-- Function to update transaction series with balance impact calculation
CREATE OR REPLACE FUNCTION update_transaction_series_with_balance(
  series_id UUID,
  from_date DATE,
  new_type TEXT,
  new_value NUMERIC,
  new_description TEXT,
  new_account_id UUID,
  new_category_id UUID,
  new_payment_method TEXT,
  new_credit_card_id UUID,
  new_family_member_id UUID,
  new_is_fixed BOOLEAN,
  new_installments INTEGER,
  total_value_difference NUMERIC,
  affected_account_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
  old_transaction RECORD;
  old_value NUMERIC;
  old_account_id UUID;
  old_type TEXT;
BEGIN
  -- Get a sample transaction to understand the original setup
  SELECT * INTO old_transaction
  FROM transactions
  WHERE transactions.series_id = update_transaction_series_with_balance.series_id AND date >= from_date
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No transactions found in series after date %', from_date;
  END IF;

  old_type := old_transaction.type;
  old_account_id := CASE
    WHEN old_transaction.type = 'income' THEN old_transaction.account_id
    WHEN old_transaction.type = 'expense' AND old_transaction.payment_method = 'debit' THEN old_transaction.account_id
    WHEN old_transaction.type = 'expense' AND old_transaction.payment_method = 'credit' THEN (
      SELECT connected_account_id
      FROM credit_cards
      WHERE id = old_transaction.credit_card_id
    )
    ELSE NULL
  END;

  -- Update all future transactions in the series
  UPDATE transactions SET
    type = new_type,
    value = new_value,
    description = new_description,
    account_id = new_account_id,
    category_id = new_category_id,
    payment_method = new_payment_method,
    credit_card_id = new_credit_card_id,
    family_member_id = new_family_member_id,
    is_fixed = new_is_fixed,
    installments = new_installments,
    updated_at = NOW()
  WHERE transactions.series_id = update_transaction_series_with_balance.series_id AND date >= from_date;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Update account balance if there's an affected account and total value changed
  IF affected_account_id IS NOT NULL AND total_value_difference != 0 THEN
    -- Reverse the impact of the old total value
    IF old_type = 'income' THEN
      -- For income, we need to subtract the old total value from the balance
      UPDATE accounts
      SET initial_balance = initial_balance - ABS(total_value_difference)
      WHERE id = affected_account_id;
    ELSIF old_type = 'expense' THEN
      -- For expense, we need to add back the old total value to the balance
      UPDATE accounts
      SET initial_balance = initial_balance + ABS(total_value_difference)
      WHERE id = affected_account_id;
    END IF;

    -- Apply the impact of the new total value
    IF new_type = 'income' THEN
      -- For income, add the new total value to the balance
      UPDATE accounts
      SET initial_balance = initial_balance + ABS(total_value_difference)
      WHERE id = affected_account_id;
    ELSIF new_type = 'expense' THEN
      -- For expense, subtract the new total value from the balance
      UPDATE accounts
      SET initial_balance = initial_balance - ABS(total_value_difference)
      WHERE id = affected_account_id;
    END IF;
  END IF;

  -- Log the transaction series update
  RAISE NOTICE 'Transaction series % updated. % transactions affected, total value difference: %',
    series_id, updated_count, total_value_difference;

  RETURN updated_count;
END;
$$;
