-- Extrato × Fechamento do mês: "a pagar"/"a receber"/pendentes do DRE passam a
-- usar o mês da FATURA para compras de cartão (mesma regra do Extrato), em vez
-- da data da compra. Receitas/despesas/categorias seguem por competência.
-- Base = definição de 20260924100000 (filtro de transferências + SET timezone).
CREATE OR REPLACE FUNCTION public.orbi_monthly_closing(
  p_month date DEFAULT NULL,
  p_scope text DEFAULT 'personal',
  p_exclude_projects boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := public.orbi_require_auth();
  v_month   date := date_trunc('month', COALESCE(p_month, CURRENT_DATE))::date;
  v_exclude boolean := COALESCE(p_exclude_projects, true);
  v_prev    date;
  v_next    date;
  v_from    date;
  v_scope   uuid[];
  v_result  jsonb;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'dre_pessoal', 'O fechamento do mês');

  IF v_month < DATE '2000-01-01' OR v_month > DATE '2100-12-01' THEN
    RAISE EXCEPTION 'Mês fora do intervalo permitido.' USING ERRCODE = '22023';
  END IF;

  v_prev  := (v_month - INTERVAL '1 month')::date;
  v_next  := (v_month + INTERVAL '1 month')::date;
  v_from  := (v_month - INTERVAL '5 months')::date;
  v_scope := public.orbi_scope_user_ids(p_scope);

  WITH base AS MATERIALIZED (
    SELECT t.id,
           t.user_id,
           t.description,
           t.date,
           t.type,
           t.status,
           t.category_id,
           date_trunc('month', t.date)::date AS m,
           -- "A pagar/receber" segue o Extrato: compra de cartão cai no mês da
           -- fatura (dia >= fechamento → fatura do mês seguinte, mesma regra de
           -- isTransactionInBillingPeriod em src/lib/utils.ts).
           CASE
             WHEN t.credit_card_id IS NOT NULL AND cc.statement_date IS NOT NULL
                  AND EXTRACT(DAY FROM t.date) >= cc.statement_date
               THEN (date_trunc('month', t.date) + INTERVAL '1 month')::date
             ELSE date_trunc('month', t.date)::date
           END AS pm,
           (CASE
              WHEN t.type = 'expense' THEN GREATEST(t.value - COALESCE(t.compensation_value, 0), 0)
              ELSE t.value
            END)::numeric(14,2) AS amount,
           CASE
             WHEN t.type <> 'expense' THEN NULL
             WHEN COALESCE(t.is_fixed, false) OR COALESCE(s.is_fixed, false) THEN 'fixed'
             WHEN t.series_id IS NOT NULL
                  AND t.installment_number IS NOT NULL
                  AND COALESCE(s.total_installments, 0) > 1
                  AND NOT COALESCE(t.is_shared, false) THEN 'installment'
             ELSE 'variable'
           END AS nature
      FROM public.transactions t
      LEFT JOIN public.series s ON s.id = t.series_id
      LEFT JOIN public.credit_cards cc ON cc.id = t.credit_card_id
     WHERE t.user_id = ANY (v_scope)
       AND t.date >= v_from
       AND t.date < v_next
       AND t.status <> 'CANCELED'
       AND t.type IN ('income', 'expense')
       AND NOT (t.type = 'income' AND COALESCE(t.is_shared, false) AND t.linked_txn_id IS NOT NULL)
       -- transferência: perna de entrada
       AND NOT (t.type = 'income' AND t.linked_txn_id IS NOT NULL AND t.category_id IS NULL
                AND t.person_id IS NULL AND NOT COALESCE(t.is_shared, false))
       -- transferência: perna de saída (apontada pela entrada)
       AND NOT (t.type = 'expense' AND t.category_id IS NULL AND EXISTS (
                  SELECT 1 FROM public.transactions tr
                   WHERE tr.linked_txn_id = t.id AND tr.type = 'income' AND tr.category_id IS NULL
                     AND tr.person_id IS NULL AND NOT COALESCE(tr.is_shared, false)))
       AND (NOT v_exclude OR t.project_id IS NULL)
  ),
  totals AS (
    SELECT b.m,
           COALESCE(SUM(b.amount) FILTER (WHERE b.type = 'income'), 0)                              AS income,
           COALESCE(SUM(b.amount) FILTER (WHERE b.type = 'income' AND b.status = 'PAID'), 0)        AS income_received,
           COALESCE(SUM(b.amount) FILTER (WHERE b.type = 'income' AND b.status <> 'PAID'), 0)       AS income_pending,
           COALESCE(SUM(b.amount) FILTER (WHERE b.type = 'expense'), 0)                             AS expenses,
           COALESCE(SUM(b.amount) FILTER (WHERE b.type = 'expense' AND b.status = 'PAID'), 0)       AS expenses_paid,
           COALESCE(SUM(b.amount) FILTER (WHERE b.type = 'expense' AND b.status <> 'PAID'), 0)      AS expenses_pending,
           COALESCE(SUM(b.amount) FILTER (WHERE b.nature = 'fixed'), 0)                             AS fixed,
           COALESCE(SUM(b.amount) FILTER (WHERE b.nature = 'installment'), 0)                       AS installments,
           COALESCE(SUM(b.amount) FILTER (WHERE b.nature = 'variable'), 0)                          AS variable,
           COUNT(*)                                                                                  AS transactions_count,
           COUNT(*) FILTER (WHERE b.status = 'PENDING')                                             AS pending_count
      FROM base b
     GROUP BY b.m
  ),
  pend AS (
    SELECT COALESCE(SUM(b.amount) FILTER (WHERE b.type = 'income' AND b.status <> 'PAID'), 0)  AS income_pending,
           COALESCE(SUM(b.amount) FILTER (WHERE b.type = 'expense' AND b.status <> 'PAID'), 0) AS expenses_pending,
           COUNT(*) FILTER (WHERE b.status = 'PENDING')                                        AS pending_count
      FROM base b
     WHERE b.pm = v_month
  ),
  months AS (
    SELECT gs::date AS m FROM generate_series(v_from, v_month, INTERVAL '1 month') gs
  ),
  series_6m AS (
    SELECT mo.m,
           COALESCE(tt.income, 0)   AS income,
           COALESCE(tt.expenses, 0) AS expenses
      FROM months mo
      LEFT JOIN totals tt ON tt.m = mo.m
  ),
  goal_m AS (
    SELECT COALESCE(SUM(ga.amount) FILTER (WHERE ga.allocated_on >= v_month), 0) AS current_total,
           COALESCE(SUM(ga.amount) FILTER (WHERE ga.allocated_on < v_month), 0)  AS previous_total
      FROM public.goal_allocations ga
     WHERE ga.user_id = ANY (v_scope)
       AND ga.allocated_on >= v_prev
       AND ga.allocated_on < v_next
  ),
  cat AS (
    SELECT b.category_id,
           SUM(b.amount) FILTER (WHERE b.m = v_month)                   AS amount,
           SUM(b.amount) FILTER (WHERE b.m = v_prev)                    AS previous_amount,
           COUNT(*) FILTER (WHERE b.m = v_month)                        AS transactions_count
      FROM base b
     WHERE b.type = 'expense'
       AND b.m >= v_prev
     GROUP BY b.category_id
  ),
  cat_budget AS (
    SELECT bu.category_id, SUM(bu.amount_limit) AS budget_limit
      FROM public.budgets bu
     WHERE bu.user_id = ANY (v_scope)
       AND bu.period_month = v_month
     GROUP BY bu.category_id
  ),
  cat_rows AS (
    SELECT c.category_id,
           COALESCE(k.name, 'Sem categoria')                         AS name,
           k.icon,
           round(COALESCE(c.amount, 0), 2)                           AS amount,
           round(COALESCE(c.previous_amount, 0), 2)                  AS previous_amount,
           public.orbi_pct_change(c.amount, c.previous_amount)       AS variation_pct,
           cb.budget_limit,
           c.transactions_count
      FROM cat c
      LEFT JOIN public.categories k ON k.id = c.category_id
      LEFT JOIN cat_budget cb ON cb.category_id = c.category_id
     WHERE COALESCE(c.amount, 0) > 0
  ),
  inc_rows AS (
    SELECT b.category_id,
           COALESCE(k.name, 'Sem categoria') AS name,
           k.icon,
           round(SUM(b.amount), 2)           AS amount
      FROM base b
      LEFT JOIN public.categories k ON k.id = b.category_id
     WHERE b.type = 'income' AND b.m = v_month
     GROUP BY b.category_id, k.name, k.icon
  ),
  largest AS (
    SELECT b.id, b.description, b.amount, b.date, b.status, COALESCE(k.name, 'Sem categoria') AS category
      FROM base b
      LEFT JOIN public.categories k ON k.id = b.category_id
     WHERE b.type = 'expense' AND b.m = v_month
     ORDER BY b.amount DESC, b.date DESC
     LIMIT 1
  ),
  proj AS (
    SELECT p.id,
           p.name,
           p.color,
           p.status,
           round(COALESCE(SUM(GREATEST(t.value - COALESCE(t.compensation_value, 0), 0)) FILTER (WHERE t.type = 'expense'), 0), 2) AS expenses,
           round(COALESCE(SUM(t.value) FILTER (WHERE t.type = 'income'), 0), 2) AS income,
           COUNT(*) AS transactions_count
      FROM public.transactions t
      JOIN public.projects p ON p.id = t.project_id
     WHERE t.user_id = ANY (v_scope)
       AND t.date >= v_month
       AND t.date < v_next
       AND t.status <> 'CANCELED'
       AND t.type IN ('income', 'expense')
       AND NOT (t.type = 'income' AND COALESCE(t.is_shared, false) AND t.linked_txn_id IS NOT NULL)
       -- transferência: perna de entrada
       AND NOT (t.type = 'income' AND t.linked_txn_id IS NOT NULL AND t.category_id IS NULL
                AND t.person_id IS NULL AND NOT COALESCE(t.is_shared, false))
       -- transferência: perna de saída (apontada pela entrada)
       AND NOT (t.type = 'expense' AND t.category_id IS NULL AND EXISTS (
                  SELECT 1 FROM public.transactions tr
                   WHERE tr.linked_txn_id = t.id AND tr.type = 'income' AND tr.category_id IS NULL
                     AND tr.person_id IS NULL AND NOT COALESCE(tr.is_shared, false)))
     GROUP BY p.id, p.name, p.color, p.status
  ),
  cur AS (
    SELECT * FROM totals WHERE m = v_month
  ),
  prv AS (
    SELECT * FROM totals WHERE m = v_prev
  ),
  summary AS (
    SELECT
      COALESCE(c.income, 0)            AS income,
      COALESCE(c.income_received, 0)   AS income_received,
      pd.income_pending                AS income_pending,
      COALESCE(c.expenses, 0)          AS expenses,
      COALESCE(c.expenses_paid, 0)     AS expenses_paid,
      pd.expenses_pending              AS expenses_pending,
      COALESCE(c.fixed, 0)             AS fixed,
      COALESCE(c.installments, 0)      AS installments,
      COALESCE(c.variable, 0)          AS variable,
      COALESCE(c.transactions_count, 0) AS transactions_count,
      pd.pending_count                 AS pending_count,
      COALESCE(p.income, 0)            AS p_income,
      COALESCE(p.expenses, 0)          AS p_expenses,
      COALESCE(p.fixed, 0)             AS p_fixed,
      COALESCE(p.installments, 0)      AS p_installments,
      COALESCE(p.variable, 0)          AS p_variable,
      (p.m IS NOT NULL)                AS has_previous,
      g.current_total                  AS goals_current,
      g.previous_total                 AS goals_previous
    FROM goal_m g
    CROSS JOIN pend pd
    LEFT JOIN cur c ON true
    LEFT JOIN prv p ON true
  )
  SELECT jsonb_build_object(
    'month',          v_month,
    'previous_month', v_prev,
    'scope',          CASE WHEN p_scope = 'couple' THEN 'couple' ELSE 'personal' END,
    'has_data',       s.transactions_count > 0 OR EXISTS (SELECT 1 FROM proj),
    'has_previous',   s.has_previous,
    'current', jsonb_build_object(
      'income',             s.income,
      'income_received',    s.income_received,
      'income_pending',     s.income_pending,
      'expenses',           s.expenses,
      'expenses_paid',      s.expenses_paid,
      'expenses_pending',   s.expenses_pending,
      'fixed',              s.fixed,
      'installments',       s.installments,
      'variable',           s.variable,
      'result',             s.income - s.expenses,
      'savings_rate',       CASE WHEN s.income > 0 THEN round((s.income - s.expenses) / s.income * 100, 1) END,
      'goal_contributions', s.goals_current,
      'free_cash',          s.income - s.expenses - s.goals_current,
      'transactions_count', s.transactions_count,
      'pending_count',      s.pending_count
    ),
    'previous', jsonb_build_object(
      'income',             s.p_income,
      'expenses',           s.p_expenses,
      'fixed',              s.p_fixed,
      'installments',       s.p_installments,
      'variable',           s.p_variable,
      'result',             s.p_income - s.p_expenses,
      'savings_rate',       CASE WHEN s.p_income > 0 THEN round((s.p_income - s.p_expenses) / s.p_income * 100, 1) END,
      'goal_contributions', s.goals_previous,
      'free_cash',          s.p_income - s.p_expenses - s.goals_previous
    ),
    'variation', jsonb_build_object(
      'income_pct',       public.orbi_pct_change(s.income, s.p_income),
      'expenses_pct',     public.orbi_pct_change(s.expenses, s.p_expenses),
      'result_pct',       public.orbi_pct_change(s.income - s.expenses, s.p_income - s.p_expenses),
      'savings_rate_pp',  CASE
                            WHEN s.income > 0 AND s.p_income > 0 THEN
                              round((s.income - s.expenses) / s.income * 100, 1)
                              - round((s.p_income - s.p_expenses) / s.p_income * 100, 1)
                          END
    ),
    'largest_expense', (SELECT to_jsonb(l) FROM largest l),
    'expense_categories', COALESCE(
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.amount DESC) FROM (SELECT * FROM cat_rows ORDER BY amount DESC LIMIT 8) r),
      '[]'::jsonb
    ),
    'expense_categories_count', (SELECT COUNT(*) FROM cat_rows),
    'income_categories', COALESCE(
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.amount DESC) FROM (SELECT * FROM inc_rows ORDER BY amount DESC LIMIT 5) r),
      '[]'::jsonb
    ),
    'trend', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'month', t6.m,
                'income', t6.income,
                'expenses', t6.expenses,
                'result', t6.income - t6.expenses
              ) ORDER BY t6.m)
         FROM series_6m t6),
      '[]'::jsonb
    ),
    'budgets', (
      SELECT jsonb_build_object(
        'count',  COUNT(*),
        'over',   COUNT(*) FILTER (WHERE COALESCE(r.amount, 0) > cb.budget_limit),
        'limit',  COALESCE(SUM(cb.budget_limit), 0),
        'spent',  COALESCE(SUM(r.amount), 0)
      )
      FROM cat_budget cb
      LEFT JOIN cat_rows r ON r.category_id = cb.category_id
    ),
    'projects', jsonb_build_object(
      'excluded', v_exclude,
      'expenses', COALESCE((SELECT SUM(expenses) FROM proj), 0),
      'income', COALESCE((SELECT SUM(income) FROM proj), 0),
      'transactions_count', COALESCE((SELECT SUM(transactions_count) FROM proj), 0),
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'id', pj.id, 'name', pj.name, 'color', pj.color, 'status', pj.status,
                 'expenses', pj.expenses, 'income', pj.income, 'transactions_count', pj.transactions_count
               ) ORDER BY pj.expenses DESC)
          FROM proj pj
      ), '[]'::jsonb)
    )
  )
  INTO v_result
  FROM summary s;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.orbi_monthly_closing(date, text, boolean) SET timezone = 'America/Sao_Paulo';
REVOKE ALL ON FUNCTION public.orbi_monthly_closing(date, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_monthly_closing(date, text, boolean) TO authenticated;
