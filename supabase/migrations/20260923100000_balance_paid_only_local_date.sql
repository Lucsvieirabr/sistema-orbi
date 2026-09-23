-- ============================================================================
-- Saldo real = só PAID, "hoje" no fuso de Brasília, projeção com pendentes
-- vencidos.
--
-- 1) vw_account_current_balance: a versão de 20250928000000 tirou o filtro
--    status = 'PAID' (regressão). Um gasto PENDING com data <= hoje já baixava
--    o saldo, contrariando a copy do Extrato ("Marque como pago para o saldo
--    acompanhar").
-- 2) vw_account_projected_balance somava o realizado DUAS vezes (PAID <= hoje
--    + todos os não cancelados). Projetado = inicial + tudo não cancelado.
-- 3) CURRENT_DATE usa o timezone da sessão (UTC no Supabase): entre 21h e 00h
--    BRT o "hoje" do banco já era amanhã (Projeção "em 23/09" às 23h de 22/09,
--    Projetos com 1 dia a menos). Views usam a data de Brasília explícita;
--    RPCs ganham SET timezone.
-- 4) orbi_cash_forecast: com o saldo real só com PAID, um PENDING vencido
--    (data <= hoje) sumiria da projeção. Ele entra como evento de amanhã.
-- ============================================================================

CREATE OR REPLACE VIEW public.vw_account_current_balance
WITH (security_invoker = true) AS
SELECT a.id AS account_id,
       a.user_id,
       a.initial_balance
         + COALESCE(SUM(CASE WHEN t.type = 'income'  AND t.status = 'PAID'
                              AND t.date <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
                             THEN t.value ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'PAID'
                              AND t.date <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
                             THEN t.value ELSE 0 END), 0) AS current_balance
  FROM public.accounts a
  LEFT JOIN public.transactions t ON t.account_id = a.id
 GROUP BY a.id, a.initial_balance, a.user_id;

COMMENT ON VIEW public.vw_account_current_balance IS
  'Saldo real: initial_balance + PAID com data <= hoje (America/Sao_Paulo). PENDING não entra.';

CREATE OR REPLACE VIEW public.vw_account_projected_balance
WITH (security_invoker = true) AS
SELECT a.id AS account_id,
       a.user_id,
       a.initial_balance
         + COALESCE(SUM(CASE WHEN t.type = 'income'  AND t.status <> 'CANCELED' THEN t.value ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status <> 'CANCELED' THEN t.value ELSE 0 END), 0)
         AS projected_balance
  FROM public.accounts a
  LEFT JOIN public.transactions t ON t.account_id = a.id
 GROUP BY a.id, a.initial_balance, a.user_id;

COMMENT ON VIEW public.vw_account_projected_balance IS
  'Saldo projetado: initial_balance + todos os lançamentos não cancelados (pagos, pendentes e futuros).';

-- vw_goal_progress: meses restantes pelo mês de Brasília.
CREATE OR REPLACE VIEW public.vw_goal_progress
WITH (security_invoker = true) AS
SELECT g.id,
       g.user_id,
       g.name,
       g.target_value,
       g.deadline,
       g.icon,
       g.color,
       g.created_at,
       g.updated_at,
       COALESCE(a.saved, 0)::numeric(12,2) AS saved_value,
       GREATEST(g.target_value - COALESCE(a.saved, 0), 0)::numeric(12,2) AS remaining_value,
       round(COALESCE(a.saved, 0) / g.target_value * 100, 1) AS progress_pct,
       COALESCE(a.movements, 0)::integer AS allocations_count,
       a.last_allocation_on,
       CASE
         WHEN g.deadline IS NULL OR COALESCE(a.saved, 0) >= g.target_value THEN NULL::integer
         ELSE GREATEST((EXTRACT(year FROM g.deadline) - EXTRACT(year FROM d.today)) * 12
                       + (EXTRACT(month FROM g.deadline) - EXTRACT(month FROM d.today)) + 1, 1)::integer
       END AS months_left,
       CASE
         WHEN g.deadline IS NULL OR COALESCE(a.saved, 0) >= g.target_value THEN NULL::numeric
         ELSE round((g.target_value - COALESCE(a.saved, 0))
                    / GREATEST((EXTRACT(year FROM g.deadline) - EXTRACT(year FROM d.today)) * 12
                               + (EXTRACT(month FROM g.deadline) - EXTRACT(month FROM d.today)) + 1, 1), 2)
       END AS monthly_needed,
       g.executed_at,
       pr.id AS project_id
  FROM public.goals g
  CROSS JOIN LATERAL (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today) d
  LEFT JOIN LATERAL (
    SELECT sum(ga.amount) AS saved,
           count(*) AS movements,
           max(ga.allocated_on) AS last_allocation_on
      FROM public.goal_allocations ga
     WHERE ga.goal_id = g.id
  ) a ON true
  LEFT JOIN public.projects pr ON pr.goal_id = g.id;

-- RPCs que dependem de CURRENT_DATE: "hoje" = Brasília.
ALTER FUNCTION public.orbi_budget_overview(date, text, boolean)      SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_cash_forecast(integer, text)               SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_daily_burn_rate(integer, text)             SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_goals_guard()                              SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_monthly_closing(date, text, boolean)       SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_personal_inflation_compute(uuid, date)     SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_personal_inflation_run_monthly()           SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_personal_inflation(integer, boolean)       SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_project_close(uuid, boolean)               SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_project_overview(uuid)                     SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_project_reopen(uuid, date)                 SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_projects_auto_archive()                    SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.orbi_quota_snapshot()                           SET timezone = 'America/Sao_Paulo';

-- Projeção: PENDING vencido (sem cartão) cai como compromisso de amanhã.
CREATE OR REPLACE FUNCTION public.orbi_cash_forecast(p_horizon_days integer DEFAULT 90, p_scope text DEFAULT 'personal'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET timezone TO 'America/Sao_Paulo'
AS $function$
DECLARE
  v_uid      uuid := public.orbi_require_auth();
  v_horizon  integer := COALESCE(p_horizon_days, 90);
  v_scope    uuid[];
  v_end      date;
  v_balance  numeric;
  v_events   jsonb;
  v_projects jsonb;
  v_has_projects boolean;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'motor_preditivo', 'Motor preditivo');

  IF v_horizon < 7 OR v_horizon > 400 THEN
    RAISE EXCEPTION 'Horizonte precisa estar entre 7 e 400 dias.' USING ERRCODE = '22023';
  END IF;

  v_scope := public.orbi_scope_user_ids(p_scope);
  v_end   := CURRENT_DATE + v_horizon;
  v_has_projects := COALESCE(public.orbi_active_plan_features(v_uid) ->> 'projetos_vida', 'false') = 'true';

  SELECT COALESCE(SUM(b.current_balance), 0)
    INTO v_balance
    FROM public.vw_account_current_balance b
   WHERE b.user_id = ANY (v_scope);

  WITH scheduled AS (
    -- Saldo real só tem PAID <= hoje. Todo o resto que não é cartão entra aqui:
    -- futuro na própria data; PENDING vencido de conta amanhã (ainda vai sair
    -- do caixa — antes ele já estava embutido no saldo real).
    SELECT GREATEST(t.date, CURRENT_DATE + 1) AS event_date,
           CASE WHEN t.type = 'income' THEN t.value ELSE -t.value END AS amount,
           t.description,
           'scheduled'::text AS kind
      FROM public.transactions t
     WHERE t.user_id = ANY (v_scope)
       AND t.credit_card_id IS NULL
       AND t.type IN ('income', 'expense')
       AND t.status <> 'CANCELED'
       AND (t.date > CURRENT_DATE OR (t.status = 'PENDING' AND t.account_id IS NOT NULL))
       AND t.date <= v_end
  ),
  card_rows AS (
    SELECT cc.id AS card_id,
           cc.name AS card_name,
           t.type,
           t.value,
           (date_trunc('month', t.date)
             + CASE WHEN EXTRACT(DAY FROM t.date) >= cc.statement_date THEN INTERVAL '1 month' ELSE INTERVAL '0' END
           )::date AS closing_month,
           cc.statement_date,
           cc.due_date
      FROM public.transactions t
      JOIN public.credit_cards cc ON cc.id = t.credit_card_id
     WHERE t.user_id = ANY (v_scope)
       AND t.type IN ('income', 'expense')
       AND t.status <> 'CANCELED'
       AND t.date > CURRENT_DATE - 120
       AND t.date <= v_end
  ),
  card_due AS (
    SELECT r.card_id,
           r.card_name,
           r.type,
           r.value,
           d.due_month,
           (d.due_month + (LEAST(r.due_date, EXTRACT(DAY FROM (d.due_month + INTERVAL '1 month - 1 day'))::int) - 1))::date AS due
      FROM card_rows r
      CROSS JOIN LATERAL (
        SELECT (r.closing_month + CASE WHEN r.due_date <= r.statement_date THEN INTERVAL '1 month' ELSE INTERVAL '0' END)::date AS due_month
      ) d
  ),
  invoices AS (
    SELECT cd.due AS event_date,
           SUM(CASE WHEN cd.type = 'income' THEN cd.value ELSE -cd.value END) AS amount,
           'Fatura ' || cd.card_name AS description,
           'invoice'::text AS kind
      FROM card_due cd
     WHERE cd.due > CURRENT_DATE
       AND cd.due <= v_end
     GROUP BY cd.card_id, cd.card_name, cd.due
  ),
  fixed_last AS (
    SELECT DISTINCT ON (s.id)
           s.id,
           s.frequency,
           s.end_date,
           t.date AS last_date,
           t.type,
           t.value,
           COALESCE(NULLIF(btrim(s.description), ''), t.description) AS description
      FROM public.series s
      JOIN public.transactions t ON t.series_id = s.id
     WHERE s.user_id = ANY (v_scope)
       AND COALESCE(s.is_fixed, false) = true
       AND t.type IN ('income', 'expense')
       AND t.status <> 'CANCELED'
     ORDER BY s.id, t.date DESC
  ),
  recurring AS (
    SELECT o.occurrence AS event_date,
           CASE WHEN f.type = 'income' THEN f.value ELSE -f.value END AS amount,
           f.description,
           'recurring'::text AS kind
      FROM fixed_last f
      CROSS JOIN LATERAL (
        SELECT (f.last_date + n * CASE f.frequency
                                    WHEN 'daily'  THEN INTERVAL '1 day'
                                    WHEN 'weekly' THEN INTERVAL '7 days'
                                    WHEN 'yearly' THEN INTERVAL '1 year'
                                    ELSE INTERVAL '1 month'
                                  END)::date AS occurrence
          FROM generate_series(1, CASE f.frequency
                                    WHEN 'daily'  THEN 400
                                    WHEN 'weekly' THEN 60
                                    WHEN 'yearly' THEN 2
                                    ELSE 14
                                  END) AS n
      ) o
     WHERE o.occurrence > CURRENT_DATE
       AND o.occurrence <= v_end
       AND (f.end_date IS NULL OR o.occurrence <= f.end_date)
  ),
  project_base AS (
    SELECT p.id,
           p.name,
           p.budget,
           p.end_date,
           GREATEST(p.start_date, CURRENT_DATE + 1) AS from_d,
           COALESCE(SUM(GREATEST(t.value - COALESCE(t.compensation_value, 0), 0)) FILTER (WHERE t.type = 'expense'), 0) AS consumed
      FROM public.projects p
      LEFT JOIN public.transactions t
        ON t.project_id = p.id AND t.user_id = p.user_id AND t.status <> 'CANCELED'
     WHERE v_has_projects
       AND p.user_id = ANY (v_scope)
       AND p.status = 'active'
       AND p.end_date > CURRENT_DATE
     GROUP BY p.id, p.name, p.budget, p.end_date, p.start_date
  ),
  project_events AS (
    SELECT (pb.from_d + g.n * 7 + LEAST(6, pb.end_date - (pb.from_d + g.n * 7)))::date AS event_date,
           -((pb.budget - pb.consumed) / (pb.end_date - pb.from_d + 1))
             * (LEAST(6, pb.end_date - (pb.from_d + g.n * 7)) + 1) AS amount,
           'Projeto ' || pb.name AS description,
           'project'::text AS kind
      FROM project_base pb
      CROSS JOIN LATERAL generate_series(0, GREATEST((LEAST(pb.end_date, v_end) - pb.from_d) / 7, 0)) AS g(n)
     WHERE pb.budget - pb.consumed > 0
       AND pb.from_d <= LEAST(pb.end_date, v_end)
  ),
  all_events AS (
    SELECT * FROM scheduled
    UNION ALL SELECT * FROM invoices
    UNION ALL SELECT * FROM recurring
    UNION ALL SELECT * FROM project_events WHERE event_date <= v_end
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'date', e.event_date,
           'amount', round(e.amount, 2),
           'description', e.description,
           'kind', e.kind
         ) ORDER BY e.event_date, e.amount), '[]'::jsonb)
    INTO v_events
    FROM (SELECT * FROM all_events WHERE round(amount, 2) <> 0 ORDER BY event_date LIMIT 3000) e;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'name', p.name,
           'end_date', p.end_date,
           'budget', p.budget,
           'consumed', round(p.consumed, 2),
           'remaining', round(GREATEST(p.budget - p.consumed, 0), 2)
         ) ORDER BY p.end_date), '[]'::jsonb)
    INTO v_projects
    FROM (
      SELECT pr.id, pr.name, pr.end_date, pr.budget,
             COALESCE((
               SELECT SUM(GREATEST(t.value - COALESCE(t.compensation_value, 0), 0))
                 FROM public.transactions t
                WHERE t.project_id = pr.id AND t.user_id = pr.user_id AND t.type = 'expense' AND t.status <> 'CANCELED'
             ), 0) AS consumed
        FROM public.projects pr
       WHERE v_has_projects
         AND pr.user_id = ANY (v_scope)
         AND pr.status = 'active'
         AND pr.end_date > CURRENT_DATE
    ) p;

  RETURN jsonb_build_object(
    'as_of', CURRENT_DATE,
    'horizon_days', v_horizon,
    'scope', CASE WHEN p_scope = 'couple' THEN 'couple' ELSE 'personal' END,
    'current_balance', round(v_balance, 2),
    'burn', public.orbi_daily_burn_rate(90, p_scope),
    'events', v_events,
    'projects', v_projects
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.orbi_cash_forecast(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_cash_forecast(integer, text) TO authenticated;

-- Excluir categoria usada numa série falhava com 23503 (FK sem ação), enquanto
-- transactions.category_id já é SET NULL. Série segue o mesmo comportamento.
ALTER TABLE public.series DROP CONSTRAINT IF EXISTS series_category_id_fkey;
ALTER TABLE public.series
  ADD CONSTRAINT series_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
