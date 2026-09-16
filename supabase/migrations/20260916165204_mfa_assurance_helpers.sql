-- ============================================================================
-- MFA (TOTP) — helpers de nível de garantia da sessão (AAL) para RLS e RPCs
-- ============================================================================
-- O front (App.tsx + src/lib/auth/assurance.ts) só decide a TELA: com TOTP
-- verificado e sessão aal1 o usuário vai para /login/verificacao. Quem chama a
-- API direto com o JWT aal1 pula essa tela — por isso dado sensível precisa de
-- gate no banco, lendo o claim `aal` do JWT assinado pelo GoTrue.
--
-- Uso em policy (camada RESTRICTIVE, soma-se às policies de dono existentes):
--   CREATE POLICY <tabela>_mfa_gate ON public.<tabela> AS RESTRICTIVE
--     FOR ALL TO authenticated
--     USING ((SELECT public.orbi_mfa_satisfied()))
--     WITH CHECK ((SELECT public.orbi_mfa_satisfied()));
--
-- Uso em RPC SECURITY DEFINER sensível:
--   PERFORM public.orbi_require_mfa_session();
--
-- Exemplo completo (tabela billing_info, aal2 obrigatório):
--   docs/sql/2026-09-16_mfa_aal2_rls_exemplo.sql
-- ============================================================================

-- Nível da sessão atual: 'aal1' | 'aal2'. Sem JWT (service_role/cron) → 'aal1'.
CREATE OR REPLACE FUNCTION public.orbi_session_aal()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN (auth.jwt() ->> 'aal') = 'aal2' THEN 'aal2' ELSE 'aal1' END;
$$;

-- O usuário da sessão tem ao menos um fator MFA verificado?
-- DEFINER: `auth.mfa_factors` não é legível por `authenticated`. Só olha o
-- próprio auth.uid() — não recebe parâmetro, não vira oráculo de outra conta.
CREATE OR REPLACE FUNCTION public.orbi_mfa_enrolled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM auth.mfa_factors f
     WHERE f.user_id = auth.uid()
       AND f.status = 'verified'
  );
$$;

-- "Quem ativou MFA precisa estar em aal2; quem não ativou passa."
-- Para exigir MFA de TODOS (ex.: billing_info), use `orbi_session_aal() = 'aal2'`.
CREATE OR REPLACE FUNCTION public.orbi_mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT public.orbi_session_aal() = 'aal2' OR NOT public.orbi_mfa_enrolled();
$$;

-- Gate com erro tipado. 42501 = insufficient_privilege; o HINT deixa o front
-- mandar para a tela de código em vez de mostrar erro genérico.
CREATE OR REPLACE FUNCTION public.orbi_require_mfa_session()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.orbi_mfa_satisfied() THEN
    RAISE EXCEPTION 'Confirme o código do aplicativo autenticador para continuar.'
      USING ERRCODE = '42501', HINT = 'insufficient_aal';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.orbi_session_aal() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_mfa_enrolled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_mfa_satisfied() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_require_mfa_session() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.orbi_session_aal() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orbi_mfa_enrolled() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orbi_mfa_satisfied() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orbi_require_mfa_session() TO authenticated, service_role;

COMMENT ON FUNCTION public.orbi_session_aal() IS
  'AAL da sessão (claim aal do JWT): aal1 = senha/link; aal2 = MFA verificado nesta sessão.';
COMMENT ON FUNCTION public.orbi_mfa_satisfied() IS
  'true se a sessão é aal2 ou se o usuário não tem fator MFA verificado. Para policies RESTRICTIVE.';
