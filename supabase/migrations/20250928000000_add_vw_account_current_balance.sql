-- Create view for current account balance (Saldo Real)
create or replace view public.vw_account_current_balance as
select
  a.id as account_id,
  a.user_id,
  a.initial_balance
    + coalesce(sum(case when t.type = 'income' and t.date <= current_date then t.value else 0 end), 0)
    - coalesce(sum(case when t.type = 'expense' and t.date <= current_date then t.value else 0 end), 0)
    as current_balance
from public.accounts a
left join public.transactions t on a.id = t.account_id
group by a.id, a.initial_balance, a.user_id;

comment on view public.vw_account_current_balance is 'Calculated current balance per account (saldo real).';

-- Ensure the view is queryable with RLS honoring underlying tables.
-- In Postgres, security barrier views or explicit policies may be needed depending on RLS setup.
-- Here we expose only rows matching authenticated user via a security-definer function wrapper if needed later.


