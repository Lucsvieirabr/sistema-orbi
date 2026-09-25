-- ============================================================================
-- PLANO CASAL — FOTO DE QUEM CONVIDOU NA TELA DE ACEITE
-- ============================================================================
-- A tela /invite/accept mostrava só as iniciais de quem convidou:
--   1. `orbi_family_invite_preview` não devolvia o caminho da foto;
--   2. mesmo com o caminho, o bucket privado `avatars` só libera leitura para o
--      dono e para o grupo JÁ vinculado (`orbi_family_user_ids`). Antes do
--      aceite o convidado não está no grupo → signed URL negada.
--
-- Agora a foto do dono do grupo fica legível para quem tem um convite dele
-- PENDENTE e NÃO EXPIRADO endereçado ao próprio e-mail confirmado — o mesmo
-- critério que a tela usa para mostrar o convite. Expirou, foi cancelado ou
-- aceito por outra conta: a leitura some junto.
-- ============================================================================

BEGIN;

-- Quem convidou o usuário atual (convite pendente e válido para o e-mail dele).
-- DEFINER: o convidado não lê family_groups/family_group_members. Só devolve
-- boolean — nada além de "esta pessoa me convidou".
CREATE OR REPLACE FUNCTION public.orbi_is_pending_inviter(p_owner_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.family_groups fg
      JOIN public.family_group_members m ON m.family_group_id = fg.id
      JOIN auth.users u ON u.id = auth.uid()
     WHERE fg.owner_id::text = p_owner_id
       AND fg.owner_id <> auth.uid()
       AND m.status = 'pending'
       AND m.invite_expires_at > now()
       AND u.email_confirmed_at IS NOT NULL
       AND lower(btrim(m.email)) = lower(btrim(u.email))
  );
$$;

REVOKE ALL ON FUNCTION public.orbi_is_pending_inviter(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_is_pending_inviter(text) TO authenticated, service_role;

-- Policy do bucket: dono + grupo vinculado + quem convidou (convite pendente).
CREATE OR REPLACE FUNCTION public.orbi_can_read_avatar(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       split_part(p_object_name, '/', 1) = auth.uid()::text
       OR split_part(p_object_name, '/', 1) = ANY (
            SELECT u::text FROM unnest(public.orbi_family_user_ids()) AS u
          )
       OR public.orbi_is_pending_inviter(split_part(p_object_name, '/', 1))
     );
$$;

-- Diagnóstico do convite: igual à versão de 20260925180000, mais
-- `inviter_avatar_path` no estado `ready` (o único em que a tela mostra a foto).
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
    'inviter_avatar_path', (
      SELECT up.avatar_path FROM public.user_profiles up WHERE up.user_id = v_invite.owner_id LIMIT 1
    ),
    'expires_at', v_invite.invite_expires_at,
    'member_id', v_invite.id,
    'owner_id', v_invite.owner_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.orbi_family_invite_resolve(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_family_invite_resolve(text, uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
