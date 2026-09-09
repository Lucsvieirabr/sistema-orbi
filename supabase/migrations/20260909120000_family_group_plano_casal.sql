-- ============================================================================
-- PLANO CASAL (MVP) — 2 usuários compartilhando leitura dos dados financeiros
-- ----------------------------------------------------------------------------
-- Modelo cru e direto:
--   * 1 family_group por owner (unique owner_id)
--   * convite = INSERT do e-mail em family_group_members (sem JWT, sem e-mail,
--     sem página de aceite). Quando o convidado abre o app, orbi_claim_family_invites()
--     vincula o user_id dele pela igualdade de e-mail.
--   * compartilhamento é SOMENTE LEITURA (policy SELECT adicional, permissiva).
--     Escrita continua restrita ao dono da linha (policies existentes intactas).
-- ============================================================================

-- ---------------------------------------------------------------- TABELAS ---
CREATE TABLE IF NOT EXISTS public.family_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_groups_owner_unique UNIQUE (owner_id)
);

CREATE TABLE IF NOT EXISTS public.family_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_group_members_email_unique UNIQUE (family_group_id, email)
);

CREATE INDEX IF NOT EXISTS idx_family_group_members_user ON public.family_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_group_members_email ON public.family_group_members(lower(email));

-- --------------------------------------------------------------- FUNÇÕES ---
-- Grupo do usuário atual (como owner ou como membro vinculado).
CREATE OR REPLACE FUNCTION public.orbi_my_family_group_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gid FROM (
    SELECT fg.id AS gid FROM public.family_groups fg WHERE fg.owner_id = auth.uid()
    UNION
    SELECT m.family_group_id FROM public.family_group_members m WHERE m.user_id = auth.uid()
  ) s
  LIMIT 1;
$$;

-- Todos os user_ids do grupo (owner + membros vinculados). Sempre inclui o próprio user.
CREATE OR REPLACE FUNCTION public.orbi_family_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT array_agg(DISTINCT uid)
      FROM (
        SELECT fg.owner_id AS uid
        FROM public.family_groups fg
        WHERE fg.id = public.orbi_my_family_group_id()
        UNION
        SELECT m.user_id
        FROM public.family_group_members m
        WHERE m.family_group_id = public.orbi_my_family_group_id()
          AND m.user_id IS NOT NULL
        UNION
        SELECT auth.uid()
      ) t
      WHERE uid IS NOT NULL
    ),
    ARRAY[auth.uid()]
  );
$$;

-- Vincula convites pendentes ao usuário atual (match por e-mail). Idempotente.
CREATE OR REPLACE FUNCTION public.orbi_claim_family_invites()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(COALESCE(auth.jwt() ->> 'email', ''));
BEGIN
  IF v_email = '' OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.family_group_members m
     SET user_id = auth.uid()
   WHERE m.user_id IS NULL
     AND lower(m.email) = v_email;
END;
$$;

-- Limite duro: 1 parceiro por grupo (plano = 2 pessoas) + não convidar a si mesmo.
CREATE OR REPLACE FUNCTION public.check_family_members_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_owner_email text;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.family_group_members
   WHERE family_group_id = NEW.family_group_id;

  IF v_count >= 1 THEN
    RAISE EXCEPTION 'Plano Casal permite no máximo 2 pessoas.';
  END IF;

  SELECT lower(u.email) INTO v_owner_email
    FROM public.family_groups fg
    JOIN auth.users u ON u.id = fg.owner_id
   WHERE fg.id = NEW.family_group_id;

  IF v_owner_email IS NOT NULL AND lower(NEW.email) = v_owner_email THEN
    RAISE EXCEPTION 'Você não pode convidar a si mesmo.';
  END IF;

  NEW.email := lower(trim(NEW.email));

  -- Vincula na hora se a pessoa já tiver conta no Orbi.
  IF NEW.user_id IS NULL THEN
    SELECT u.id INTO NEW.user_id FROM auth.users u WHERE lower(u.email) = NEW.email LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_family_members_limit ON public.family_group_members;
CREATE TRIGGER trg_check_family_members_limit
BEFORE INSERT ON public.family_group_members
FOR EACH ROW EXECUTE FUNCTION public.check_family_members_limit();

-- ------------------------------------------------------------------- RLS ---
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_groups_select" ON public.family_groups;
CREATE POLICY "family_groups_select" ON public.family_groups
  FOR SELECT USING (owner_id = auth.uid() OR id = public.orbi_my_family_group_id());

DROP POLICY IF EXISTS "family_groups_insert" ON public.family_groups;
CREATE POLICY "family_groups_insert" ON public.family_groups
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "family_groups_delete" ON public.family_groups;
CREATE POLICY "family_groups_delete" ON public.family_groups
  FOR DELETE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "family_members_select" ON public.family_group_members;
CREATE POLICY "family_members_select" ON public.family_group_members
  FOR SELECT USING (
    family_group_id = public.orbi_my_family_group_id()
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "family_members_insert" ON public.family_group_members;
CREATE POLICY "family_members_insert" ON public.family_group_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.family_groups fg WHERE fg.id = family_group_id AND fg.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "family_members_delete" ON public.family_group_members;
CREATE POLICY "family_members_delete" ON public.family_group_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.family_groups fg WHERE fg.id = family_group_id AND fg.owner_id = auth.uid())
  );

-- ------------------------------------- LEITURA COMPARTILHADA (ADITIVA) -----
-- Policies permissivas: fazem OR com as policies existentes de dono da linha.
DROP POLICY IF EXISTS "family_read_accounts" ON public.accounts;
CREATE POLICY "family_read_accounts" ON public.accounts
  FOR SELECT USING (user_id = ANY (public.orbi_family_user_ids()));

DROP POLICY IF EXISTS "family_read_transactions" ON public.transactions;
CREATE POLICY "family_read_transactions" ON public.transactions
  FOR SELECT USING (user_id = ANY (public.orbi_family_user_ids()));

DROP POLICY IF EXISTS "family_read_credit_cards" ON public.credit_cards;
CREATE POLICY "family_read_credit_cards" ON public.credit_cards
  FOR SELECT USING (user_id = ANY (public.orbi_family_user_ids()));

DROP POLICY IF EXISTS "family_read_categories" ON public.categories;
CREATE POLICY "family_read_categories" ON public.categories
  FOR SELECT USING (user_id = ANY (public.orbi_family_user_ids()));

DROP POLICY IF EXISTS "family_read_people" ON public.people;
CREATE POLICY "family_read_people" ON public.people
  FOR SELECT USING (user_id = ANY (public.orbi_family_user_ids()));

DROP POLICY IF EXISTS "family_read_series" ON public.series;
CREATE POLICY "family_read_series" ON public.series
  FOR SELECT USING (user_id = ANY (public.orbi_family_user_ids()));

-- ---------------------------------------------------------------- GRANTS ---
GRANT SELECT, INSERT, DELETE ON public.family_groups TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.family_group_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_my_family_group_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_family_user_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_claim_family_invites() TO authenticated;

COMMENT ON TABLE public.family_groups IS 'Plano Casal: 1 grupo por owner, máximo 2 pessoas.';
COMMENT ON TABLE public.family_group_members IS 'Convite cru: e-mail inserido direto; user_id é vinculado no primeiro acesso do convidado.';
