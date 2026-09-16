-- ============================================================================
-- CHECKOUT QUEBRADO: service_role SEM PRIVILÉGIO DE TABELA + HARDENING DE RPCs
-- ============================================================================
-- Achados que este arquivo corrige:
--
--  [A] `service_role` não tinha NENHUM GRANT nas tabelas de domínio de `public`
--      (subscription_plans, user_subscriptions, payment_history, user_profiles,
--      asaas_webhook_events, ...). `BYPASSRLS` e a policy `orbi_service_bypass`
--      (20260910000000) só dispensam a RLS — o privilégio de tabela continua
--      obrigatório. Efeito em produção: `asaas-create-payment` levava
--      "permission denied for table subscription_plans" (403 no PostgREST)
--      ANTES de chegar ao Asaas; o webhook e o sync também não gravavam.
--      Tabelas criadas depois (budgets/goals/rate_limit_counters) funcionavam
--      só porque receberam GRANT explícito na própria migration.
--      Correção: GRANT DML + DEFAULT PRIVILEGES, para tabela nova não regredir.
--
--  [B] Funções de trigger com EXECUTE para PUBLIC/anon/authenticated
--      (lint 0028/0029). O Postgres só confere EXECUTE no CREATE TRIGGER:
--      o grant só expunha `/rest/v1/rpc/<trigger_fn>`. Mesmo padrão de
--      20260915161536_premium_modules_trigger_exec_hardening, agora geral.
--
--  [C] SECURITY DEFINER executável por `anon` via grant implícito de PUBLIC
--      (orbi_family_user_ids, orbi_active_plan_*, orbi_claim_family_invites...).
--      O anônimo não chama RPC nenhuma: só lê a vitrine `subscription_plans`.
--      `authenticated` mantém o que já tinha (policies de RLS dependem disso).
--
--  [D] IDOR em RPCs com `p_user_id` do payload, sem `require_self`:
--      `get_user_plan(p_user_id)` → `COALESCE(p_user_id, auth.uid())`;
--      `orbi_active_plan_features/limits(p_user_id)` e
--      `user_active_plan_limits(p_user_id)` → qualquer usuário lia plano,
--      features e limites de qualquer outro tenant. Nenhuma é chamada pelo
--      front (verificado em src/): são internas de triggers/RPCs SECURITY
--      DEFINER (rodam como owner, não precisam do grant do chamador).
--      `refresh_frequent_merchants()` → qualquer usuário disparava
--      REFRESH MATERIALIZED VIEW em loop (DoS). Também sem uso no front.
--
--  [E] 11 funções sem `search_path` fixo (lint 0011, CWE-426).
-- ============================================================================

-- ============================================================================
-- 1. [A] PRIVILÉGIOS DO service_role (Edge Functions / webhook Asaas)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE NOTICE 'service_role inexistente neste banco: bloco ignorado';
    RETURN;
  END IF;

  GRANT USAGE ON SCHEMA public TO service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
  GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO service_role;

  -- Tabela/sequence nova criada pelo postgres já nasce acessível ao backend.
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO service_role;
END;
$$;

-- ============================================================================
-- 2. [B] + [C] SUPERFÍCIE DE EXECUTE EM FUNÇÕES DE public
-- ============================================================================
-- Funções de extensão (pg_trgm está em public) são puladas: não são nossas.

DO $$
DECLARE
  fn         RECORD;
  v_triggers int := 0;
  v_secdef   int := 0;
BEGIN
  FOR fn IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           p.prosecdef,
           p.prorettype = 'trigger'::regtype AS is_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
            SELECT 1 FROM pg_depend d
            WHERE d.objid = p.oid
              AND d.classid = 'pg_proc'::regclass
              AND d.deptype = 'e'
          )
  LOOP
    IF fn.is_trigger THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
        fn.proname, fn.args);
      v_triggers := v_triggers + 1;

    ELSIF fn.prosecdef THEN
      -- Preserva o acesso atual de `authenticated` (inclusive o herdado de
      -- PUBLIC) ANTES de cortar PUBLIC; só o anônimo perde.
      IF has_function_privilege('authenticated', fn.oid, 'EXECUTE') THEN
        EXECUTE format(
          'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
          fn.proname, fn.args);
      END IF;

      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
        fn.proname, fn.args);
      v_secdef := v_secdef + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'EXECUTE revogado: % trigger(s), % SECURITY DEFINER sem anon', v_triggers, v_secdef;
END;
$$;

-- Novas funções não nascem executáveis por PUBLIC (já existia em
-- sql-editor/orbi_security_hardening; repetido para o script ser autossuficiente).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ============================================================================
-- 3. [D] RPCs INTERNAS COM p_user_id / DoS — fora da API pública
-- ============================================================================

SELECT public.orbi_exec_if_tables(
  ARRAY['public.user_subscriptions'],
  ARRAY[
    $cmd$REVOKE EXECUTE ON FUNCTION public.get_user_plan(uuid) FROM PUBLIC, anon, authenticated$cmd$,
    $cmd$REVOKE EXECUTE ON FUNCTION public.orbi_active_plan_features(uuid) FROM PUBLIC, anon, authenticated$cmd$,
    $cmd$REVOKE EXECUTE ON FUNCTION public.orbi_active_plan_limits(uuid) FROM PUBLIC, anon, authenticated$cmd$,
    $cmd$REVOKE EXECUTE ON FUNCTION public.user_active_plan_limits(uuid) FROM PUBLIC, anon, authenticated$cmd$
  ]);

DO $$
BEGIN
  IF to_regprocedure('public.refresh_frequent_merchants()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.refresh_frequent_merchants() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_user_plan(uuid) IS
  'INTERNA (sem EXECUTE para authenticated): aceitava p_user_id arbitrário (IDOR). Front usa get_my_subscription_status().';

-- ============================================================================
-- 4. [E] search_path FIXO NAS FUNÇÕES RESTANTES
-- ============================================================================

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
          ))
      AND NOT EXISTS (
            SELECT 1 FROM pg_depend d
            WHERE d.objid = p.oid
              AND d.classid = 'pg_proc'::regclass
              AND d.deptype = 'e'
          )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
                     fn.proname, fn.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'search_path não fixado em %(%): %', fn.proname, fn.args, SQLERRM;
    END;
  END LOOP;
END;
$$;
