-- Migration: Fix unique constraint on global_learned_patterns to allow same description with different categories
-- This allows the system to track multiple categorizations for the same merchant/description
-- The system will then use the one with most votes/usage

BEGIN;

-- 1. Drop the existing unique constraint on normalized_description alone
ALTER TABLE public.global_learned_patterns 
DROP CONSTRAINT IF EXISTS global_learned_patterns_normalized_description_key;

-- 2. Add a composite unique constraint on (normalized_description, category)
-- This allows the same description to have different categories
ALTER TABLE public.global_learned_patterns 
ADD CONSTRAINT global_learned_patterns_normalized_desc_category_key 
UNIQUE (normalized_description, category);

-- 3. Update the function to handle the new constraint
CREATE OR REPLACE FUNCTION public.update_global_learned_pattern(
  p_description text,
  p_category text,
  p_subcategory text DEFAULT NULL,
  p_confidence numeric DEFAULT 85.00,
  p_user_vote boolean DEFAULT false
) RETURNS void AS $$
DECLARE
  v_normalized_desc text;
  v_existing_record record;
BEGIN
  -- Normalize description
  v_normalized_desc := lower(trim(p_description));

  -- Check if pattern already exists with THIS CATEGORY
  SELECT * INTO v_existing_record
  FROM public.global_learned_patterns
  WHERE normalized_description = v_normalized_desc
    AND category = p_category
    AND is_active = true;

  IF v_existing_record.id IS NOT NULL THEN
    -- Update existing pattern (same description + same category)
    UPDATE public.global_learned_patterns
    SET
      usage_count = usage_count + 1,
      user_votes = user_votes + (CASE WHEN p_user_vote THEN 1 ELSE 0 END),
      last_used_at = now(),
      confidence = LEAST(
        confidence + (usage_count * 0.1) + (user_votes * 2.0),
        99.00
      ),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{last_used}',
        to_jsonb(now())
      )
    WHERE id = v_existing_record.id;
  ELSE
    -- Create new pattern (new description OR same description with different category)
    INSERT INTO public.global_learned_patterns (
      description,
      normalized_description,
      category,
      subcategory,
      confidence,
      usage_count,
      user_votes,
      metadata
    ) VALUES (
      p_description,
      v_normalized_desc,
      p_category,
      p_subcategory,
      p_confidence,
      1,
      (CASE WHEN p_user_vote THEN 1 ELSE 0 END),
      jsonb_build_object(
        'source', 'auto_learned',
        'first_user_vote', p_user_vote,
        'created_at', now()
      )
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update search function to prioritize by votes and usage when multiple categories exist
CREATE OR REPLACE FUNCTION public.search_learned_pattern_by_description(
  p_description text,
  p_min_confidence numeric DEFAULT 70.00
) RETURNS TABLE (
  id uuid,
  description text,
  category text,
  subcategory text,
  confidence numeric,
  usage_count integer,
  user_votes integer
) AS $$
DECLARE
  v_normalized_desc text;
BEGIN
  v_normalized_desc := lower(trim(p_description));
  
  RETURN QUERY
  SELECT
    glp.id,
    glp.description,
    glp.category,
    glp.subcategory,
    glp.confidence,
    glp.usage_count,
    glp.user_votes
  FROM public.global_learned_patterns glp
  WHERE glp.normalized_description = v_normalized_desc
    AND glp.is_active = true
    AND glp.confidence >= p_min_confidence
  -- Order by votes first (most voted wins), then usage, then confidence
  ORDER BY glp.user_votes DESC, glp.usage_count DESC, glp.confidence DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_learned_pattern_by_description(text, numeric) TO authenticated;

-- 5. Update the batch update function to handle the new constraint
CREATE OR REPLACE FUNCTION public.batch_update_learned_patterns(
  p_updates jsonb[]
) RETURNS integer AS $$
DECLARE
  update_record jsonb;
  description text;
  category text;
  subcategory text;
  confidence numeric;
  user_vote boolean;
  updated_count integer := 0;
BEGIN
  FOREACH update_record IN ARRAY p_updates
  LOOP
    description := update_record->>'description';
    category := update_record->>'category';
    subcategory := update_record->>'subcategory';
    confidence := (update_record->>'confidence')::numeric;
    user_vote := (update_record->>'user_vote')::boolean;

    -- Update or insert pattern (now using description + category as unique)
    INSERT INTO public.global_learned_patterns (
      description,
      normalized_description,
      category,
      subcategory,
      confidence,
      usage_count,
      user_votes,
      metadata
    ) VALUES (
      description,
      lower(trim(description)),
      category,
      subcategory,
      confidence,
      1,
      CASE WHEN user_vote THEN 1 ELSE 0 END,
      jsonb_build_object('batch_update', true)
    )
    ON CONFLICT (normalized_description, category)
    DO UPDATE SET
      usage_count = global_learned_patterns.usage_count + 1,
      user_votes = global_learned_patterns.user_votes + (CASE WHEN user_vote THEN 1 ELSE 0 END),
      last_used_at = now(),
      confidence = LEAST(
        global_learned_patterns.confidence + (global_learned_patterns.usage_count * 0.1),
        99.00
      );

    updated_count := updated_count + 1;
  END LOOP;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create index for the new search pattern (description + votes)
CREATE INDEX IF NOT EXISTS idx_global_learned_patterns_desc_votes 
ON public.global_learned_patterns(normalized_description, user_votes DESC, usage_count DESC) 
WHERE is_active = true;

-- 7. Update comments
COMMENT ON FUNCTION public.update_global_learned_pattern IS 'Atualiza ou cria padrão aprendido. Permite múltiplas categorias para a mesma descrição. A categoria com mais votos é considerada a correta.';
COMMENT ON FUNCTION public.search_learned_pattern_by_description IS 'Busca o padrão mais votado para uma descrição. Se houver múltiplas categorias, retorna a com mais user_votes e usage_count.';
COMMENT ON CONSTRAINT global_learned_patterns_normalized_desc_category_key ON public.global_learned_patterns IS 'Permite a mesma descrição com categorias diferentes. O sistema escolhe a mais votada.';

COMMIT;

