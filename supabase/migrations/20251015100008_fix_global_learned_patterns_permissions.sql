-- Migration: Fix permissions for global_learned_patterns table
-- Allow both anonymous and authenticated users to read learned patterns
-- This is necessary because the REST API may use the anon role

BEGIN;

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Authenticated users can read learned patterns." ON public.global_learned_patterns;

-- Drop existing policy if it exists to make this migration idempotent
DROP POLICY IF EXISTS "Public read access to learned patterns" ON public.global_learned_patterns;

-- Create new policy that allows both anon and authenticated users to read
CREATE POLICY "Public read access to learned patterns"
  ON public.global_learned_patterns FOR SELECT 
  TO anon, authenticated
  USING (true);

-- Ensure the service role policy still exists for write operations
-- (no change needed, just keeping it as is)

-- Grant SELECT permission to anon and authenticated roles
GRANT SELECT ON public.global_learned_patterns TO anon, authenticated;

COMMIT;

