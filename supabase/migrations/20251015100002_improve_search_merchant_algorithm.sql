-- Migration: Improve search_merchant function with advanced word-based matching
-- Enhanced algorithm that better handles compound words like "CULTURA FITNESS" and "pagamento investimento"

BEGIN;

-- ============================================================================
-- MELHORAR FUNÇÃO SEARCH_MERCHANT COM ALGORITMO AVANÇADO
-- ============================================================================

-- Drop e recriar a função com algoritmo melhorado
DROP FUNCTION IF EXISTS public.search_merchant(text, text, integer);

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
) AS $$
DECLARE
  v_description_lower text;
  v_tokens text[];
  v_token_count integer;
  v_best_matches record;
BEGIN
  -- Normalizar descrição para busca
  v_description_lower := lower(trim(p_description));

  -- Tokenizar descrição em palavras individuais (mínimo 2 caracteres)
  SELECT array_agg(DISTINCT word) INTO v_tokens
  FROM unnest(string_to_array(v_description_lower, ' ')) word
  WHERE length(word) >= 2;

  v_token_count := array_length(v_tokens, 1);

  RETURN QUERY
  WITH merchant_matches AS (
    SELECT
      m.id,
      m.merchant_key,
      m.entity_name,
      m.category,
      m.subcategory,
      m.confidence_modifier,
      m.priority,
      m.usage_count,

      -- ALGORITMO AVANÇADO DE MATCHING
      (
        -- 1. MATCHING EXATO COMPLETO (máxima prioridade)
        CASE
          WHEN lower(m.merchant_key) = v_description_lower THEN 100.0
          WHEN lower(m.entity_name) = v_description_lower THEN 95.0
          ELSE 0.0
        END +

        -- 2. MATCHING POR PALAVRAS COMPOSTAS (média prioridade)
        CASE
          WHEN v_token_count >= 2 THEN
            -- Busca por combinações de palavras consecutivas
            GREATEST(
              -- CULTURA FITNESS -> busca "cultura fitness"
              COALESCE((
                SELECT similarity(v_description_lower, mk.merchant_key)
                FROM public.merchants_dictionary mk
                WHERE mk.id = m.id
                  AND lower(mk.merchant_key) % v_description_lower
              ), 0),

              -- Busca por palavras individuais com peso maior para palavras mais específicas
              COALESCE((
                SELECT SUM(
                  CASE
                    WHEN length(token) >= 4 THEN similarity(token, lower(m.merchant_key)) * 1.5
                    ELSE similarity(token, lower(m.merchant_key))
                  END
                )
                FROM unnest(v_tokens) token
                WHERE lower(m.merchant_key) LIKE '%' || token || '%'
                   OR lower(m.entity_name) LIKE '%' || token || '%'
              ), 0) / GREATEST(v_token_count, 1) * 0.8
            )
          ELSE 0.0
        END +

        -- 3. MATCHING POR ALIASES (média prioridade)
        COALESCE((
          SELECT MAX(similarity(v_description_lower, alias_item))
          FROM unnest(m.aliases) alias_item
          WHERE v_description_lower LIKE '%' || alias_item || '%'
             OR alias_item LIKE '%' || v_description_lower || '%'
        ), 0) * 0.9 +

        -- 4. MATCHING POR PALAVRAS-CHAVE (baixa prioridade)
        COALESCE((
          SELECT COUNT(*)::float / GREATEST(array_length(m.keywords, 1), 1)
          FROM unnest(m.keywords) keyword
          WHERE keyword = ANY(v_tokens)
        ) * 0.6, 0)

      ) as raw_score

    FROM public.merchants_dictionary m
    WHERE m.is_active = true
      AND (
        -- Critérios de matching melhorados
        lower(m.merchant_key) = v_description_lower
        OR lower(m.entity_name) = v_description_lower
        OR lower(m.merchant_key) % v_description_lower  -- Trigram similarity
        OR lower(m.entity_name) % v_description_lower  -- Trigram similarity
        OR EXISTS (
          SELECT 1 FROM unnest(m.aliases) alias
          WHERE lower(v_description_lower) LIKE '%' || alias || '%'
             OR alias LIKE '%' || lower(v_description_lower) || '%'
        )
        OR EXISTS (
          SELECT 1 FROM unnest(m.keywords) keyword
          WHERE keyword = ANY(v_tokens)
        )
        -- NOVO: Busca por palavras compostas (ex: "cultura fitness")
        OR (v_token_count >= 2 AND (
          SELECT string_agg(token, ' ')
          FROM unnest(v_tokens) token
        ) LIKE '%' || lower(m.merchant_key) || '%')
      )
      AND (
        -- Se é específico de estado, verificar localização
        m.state_specific = false
        OR p_user_location IS NULL
        OR p_user_location = ANY(m.states)
      )
  ),

  scored_matches AS (
    SELECT *,
      -- NORMALIZAR SCORE PARA 0-100
      LEAST(raw_score * 100, 100.0)::real as normalized_score
    FROM merchant_matches
    WHERE raw_score > 0.1  -- Filtrar matches muito fracos
  )

  SELECT
    sm.id,
    sm.merchant_key,
    sm.entity_name,
    sm.category,
    sm.subcategory,
    sm.confidence_modifier,
    sm.priority,
    sm.normalized_score as match_score
  FROM scored_matches sm
  ORDER BY
    sm.normalized_score DESC,
    sm.priority DESC,
    sm.confidence_modifier DESC,
    sm.usage_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNÇÃO AUXILIAR PARA BUSCA AVANÇADA POR PALAVRAS COMPOSTAS
-- ============================================================================

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
) AS $$
DECLARE
  v_description_lower text;
  v_tokens text[];
  v_two_word_combinations text[];
  v_three_word_combinations text[];
BEGIN
  -- Preparar dados
  v_description_lower := lower(trim(p_description));
  SELECT array_agg(DISTINCT word) INTO v_tokens
  FROM unnest(string_to_array(v_description_lower, ' ')) word
  WHERE length(word) >= 2;

  -- Criar combinações de 2 e 3 palavras
  SELECT array_agg(token1 || ' ' || token2) INTO v_two_word_combinations
  FROM unnest(v_tokens) token1
  JOIN unnest(v_tokens) token2 ON true
  WHERE token1 < token2;

  SELECT array_agg(token1 || ' ' || token2 || ' ' || token3) INTO v_three_word_combinations
  FROM unnest(v_tokens) token1
  JOIN unnest(v_tokens) token2 ON true
  JOIN unnest(v_tokens) token3 ON true
  WHERE token1 < token2 AND token2 < token3;

  RETURN QUERY
  SELECT
    m.id,
    m.merchant_key,
    m.entity_name,
    m.category,
    m.subcategory,
    m.confidence_modifier,
    m.priority,

    -- Score baseado em matching avançado
    GREATEST(
      -- Matching exato de combinação de palavras
      CASE
        WHEN EXISTS (
          SELECT 1 FROM unnest(v_two_word_combinations) combo
          WHERE lower(m.merchant_key) LIKE '%' || combo || '%'
             OR lower(m.entity_name) LIKE '%' || combo || '%'
        ) THEN 0.8
        ELSE 0.0
      END,

      -- Matching de palavras individuais com pesos
      COALESCE((
        SELECT SUM(
          CASE
            WHEN length(token) >= 5 THEN 0.4  -- Palavras longas têm mais peso
            WHEN length(token) >= 3 THEN 0.3  -- Palavras médias
            ELSE 0.2                           -- Palavras curtas
          END
        )
        FROM unnest(v_tokens) token
        WHERE lower(m.merchant_key) LIKE '%' || token || '%'
           OR lower(m.entity_name) LIKE '%' || token || '%'
           OR EXISTS (
             SELECT 1 FROM unnest(m.aliases) alias
             WHERE alias LIKE '%' || token || '%'
           )
      ), 0) / GREATEST(array_length(v_tokens, 1), 1),

      -- Matching por palavras-chave
      COALESCE((
        SELECT COUNT(*)::float / GREATEST(array_length(m.keywords, 1), 1) * 0.6
        FROM unnest(m.keywords) keyword
        WHERE keyword = ANY(v_tokens)
      ), 0)
    ) as match_score,

    -- Tokens que fizeram match
    ARRAY(
      SELECT token FROM unnest(v_tokens) token
      WHERE lower(m.merchant_key) LIKE '%' || token || '%'
         OR lower(m.entity_name) LIKE '%' || token || '%'
    ) as matched_tokens

  FROM public.merchants_dictionary m
  WHERE m.is_active = true
    AND (
      -- Matching principal
      EXISTS (
        SELECT 1 FROM unnest(v_two_word_combinations) combo
        WHERE lower(m.merchant_key) LIKE '%' || combo || '%'
           OR lower(m.entity_name) LIKE '%' || combo || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(v_tokens) token
        WHERE lower(m.merchant_key) LIKE '%' || token || '%'
           OR lower(m.entity_name) LIKE '%' || token || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(m.aliases) alias
        WHERE EXISTS (
          SELECT 1 FROM unnest(v_tokens) token
          WHERE alias LIKE '%' || token || '%'
        )
      )
      OR EXISTS (
        SELECT 1 FROM unnest(m.keywords) keyword
        WHERE keyword = ANY(v_tokens)
      )
    )
    AND (
      -- Filtro de localização (estado específico)
      m.state_specific = false
      OR p_user_location IS NULL
      OR p_user_location = ANY(m.states)
    )
    AND GREATEST(
      -- Aplicar score mínimo
      CASE
        WHEN EXISTS (
          SELECT 1 FROM unnest(v_two_word_combinations) combo
          WHERE lower(m.merchant_key) LIKE '%' || combo || '%'
        ) THEN 0.8
        ELSE 0.0
      END,

      COALESCE((
        SELECT SUM(
          CASE
            WHEN length(token) >= 5 THEN 0.4
            WHEN length(token) >= 3 THEN 0.3
            ELSE 0.2
          END
        )
        FROM unnest(v_tokens) token
        WHERE lower(m.merchant_key) LIKE '%' || token || '%'
           OR lower(m.entity_name) LIKE '%' || token || '%'
      ), 0) / GREATEST(array_length(v_tokens, 1), 1),

      COALESCE((
        SELECT COUNT(*)::float / GREATEST(array_length(m.keywords, 1), 1) * 0.6
        FROM unnest(m.keywords) keyword
        WHERE keyword = ANY(v_tokens)
      ), 0)
    ) >= p_min_score

  ORDER BY match_score DESC, m.priority DESC, m.confidence_modifier DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ATUALIZAR PERMISSÕES
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.search_merchant(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_merchant_compound_words(text, text, real) TO authenticated;

-- ============================================================================
-- ATUALIZAR MATERIALIZED VIEW
-- ============================================================================

REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_frequent_merchants;

COMMIT;
