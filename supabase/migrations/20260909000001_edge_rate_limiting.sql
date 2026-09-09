-- ============================================================================
-- RATE LIMITING PARA EDGE FUNCTIONS
-- ============================================================================
-- Endpoints públicos/caros (extract-pdf-text, classify-transactions,
-- search-logo, get-company-logo) não tinham nenhum limite. Um token válido
-- bastava para esgotar CPU da função e a cota paga do logo.dev.
-- Contador em janela fixa, atômico via UPSERT, escrito só por service_role.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket       TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER     NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, bucket)
);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy para `authenticated`: a tabela é invisível ao cliente.
-- Só service_role (Edge Functions) escreve, através da RPC abaixo.
REVOKE ALL ON public.edge_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edge_rate_limits TO service_role;

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_window
  ON public.edge_rate_limits (window_start);

-- ----------------------------------------------------------------------------
-- consume_rate_limit: incrementa e decide, numa única ida ao banco.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_user_id        UUID,
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
  v_window_start TIMESTAMPTZ;
  v_hits         INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_bucket IS NULL THEN
    RAISE EXCEPTION 'user_id e bucket são obrigatórios';
  END IF;

  -- Janela fixa alinhada ao relógio: previsível e sem varredura de histórico.
  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / GREATEST(p_window_seconds, 1))
    * GREATEST(p_window_seconds, 1)
  );

  INSERT INTO public.edge_rate_limits AS erl (user_id, bucket, window_start, hits, updated_at)
  VALUES (p_user_id, p_bucket, v_window_start, 1, v_now)
  ON CONFLICT (user_id, bucket) DO UPDATE
    SET hits = CASE
                 WHEN erl.window_start < v_window_start THEN 1
                 ELSE erl.hits + 1
               END,
        window_start = GREATEST(erl.window_start, v_window_start),
        updated_at = v_now
  RETURNING erl.hits INTO v_hits;

  IF v_hits > p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'hits', v_hits,
      'limit', p_limit,
      'retry_after_seconds',
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::int)
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'hits', v_hits, 'limit', p_limit);
END;
$$;

-- Só as Edge Functions chamam. O cliente NÃO pode zerar o próprio contador.
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) IS
  'Janela fixa de rate limit por (user_id, bucket). Exclusiva de service_role.';

-- ----------------------------------------------------------------------------
-- Higiene: remove janelas antigas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_edge_rate_limits(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.edge_rate_limits
  WHERE updated_at < NOW() - make_interval(hours => GREATEST(p_older_than_hours, 1));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_edge_rate_limits(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_edge_rate_limits(INTEGER) TO service_role;

COMMIT;
