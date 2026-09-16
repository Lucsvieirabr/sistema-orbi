UPDATE public.subscription_plans
   SET features = COALESCE(features, '{}'::jsonb)
                  || jsonb_build_object(
                       'projetos_vida',    COALESCE((features ->> 'orcamentos')::boolean, false),
                       'inflacao_pessoal', COALESCE((features ->> 'orcamentos')::boolean, false)
                     ),
       updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  kind             text NOT NULL DEFAULT 'event',
  icon             text NOT NULL DEFAULT 'sparkles',
  color            text NOT NULL DEFAULT '#3B82F6',
  budget           numeric(12,2) NOT NULL DEFAULT 0,
  funded_from_goal numeric(12,2) NOT NULL DEFAULT 0,
  start_date       date NOT NULL DEFAULT CURRENT_DATE,
  end_date         date NOT NULL,
  goal_id          uuid UNIQUE REFERENCES public.goals(id) ON DELETE SET NULL,
  ledger_id        uuid UNIQUE REFERENCES public.ledgers(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'active',
  archived_at      timestamptz,
  final_report     jsonb,
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  updated_at       timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT projects_name_safe CHECK (length(btrim(name)) BETWEEN 1 AND 80 AND public.orbi_is_safe_text(name, 80)),
  CONSTRAINT projects_description_safe CHECK (description IS NULL OR public.orbi_is_safe_text(description, 280)),
  CONSTRAINT projects_kind_whitelist CHECK (kind IN ('event', 'trip', 'purchase', 'home', 'family', 'other')),
  CONSTRAINT projects_icon_format CHECK (icon ~ '^[a-z0-9-]{1,32}$'),
  CONSTRAINT projects_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT projects_budget_range CHECK (budget >= 0 AND budget <= 1000000000),
  CONSTRAINT projects_funded_range CHECK (funded_from_goal >= 0 AND funded_from_goal <= budget),
  CONSTRAINT projects_dates_range CHECK (
    start_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
    AND end_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
    AND end_date >= start_date
  ),
  CONSTRAINT projects_status_whitelist CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects (user_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_active_end ON public.projects (end_date) WHERE status = 'active';

COMMENT ON TABLE public.projects IS
  'Projetos de Vida (Pro/Casal): centro de custo temporário e transversal às categorias. Transações ligadas por transactions.project_id; meta executada em goal_id; acerto entre pessoas em ledger_id.';

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_project ON public.transactions (project_id, date) WHERE project_id IS NOT NULL;

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS executed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.monthly_summaries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month      date NOT NULL,
  essential_monthly numeric(14,2) NOT NULL DEFAULT 0,
  inflation_3m      numeric(8,2),
  inflation_6m      numeric(8,2),
  inflation_12m     numeric(8,2),
  headline_pct      numeric(8,2),
  headline_basis    smallint,
  categories        jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_merchants integer NOT NULL DEFAULT 0,
  sample_size       integer NOT NULL DEFAULT 0,
  computed_at       timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT monthly_summaries_first_day CHECK (EXTRACT(DAY FROM period_month) = 1),
  CONSTRAINT monthly_summaries_month_range CHECK (period_month BETWEEN DATE '2000-01-01' AND DATE '2100-12-01'),
  CONSTRAINT monthly_summaries_basis CHECK (headline_basis IS NULL OR headline_basis IN (3, 6, 12)),
  CONSTRAINT monthly_summaries_categories_array CHECK (jsonb_typeof(categories) = 'array'),
  CONSTRAINT monthly_summaries_unique UNIQUE (user_id, period_month)
);

COMMENT ON TABLE public.monthly_summaries IS
  'Snapshot mensal da Inflação Pessoal (Pro/Casal): índice das despesas essenciais (média de 3 meses) contra 3, 6 e 12 meses antes, por categoria e estabelecimento. Escrito só por orbi_personal_inflation_compute.';

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL,
  action_path text,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key  text NOT NULL,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT user_notifications_kind_whitelist CHECK (kind IN ('budget_inflation', 'project_archived')),
  CONSTRAINT user_notifications_title_safe CHECK (length(btrim(title)) BETWEEN 1 AND 120 AND public.orbi_is_safe_text(title, 120)),
  CONSTRAINT user_notifications_body_safe CHECK (length(btrim(body)) BETWEEN 1 AND 400 AND public.orbi_is_safe_text(body, 400)),
  CONSTRAINT user_notifications_path_safe CHECK (action_path IS NULL OR action_path ~ '^/sistema(/[a-z0-9-]+)*(\?[a-z0-9=&_-]*)?$'),
  CONSTRAINT user_notifications_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT user_notifications_dedupe UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications (user_id, created_at DESC) WHERE read_at IS NULL;

COMMENT ON TABLE public.user_notifications IS
  'Avisos do sistema ao usuário (sugestão de reajuste de orçamento pela Inflação Pessoal, relatório de projeto arquivado). Escrita só por funções SECURITY DEFINER; o usuário só marca como lida.';

DO $rls$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['projects', 'monthly_summaries', 'user_notifications'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', v_table);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', v_table);
    EXECUTE format('DROP POLICY IF EXISTS orbi_service_bypass ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY orbi_service_bypass ON public.%I AS PERMISSIVE FOR ALL TO %s USING (true) WITH CHECK (true)',
      v_table, public.orbi_service_roles()
    );
  END LOOP;
END
$rls$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT ON public.monthly_summaries TO authenticated;
GRANT SELECT, DELETE ON public.user_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.user_notifications TO authenticated;

DROP POLICY IF EXISTS orbi_projects_select ON public.projects;
CREATE POLICY orbi_projects_select ON public.projects
  FOR SELECT TO authenticated
  USING ((SELECT public.orbi_has_feature('projetos_vida')) AND user_id = ANY ((SELECT public.orbi_family_user_ids())::uuid[]));

DROP POLICY IF EXISTS orbi_projects_insert ON public.projects;
CREATE POLICY orbi_projects_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.orbi_has_feature('projetos_vida')) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_projects_update ON public.projects;
CREATE POLICY orbi_projects_update ON public.projects
  FOR UPDATE TO authenticated
  USING ((SELECT public.orbi_has_feature('projetos_vida')) AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT public.orbi_has_feature('projetos_vida')) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_projects_delete ON public.projects;
CREATE POLICY orbi_projects_delete ON public.projects
  FOR DELETE TO authenticated
  USING ((SELECT public.orbi_has_feature('projetos_vida')) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_monthly_summaries_select ON public.monthly_summaries;
CREATE POLICY orbi_monthly_summaries_select ON public.monthly_summaries
  FOR SELECT TO authenticated
  USING ((SELECT public.orbi_has_feature('inflacao_pessoal')) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_user_notifications_select ON public.user_notifications;
CREATE POLICY orbi_user_notifications_select ON public.user_notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_user_notifications_update ON public.user_notifications;
CREATE POLICY orbi_user_notifications_update ON public.user_notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_user_notifications_delete ON public.user_notifications;
CREATE POLICY orbi_user_notifications_delete ON public.user_notifications
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.orbi_tenant_tables()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT ARRAY[
    'accounts', 'categories', 'credit_cards', 'people', 'series', 'transactions',
    'notes', 'bug_reports', 'user_learned_patterns', 'user_profiles',
    'user_subscriptions', 'user_usage', 'payment_history', 'admin_users',
    'audit_logs', 'asaas_webhook_events', 'subscription_plans',
    'merchants_dictionary', 'edge_rate_limits', 'family_groups',
    'family_group_members', 'budgets', 'goals', 'goal_allocations',
    'split_contracts', 'ledgers', 'ledger_participants', 'ledger_entries',
    'projects', 'monthly_summaries', 'user_notifications'
  ];
$$;

CREATE OR REPLACE FUNCTION public.orbi_projects_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status_ok boolean := COALESCE(current_setting('orbi.project_status', true), '') = 'on';
  v_goal_ok   boolean := NEW.goal_id IS NOT NULL
                         AND COALESCE(current_setting('orbi.goal_execute', true), '') = NEW.goal_id::text;
  v_ledger_owner uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'O dono do projeto não pode mudar.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.orbi_require_feature(NEW.user_id, 'projetos_vida', 'Projetos de Vida');

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'active';
    NEW.archived_at := NULL;
    NEW.final_report := NULL;
    IF NOT v_goal_ok THEN
      NEW.goal_id := NULL;
      NEW.funded_from_goal := 0;
    END IF;
  ELSE
    IF OLD.status = 'archived' AND NEW.status = 'archived' AND NOT v_status_ok THEN
      RAISE EXCEPTION 'Projeto arquivado é somente leitura. Reabra-o para editar.' USING ERRCODE = '23514';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT v_status_ok THEN
      RAISE EXCEPTION 'Use Arquivar ou Reabrir para mudar a fase do projeto.' USING ERRCODE = '42501';
    END IF;

    IF NEW.goal_id IS DISTINCT FROM OLD.goal_id AND NOT (v_goal_ok OR NEW.goal_id IS NULL) THEN
      RAISE EXCEPTION 'O vínculo com a meta só nasce em Executar meta.' USING ERRCODE = '42501';
    END IF;

    IF NOT v_goal_ok THEN
      NEW.funded_from_goal := CASE WHEN NEW.goal_id IS NULL THEN 0 ELSE OLD.funded_from_goal END;
    END IF;

    IF NOT v_status_ok THEN
      NEW.final_report := OLD.final_report;
      NEW.archived_at := OLD.archived_at;
    END IF;
  END IF;

  IF NEW.goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.goals g WHERE g.id = NEW.goal_id AND g.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Meta inexistente ou de outro usuário.' USING ERRCODE = '42501';
  END IF;

  IF NEW.ledger_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.ledger_id IS DISTINCT FROM OLD.ledger_id) THEN
    PERFORM public.orbi_require_feature(NEW.user_id, 'contratos_rateio', 'Acertos de viagem');
    SELECT l.user_id INTO v_ledger_owner FROM public.ledgers l WHERE l.id = NEW.ledger_id;
    IF v_ledger_owner IS NULL OR v_ledger_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'Evento de acerto inexistente ou de outro usuário.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'archived' THEN
      NEW.archived_at := NOW();
    ELSE
      NEW.archived_at := NULL;
      NEW.final_report := NULL;
    END IF;
  END IF;

  NEW.name := btrim(NEW.name);
  NEW.description := NULLIF(btrim(NEW.description), '');
  NEW.budget := round(NEW.budget, 2);
  NEW.funded_from_goal := LEAST(round(NEW.funded_from_goal, 2), NEW.budget);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_projects_release_goal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.goal_id IS NOT NULL THEN
    PERFORM set_config('orbi.goal_release', OLD.goal_id::text, true);
    UPDATE public.goals SET executed_at = NULL WHERE id = OLD.goal_id;
    PERFORM set_config('orbi.goal_release', '', true);
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_goals_execution_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.executed_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.executed_at IS DISTINCT FROM OLD.executed_at
     AND COALESCE(current_setting('orbi.goal_execute', true), '') <> OLD.id::text
     AND COALESCE(current_setting('orbi.goal_release', true), '') <> OLD.id::text
  THEN
    NEW.executed_at := OLD.executed_at;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_goal_allocations_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner    uuid;
  v_executed timestamptz;
  v_saved    numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT g.executed_at INTO v_executed FROM public.goals g WHERE g.id = OLD.goal_id;
    IF NOT FOUND THEN
      RETURN OLD;
    END IF;

    IF v_executed IS NOT NULL THEN
      RAISE EXCEPTION 'Esta meta já virou projeto. O histórico de aportes fica congelado.' USING ERRCODE = '23514';
    END IF;

    PERFORM public.orbi_quota_lock(OLD.user_id, 'goal:' || OLD.goal_id::text);

    SELECT COALESCE(SUM(a.amount), 0) INTO v_saved
      FROM public.goal_allocations a
     WHERE a.goal_id = OLD.goal_id AND a.id <> OLD.id;

    IF v_saved < 0 THEN
      RAISE EXCEPTION 'Excluir este aporte deixaria a meta com saldo negativo. Exclua antes o resgate correspondente.'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.goal_id IS DISTINCT FROM OLD.goal_id)
  THEN
    RAISE EXCEPTION 'Um aporte não pode trocar de dono nem de meta.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.orbi_require_feature(NEW.user_id, 'metas', 'Metas financeiras');

  SELECT g.user_id, g.executed_at INTO v_owner, v_executed FROM public.goals g WHERE g.id = NEW.goal_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Meta inexistente.' USING ERRCODE = '23503';
  END IF;

  IF v_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Só o dono da meta pode registrar aportes nela.' USING ERRCODE = '42501';
  END IF;

  IF v_executed IS NOT NULL THEN
    RAISE EXCEPTION 'Esta meta já virou projeto. Lance os gastos dentro do projeto.' USING ERRCODE = '23514';
  END IF;

  NEW.amount := round(NEW.amount, 2);
  NEW.note := NULLIF(btrim(NEW.note), '');

  PERFORM public.orbi_quota_lock(NEW.user_id, 'goal:' || NEW.goal_id::text);

  SELECT COALESCE(SUM(a.amount), 0) INTO v_saved
    FROM public.goal_allocations a
   WHERE a.goal_id = NEW.goal_id
     AND (TG_OP = 'INSERT' OR a.id <> OLD.id);

  IF v_saved + NEW.amount < 0 THEN
    RAISE EXCEPTION 'O resgate é maior do que o valor guardado na meta.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_transactions_project_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old     record;
  v_project record;
  v_ledger  record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.project_id IS NOT NULL THEN
    SELECT p.status INTO v_old FROM public.projects p WHERE p.id = OLD.project_id;
    IF FOUND AND v_old.status = 'archived' THEN
      RAISE EXCEPTION 'Este lançamento pertence a um projeto arquivado. Reabra o projeto para movê-lo.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.orbi_require_feature(NEW.user_id, 'projetos_vida', 'Projetos de Vida');

  SELECT p.user_id, p.status, p.ledger_id INTO v_project FROM public.projects p WHERE p.id = NEW.project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto inexistente.' USING ERRCODE = '23503';
  END IF;
  IF v_project.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'A transação só pode entrar em um projeto seu.' USING ERRCODE = '42501';
  END IF;
  IF v_project.status = 'archived' THEN
    RAISE EXCEPTION 'Este projeto está arquivado. Reabra-o para lançar novos gastos.' USING ERRCODE = '23514';
  END IF;

  IF v_project.ledger_id IS NOT NULL
     AND NEW.type = 'expense'
     AND NEW.ledger_id IS NULL
     AND COALESCE(public.orbi_active_plan_features(NEW.user_id) ->> 'contratos_rateio', 'false') = 'true'
  THEN
    SELECT l.user_id, l.status INTO v_ledger FROM public.ledgers l WHERE l.id = v_project.ledger_id;
    IF FOUND AND v_ledger.user_id = NEW.user_id AND v_ledger.status = 'open' THEN
      NEW.ledger_id := v_project.ledger_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orbi_projects_guard ON public.projects;
CREATE TRIGGER orbi_projects_guard
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.orbi_projects_guard();

DROP TRIGGER IF EXISTS orbi_projects_release_goal ON public.projects;
CREATE TRIGGER orbi_projects_release_goal
  AFTER DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.orbi_projects_release_goal();

DROP TRIGGER IF EXISTS orbi_goals_execution_guard ON public.goals;
CREATE TRIGGER orbi_goals_execution_guard
  BEFORE INSERT OR UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.orbi_goals_execution_guard();

DROP TRIGGER IF EXISTS orbi_transactions_project_guard ON public.transactions;
CREATE TRIGGER orbi_transactions_project_guard
  BEFORE INSERT OR UPDATE OF project_id ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.orbi_transactions_project_guard();

CREATE OR REPLACE VIEW public.vw_goal_progress
WITH (security_invoker = true) AS
SELECT
  g.id,
  g.user_id,
  g.name,
  g.target_value,
  g.deadline,
  g.icon,
  g.color,
  g.created_at,
  g.updated_at,
  COALESCE(a.saved, 0)::numeric(12,2)                                   AS saved_value,
  GREATEST(g.target_value - COALESCE(a.saved, 0), 0)::numeric(12,2)     AS remaining_value,
  round(COALESCE(a.saved, 0) / g.target_value * 100, 1)                 AS progress_pct,
  COALESCE(a.movements, 0)::integer                                     AS allocations_count,
  a.last_allocation_on,
  CASE
    WHEN g.deadline IS NULL OR COALESCE(a.saved, 0) >= g.target_value THEN NULL
    ELSE GREATEST(
      (EXTRACT(YEAR FROM g.deadline) - EXTRACT(YEAR FROM CURRENT_DATE)) * 12
      + (EXTRACT(MONTH FROM g.deadline) - EXTRACT(MONTH FROM CURRENT_DATE)) + 1,
      1
    )::integer
  END                                                                   AS months_left,
  CASE
    WHEN g.deadline IS NULL OR COALESCE(a.saved, 0) >= g.target_value THEN NULL
    ELSE round(
      (g.target_value - COALESCE(a.saved, 0)) / GREATEST(
        (EXTRACT(YEAR FROM g.deadline) - EXTRACT(YEAR FROM CURRENT_DATE)) * 12
        + (EXTRACT(MONTH FROM g.deadline) - EXTRACT(MONTH FROM CURRENT_DATE)) + 1,
        1
      ),
      2
    )
  END                                                                   AS monthly_needed,
  g.executed_at,
  pr.id                                                                 AS project_id
FROM public.goals g
LEFT JOIN LATERAL (
  SELECT SUM(ga.amount) AS saved, COUNT(*) AS movements, MAX(ga.allocated_on) AS last_allocation_on
    FROM public.goal_allocations ga
   WHERE ga.goal_id = g.id
) a ON true
LEFT JOIN public.projects pr ON pr.goal_id = g.id;

REVOKE ALL ON public.vw_goal_progress FROM anon, authenticated;
GRANT SELECT ON public.vw_goal_progress TO authenticated;
GRANT SELECT ON public.vw_goal_progress TO service_role;

REVOKE ALL ON FUNCTION public.orbi_projects_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_projects_release_goal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_goals_execution_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_goal_allocations_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_transactions_project_guard() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
