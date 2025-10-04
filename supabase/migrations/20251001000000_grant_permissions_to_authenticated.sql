-- Migration: Grant necessary permissions to authenticated users
-- This fixes "permission denied" errors in production

BEGIN;

-- ====================
-- 1. GRANT permissions on all tables to authenticated role
-- ====================
GRANT ALL ON public.accounts TO authenticated;
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.people TO authenticated;
GRANT ALL ON public.credit_cards TO authenticated;
GRANT ALL ON public.transactions TO authenticated;

-- ====================
-- 2. GRANT permissions on views to authenticated role
-- ====================
GRANT SELECT ON public.vw_account_current_balance TO authenticated;
GRANT SELECT ON public.vw_account_projected_balance TO authenticated;
-- vw_transaction_series was removed in migration 20250131000008

-- ====================
-- 3. GRANT EXECUTE on functions to authenticated role
-- ====================
-- Note: For functions, we need to specify the full signature or Postgres can't find them
-- We'll grant on all functions in the public schema to authenticated
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Alternative: grant on specific functions if needed
-- GRANT EXECUTE ON FUNCTION update_transaction_with_balance TO authenticated;
-- GRANT EXECUTE ON FUNCTION update_transaction_series_with_balance TO authenticated;
-- GRANT EXECUTE ON FUNCTION maintain_fixed_transaction_series TO authenticated;
-- GRANT EXECUTE ON FUNCTION generate_future_fixed_transactions TO authenticated;
-- GRANT EXECUTE ON FUNCTION update_updated_at_column TO authenticated;

-- ====================
-- 4. Garantir que as views respeitam RLS das tabelas base
-- ====================
ALTER VIEW public.vw_account_current_balance SET (security_invoker = true);
ALTER VIEW public.vw_account_projected_balance SET (security_invoker = true);
-- vw_transaction_series was removed in migration 20250131000008

COMMIT;

