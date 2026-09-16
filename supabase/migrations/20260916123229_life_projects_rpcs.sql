CREATE OR REPLACE FUNCTION public.orbi_project_totals(p_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH p AS (
    SELECT pr.* FROM public.projects pr WHERE pr.id = p_project_id
  ),
  t AS (
    SELECT x.type,
           x.status,
           x.date,
           x.value,
           COALESCE(x.compensation_value, 0) AS compensation,
           GREATEST(x.value - COALESCE(x.compensation_value, 0), 0) AS net,
           (x.type = 'income' AND COALESCE(x.is_shared, false) AND x.linked_txn_id IS NOT NULL) AS is_receivable
      FROM public.transactions x
      JOIN p ON x.project_id = p.id AND x.user_id = p.user_id
     WHERE x.status <> 'CANCELED'
       AND x.type IN ('income', 'expense')
  )
  SELECT jsonb_build_object(
    'budget',            (SELECT budget FROM p),
    'funded_from_goal',  (SELECT funded_from_goal FROM p),
    'spent',             round(COALESCE((SELECT SUM(net) FROM t WHERE type = 'expense' AND status = 'PAID'), 0), 2),
    'committed',         round(COALESCE((SELECT SUM(net) FROM t WHERE type = 'expense' AND status = 'PENDING'), 0), 2),
    'gross',             round(COALESCE((SELECT SUM(value) FROM t WHERE type = 'expense'), 0), 2),
    'compensation',      round(COALESCE((SELECT SUM(compensation) FROM t WHERE type = 'expense'), 0), 2),
    'income',            round(COALESCE((SELECT SUM(value) FROM t WHERE type = 'income' AND NOT is_receivable), 0), 2),
    'cost',              round(COALESCE((SELECT SUM(net) FROM t WHERE type = 'expense'), 0), 2),
    'remaining',         round((SELECT budget FROM p) - COALESCE((SELECT SUM(net) FROM t WHERE type = 'expense'), 0), 2),
    'transactions',      (SELECT COUNT(*) FROM t WHERE NOT is_receivable),
    'pending',           (SELECT COUNT(*) FROM t WHERE status = 'PENDING' AND NOT is_receivable),
    'first_date',        (SELECT MIN(date) FROM t),
    'last_date',         (SELECT MAX(date) FROM t)
  );
$$;

CREATE OR REPLACE FUNCTION public.orbi_projects_list(p_scope text DEFAULT 'personal')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := public.orbi_require_auth();
  v_scope  uuid[];
  v_result jsonb;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'projetos_vida', 'Projetos de Vida');

  IF p_scope IS NOT NULL AND p_scope NOT IN ('personal', 'couple') THEN
    RAISE EXCEPTION 'Escopo inválido.' USING ERRCODE = '22023';
  END IF;

  v_scope := public.orbi_scope_user_ids(p_scope);

  SELECT COALESCE(jsonb_agg(item ORDER BY (item ->> 'status') = 'archived', item ->> 'end_date', item ->> 'name'), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
               'id', pr.id,
               'user_id', pr.user_id,
               'is_owner', pr.user_id = v_uid,
               'name', pr.name,
               'description', pr.description,
               'kind', pr.kind,
               'icon', pr.icon,
               'color', pr.color,
               'start_date', pr.start_date,
               'end_date', pr.end_date,
               'status', pr.status,
               'archived_at', pr.archived_at,
               'goal_id', pr.goal_id,
               'goal_name', g.name,
               'ledger_id', pr.ledger_id,
               'ledger_status', l.status,
               'final_report', pr.final_report,
               'totals', public.orbi_project_totals(pr.id)
             ) AS item
        FROM public.projects pr
        LEFT JOIN public.goals g ON g.id = pr.goal_id
        LEFT JOIN public.ledgers l ON l.id = pr.ledger_id
       WHERE pr.user_id = ANY (v_scope)
    ) s;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_project_overview(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid          uuid := public.orbi_require_auth();
  v_project      public.projects%ROWTYPE;
  v_goal_name    text;
  v_ledger_name  text;
  v_ledger_status text;
  v_totals       jsonb;
  v_categories   jsonb;
  v_timeline     jsonb;
  v_transactions jsonb;
  v_days_total   integer;
  v_days_elapsed integer;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'projetos_vida', 'Projetos de Vida');

  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'Projeto inexistente.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_project
    FROM public.projects pr
   WHERE pr.id = p_project_id
     AND pr.user_id = ANY (public.orbi_family_user_ids());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto inexistente.' USING ERRCODE = '42501';
  END IF;

  SELECT g.name INTO v_goal_name FROM public.goals g WHERE g.id = v_project.goal_id;
  SELECT l.name, l.status INTO v_ledger_name, v_ledger_status FROM public.ledgers l WHERE l.id = v_project.ledger_id;

  v_totals := public.orbi_project_totals(v_project.id);
  v_days_total := v_project.end_date - v_project.start_date + 1;
  v_days_elapsed := LEAST(GREATEST(CURRENT_DATE - v_project.start_date + 1, 0), v_days_total);

  WITH t AS (
    SELECT x.category_id, GREATEST(x.value - COALESCE(x.compensation_value, 0), 0) AS net
      FROM public.transactions x
     WHERE x.project_id = v_project.id
       AND x.user_id = v_project.user_id
       AND x.type = 'expense'
       AND x.status <> 'CANCELED'
  ),
  agg AS (
    SELECT t.category_id, SUM(t.net) AS total, COUNT(*) AS n FROM t GROUP BY t.category_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'category_id', a.category_id,
           'name', COALESCE(c.name, 'Sem categoria'),
           'icon', c.icon,
           'amount', round(a.total, 2),
           'transactions', a.n
         ) ORDER BY a.total DESC), '[]'::jsonb)
    INTO v_categories
    FROM (SELECT * FROM agg ORDER BY total DESC LIMIT 8) a
    LEFT JOIN public.categories c ON c.id = a.category_id;

  WITH months AS (
    SELECT gs::date AS m
      FROM generate_series(
             date_trunc('month', LEAST(v_project.start_date, COALESCE((v_totals ->> 'first_date')::date, v_project.start_date))),
             date_trunc('month', GREATEST(v_project.end_date, COALESCE((v_totals ->> 'last_date')::date, v_project.end_date))),
             INTERVAL '1 month'
           ) gs
     LIMIT 60
  ),
  t AS (
    SELECT date_trunc('month', x.date)::date AS m,
           x.status,
           GREATEST(x.value - COALESCE(x.compensation_value, 0), 0) AS net
      FROM public.transactions x
     WHERE x.project_id = v_project.id
       AND x.user_id = v_project.user_id
       AND x.type = 'expense'
       AND x.status <> 'CANCELED'
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'month', mo.m,
           'paid', round(COALESCE((SELECT SUM(net) FROM t WHERE t.m = mo.m AND t.status = 'PAID'), 0), 2),
           'pending', round(COALESCE((SELECT SUM(net) FROM t WHERE t.m = mo.m AND t.status = 'PENDING'), 0), 2)
         ) ORDER BY mo.m), '[]'::jsonb)
    INTO v_timeline
    FROM months mo;

  SELECT COALESCE(jsonb_agg(item ORDER BY (item ->> 'date') DESC, item ->> 'description'), '[]'::jsonb)
    INTO v_transactions
    FROM (
      SELECT jsonb_build_object(
               'id', x.id,
               'date', x.date,
               'description', x.description,
               'type', x.type,
               'status', x.status,
               'value', x.value,
               'compensation', COALESCE(x.compensation_value, 0),
               'net', CASE WHEN x.type = 'expense' THEN GREATEST(x.value - COALESCE(x.compensation_value, 0), 0) ELSE x.value END,
               'category_name', c.name,
               'category_icon', c.icon,
               'payment_label', COALESCE(cc.name, a.name),
               'is_shared', COALESCE(x.is_shared, false),
               'ledger_id', x.ledger_id
             ) AS item
        FROM public.transactions x
        LEFT JOIN public.categories c ON c.id = x.category_id
        LEFT JOIN public.accounts a ON a.id = x.account_id
        LEFT JOIN public.credit_cards cc ON cc.id = x.credit_card_id
       WHERE x.project_id = v_project.id
         AND x.user_id = v_project.user_id
         AND x.status <> 'CANCELED'
       ORDER BY x.date DESC
       LIMIT 300
    ) s;

  RETURN jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_project.id,
      'user_id', v_project.user_id,
      'is_owner', v_project.user_id = v_uid,
      'name', v_project.name,
      'description', v_project.description,
      'kind', v_project.kind,
      'icon', v_project.icon,
      'color', v_project.color,
      'budget', v_project.budget,
      'funded_from_goal', v_project.funded_from_goal,
      'start_date', v_project.start_date,
      'end_date', v_project.end_date,
      'status', v_project.status,
      'archived_at', v_project.archived_at,
      'final_report', v_project.final_report,
      'goal_id', v_project.goal_id,
      'goal_name', v_goal_name,
      'ledger_id', v_project.ledger_id,
      'ledger_name', v_ledger_name,
      'ledger_status', v_ledger_status
    ),
    'totals', v_totals,
    'pace', jsonb_build_object(
      'days_total', v_days_total,
      'days_elapsed', v_days_elapsed,
      'time_pct', round(v_days_elapsed::numeric / GREATEST(v_days_total, 1) * 100, 1),
      'budget_pct', CASE WHEN v_project.budget > 0 THEN round((v_totals ->> 'cost')::numeric / v_project.budget * 100, 1) END
    ),
    'categories', v_categories,
    'timeline', v_timeline,
    'transactions', v_transactions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_project_close(p_project_id uuid, p_auto boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_totals  jsonb;
  v_top     jsonb;
  v_report  jsonb;
  v_cost    numeric;
  v_var     numeric;
  v_pct     numeric;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto inexistente.' USING ERRCODE = '23503';
  END IF;
  IF v_project.status = 'archived' THEN
    RETURN v_project.final_report;
  END IF;

  v_totals := public.orbi_project_totals(p_project_id);
  v_cost := (v_totals ->> 'cost')::numeric;
  v_var := round(v_project.budget - v_cost, 2);
  v_pct := CASE WHEN v_project.budget > 0 THEN round((v_cost - v_project.budget) / v_project.budget * 100, 1) END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', COALESCE(c.name, 'Sem categoria'), 'amount', round(a.total, 2)) ORDER BY a.total DESC), '[]'::jsonb)
    INTO v_top
    FROM (
      SELECT x.category_id, SUM(GREATEST(x.value - COALESCE(x.compensation_value, 0), 0)) AS total
        FROM public.transactions x
       WHERE x.project_id = p_project_id AND x.user_id = v_project.user_id AND x.type = 'expense' AND x.status <> 'CANCELED'
       GROUP BY x.category_id
       ORDER BY total DESC
       LIMIT 5
    ) a
    LEFT JOIN public.categories c ON c.id = a.category_id;

  v_report := jsonb_build_object(
    'closed_on', CURRENT_DATE,
    'auto', p_auto,
    'budget', v_project.budget,
    'cost', v_cost,
    'gross', (v_totals ->> 'gross')::numeric,
    'compensation', (v_totals ->> 'compensation')::numeric,
    'income', (v_totals ->> 'income')::numeric,
    'variance', v_var,
    'variance_pct', v_pct,
    'transactions', (v_totals ->> 'transactions')::integer,
    'pending', (v_totals ->> 'pending')::integer,
    'days', v_project.end_date - v_project.start_date + 1,
    'top_categories', v_top
  );

  PERFORM set_config('orbi.project_status', 'on', true);
  UPDATE public.projects
     SET status = 'archived',
         final_report = v_report
   WHERE id = p_project_id;
  PERFORM set_config('orbi.project_status', '', true);

  INSERT INTO public.user_notifications (user_id, kind, title, body, action_path, payload, dedupe_key)
  VALUES (
    v_project.user_id,
    'project_archived',
    left('Projeto arquivado: ' || v_project.name, 120),
    left(CASE
           WHEN v_project.budget <= 0 THEN 'O relatório final está pronto. As transações continuam no extrato para auditoria.'
           WHEN v_pct IS NOT NULL AND v_pct <= 0 THEN 'Fechou abaixo do orçamento previsto. O relatório final está pronto.'
           ELSE 'Fechou acima do orçamento previsto. Veja no relatório final onde o custo passou.'
         END, 400),
    '/sistema/projects?projeto=' || p_project_id::text,
    jsonb_build_object('project_id', p_project_id, 'name', v_project.name, 'cost', v_cost, 'budget', v_project.budget, 'variance_pct', v_pct),
    'project_archived:' || p_project_id::text || ':' || CURRENT_DATE::text
  )
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;

  RETURN v_report;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_project_archive(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := public.orbi_require_auth();
  v_owner uuid;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'projetos_vida', 'Projetos de Vida');

  SELECT pr.user_id INTO v_owner FROM public.projects pr WHERE pr.id = p_project_id;
  IF v_owner IS NULL OR v_owner <> v_uid THEN
    RAISE EXCEPTION 'Só o dono do projeto pode arquivá-lo.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.orbi_quota_lock(v_uid, 'project:' || p_project_id::text);
  RETURN public.orbi_project_close(p_project_id, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_project_reopen(p_project_id uuid, p_end_date date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := public.orbi_require_auth();
  v_project public.projects%ROWTYPE;
  v_end     date;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'projetos_vida', 'Projetos de Vida');

  SELECT * INTO v_project FROM public.projects pr WHERE pr.id = p_project_id FOR UPDATE;
  IF NOT FOUND OR v_project.user_id <> v_uid THEN
    RAISE EXCEPTION 'Só o dono do projeto pode reabri-lo.' USING ERRCODE = '42501';
  END IF;
  IF v_project.status <> 'archived' THEN
    RETURN;
  END IF;

  v_end := COALESCE(p_end_date, v_project.end_date);
  IF v_end < CURRENT_DATE THEN
    RAISE EXCEPTION 'Escolha uma nova data final a partir de hoje para reabrir o projeto.' USING ERRCODE = '23514';
  END IF;
  IF v_end < v_project.start_date OR v_end > DATE '2100-12-31' THEN
    RAISE EXCEPTION 'Data final fora do intervalo do projeto.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('orbi.project_status', 'on', true);
  UPDATE public.projects SET status = 'active', end_date = v_end WHERE id = p_project_id;
  PERFORM set_config('orbi.project_status', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_goal_execute(
  p_goal_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_kind text DEFAULT 'event',
  p_extra_budget numeric DEFAULT 0,
  p_with_ledger boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       uuid := public.orbi_require_auth();
  v_goal      public.goals%ROWTYPE;
  v_saved     numeric;
  v_name      text := btrim(COALESCE(p_name, ''));
  v_extra     numeric := round(COALESCE(p_extra_budget, 0), 2);
  v_ledger_id uuid;
  v_project   uuid;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'metas', 'Metas financeiras');
  PERFORM public.orbi_require_feature(v_uid, 'projetos_vida', 'Projetos de Vida');

  IF p_goal_id IS NULL THEN
    RAISE EXCEPTION 'Meta inexistente.' USING ERRCODE = '22023';
  END IF;

  PERFORM public.orbi_quota_lock(v_uid, 'goal:' || p_goal_id::text);

  SELECT * INTO v_goal FROM public.goals g WHERE g.id = p_goal_id FOR UPDATE;
  IF NOT FOUND OR v_goal.user_id <> v_uid THEN
    RAISE EXCEPTION 'Só o dono da meta pode executá-la.' USING ERRCODE = '42501';
  END IF;
  IF v_goal.executed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta meta já virou projeto.' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM(a.amount), 0) INTO v_saved FROM public.goal_allocations a WHERE a.goal_id = p_goal_id;
  IF v_saved <= 0 THEN
    RAISE EXCEPTION 'A meta ainda não tem saldo guardado para virar orçamento.' USING ERRCODE = '23514';
  END IF;

  IF v_name = '' THEN
    v_name := v_goal.name;
  END IF;
  IF length(v_name) > 80 OR NOT public.orbi_is_safe_text(v_name, 80) THEN
    RAISE EXCEPTION 'Nome do projeto inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date
     OR p_start_date < DATE '2000-01-01' OR p_end_date > DATE '2100-12-31' THEN
    RAISE EXCEPTION 'Datas do projeto inválidas: o fim precisa ser igual ou depois do início.' USING ERRCODE = '22023';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('event', 'trip', 'purchase', 'home', 'family', 'other') THEN
    RAISE EXCEPTION 'Tipo de projeto inválido.' USING ERRCODE = '22023';
  END IF;
  IF v_extra < 0 OR v_saved + v_extra > 1000000000 THEN
    RAISE EXCEPTION 'Valor extra de orçamento inválido.' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_with_ledger, false) THEN
    PERFORM public.orbi_require_feature(v_uid, 'contratos_rateio', 'Acertos de viagem');
    INSERT INTO public.ledgers (user_id, name, start_date, end_date)
    VALUES (v_uid, v_name, p_start_date, p_end_date)
    RETURNING id INTO v_ledger_id;
  END IF;

  PERFORM set_config('orbi.goal_execute', p_goal_id::text, true);

  INSERT INTO public.projects (user_id, name, kind, icon, color, budget, funded_from_goal, start_date, end_date, goal_id, ledger_id)
  VALUES (v_uid, v_name, p_kind, v_goal.icon, v_goal.color, round(v_saved + v_extra, 2), round(v_saved, 2), p_start_date, p_end_date, p_goal_id, v_ledger_id)
  RETURNING id INTO v_project;

  UPDATE public.goals SET executed_at = NOW() WHERE id = p_goal_id;

  PERFORM set_config('orbi.goal_execute', '', true);

  RETURN v_project;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_projects_auto_archive()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row   record;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT pr.id FROM public.projects pr WHERE pr.status = 'active' AND pr.end_date < CURRENT_DATE ORDER BY pr.end_date LIMIT 5000
  LOOP
    BEGIN
      PERFORM public.orbi_project_close(v_row.id, true);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'orbi_projects_auto_archive: projeto % não arquivado (%)', v_row.id, SQLSTATE;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.orbi_project_totals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_project_close(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_projects_auto_archive() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_projects_list(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_project_overview(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_project_archive(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_project_reopen(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_goal_execute(uuid, text, date, date, text, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_projects_list(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_project_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_project_archive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_project_reopen(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_goal_execute(uuid, text, date, date, text, numeric, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
