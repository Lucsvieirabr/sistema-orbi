-- Function to update transaction with balance impact calculation
CREATE OR REPLACE FUNCTION update_transaction_with_balance(
  transaction_id UUID,
  new_type TEXT,
  new_value NUMERIC,
  new_description TEXT,
  new_date DATE,
  new_account_id UUID,
  new_category_id UUID,
  new_payment_method TEXT,
  new_credit_card_id UUID,
  new_person_id UUID,
  new_is_fixed BOOLEAN,
  new_installments INTEGER,
  value_difference NUMERIC,
  affected_account_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_transaction RECORD;
  old_value NUMERIC;
  old_account_id UUID;
  old_type TEXT;
BEGIN
  -- Get current transaction data
  SELECT * INTO old_transaction
  FROM transactions
  WHERE id = transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  old_value := old_transaction.value;
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

  -- Update the transaction
  UPDATE transactions SET
    type = new_type,
    value = new_value,
    description = new_description,
    date = new_date,
    account_id = new_account_id,
    category_id = new_category_id,
    payment_method = new_payment_method,
    credit_card_id = new_credit_card_id,
    person_id = new_person_id,
    is_fixed = new_is_fixed,
    installments = new_installments,
    updated_at = NOW()
  WHERE id = transaction_id;

  -- Update account balance if there's an affected account and value changed
  IF affected_account_id IS NOT NULL AND value_difference != 0 THEN
    -- Reverse the impact of the old value
    IF old_value > 0 THEN
      IF old_transaction.type = 'income' THEN
        -- For income, we need to subtract the old value from the balance
        UPDATE accounts
        SET initial_balance = initial_balance - old_value
        WHERE id = affected_account_id;
      ELSIF old_transaction.type = 'expense' THEN
        -- For expense, we need to add back the old value to the balance
        UPDATE accounts
        SET initial_balance = initial_balance + old_value
        WHERE id = affected_account_id;
      END IF;
    END IF;

    -- Apply the impact of the new value
    IF new_value > 0 THEN
      IF new_type = 'income' THEN
        -- For income, add the new value to the balance
        UPDATE accounts
        SET initial_balance = initial_balance + new_value
        WHERE id = affected_account_id;
      ELSIF new_type = 'expense' THEN
        -- For expense, subtract the new value from the balance
        UPDATE accounts
        SET initial_balance = initial_balance - new_value
        WHERE id = affected_account_id;
      END IF;
    END IF;
  END IF;

  -- Log the transaction update
  RAISE NOTICE 'Transaction % updated. Value changed from % to %, balance impact: %',
    transaction_id, old_value, new_value, value_difference;

END;
$$;
