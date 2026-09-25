-- ============================================================================
-- PLANO CASAL — CONVITE COM ACEITE EXPLÍCITO (opt-in)
-- ============================================================================
-- Antes: o convite era só um e-mail em `family_group_members`. O vínculo
-- acontecia sozinho — no INSERT (conta já existente) ou no primeiro acesso do
-- convidado (`orbi_claim_family_invites`). O convidado passava a ter as
-- finanças lidas pelo dono sem nunca ter dito "sim".
--
-- Agora:
--   convite (pending + token) → e-mail (Edge Function `family-invite`)
--   → /invite/accept → `orbi_family_invite_accept` → active
--
--  * `status` pending|active, com invariante active ⇔ user_id preenchido.
--    Todas as leituras de grupo/plano já filtram por `user_id`, então herança
--    de plano e leitura compartilhada só valem depois do aceite.
--  * Token de 64 hex (2 × gen_random_uuid, 244 bits). Só o SHA-256 fica no
--    banco, e a coluna não é legível pelo cliente (GRANT por coluna).
--    Validade de 7 dias; reenviar gera um token novo e mata o anterior.
--  * Aceite exige a conta do e-mail convidado, com e-mail confirmado, fora de
--    outro grupo e com o dono ainda no Casal. Tudo revalidado sob lock.
--  * Cliente não escreve mais direto na tabela: INSERT só pela RPC.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SCHEMA
-- ============================================================================
ALTER TABLE public.family_group_members
  ADD COLUMN IF NOT EXISTS status            text,
  ADD COLUMN IF NOT EXISTS invite_token_hash text,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_sent_at    timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at       timestamptz;

-- Vínculos existentes seguem ativos; pendentes antigos não têm token e
-- precisam ser reenviados pelo dono (a tela mostra "Reenviar").
UPDATE public.family_group_members
   SET status      = CASE WHEN user_id IS NULL THEN 'pending' ELSE 'active' END,
       accepted_at = CASE WHEN user_id IS NULL THEN NULL ELSE COALESCE(accepted_at, created_at) END
 WHERE status IS NULL;

ALTER TABLE public.family_group_members
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.family_group_members
  DROP CONSTRAINT IF EXISTS family_group_members_status_check,
  ADD CONSTRAINT family_group_members_status_check
    CHECK (status IN ('pending', 'active')),
  DROP CONSTRAINT IF EXISTS family_group_members_status_user_check,
  ADD CONSTRAINT family_group_members_status_user_check
    CHECK ((status = 'active') = (user_id IS NOT NULL)),
  DROP CONSTRAINT IF EXISTS family_group_members_token_hash_check,
  ADD CONSTRAINT family_group_members_token_hash_check
    CHECK (invite_token_hash IS NULL OR invite_token_hash ~ '^[0-9a-f]{64}$');

-- ON DELETE SET NULL deixaria uma linha `active` sem user_id (viola o CHECK
-- acima e trava a exclusão da conta). Conta apagada = vínculo apagado.
ALTER TABLE public.family_group_members
  DROP CONSTRAINT IF EXISTS family_group_members_user_id_fkey,
  ADD CONSTRAINT family_group_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS ux_family_group_members_invite_token
  ON public.family_group_members (invite_token_hash)
  WHERE invite_token_hash IS NOT NULL;

COMMENT ON COLUMN public.family_group_members.status IS
  'pending = convite aguardando aceite; active = parceiro vinculado (user_id preenchido).';
COMMENT ON COLUMN public.family_group_members.invite_token_hash IS
  'SHA-256 (hex) do token do link de aceite. O token em si nunca é gravado.';

-- ============================================================================
-- 2. PRIVILÉGIOS — cliente lê sem o hash e não escreve direto
-- ============================================================================
DROP POLICY IF EXISTS "family_members_insert" ON public.family_group_members;

-- Leitura só do próprio grupo. A cláusula por e-mail do JWT deixava o
-- convidado ler convites pendentes; o aceite agora passa pela RPC.
DROP POLICY IF EXISTS "family_members_select" ON public.family_group_members;
CREATE POLICY "family_members_select" ON public.family_group_members
  FOR SELECT TO authenticated
  USING (family_group_id = public.orbi_my_family_group_id());

REVOKE INSERT, UPDATE ON public.family_group_members FROM anon, authenticated;
REVOKE SELECT ON public.family_group_members FROM anon, authenticated;
GRANT SELECT (
  id, family_group_id, email, user_id, status,
  invite_expires_at, invite_sent_at, accepted_at, created_at
) ON public.family_group_members TO authenticated;

-- ============================================================================
-- 3. TRIGGER DE CONVITE — nasce pendente, sem auto-vínculo
-- ============================================================================
-- Mesmas regras da versão vigente (20260922171500): Casal no plano PRÓPRIO do
-- dono, teto de membros sob advisory lock, sem convidar a si mesmo.
CREATE OR REPLACE FUNCTION public.check_family_members_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id    uuid;
  v_owner_email text;
  v_features    jsonb;
  v_limits      jsonb;
  v_max         integer;
  v_count       integer;
BEGIN
  SELECT fg.owner_id INTO v_owner_id
    FROM public.family_groups fg
   WHERE fg.id = NEW.family_group_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Grupo familiar inexistente.' USING ERRCODE = 'P0002';
  END IF;

  v_features := public.orbi_own_active_plan(v_owner_id) -> 'features';
  v_limits   := public.orbi_own_active_plan(v_owner_id) -> 'limits';

  IF v_features IS NULL THEN PERFORM public.orbi_no_subscription('convites'); END IF;

  IF COALESCE((v_features ->> 'familia_compartilhada')::boolean, false) = false THEN
    RAISE EXCEPTION 'Compartilhamento é exclusivo do Plano Casal.'
      USING ERRCODE = 'P0005', HINT = 'plan_feature_required';
  END IF;

  v_max := public.orbi_quota_max(v_limits, 'max_membros_familia', 1);

  PERFORM public.orbi_quota_lock(v_owner_id, 'family_members');

  SELECT COUNT(*) INTO v_count
    FROM public.family_group_members
   WHERE family_group_id = NEW.family_group_id;

  IF v_max <> -1 AND v_count >= v_max THEN
    PERFORM public.orbi_quota_reject('pessoas no Plano Casal', v_max + 1);
  END IF;

  SELECT lower(u.email) INTO v_owner_email FROM auth.users u WHERE u.id = v_owner_id;

  NEW.email := lower(btrim(NEW.email));

  IF v_owner_email IS NOT NULL AND NEW.email = v_owner_email THEN
    RAISE EXCEPTION 'Você não pode convidar a si mesmo.' USING ERRCODE = 'P0001';
  END IF;

  -- Vínculo só pelo aceite (orbi_family_invite_accept).
  NEW.status      := 'pending';
  NEW.user_id     := NULL;
  NEW.accepted_at := NULL;

  RETURN NEW;
END;
$$;

-- O vínculo por igualdade de e-mail acabou: sem aceite, sem vínculo.
DROP FUNCTION IF EXISTS public.orbi_claim_family_invites();

-- ============================================================================
-- 4. HELPERS INTERNOS (sem EXECUTE para o cliente)
-- ============================================================================
-- Nome exibido de uma pessoa: apelido → nome completo do perfil → nome do cadastro.
CREATE OR REPLACE FUNCTION public.orbi_person_label(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(left(btrim(COALESCE(
           NULLIF(btrim(up.display_name), ''),
           NULLIF(btrim(up.full_name), ''),
           NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           ''
         )), 60), '')
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON up.user_id = u.id
   WHERE u.id = p_user_id
   LIMIT 1;
$$;

-- Diagnóstico de um token para um usuário. Sem efeito colateral.
-- Devolve `member_id`/`owner_id` só para uso interno (a RPC pública remove).
-- Ordem das checagens = o que a pessoa precisa resolver primeiro; o nome de
-- quem convidou só sai depois de confirmado que o link é desta conta.
CREATE OR REPLACE FUNCTION public.orbi_family_invite_resolve(p_token text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite    record;
  v_email     text;
  v_confirmed timestamptz;
  v_name      text;
BEGIN
  IF p_user_id IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT m.id, lower(btrim(m.email)) AS email, m.status, m.user_id,
         m.invite_expires_at, fg.owner_id
    INTO v_invite
    FROM public.family_group_members m
    JOIN public.family_groups fg ON fg.id = m.family_group_id
   WHERE m.invite_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF v_invite.owner_id = p_user_id THEN
    RETURN jsonb_build_object('status', 'self');
  END IF;

  IF v_invite.status = 'active' THEN
    IF v_invite.user_id = p_user_id THEN
      RETURN jsonb_build_object('status', 'accepted', 'inviter_name', public.orbi_person_label(v_invite.owner_id));
    END IF;
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT lower(btrim(u.email)), u.email_confirmed_at
    INTO v_email, v_confirmed
    FROM auth.users u
   WHERE u.id = p_user_id;

  IF v_email IS DISTINCT FROM v_invite.email THEN
    RETURN jsonb_build_object(
      'status', 'email_mismatch',
      'invited_email', CASE
        WHEN position('@' IN v_invite.email) > 1
          THEN left(v_invite.email, 1) || '•••@' || split_part(v_invite.email, '@', 2)
        ELSE '•••'
      END
    );
  END IF;

  IF v_confirmed IS NULL THEN
    RETURN jsonb_build_object('status', 'email_unconfirmed');
  END IF;

  v_name := public.orbi_person_label(v_invite.owner_id);

  IF v_invite.invite_expires_at IS NULL OR v_invite.invite_expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired', 'inviter_name', v_name);
  END IF;

  IF EXISTS (SELECT 1 FROM public.family_group_members x WHERE x.user_id = p_user_id) THEN
    RETURN jsonb_build_object('status', 'already_linked', 'inviter_name', v_name);
  END IF;

  -- Grupo próprio COM alguém (pendente ou ativo): a pessoa decide antes.
  -- Grupo próprio vazio é só uma casca e some no aceite.
  IF EXISTS (
    SELECT 1
      FROM public.family_groups g
      JOIN public.family_group_members x ON x.family_group_id = g.id
     WHERE g.owner_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('status', 'owns_group', 'inviter_name', v_name);
  END IF;

  IF NOT public.orbi_owner_shares_family(v_invite.owner_id) THEN
    RETURN jsonb_build_object('status', 'owner_inactive', 'inviter_name', v_name);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ready',
    'inviter_name', v_name,
    'expires_at', v_invite.invite_expires_at,
    'member_id', v_invite.id,
    'owner_id', v_invite.owner_id
  );
END;
$$;

-- ============================================================================
-- 5. RPC — EMITIR / REEMITIR CONVITE (chamada pela Edge Function `family-invite`)
-- ============================================================================
-- Devolve o token em claro UMA vez, para o link do e-mail. Reemitir para o
-- mesmo e-mail troca o token (o link antigo para de funcionar) e renova os 7 dias.
CREATE OR REPLACE FUNCTION public.orbi_family_invite_issue(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_email    text := lower(btrim(COALESCE(p_email, '')));
  v_group    uuid;
  v_features jsonb;
  v_member   public.family_group_members%ROWTYPE;
  v_token    text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_hash     text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  IF length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido.' USING ERRCODE = '22023';
  END IF;

  SELECT fg.id INTO v_group FROM public.family_groups fg WHERE fg.owner_id = v_uid;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Crie o Plano Casal antes de convidar.' USING ERRCODE = 'P0002';
  END IF;

  -- Reenvio também exige o Casal no plano próprio (o trigger só roda no INSERT).
  v_features := public.orbi_own_active_plan(v_uid) -> 'features';
  IF v_features IS NULL THEN PERFORM public.orbi_no_subscription('convites'); END IF;
  IF COALESCE((v_features ->> 'familia_compartilhada')::boolean, false) = false THEN
    RAISE EXCEPTION 'Compartilhamento é exclusivo do Plano Casal.'
      USING ERRCODE = 'P0005', HINT = 'plan_feature_required';
  END IF;

  PERFORM public.orbi_quota_lock(v_uid, 'family_members');

  v_hash := encode(sha256(convert_to(v_token, 'UTF8')), 'hex');

  SELECT * INTO v_member
    FROM public.family_group_members m
   WHERE m.family_group_id = v_group
     AND lower(btrim(m.email)) = v_email;

  IF FOUND THEN
    IF v_member.status = 'active' THEN
      RAISE EXCEPTION 'Esta pessoa já faz parte do seu Plano Casal.' USING ERRCODE = '23505';
    END IF;

    UPDATE public.family_group_members
       SET invite_token_hash = v_hash,
           invite_expires_at = now() + interval '7 days',
           invite_sent_at    = now()
     WHERE id = v_member.id
    RETURNING * INTO v_member;
  ELSE
    INSERT INTO public.family_group_members
      (family_group_id, email, invite_token_hash, invite_expires_at, invite_sent_at)
    VALUES
      (v_group, v_email, v_hash, now() + interval '7 days', now())
    RETURNING * INTO v_member;
  END IF;

  RETURN jsonb_build_object(
    'member_id',    v_member.id,
    'email',        v_member.email,
    'status',       v_member.status,
    'expires_at',   v_member.invite_expires_at,
    'token',        v_token,
    'inviter_name', public.orbi_person_label(v_uid)
  );
END;
$$;

-- ============================================================================
-- 6. RPC — LER O CONVITE (tela /invite/accept, antes do "sim")
-- ============================================================================
CREATE OR REPLACE FUNCTION public.orbi_family_invite_preview(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.orbi_family_invite_resolve(p_token, auth.uid()) - 'member_id' - 'owner_id';
$$;

-- ============================================================================
-- 7. RPC — ACEITAR (pending → active)
-- ============================================================================
-- Locks na mesma ordem das outras escritas do grupo: dono (family_members),
-- depois quem entra (family_join). Revalida tudo sob lock — reenvio, remoção
-- ou outro aceite simultâneo não passam.
CREATE OR REPLACE FUNCTION public.orbi_family_invite_accept(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_check  jsonb;
  v_owner  uuid;
  v_member uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  v_check := public.orbi_family_invite_resolve(p_token, v_uid);
  IF v_check ->> 'status' <> 'ready' THEN
    RETURN v_check - 'member_id' - 'owner_id';
  END IF;

  v_owner := (v_check ->> 'owner_id')::uuid;

  PERFORM public.orbi_quota_lock(v_owner, 'family_members');
  PERFORM public.orbi_quota_lock(v_uid, 'family_join');

  v_check := public.orbi_family_invite_resolve(p_token, v_uid);
  IF v_check ->> 'status' <> 'ready' THEN
    RETURN v_check - 'member_id' - 'owner_id';
  END IF;

  v_member := (v_check ->> 'member_id')::uuid;

  -- Casca vazia de Plano Casal próprio: sairia como "grupo mais antigo" em
  -- orbi_family_group_of e esconderia o vínculo novo.
  DELETE FROM public.family_groups g
   WHERE g.owner_id = v_uid
     AND NOT EXISTS (SELECT 1 FROM public.family_group_members x WHERE x.family_group_id = g.id);

  UPDATE public.family_group_members
     SET status            = 'active',
         user_id           = v_uid,
         accepted_at       = now(),
         invite_expires_at = NULL
   WHERE id = v_member
     AND status = 'pending';

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'family_invite_accepted', 'family_group_members', v_member,
          jsonb_build_object('owner_id', v_owner));

  RETURN jsonb_build_object('status', 'accepted', 'inviter_name', v_check ->> 'inviter_name');
END;
$$;

-- ============================================================================
-- 8. GRANTS
-- ============================================================================
REVOKE ALL ON FUNCTION public.orbi_person_label(uuid)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_family_invite_resolve(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_person_label(uuid)                TO service_role;
GRANT EXECUTE ON FUNCTION public.orbi_family_invite_resolve(text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.orbi_family_invite_issue(text)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_family_invite_preview(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_family_invite_accept(text)  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_family_invite_issue(text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_family_invite_preview(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_family_invite_accept(text)  TO authenticated;

COMMENT ON FUNCTION public.orbi_family_invite_issue(text) IS
  'Plano Casal: cria (ou renova) o convite pendente do e-mail e devolve o token em claro uma única vez. Usada pela Edge Function family-invite.';
COMMENT ON FUNCTION public.orbi_family_invite_preview(text) IS
  'Plano Casal: status do convite para o usuário logado (ready, accepted, expired, email_mismatch, ...). Sem efeito colateral.';
COMMENT ON FUNCTION public.orbi_family_invite_accept(text) IS
  'Plano Casal: aceite explícito. pending → active, com e-mail confirmado da conta convidada e dono ainda no Casal.';
COMMENT ON TABLE public.family_group_members IS
  'Plano Casal: convite (pending, token com hash) e vínculo (active, user_id) do parceiro.';

COMMIT;

NOTIFY pgrst, 'reload schema';
