-- ============================================================================
-- RATE LIMIT v2 — contador genérico por IDENTIDADE (user_id OU IP OU chave)
-- ----------------------------------------------------------------------------
-- Problema da v1 (20260909000001_edge_rate_limiting.sql):
--   `edge_rate_limits.user_id UUID NOT NULL REFERENCES auth.users` só permitia
--   limitar quem já estava autenticado. Endpoints anônimos (webhook do Asaas,
--   preflight de checkout, qualquer rota antes do JWT) ficavam sem teto, e
--   um atacante sem conta pagava zero para inundar a Edge Function.
--
-- v2: a chave vira TEXT com prefixo de escopo ("user:<uuid>", "ip:<addr>",
--     "sub:<asaas_id>"). Mesmo algoritmo de janela fixa, mesmo UPSERT atômico
--     numa única ida ao banco, mesma exclusividade de service_role.
--
-- FAIL-FAST: a decisão acontece na borda (Edge Function) antes de qualquer
-- trabalho pesado — parsing de PDF, chamada ao Asaas, varredura de ML.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  identity     TEXT        NOT NULL,
  bucket       TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER     NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identity, bucket)
);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy para authenticated/anon: a tabela é invisível ao cliente.
REVOKE ALL ON public.rate_limit_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_counters TO service_role;

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_updated
  ON public.rate_limit_counters (updated_at);

-- ----------------------------------------------------------------------------
-- Migra os contadores da v1, se a tabela antiga existir.
-- ----------------------------------------------------------------------------
DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'edge_rate_limits'
  ) THEN
    INSERT INTO public.rate_limit_counters (identity, bucket, window_start, hits, updated_at)
    SELECT 'user:' || user_id::text, bucket, window_start, hits, updated_at
      FROM public.edge_rate_limits
    ON CONFLICT (identity, bucket) DO NOTHING;
  END IF;
END
$migrate$;

-- ----------------------------------------------------------------------------
-- consume_rate_limit_key: incrementa e decide numa única ida ao banco.
-- Janela fixa alinhada ao relógio — previsível, sem varredura de histórico.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_rate_limit_key(
  p_identity       TEXT,
  p_bucket         TEXT,
  p_limit          INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now          TIMESTAMPTZ := NOW();
  v_window       INTEGER     := GREATEST(COALESCE(p_window_seconds, 60), 1);
  v_window_start TIMESTAMPTZ;
  v_hits         INTEGER;
BEGIN
  IF p_identity IS NULL OR btrim(p_identity) = '' OR p_bucket IS NULL THEN
    RAISE EXCEPTION 'identity e bucket são obrigatórios' USING ERRCODE = '22004';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / v_window) * v_window
  );

  INSERT INTO public.rate_limit_counters AS rlc (identity, bucket, window_start, hits, updated_at)
  VALUES (left(p_identity, 200), p_bucket, v_window_start, 1, v_now)
  ON CONFLICT (identity, bucket) DO UPDATE
    SET hits = CASE
                 WHEN rlc.window_start < v_window_start THEN 1
                 ELSE rlc.hits + 1
               END,
        window_start = GREATEST(rlc.window_start, v_window_start),
        updated_at = v_now
  RETURNING rlc.hits INTO v_hits;

  IF v_hits > p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'hits', v_hits,
      'limit', p_limit,
      'remaining', 0,
      'reset_at', v_window_start + make_interval(secs => v_window),
      'retry_after_seconds',
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_window_start + make_interval(secs => v_window) - v_now)))::int)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'hits', v_hits,
    'limit', p_limit,
    'remaining', GREATEST(0, p_limit - v_hits),
    'reset_at', v_window_start + make_interval(secs => v_window)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit_key(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit_key(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.consume_rate_limit_key(TEXT, TEXT, INTEGER, INTEGER) IS
  'Janela fixa por (identity, bucket). identity usa prefixo de escopo: user:<uuid> | ip:<addr>. Exclusiva de service_role.';

-- ----------------------------------------------------------------------------
-- Compatibilidade: a assinatura antiga continua existindo e delega para a nova
-- (deploy de Edge Function e migration não são atômicos entre si).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_user_id        UUID,
  p_bucket         TEXT,
  p_limit          INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.consume_rate_limit_key('user:' || p_user_id::text, p_bucket, p_limit, p_window_seconds);
$$;

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO service_role;

-- A tabela v1 vira redundante depois do backfill.
DROP TABLE IF EXISTS public.edge_rate_limits;
DROP FUNCTION IF EXISTS public.cleanup_edge_rate_limits(INTEGER);

-- ----------------------------------------------------------------------------
-- Higiene: remove janelas antigas (chamar via cron/pg_cron ou manualmente).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_counters(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limit_counters
  WHERE updated_at < NOW() - make_interval(hours => GREATEST(p_older_than_hours, 1));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_counters(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_counters(INTEGER) TO service_role;

-- ----------------------------------------------------------------------------
-- Compatibilidade com o zero-trust (20260910000000_zero_trust_rls_force):
-- a tabela nova nasce depois daquela migration, então recebe aqui o mesmo
-- tratamento: FORCE RLS + válvula explícita para as roles de infraestrutura.
-- Sem a policy de bypass, a própria RPC SECURITY DEFINER (que roda como o dono
-- da tabela) deixaria de enxergar as linhas sob FORCE.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS orbi_service_bypass ON public.rate_limit_counters;
CREATE POLICY orbi_service_bypass ON public.rate_limit_counters
  AS PERMISSIVE FOR ALL
  TO postgres, service_role, supabase_admin
  USING (true) WITH CHECK (true);

ALTER TABLE public.rate_limit_counters FORCE ROW LEVEL SECURITY;

-- Substitui edge_rate_limits por rate_limit_counters na lista canônica de
-- tabelas que a varredura de zero-trust percorre.
DO $tenant$
BEGIN
  IF to_regprocedure('public.orbi_tenant_tables()') IS NOT NULL THEN
    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION public.orbi_tenant_tables()
      RETURNS text[]
      LANGUAGE sql
      IMMUTABLE
      AS 'SELECT ARRAY[
        ''accounts'', ''categories'', ''credit_cards'', ''people'', ''series'', ''transactions'',
        ''notes'', ''bug_reports'', ''user_learned_patterns'', ''user_profiles'',
        ''user_subscriptions'', ''user_usage'', ''payment_history'', ''admin_users'',
        ''audit_logs'', ''asaas_webhook_events'', ''subscription_plans'',
        ''merchants_dictionary'', ''rate_limit_counters'', ''family_groups'',
        ''family_group_members''
      ]';
    $ddl$;
  END IF;
END
$tenant$;

NOTIFY pgrst, 'reload schema';

COMMIT;
