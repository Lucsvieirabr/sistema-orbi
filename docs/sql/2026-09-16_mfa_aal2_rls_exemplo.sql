-- ============================================================================
--  ORBI — EXEMPLO: tabela sensível acessível SÓ com sessão aal2 (MFA verificado)
-- ----------------------------------------------------------------------------
--  NÃO é migration. Modelo para copiar quando uma tabela precisar de MFA.
--  Pré-requisito: supabase/migrations/20260916165204_mfa_assurance_helpers.sql
--
--  Como funciona
--   - Login com senha (ou link de e-mail) gera JWT com "aal": "aal1".
--   - `mfa.challengeAndVerify` troca por um JWT com "aal": "aal2".
--   - O claim é assinado pelo GoTrue: o cliente não consegue forjar aal2.
--   - Policies abaixo leem `auth.jwt()->>'aal'`. Com aal1: SELECT volta 0 linhas,
--     INSERT/UPDATE falham com 42501 ("new row violates row-level security").
--
--  Atenção: o JWT vale até expirar (jwt_expiry, 1 h). Desativar o MFA não
--  rebaixa tokens aal2 já emitidos; eles expiram sozinhos.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.billing_info (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_name    text        NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 120),
  tax_id        text        NOT NULL CHECK (tax_id ~ '^([0-9]{11}|[0-9]{14})$'),   -- CPF ou CNPJ, só dígitos
  billing_email text        CHECK (billing_email IS NULL OR char_length(billing_email) <= 254),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.billing_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_info FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.billing_info FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_info TO authenticated;
GRANT ALL ON public.billing_info TO service_role;  -- GOTCHA #6: RLS ≠ privilégio

-- ----------------------------------------------------------------------------
-- VARIANTE A (pedida): dono + aal2 obrigatório, tenha ou não ativado MFA.
-- Quem não ativou MFA simplesmente não acessa — a UI deve pedir a ativação.
-- `(SELECT ...)` faz o Postgres avaliar a função 1x por query, não por linha.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS billing_info_select_owner_aal2 ON public.billing_info;
CREATE POLICY billing_info_select_owner_aal2
  ON public.billing_info
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
  );

DROP POLICY IF EXISTS billing_info_insert_owner_aal2 ON public.billing_info;
CREATE POLICY billing_info_insert_owner_aal2
  ON public.billing_info
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
  );

DROP POLICY IF EXISTS billing_info_update_owner_aal2 ON public.billing_info;
CREATE POLICY billing_info_update_owner_aal2
  ON public.billing_info
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
  );

DROP POLICY IF EXISTS billing_info_delete_owner_aal2 ON public.billing_info;
CREATE POLICY billing_info_delete_owner_aal2
  ON public.billing_info
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
  );

-- ----------------------------------------------------------------------------
-- VARIANTE B (reaproveitável em tabelas existentes): camada RESTRICTIVE que só
-- cobra aal2 de quem ATIVOU MFA. Soma (AND) com as policies de dono já
-- existentes, sem reescrevê-las. Descomente para usar em vez da A.
-- ----------------------------------------------------------------------------
-- CREATE POLICY billing_info_mfa_gate
--   ON public.billing_info
--   AS RESTRICTIVE
--   FOR ALL
--   TO authenticated
--   USING ((SELECT public.orbi_mfa_satisfied()))
--   WITH CHECK ((SELECT public.orbi_mfa_satisfied()));

-- Dono imutável: sem isto um UPDATE poderia "doar" a linha a outro user_id
-- (a WITH CHECK barra, mas o trigger deixa o erro explícito e barato).
CREATE OR REPLACE FUNCTION public.billing_info_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'O dono do registro não pode ser alterado.' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_info_guard ON public.billing_info;
CREATE TRIGGER billing_info_guard
  BEFORE INSERT OR UPDATE ON public.billing_info
  FOR EACH ROW EXECUTE FUNCTION public.billing_info_guard();

COMMIT;

-- ============================================================================
--  VALIDAÇÃO (SQL Editor, dentro de uma transação descartável)
--  Troque <USER_UUID> por um usuário real de teste.
-- ============================================================================
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--
--   -- 1) Sessão aal1 (só senha): nada visível, escrita recusada.
--   SELECT set_config('request.jwt.claims',
--     '{"sub":"<USER_UUID>","role":"authenticated","aal":"aal1"}', true);
--   SELECT count(*) FROM public.billing_info;                          -- 0
--   INSERT INTO public.billing_info (user_id, legal_name, tax_id)
--     VALUES ('<USER_UUID>', 'Teste', '12345678901');                  -- ERRO 42501
--
--   -- 2) Sessão aal2 (código TOTP validado): acesso normal ao próprio registro.
--   SELECT set_config('request.jwt.claims',
--     '{"sub":"<USER_UUID>","role":"authenticated","aal":"aal2"}', true);
--   INSERT INTO public.billing_info (user_id, legal_name, tax_id)
--     VALUES ('<USER_UUID>', 'Teste', '12345678901');                  -- OK
--   SELECT count(*) FROM public.billing_info;                          -- 1
-- ROLLBACK;
