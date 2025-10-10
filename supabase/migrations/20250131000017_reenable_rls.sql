-- Re-enable RLS for production
-- This migration re-enables RLS on all tables for security

BEGIN;

-- Re-enable RLS on all tables
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;

-- Re-create RLS policies (drop first if they exist)
DROP POLICY IF EXISTS "Users can manage their own transactions." ON public.transactions;
CREATE POLICY "Users can manage their own transactions."
  ON public.transactions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own accounts." ON public.accounts;
CREATE POLICY "Users can manage their own accounts."
  ON public.accounts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own categories." ON public.categories;
CREATE POLICY "Users can manage their own categories."
  ON public.categories FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own credit cards." ON public.credit_cards;
CREATE POLICY "Users can manage their own credit cards."
  ON public.credit_cards FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own series." ON public.series;
CREATE POLICY "Users can manage their own series."
  ON public.series FOR ALL USING (auth.uid() = user_id);

-- Add RLS policy for people table (created in later migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'people' AND table_schema = 'public') THEN
    ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can manage their own people."
      ON public.people FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
