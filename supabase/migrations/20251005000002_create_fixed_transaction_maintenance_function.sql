-- Migration: Create maintenance function for fixed/recurring transactions
-- This function generates future transactions for fixed series automatically

BEGIN;

-- Create or replace function to maintain fixed transaction series
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
  generated_count INTEGER := 0;
  last_date DATE;
  current_date DATE := CURRENT_DATE;
BEGIN
  -- Loop through all active fixed series
  FOR series_record IN
    SELECT s.id, s.frequency, s.start_date, s.end_date, s.total_value, s.description, s.category_id, s.account_id, s.credit_card_id, s.person_id
    FROM public.series s
    WHERE s.is_fixed = TRUE
      AND (s.end_date IS NULL OR s.end_date >= current_date)
  LOOP
    -- Find the last transaction for this series
    SELECT t.date, t.account_id, t.credit_card_id, t.person_id, t.payment_method, t.status
    INTO last_transaction
    FROM public.transactions t
    WHERE t.series_id = series_record.id
    ORDER BY t.date DESC
    LIMIT 1;

    -- If no transaction exists, use start_date as reference
    IF last_transaction.date IS NULL THEN
      last_date := series_record.start_date;
    ELSE
      last_date := last_transaction.date;
    END IF;

    -- Calculate next date based on frequency
    CASE series_record.frequency
      WHEN 'daily' THEN
        next_date := last_date + INTERVAL '1 day';
      WHEN 'weekly' THEN
        next_date := last_date + INTERVAL '1 week';
      WHEN 'monthly' THEN
        next_date := last_date + INTERVAL '1 month';
      WHEN 'yearly' THEN
        next_date := last_date + INTERVAL '1 year';
      ELSE
        next_date := last_date + INTERVAL '1 month'; -- Default to monthly
    END CASE;

    -- Check if we need to generate more transactions (less than 3 months remaining)
    IF next_date <= current_date + INTERVAL '3 months' THEN
      -- Generate up to 12 more transactions
      transactions_to_insert := 12;
      generated_count := generate_future_fixed_transactions(
        series_record.id,
        next_date,
        transactions_to_insert
      );

      -- Return results
      series_id := series_record.id;
      next_generation_date := next_date + (transactions_to_insert::text || ' ' || series_record.frequency)::interval;
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

-- Create or replace helper function to generate future transactions for a fixed series
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
  series_record RECORD;
  transaction_date DATE;
  inserted_count INTEGER := 0;
  i INTEGER;
BEGIN
  -- Get series information
  SELECT s.frequency, s.total_value, s.description, s.category_id, s.account_id, s.credit_card_id, s.person_id, s.end_date
  INTO series_record
  FROM public.series s
  WHERE s.id = target_series_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Generate transactions
  transaction_date := from_date;

  FOR i IN 1..count LOOP
    -- Check if this date is within the series end date (if specified)
    IF series_record.end_date IS NOT NULL AND transaction_date > series_record.end_date THEN
      EXIT;
    END IF;

    -- Check if transaction already exists for this date
    IF NOT EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.series_id = target_series_id
        AND t.date = transaction_date
    ) THEN
      -- Insert new transaction
      INSERT INTO public.transactions (
        user_id,
        description,
        value,
        date,
        type,
        payment_method,
        account_id,
        credit_card_id,
        category_id,
        person_id,
        series_id,
        is_fixed,
        status
      )
      SELECT
        s.user_id,
        s.description,
        s.total_value,
        transaction_date,
        'expense', -- Default to expense, can be changed later
        'debit',
        s.account_id,
        s.credit_card_id,
        s.category_id,
        s.person_id,
        s.id,
        TRUE,
        'PENDING'
      FROM public.series s
      WHERE s.id = target_series_id;

      inserted_count := inserted_count + 1;
    END IF;

    -- Calculate next date
    CASE series_record.frequency
      WHEN 'daily' THEN
        transaction_date := transaction_date + INTERVAL '1 day';
      WHEN 'weekly' THEN
        transaction_date := transaction_date + INTERVAL '1 week';
      WHEN 'monthly' THEN
        transaction_date := transaction_date + INTERVAL '1 month';
      WHEN 'yearly' THEN
        transaction_date := transaction_date + INTERVAL '1 year';
      ELSE
        transaction_date := transaction_date + INTERVAL '1 month';
    END CASE;
  END LOOP;

  RETURN inserted_count;
END;
$$;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION maintain_fixed_transaction_series() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_future_fixed_transactions(UUID, DATE, INTEGER) TO authenticated;

-- Create a function that can be called by a cron job or scheduled task
CREATE OR REPLACE FUNCTION run_fixed_transaction_maintenance()
RETURNS TABLE (
  processed_series INTEGER,
  generated_transactions INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  maintenance_result RECORD;
  total_series INTEGER := 0;
  total_transactions INTEGER := 0;
BEGIN
  FOR maintenance_result IN SELECT * FROM maintain_fixed_transaction_series()
  LOOP
    total_series := total_series + 1;
    total_transactions := total_transactions + COALESCE(maintenance_result.generated_count, 0);
  END LOOP;

  processed_series := total_series;
  generated_transactions := total_transactions;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION run_fixed_transaction_maintenance() TO authenticated;

COMMIT;
