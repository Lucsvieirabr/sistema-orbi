-- Migration: Implement Series and Events Model for Scalable Installment Management
-- This migration creates the master series table and refactors transactions to be simpler events

BEGIN;

-- 1. Create the master series table for installment contracts
CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  description text NOT NULL,
  total_value numeric(12,2) NOT NULL, -- Precise monetary value
  total_installments integer NOT NULL,
  is_fixed boolean NOT NULL DEFAULT FALSE, -- For recurring payments
  category_id uuid REFERENCES public.categories(id),
  created_by_txn_id uuid, -- Optional: original transaction that created this series
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Add RLS for series table
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own series."
  ON public.series FOR ALL USING (auth.uid() = user_id);

-- 3. Create indexes for performance
CREATE INDEX idx_series_user_id ON public.series(user_id);
CREATE INDEX idx_series_category_id ON public.series(category_id);
CREATE INDEX idx_series_created_by_txn_id ON public.series(created_by_txn_id);

-- 4. Backup existing transaction data before refactoring
-- Create a temporary table to store existing installment data
CREATE TEMP TABLE temp_installment_data AS
SELECT 
  t.id,
  t.user_id,
  t.description,
  t.value,
  t.date,
  t.type,
  t.payment_method,
  t.installments,
  t.installment_number,
  t.is_fixed,
  t.account_id,
  t.credit_card_id,
  t.category_id,
  t.family_member_id,
  t.status,
  t.series_id,
  t.created_at
FROM public.transactions t
WHERE t.installments > 1 OR t.series_id IS NOT NULL;

-- 5. Create series records from existing installment transactions
-- Group by series_id or create new series for ungrouped installments
INSERT INTO public.series (
  user_id,
  description,
  total_value,
  total_installments,
  is_fixed,
  category_id,
  created_by_txn_id
)
SELECT DISTINCT
  t.user_id,
  t.description,
  -- Calculate total value from existing installments
  SUM(t.value) as total_value,
  MAX(t.installments) as total_installments,
  BOOL_OR(t.is_fixed) as is_fixed,
  t.category_id,
  -- Use the first transaction as the creator
  (array_agg(t.id ORDER BY t.created_at))[1] as created_by_txn_id
FROM temp_installment_data t
WHERE t.installments > 1
GROUP BY 
  t.user_id,
  t.description,
  t.category_id,
  t.series_id,
  -- Group by similar characteristics for ungrouped installments
  t.account_id,
  t.credit_card_id,
  t.family_member_id,
  t.type,
  t.payment_method;

-- 6. Update transactions to reference the new series
-- First, update transactions that already have series_id
UPDATE public.transactions 
SET series_id = s.id
FROM public.series s
WHERE public.transactions.series_id IS NOT NULL
  AND public.transactions.user_id = s.user_id
  AND public.transactions.description = s.description
  AND public.transactions.category_id = s.category_id;

-- 7. Drop dependent views before removing columns
DROP VIEW IF EXISTS public.vw_transaction_series;

-- 8. Remove obsolete columns from transactions table
-- These will be managed by the series table now
ALTER TABLE public.transactions 
  DROP COLUMN IF EXISTS installments,
  DROP COLUMN IF EXISTS installment_number,
  DROP COLUMN IF EXISTS is_fixed;

-- 9. Add constraint to ensure series_id references valid series
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_series_id_fkey 
  FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;

-- 10. Create function to update series updated_at timestamp
CREATE OR REPLACE FUNCTION update_series_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the series updated_at timestamp when any transaction changes
  IF NEW.series_id IS NOT NULL THEN
    UPDATE public.series 
    SET updated_at = now() 
    WHERE id = NEW.series_id;
  END IF;
  
  -- Handle series_id changes
  IF OLD.series_id IS NOT NULL AND OLD.series_id != NEW.series_id THEN
    UPDATE public.series 
    SET updated_at = now() 
    WHERE id = OLD.series_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger to automatically update series timestamp
CREATE TRIGGER update_series_updated_at_trigger
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_series_updated_at();

-- 12. Update existing function to work with new series table
-- The function is already defined in migration 20250131000007
-- We just need to update it to work with the new series table structure

-- 13. Grant necessary permissions
GRANT ALL ON public.series TO authenticated;
GRANT EXECUTE ON FUNCTION create_installment_series TO authenticated;
GRANT EXECUTE ON FUNCTION update_installment_series TO authenticated;

-- 14. Create view for series with transaction summary
CREATE VIEW public.series_summary AS
SELECT 
  s.id,
  s.user_id,
  s.description,
  s.total_value,
  s.total_installments,
  s.is_fixed,
  s.category_id,
  s.created_at,
  s.updated_at,
  COUNT(t.id) as created_installments,
  COUNT(CASE WHEN t.status = 'PAID' THEN 1 END) as paid_installments,
  COUNT(CASE WHEN t.status = 'PENDING' THEN 1 END) as pending_installments,
  SUM(CASE WHEN t.status = 'PAID' THEN t.value ELSE 0 END) as paid_value,
  SUM(CASE WHEN t.status = 'PENDING' THEN t.value ELSE 0 END) as pending_value
FROM public.series s
LEFT JOIN public.transactions t ON s.id = t.series_id
GROUP BY s.id, s.user_id, s.description, s.total_value, s.total_installments, 
         s.is_fixed, s.category_id, s.created_at, s.updated_at;

-- Grant access to the view
GRANT SELECT ON public.series_summary TO authenticated;

COMMIT;
