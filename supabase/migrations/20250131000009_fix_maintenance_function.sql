-- Fix maintenance function to work with new series-based structure
-- This migration updates the maintain_fixed_transaction_series function to work with the new schema

BEGIN;

-- Drop the old functions
DROP FUNCTION IF EXISTS maintain_fixed_transaction_series();
DROP FUNCTION IF EXISTS generate_future_fixed_transactions(UUID, DATE, INTEGER);

-- Create updated maintain_fixed_transaction_series function
CREATE OR REPLACE FUNCTION maintain_fixed_transaction_series()
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
BEGIN
  -- Find all fixed transaction series that need maintenance
  -- Now we check the series table for is_fixed instead of transactions table
  FOR series_record IN
    SELECT DISTINCT s.id as series_id
    FROM series s
    WHERE s.is_fixed = true
    AND EXISTS (
      SELECT 1 FROM transactions t 
      WHERE t.series_id = s.id 
      AND t.status = 'PENDING'
    )
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
        -- Generate 12 more months of transactions
        transactions_to_insert := 12;
        generated_count := generate_future_fixed_transactions(
          series_record.series_id,
          last_transaction.date,
          transactions_to_insert
        );

        -- Return results
        series_id := series_record.series_id;
        generated_count := COALESCE(generated_count, 0);
        next_generation_date := next_date;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

-- Create updated generate_future_fixed_transactions function
CREATE OR REPLACE FUNCTION generate_future_fixed_transactions(
  target_series_id UUID,
  from_date DATE,
  count INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  transactions_to_insert INTEGER;
  i INTEGER;
  new_date DATE;
  sample_transaction RECORD;
  inserted_count INTEGER;
BEGIN
  -- Get a sample transaction from the series to copy properties
  SELECT * INTO sample_transaction
  FROM transactions
  WHERE series_id = target_series_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Start from the day after the from_date
  new_date := (from_date::date + INTERVAL '1 month')::date;
  transactions_to_insert := count;
  inserted_count := 0;

  -- Generate future transactions (without the removed fields)
  FOR i IN 1..transactions_to_insert LOOP
    INSERT INTO transactions (
      user_id, type, value, description, date, account_id, category_id,
      payment_method, credit_card_id, person_id, series_id, status
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
      target_series_id,
      'PENDING'
    );

    inserted_count := inserted_count + 1;
    new_date := (new_date + INTERVAL '1 month')::date;
  END LOOP;

  RETURN inserted_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION maintain_fixed_transaction_series TO authenticated;
GRANT EXECUTE ON FUNCTION generate_future_fixed_transactions TO authenticated;

COMMIT;
