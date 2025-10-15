-- Migration: Remove global_learned_patterns system
-- WIP: Sistema migrado para user_learned_patterns apenas (isolamento por usuário)
-- TODO: Futuro - implementar sistema de admin para ensino global controlado

BEGIN;

-- Drop functions first (dependencies)
DROP FUNCTION IF EXISTS public.get_learned_pattern_for_user(text, numeric);
DROP FUNCTION IF EXISTS public.get_learned_patterns_batch(text[], numeric);
DROP FUNCTION IF EXISTS public.update_global_learned_pattern(text, text, text, numeric, boolean);
DROP FUNCTION IF EXISTS public.get_global_learned_patterns(integer, numeric, integer);
DROP FUNCTION IF EXISTS public.cleanup_old_global_learned_patterns(integer, integer, integer);
DROP FUNCTION IF EXISTS public.vote_on_learned_pattern(text, boolean);
DROP FUNCTION IF EXISTS public.get_patterns_by_descriptions(text[], numeric);
DROP FUNCTION IF EXISTS public.get_top_patterns_by_category(text, integer, numeric);
DROP FUNCTION IF EXISTS public.batch_update_learned_patterns(jsonb[]);
DROP FUNCTION IF EXISTS public.refresh_frequent_patterns_view();
DROP FUNCTION IF EXISTS public.search_learned_pattern_by_description(text, numeric);
DROP FUNCTION IF EXISTS public.is_standard_category(text);

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS public.mv_frequent_patterns;

-- Drop standard_categories table (not needed without global patterns)
DROP TABLE IF EXISTS public.standard_categories CASCADE;

-- Drop main table
DROP TABLE IF EXISTS public.global_learned_patterns CASCADE;

COMMIT;


