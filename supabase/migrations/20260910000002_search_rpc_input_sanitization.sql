-- ============================================================================
-- SANITIZACAO DE INPUT NAS RPCs DE BUSCA / APRENDIZADO
-- ============================================================================
-- As RPCs do classificador (`search_merchant`, `search_merchant_compound_words`,
-- `search_banking_pattern`, `search_by_keywords`) recebem a descricao bruta da
-- transacao e a usam como PADRAO de LIKE:
--
--     WHERE lower(m.merchant_key) LIKE '%' || token || '%'
--
-- O parametro e passado de forma parametrizada (nao ha SQL injection classica),
-- mas o CONTEUDO do parametro vira sintaxe de padrao. Consequencias reais:
--
--   1. LIKE-pattern injection: descricao "%" casa com o dicionario inteiro e
--      a RPC devolve/classifica com base em lixo.
--   2. DoS: "%a%a%a%a%a%a%a%a%a%a%a%a%a%a%b" forca backtracking exponencial no
--      matcher de LIKE. Uma unica chamada trava um worker do Postgres; um laco
--      no cliente derruba a instancia — e o dicionario tem dezenas de milhares
--      de linhas.
--   3. Sem limite de tamanho: descricao de 1MB e tokenizada e cruzada contra
--      toda a tabela via trigram.
--   4. `p_limit` sem teto: `p_limit = 10000000` materializa a tabela inteira.
--   5. Nenhuma exigia autenticacao — `authenticated` tinha EXECUTE, mas nada
--      checava `auth.uid()` dentro da funcao.
--
-- Estrategia: nao reescrever o algoritmo (logica de negocio intacta). As
-- implementacoes originais sao renomeadas para `_impl`, perdem o EXECUTE de
-- `authenticated`, e passam a ser alcancadas apenas por um wrapper de mesmo
-- nome/assinatura que autentica, limita e higieniza a entrada.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. HIGIENIZADOR DE ENTRADA DE BUSCA
-- ============================================================================

CREATE OR REPLACE FUNCTION public.orbi_sanitize_search_text(
  p_value text,
  p_max int DEFAULT 200
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(
    btrim(
      regexp_replace(
        regexp_replace(
          -- 1) Neutraliza os metacaracteres de LIKE e o escape padrao.
          --    Viram espaco: preserva a tokenizacao por palavra do algoritmo.
          translate(left(COALESCE(p_value, ''), p_max), '%_\', '   '),
          -- 2) Remove caracteres de controle (NUL, ESC, CR/LF).
          '[[:cntrl:]]', ' ', 'g'
        ),
        -- 3) Colapsa espacos: evita explosao de tokens vazios.
        '[[:space:]]+', ' ', 'g'
      )
    ),
    ''
  );
$fn$;

COMMENT ON FUNCTION public.orbi_sanitize_search_text(text, int) IS
  'Higieniza texto que sera usado como padrao de LIKE: corta o tamanho, remove %/_/\\ (LIKE-pattern injection e backtracking exponencial) e caracteres de controle.';

CREATE OR REPLACE FUNCTION public.orbi_require_auth()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado' USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.orbi_sanitize_search_text(text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orbi_require_auth() TO authenticated, service_role;

-- ============================================================================
-- 2. RENOMEIA AS IMPLEMENTACOES E TRANCA O ACESSO DIRETO
-- ============================================================================

DO $blk$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'search_merchant',
        'search_merchant_compound_words',
        'search_banking_pattern',
        'search_by_keywords',
        'get_top_merchants'
      )
      -- Idempotencia: se o _impl ja existe, esta migration ja rodou e o que
      -- esta com o nome publico e o wrapper — nao renomear de novo.
      AND NOT EXISTS (
        SELECT 1 FROM pg_proc p2
        JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
        WHERE n2.nspname = 'public' AND p2.proname = p.proname || '_impl'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I',
                   f.proname, f.args, f.proname || '_impl');
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   f.proname || '_impl', f.args);
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
                   f.proname || '_impl', f.args);
    RAISE NOTICE 'implementacao isolada: public.%(%)', f.proname || '_impl', f.args;
  END LOOP;
END;
$blk$;

-- ============================================================================
-- 3. WRAPPERS PUBLICOS — autenticam, limitam e higienizam
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_merchant(
  p_description text,
  p_user_location text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  entity_name text,
  category text,
  subcategory text,
  confidence_modifier numeric,
  priority integer,
  match_score real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_desc text;
BEGIN
  PERFORM public.orbi_require_auth();

  v_desc := public.orbi_sanitize_search_text(p_description, 200);
  IF length(v_desc) < 2 THEN
    RETURN;  -- entrada inutil apos higienizacao: nao varre o dicionario
  END IF;

  RETURN QUERY
  SELECT * FROM public.search_merchant_impl(
    v_desc,
    NULLIF(public.orbi_sanitize_search_text(p_user_location, 60), ''),
    LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50)   -- teto de linhas
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.search_merchant_compound_words(
  p_description text,
  p_user_location text DEFAULT NULL,
  p_min_score real DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  entity_name text,
  category text,
  subcategory text,
  confidence_modifier numeric,
  priority integer,
  match_score real,
  matched_tokens text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_desc text;
BEGIN
  PERFORM public.orbi_require_auth();

  v_desc := public.orbi_sanitize_search_text(p_description, 200);
  IF length(v_desc) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.search_merchant_compound_words_impl(
    v_desc,
    NULLIF(public.orbi_sanitize_search_text(p_user_location, 60), ''),
    LEAST(GREATEST(COALESCE(p_min_score, 0.3), 0.0), 100.0)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.search_banking_pattern(
  p_description text,
  p_context text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  category text,
  subcategory text,
  confidence_modifier numeric,
  priority integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_desc text;
BEGIN
  PERFORM public.orbi_require_auth();

  v_desc := public.orbi_sanitize_search_text(p_description, 200);
  IF length(v_desc) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.search_banking_pattern_impl(
    v_desc,
    NULLIF(public.orbi_sanitize_search_text(p_context, 60), '')
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.search_by_keywords(
  p_description text,
  p_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  category text,
  subcategory text,
  confidence_modifier numeric,
  priority integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_desc text;
  v_type text;
BEGIN
  PERFORM public.orbi_require_auth();

  v_desc := public.orbi_sanitize_search_text(p_description, 200);
  IF length(v_desc) < 2 THEN
    RETURN;
  END IF;

  -- Whitelist: p_type alimenta comparacao de categoria, nao aceita texto livre.
  v_type := CASE WHEN p_type IN ('income', 'expense') THEN p_type ELSE NULL END;

  RETURN QUERY
  SELECT * FROM public.search_by_keywords_impl(v_desc, v_type);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_top_merchants(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  entity_name text,
  category text,
  subcategory text,
  aliases text[],
  confidence_modifier numeric,
  priority integer,
  entry_type text,
  usage_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  PERFORM public.orbi_require_auth();

  RETURN QUERY
  SELECT * FROM public.get_top_merchants_impl(
    LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)  -- antes: sem teto
  );
END;
$fn$;

-- ============================================================================
-- 4. update_user_learned_pattern — entrada limitada e categoria conferida
-- ============================================================================
-- A versao anterior gravava `p_description`/`p_category` sem qualquer limite
-- de tamanho e com `p_confidence` arbitrario (o cliente escolhia a confianca
-- do proprio padrao e sequestrava a classificacao futura).

CREATE OR REPLACE FUNCTION public.update_user_learned_pattern(
  p_description text,
  p_category text,
  p_subcategory text DEFAULT NULL,
  p_confidence numeric DEFAULT 85.00
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user_id    uuid := public.orbi_require_auth();
  v_desc       text;
  v_category   text;
  v_subcat     text;
  v_confidence numeric;
BEGIN
  v_desc := btrim(regexp_replace(left(COALESCE(p_description, ''), 300), '[[:cntrl:]]', ' ', 'g'));
  IF length(v_desc) < 2 THEN
    RAISE EXCEPTION 'Descricao invalida para aprendizado';
  END IF;

  v_category := btrim(regexp_replace(left(COALESCE(p_category, ''), 120), '[[:cntrl:]]', ' ', 'g'));
  IF length(v_category) < 1 THEN
    RAISE EXCEPTION 'Categoria obrigatoria';
  END IF;

  -- A categoria precisa existir para ESTE usuario (ou ser global de sistema);
  -- antes o cliente inventava qualquer string e poluia o proprio classificador.
  IF NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = v_category
      AND (c.user_id = v_user_id OR c.is_system = TRUE)
  ) THEN
    RAISE EXCEPTION 'Categoria nao pertence ao usuario' USING ERRCODE = '42501';
  END IF;

  v_subcat := NULLIF(
    btrim(regexp_replace(left(COALESCE(p_subcategory, ''), 120), '[[:cntrl:]]', ' ', 'g')),
    ''
  );

  -- Confianca e do servidor: o cliente so sugere, dentro de faixa.
  v_confidence := LEAST(GREATEST(COALESCE(p_confidence, 85.00), 50.00), 95.00);

  INSERT INTO public.user_learned_patterns (
    user_id, description, normalized_description, category, subcategory,
    confidence, usage_count, last_used_at
  ) VALUES (
    v_user_id, v_desc, lower(v_desc), v_category, v_subcat,
    v_confidence, 1, now()
  )
  ON CONFLICT (user_id, normalized_description)
  DO UPDATE SET
    category    = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    usage_count = user_learned_patterns.usage_count + 1,
    last_used_at = now(),
    confidence  = LEAST(
      user_learned_patterns.confidence + (user_learned_patterns.usage_count * 0.5),
      98.00
    );
END;
$fn$;

-- ============================================================================
-- 5. record_merchant_usage — contador global escrito pelo cliente
-- ============================================================================
-- Recebia um uuid arbitrario e incrementava o contador de qualquer merchant,
-- sem autenticacao. `usage_count` e o ranking que alimenta get_top_merchants:
-- era possivel empurrar um merchant escolhido para o topo do dicionario de
-- todos os tenants.

CREATE OR REPLACE FUNCTION public.record_merchant_usage(p_merchant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user_id uuid := public.orbi_require_auth();
  v_rl      jsonb;
BEGIN
  IF p_merchant_id IS NULL THEN
    RETURN;
  END IF;

  -- Rate limit por usuario: 600 incrementos/hora cobre uma importacao de
  -- extrato grande e barra o laco de envenenamento de ranking.
  BEGIN
    v_rl := public.consume_rate_limit(v_user_id, 'merchant-usage', 600, 3600);
  EXCEPTION WHEN OTHERS THEN
    v_rl := NULL;  -- contador indisponivel nao derruba a classificacao
  END;

  IF v_rl IS NOT NULL AND COALESCE((v_rl->>'allowed')::boolean, TRUE) = FALSE THEN
    RETURN;  -- silencioso: e telemetria, nao pode quebrar a classificacao
  END IF;

  UPDATE public.merchants_dictionary
  SET usage_count = COALESCE(usage_count, 0) + 1,
      updated_at  = NOW()
  WHERE id = p_merchant_id;
END;
$fn$;

-- ============================================================================
-- 6. PRIVILEGIOS — so os wrappers ficam expostos
-- ============================================================================

REVOKE ALL ON FUNCTION public.search_merchant(text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_merchant_compound_words(text, text, real) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_banking_pattern(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_by_keywords(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_top_merchants(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_user_learned_pattern(text, text, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_merchant_usage(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.search_merchant(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_merchant_compound_words(text, text, real) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_banking_pattern(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_by_keywords(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_merchants(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_learned_pattern(text, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_merchant_usage(uuid) TO authenticated;

-- Fecha a porta padrao do Postgres para funcoes futuras.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;
