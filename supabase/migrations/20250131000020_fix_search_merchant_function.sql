-- Fix search_merchant function: corrigir erro com unnest dentro de aggregate

BEGIN;

-- Drop e recriar a função com sintaxe corrigida
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
BEGIN
  RETURN QUERY
  WITH alias_similarity AS (
    SELECT 
      m.id,
      COALESCE(
        MAX(similarity(lower(p_description), alias_item))
        FILTER (WHERE alias_item IS NOT NULL),
        0
      ) as max_alias_similarity
    FROM public.merchants_dictionary m
    CROSS JOIN LATERAL unnest(m.aliases) AS alias_item
    WHERE m.is_active = true
    GROUP BY m.id
  )
  SELECT 
    m.id,
    m.merchant_key,
    m.entity_name,
    m.category,
    m.subcategory,
    m.confidence_modifier,
    m.priority,
    GREATEST(
      similarity(lower(p_description), m.merchant_key),
      similarity(lower(p_description), m.entity_name),
      COALESCE(als.max_alias_similarity, 0)
    )::real as match_score
  FROM public.merchants_dictionary m
  LEFT JOIN alias_similarity als ON m.id = als.id
  WHERE m.is_active = true
    AND (
      lower(p_description) LIKE '%' || m.merchant_key || '%'
      OR m.merchant_key LIKE '%' || lower(p_description) || '%'
      OR lower(p_description) % m.merchant_key  -- Trigram similarity
      OR EXISTS (
        SELECT 1 FROM unnest(m.aliases) alias
        WHERE lower(p_description) LIKE '%' || alias || '%'
      )
    )
    AND (
      -- Se é específico de estado, verificar localização
      m.state_specific = false
      OR p_user_location IS NULL
      OR p_user_location = ANY(m.states)
    )
  ORDER BY 
    match_score DESC,
    m.priority DESC,
    m.confidence_modifier DESC,
    m.usage_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Regrant permissions
GRANT EXECUTE ON FUNCTION public.search_merchant(text, text, integer) TO authenticated;

COMMIT;

