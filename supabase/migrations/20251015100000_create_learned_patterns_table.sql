-- Migration: Create learned patterns table for intelligent transaction categorization
-- This table stores learned patterns from user corrections and usage statistics
-- for the intelligent dictionary system

BEGIN;

-- Create global learned patterns table (shared across all users)
CREATE TABLE public.global_learned_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  normalized_description text NOT NULL UNIQUE, -- Lowercase, trimmed version for matching
  category text NOT NULL,
  subcategory text,
  confidence numeric(5,2) NOT NULL DEFAULT 0.00, -- 0.00 to 100.00
  usage_count integer NOT NULL DEFAULT 1,
  user_votes integer NOT NULL DEFAULT 0, -- Número de usuários que confirmaram este padrão
  last_used_at timestamptz DEFAULT now(),
  first_learned_at timestamptz DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  source_type text NOT NULL DEFAULT 'user_correction', -- 'user_correction', 'system_generated', 'imported'
  metadata jsonb DEFAULT '{}', -- Additional data like entity_name, aliases, etc.

  -- Indexes for performance
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_global_learned_patterns_normalized_desc ON public.global_learned_patterns(normalized_description);
CREATE INDEX idx_global_learned_patterns_category ON public.global_learned_patterns(category);
CREATE INDEX idx_global_learned_patterns_confidence ON public.global_learned_patterns(confidence DESC);
CREATE INDEX idx_global_learned_patterns_last_used ON public.global_learned_patterns(last_used_at DESC);
CREATE INDEX idx_global_learned_patterns_active ON public.global_learned_patterns(is_active) WHERE is_active = true;
CREATE INDEX idx_global_learned_patterns_user_votes ON public.global_learned_patterns(user_votes DESC);

-- Create composite index for fast lookups
CREATE INDEX idx_global_learned_patterns_desc_active ON public.global_learned_patterns(normalized_description, is_active) WHERE is_active = true;

-- Create additional performance indexes
CREATE INDEX idx_global_learned_patterns_category_confidence ON public.global_learned_patterns(category, confidence DESC) WHERE is_active = true;
CREATE INDEX idx_global_learned_patterns_desc_category_active ON public.global_learned_patterns(normalized_description, category, is_active) WHERE is_active = true;
CREATE INDEX idx_global_learned_patterns_confidence_active ON public.global_learned_patterns(confidence DESC, is_active) WHERE is_active = true;

-- Create partial indexes for high-confidence patterns (most frequently used)
CREATE INDEX idx_global_learned_patterns_high_confidence ON public.global_learned_patterns(normalized_description, category, subcategory) WHERE is_active = true AND confidence >= 85.00;

-- Create hash index for exact description matching (PostgreSQL 10+)
-- Note: Hash indexes are faster for equality comparisons
-- CREATE INDEX idx_global_learned_patterns_desc_hash ON public.global_learned_patterns USING HASH (normalized_description) WHERE is_active = true;

-- Create GIN index for JSONB metadata (for advanced queries)
CREATE INDEX idx_global_learned_patterns_metadata ON public.global_learned_patterns USING GIN (metadata);

-- Create BRIN index for timestamp columns (for time-series queries)
CREATE INDEX idx_global_learned_patterns_last_used_brin ON public.global_learned_patterns USING BRIN (last_used_at);

-- Row Level Security (todos os usuários autenticados podem ler, mas apenas sistema pode escrever)
ALTER TABLE public.global_learned_patterns ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read learned patterns
CREATE POLICY "Authenticated users can read learned patterns."
  ON public.global_learned_patterns FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Only service role can insert/update learned patterns (for system learning)
CREATE POLICY "Service role can manage learned patterns."
  ON public.global_learned_patterns FOR ALL USING (auth.role() = 'service_role');

-- Create function to update global learned pattern usage
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

  -- Check if pattern already exists
  SELECT * INTO v_existing_record
  FROM public.global_learned_patterns
  WHERE normalized_description = v_normalized_desc
    AND is_active = true;

  IF v_existing_record.id IS NOT NULL THEN
    -- Update existing pattern
    UPDATE public.global_learned_patterns
    SET
      usage_count = usage_count + 1,
      user_votes = user_votes + (CASE WHEN p_user_vote THEN 1 ELSE 0 END),
      last_used_at = now(),
      confidence = LEAST(
        confidence + (usage_count * 0.1) + (user_votes * 2.0),
        95.00
      ),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{last_category}',
        to_jsonb(p_category)
      )
    WHERE id = v_existing_record.id;
  ELSE
    -- Create new pattern
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
        'first_user_vote', p_user_vote
      )
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_global_learned_pattern(text, text, text, numeric, boolean) TO authenticated;

-- Create function to get global learned patterns
CREATE OR REPLACE FUNCTION public.get_global_learned_patterns(
  p_limit integer DEFAULT 100,
  p_min_confidence numeric DEFAULT 70.00,
  p_min_user_votes integer DEFAULT 1
) RETURNS TABLE (
  id uuid,
  description text,
  category text,
  subcategory text,
  confidence numeric,
  usage_count integer,
  user_votes integer,
  last_used_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    glp.id,
    glp.description,
    glp.category,
    glp.subcategory,
    glp.confidence,
    glp.usage_count,
    glp.user_votes,
    glp.last_used_at
  FROM public.global_learned_patterns glp
  WHERE glp.is_active = true
    AND glp.confidence >= p_min_confidence
    AND glp.user_votes >= p_min_user_votes
  ORDER BY glp.confidence DESC, glp.user_votes DESC, glp.usage_count DESC, glp.last_used_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_global_learned_patterns(integer, numeric, integer) TO authenticated;

-- Create function to cleanup old global learned patterns (maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_old_global_learned_patterns(
  p_days_old integer DEFAULT 180,
  p_min_usage integer DEFAULT 3,
  p_min_user_votes integer DEFAULT 1
) RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.global_learned_patterns
  WHERE last_used_at < (now() - interval '1 day' * p_days_old)
    AND usage_count < p_min_usage
    AND user_votes < p_min_user_votes
    AND is_active = true;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role only
GRANT EXECUTE ON FUNCTION public.cleanup_old_global_learned_patterns(integer, integer, integer) TO service_role;

-- Create function for user voting on patterns
CREATE OR REPLACE FUNCTION public.vote_on_learned_pattern(
  p_description text,
  p_user_vote boolean DEFAULT true
) RETURNS boolean AS $$
DECLARE
  v_normalized_desc text;
  v_existing_record record;
BEGIN
  -- Normalize description
  v_normalized_desc := lower(trim(p_description));

  -- Check if pattern exists
  SELECT * INTO v_existing_record
  FROM public.global_learned_patterns
  WHERE normalized_description = v_normalized_desc
    AND is_active = true;

  IF v_existing_record.id IS NOT NULL THEN
    -- Update vote count
    UPDATE public.global_learned_patterns
    SET
      user_votes = user_votes + (CASE WHEN p_user_vote THEN 1 ELSE -1 END),
      last_used_at = now()
    WHERE id = v_existing_record.id;

    RETURN true;
  ELSE
    -- Pattern doesn't exist, cannot vote
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.vote_on_learned_pattern(text, boolean) TO authenticated;

-- Create optimized functions for batch operations

-- Function to get patterns by multiple descriptions (for batch classification)
CREATE OR REPLACE FUNCTION public.get_patterns_by_descriptions(
  p_descriptions text[],
  p_min_confidence numeric DEFAULT 70.00
) RETURNS TABLE (
  description text,
  category text,
  subcategory text,
  confidence numeric,
  usage_count integer,
  user_votes integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    glp.description,
    glp.category,
    glp.subcategory,
    glp.confidence,
    glp.usage_count,
    glp.user_votes
  FROM public.global_learned_patterns glp
  WHERE glp.normalized_description = ANY(
    SELECT lower(trim(unnest(p_descriptions)))
  )
    AND glp.is_active = true
    AND glp.confidence >= p_min_confidence
  ORDER BY glp.confidence DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_patterns_by_descriptions(text[], numeric) TO authenticated;

-- Function to get top patterns for a category (for ML training)
CREATE OR REPLACE FUNCTION public.get_top_patterns_by_category(
  p_category text,
  p_limit integer DEFAULT 100,
  p_min_confidence numeric DEFAULT 75.00
) RETURNS TABLE (
  description text,
  category text,
  subcategory text,
  confidence numeric,
  usage_count integer,
  user_votes integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    glp.description,
    glp.category,
    glp.subcategory,
    glp.confidence,
    glp.usage_count,
    glp.user_votes
  FROM public.global_learned_patterns glp
  WHERE glp.category = p_category
    AND glp.is_active = true
    AND glp.confidence >= p_min_confidence
  ORDER BY glp.confidence DESC, glp.user_votes DESC, glp.usage_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_top_patterns_by_category(text, integer, numeric) TO authenticated;

-- Function to update multiple pattern usages at once (for batch learning)
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

    -- Update or insert pattern
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
    ON CONFLICT (normalized_description)
    DO UPDATE SET
      usage_count = global_learned_patterns.usage_count + 1,
      user_votes = global_learned_patterns.user_votes + (CASE WHEN user_vote THEN 1 ELSE 0 END),
      last_used_at = now(),
      confidence = LEAST(
        global_learned_patterns.confidence + (global_learned_patterns.usage_count * 0.1),
        95.00
      );

    updated_count := updated_count + 1;
  END LOOP;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.batch_update_learned_patterns(jsonb[]) TO authenticated;

-- Create materialized view for frequently accessed data (for performance)
CREATE MATERIALIZED VIEW public.mv_frequent_patterns AS
SELECT
  normalized_description,
  category,
  subcategory,
  confidence,
  usage_count,
  user_votes,
  last_used_at
FROM public.global_learned_patterns
WHERE is_active = true
  AND confidence >= 80.00
  AND usage_count >= 3
ORDER BY confidence DESC, user_votes DESC, usage_count DESC;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_mv_frequent_patterns_desc ON public.mv_frequent_patterns(normalized_description);

-- Create refresh function for materialized view
CREATE OR REPLACE FUNCTION public.refresh_frequent_patterns_view() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_frequent_patterns;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.refresh_frequent_patterns_view() TO service_role;

COMMIT;
