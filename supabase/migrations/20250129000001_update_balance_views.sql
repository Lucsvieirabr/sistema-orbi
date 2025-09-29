-- Migration: Update balance views to consider transaction status

BEGIN;

-- Update current balance view to only consider PAID transactions
CREATE OR REPLACE VIEW public.vw_account_current_balance AS
SELECT
  a.id as account_id,
  a.user_id,
  a.initial_balance
    + COALESCE(SUM(CASE WHEN t.type = 'income' AND t.date <= CURRENT_DATE AND t.status = 'PAID' THEN t.value ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.date <= CURRENT_DATE AND t.status = 'PAID' THEN t.value ELSE 0 END), 0)
    AS current_balance
FROM public.accounts a
LEFT JOIN public.transactions t ON a.id = t.account_id
GROUP BY a.id, a.initial_balance, a.user_id;

COMMENT ON VIEW public.vw_account_current_balance IS 'Calculated current balance per account (saldo real) - only considers PAID transactions';

-- Create new projected balance view for future commitments
CREATE OR REPLACE VIEW public.vw_account_projected_balance AS
SELECT
  a.id as account_id,
  a.user_id,
  a.initial_balance
    + COALESCE(SUM(CASE WHEN t.type = 'income' AND t.date <= CURRENT_DATE AND t.status = 'PAID' THEN t.value ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.date <= CURRENT_DATE AND t.status = 'PAID' THEN t.value ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status != 'CANCELED' THEN t.value ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status != 'CANCELED' THEN t.value ELSE 0 END), 0)
    AS projected_balance
FROM public.accounts a
LEFT JOIN public.transactions t ON a.id = t.account_id
GROUP BY a.id, a.initial_balance, a.user_id;

COMMENT ON VIEW public.vw_account_projected_balance IS 'Calculated projected balance per account including future commitments (saldo projetado)';

-- Create view for transactions grouped by series
CREATE OR REPLACE VIEW public.vw_transaction_series AS
SELECT
  series_id,
  MIN(description) as description,
  COUNT(*) as total_installments,
  MAX(installments) as installments,
  MAX(installment_number) as max_installment_number,
  SUM(value) as total_value,
  MIN(date) as first_date,
  MAX(date) as last_date,
  MIN(status) as status
FROM public.transactions
WHERE series_id IS NOT NULL
GROUP BY series_id;

COMMENT ON VIEW public.vw_transaction_series IS 'Groups transactions by series_id for installment display';

COMMIT;
