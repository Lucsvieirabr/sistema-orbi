-- Add is_fixed column back to transactions table
-- This migration adds the is_fixed column to transactions table to support fixed/recurring transactions
-- The column allows NULL values and defaults to FALSE for backward compatibility

BEGIN;

-- Add is_fixed column to transactions table
-- This column will be used to mark transactions as fixed/recurring
ALTER TABLE public.transactions 
ADD COLUMN is_fixed boolean DEFAULT FALSE;

-- Update existing transactions to have is_fixed = FALSE by default
-- This ensures backward compatibility with existing data
UPDATE public.transactions 
SET is_fixed = FALSE 
WHERE is_fixed IS NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN public.transactions.is_fixed IS 'Indicates if the transaction is fixed/recurring. Used for recurring transactions functionality.';

-- Create index for performance on is_fixed queries
CREATE INDEX idx_transactions_is_fixed ON public.transactions(is_fixed) WHERE is_fixed = TRUE;

-- Update the series table to also support is_fixed if needed
-- This ensures consistency between series and individual transactions
ALTER TABLE public.series 
ADD COLUMN IF NOT EXISTS is_fixed boolean DEFAULT FALSE;

-- Update existing series to have is_fixed = FALSE by default
UPDATE public.series 
SET is_fixed = FALSE 
WHERE is_fixed IS NULL;

-- Add comment to document the series is_fixed column
COMMENT ON COLUMN public.series.is_fixed IS 'Indicates if the series represents fixed/recurring transactions. Used for recurring series functionality.';

-- Create index for performance on series is_fixed queries
CREATE INDEX idx_series_is_fixed ON public.series(is_fixed) WHERE is_fixed = TRUE;

-- Update the series_summary view to include is_fixed information
DROP VIEW IF EXISTS public.series_summary;

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

-- Grant access to the updated view
GRANT SELECT ON public.series_summary TO authenticated;

-- Create smart maintenance function for fixed transactions
CREATE OR REPLACE FUNCTION maintain_smart_fixed_transactions()
RETURNS TABLE (
  series_id UUID,
  generated_count INTEGER,
  next_generation_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  series_record RECORD;
  last_transaction RECORD;
  next_date DATE;
  transactions_to_insert INTEGER;
  generated_count INTEGER;
  sample_transaction RECORD;
  new_date DATE;
  i INTEGER;
BEGIN
  -- Find all fixed transaction series that need maintenance
  FOR series_record IN
    SELECT DISTINCT s.id, s.user_id, s.description, s.total_value, s.category_id
    FROM series s
    WHERE s.is_fixed = true
  LOOP
    -- Get the last transaction in this series
    SELECT * INTO last_transaction
    FROM transactions
    WHERE transactions.series_id = series_record.series_id
    ORDER BY date DESC
    LIMIT 1;

    IF FOUND THEN
      -- Calculate next date (3 months from last transaction)
      next_date := (last_transaction.date::date + INTERVAL '3 months')::date;

      -- Check if we need to generate more transactions (less than 3 months remaining)
      IF next_date <= CURRENT_DATE + INTERVAL '3 months' THEN
        -- Get a sample transaction from the series to copy properties
        SELECT * INTO sample_transaction
        FROM transactions
        WHERE series_id = series_record.series_id
        LIMIT 1;

        IF FOUND THEN
          -- Generate 6 more months of transactions
          transactions_to_insert := 6;
          generated_count := 0;
          new_date := (last_transaction.date::date + INTERVAL '1 month')::date;

          -- Generate future transactions
          FOR i IN 1..transactions_to_insert LOOP
            INSERT INTO transactions (
              user_id, type, value, description, date, account_id, category_id,
              payment_method, credit_card_id, person_id, series_id, status, is_fixed
            ) VALUES (
              sample_transaction.user_id,
              sample_transaction.type,
              sample_transaction.value,
              sample_transaction.description,
              new_date,
              sample_transaction.account_id,
              sample_transaction.category_id,
              sample_transaction.payment_method,
              sample_transaction.credit_card_id,
              sample_transaction.person_id,
              series_record.series_id,
              'PENDING',
              true
            );

            generated_count := generated_count + 1;
            new_date := (new_date + INTERVAL '1 month')::date;
          END LOOP;

          -- Update series totals
          UPDATE series 
          SET 
            total_installments = total_installments + generated_count,
            total_value = total_value + (sample_transaction.value * generated_count),
            updated_at = NOW()
          WHERE id = series_record.series_id;

          -- Return results
          series_id := series_record.series_id;
          next_generation_date := next_date;
          RETURN NEXT;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

-- Grant permissions for the maintenance function
GRANT EXECUTE ON FUNCTION maintain_smart_fixed_transactions TO authenticated;

-- Add comment
COMMENT ON FUNCTION maintain_smart_fixed_transactions IS 'Maintains fixed transaction series by generating future transactions when needed. Generates 6 months ahead when less than 3 months remain.';

COMMIT;
