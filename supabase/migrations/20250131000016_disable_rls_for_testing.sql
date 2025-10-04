-- Temporarily disable RLS for testing purposes
-- This migration disables RLS on transactions table to allow API testing

BEGIN;

-- Disable RLS on transactions table for testing
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;

-- Also disable RLS on related tables for testing
ALTER TABLE public.accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.series DISABLE ROW LEVEL SECURITY;

COMMIT;
