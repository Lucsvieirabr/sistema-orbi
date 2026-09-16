-- ============================================================================
-- MÓDULOS PREMIUM — ORÇAMENTOS, METAS E FECHAMENTO DO MÊS (DRE PESSOAL)
-- ----------------------------------------------------------------------------
-- Regra de negócio: os três módulos são EXCLUSIVOS dos planos Pro e Casal.
--
-- Defesa em profundidade (mesma filosofia dos limites de plano, regra #7):
--   1. Catálogo: features `orcamentos`, `metas`, `dre_pessoal` no jsonb
--      `subscription_plans.features` (true só em pro/casal). O front lê isso
--      via get_my_subscription_status → FeaturePageGuard / PremiumRoute.
--   2. RLS: toda policy das tabelas novas exige a feature no plano vigente
--      (`orbi_has_feature`, avaliada 1x por statement via `(SELECT ...)`).
--   3. Triggers BEFORE INSERT/UPDATE: repetem o gate com ERRCODE P0005 +
--      HINT `plan_feature_required` (o front traduz em src/lib/limits.ts) e
--      validam integridade entre tenants (categoria/meta de outro usuário).
--   4. RPCs de leitura agregada (SECURITY DEFINER, escopo derivado de
--      auth.uid()) exigem a feature antes de calcular qualquer coisa.
--
-- Tenant = `user_id -> auth.users.id` (padrão do projeto; não existe tabela
-- de tenants). Plano Casal: leitura compartilhada somente leitura, igual às
-- policies `family_read_*` de 20260909120000 — escrita só no dono da linha.
--
-- Performance do DRE: nada de agregação no cliente. Uma única varredura de
-- `transactions` por (user_id, date) — índice criado aqui — materializada
-- numa CTE e reaproveitada por todos os blocos do relatório.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. CATÁLOGO DE FEATURES DOS PLANOS
-- ============================================================================
UPDATE public.subscription_plans
   SET features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
         'orcamentos',  slug IN ('pro', 'casal'),
         'metas',       slug IN ('pro', 'casal'),
         'dre_pessoal', slug IN ('pro', 'casal')
       ),
       updated_at = NOW();

-- ============================================================================
-- 1. HELPERS
-- ============================================================================

-- Feature do plano vigente do usuário do JWT. Usada nas policies.
CREATE OR REPLACE FUNCTION public.orbi_has_feature(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.orbi_active_plan_features(auth.uid()) ->> p_key, 'false') = 'true';
$$;

-- Gate com erro tipado para triggers e RPCs.
--   P0004 = sem assinatura ativa | P0005 = plano não inclui a feature.
CREATE OR REPLACE FUNCTION public.orbi_require_feature(p_user_id uuid, p_key text, p_label text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_features jsonb;
BEGIN
  v_features := public.orbi_active_plan_features(p_user_id);

  IF v_features IS NULL THEN
    RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada para usar %.', p_label
      USING ERRCODE = 'P0004', HINT = 'no_active_subscription';
  END IF;

  IF COALESCE(v_features ->> p_key, 'false') <> 'true' THEN
    RAISE EXCEPTION '% é exclusivo dos planos Pro e Casal.', p_label
      USING ERRCODE = 'P0005', HINT = 'plan_feature_required';
  END IF;
END;
$$;

-- Escopo de leitura: 'personal' = [eu]; 'couple' = [eu, parceiro vinculado].
CREATE OR REPLACE FUNCTION public.orbi_scope_user_ids(p_scope text)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
           WHEN auth.uid() IS NULL THEN ARRAY[]::uuid[]
           WHEN p_scope = 'couple' THEN public.orbi_family_user_ids()
           ELSE ARRAY[auth.uid()]
         END;
$$;

-- Variação percentual com denominador zero tratado (NULL = sem base).
CREATE OR REPLACE FUNCTION public.orbi_pct_change(p_current numeric, p_previous numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
           WHEN p_previous IS NULL OR p_previous = 0 THEN NULL
           ELSE round((COALESCE(p_current, 0) - p_previous) / abs(p_previous) * 100, 1)
         END;
$$;

-- Índice que sustenta DRE, orçamentos e extrato mensal: toda leitura
-- financeira filtra por dono + janela de datas.
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON public.transactions (user_id, date);

-- ============================================================================
-- 2. ORÇAMENTOS — teto de gasto por categoria, por mês
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budgets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id   uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount_limit  numeric(12,2) NOT NULL,
  period_month  date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT budgets_amount_limit_positive CHECK (amount_limit > 0),
  CONSTRAINT budgets_period_month_first_day CHECK (EXTRACT(DAY FROM period_month) = 1),
  CONSTRAINT budgets_period_month_range CHECK (period_month BETWEEN DATE '2000-01-01' AND DATE '2100-12-01'),
  CONSTRAINT budgets_one_per_category_month UNIQUE (user_id, period_month, category_id)
);

CREATE INDEX IF NOT EXISTS idx_budgets_category ON public.budgets (category_id);

COMMENT ON TABLE public.budgets IS
  'Orçamento mensal por categoria de gasto (Pro/Casal). period_month = 1º dia do mês. Consumo calculado em orbi_budget_overview.';

CREATE OR REPLACE FUNCTION public.orbi_budgets_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cat record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'O dono do orçamento não pode mudar.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.orbi_require_feature(NEW.user_id, 'orcamentos', 'Orçamentos');

  SELECT c.user_id, COALESCE(c.is_system, false) AS is_system, c.category_type
    INTO v_cat
    FROM public.categories c
   WHERE c.id = NEW.category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoria inexistente.' USING ERRCODE = '23503';
  END IF;

  -- FK sozinha aceitaria o UUID de uma categoria privada de outro tenant.
  IF NOT (v_cat.is_system OR v_cat.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Categoria não encontrada.' USING ERRCODE = '42501';
  END IF;

  IF v_cat.category_type <> 'expense' THEN
    RAISE EXCEPTION 'Orçamento só vale para categorias de gasto.' USING ERRCODE = '23514';
  END IF;

  NEW.amount_limit := round(NEW.amount_limit, 2);
  NEW.period_month := date_trunc('month', NEW.period_month)::date;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orbi_budgets_guard ON public.budgets;
CREATE TRIGGER trg_orbi_budgets_guard
  BEFORE INSERT OR UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.orbi_budgets_guard();

-- ============================================================================
-- 3. METAS + APORTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  target_value  numeric(12,2) NOT NULL,
  deadline      date,
  icon          text NOT NULL DEFAULT 'target',
  color         text NOT NULL DEFAULT '#3B82F6',
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT goals_name_safe CHECK (length(btrim(name)) BETWEEN 1 AND 80 AND public.orbi_is_safe_text(name, 80)),
  CONSTRAINT goals_target_positive CHECK (target_value > 0),
  CONSTRAINT goals_icon_format CHECK (icon ~ '^[a-z0-9-]{1,32}$'),
  CONSTRAINT goals_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT goals_deadline_range CHECK (deadline IS NULL OR deadline BETWEEN DATE '2000-01-01' AND DATE '2100-12-31')
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON public.goals (user_id);

COMMENT ON TABLE public.goals IS
  'Metas financeiras (Pro/Casal): valor-alvo, prazo opcional, ícone e cor. Saldo = soma de goal_allocations.';

CREATE TABLE IF NOT EXISTS public.goal_allocations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id       uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  amount        numeric(12,2) NOT NULL,
  allocated_on  date NOT NULL DEFAULT CURRENT_DATE,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT goal_allocations_amount_nonzero CHECK (amount <> 0),
  CONSTRAINT goal_allocations_note_safe CHECK (note IS NULL OR public.orbi_is_safe_text(note, 140)),
  CONSTRAINT goal_allocations_date_range CHECK (allocated_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31')
);

CREATE INDEX IF NOT EXISTS idx_goal_allocations_goal ON public.goal_allocations (goal_id, allocated_on);
CREATE INDEX IF NOT EXISTS idx_goal_allocations_user_date ON public.goal_allocations (user_id, allocated_on);

COMMENT ON TABLE public.goal_allocations IS
  'Movimentos de uma meta: amount > 0 = aporte, amount < 0 = resgate. O saldo da meta nunca fica negativo (trigger).';

CREATE OR REPLACE FUNCTION public.orbi_goals_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'O dono da meta não pode mudar.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.orbi_require_feature(NEW.user_id, 'metas', 'Metas financeiras');

  NEW.name := btrim(NEW.name);
  NEW.target_value := round(NEW.target_value, 2);

  IF NEW.deadline IS NOT NULL
     AND NEW.deadline < CURRENT_DATE
     AND (TG_OP = 'INSERT' OR NEW.deadline IS DISTINCT FROM OLD.deadline)
  THEN
    RAISE EXCEPTION 'O prazo da meta precisa ser hoje ou uma data futura.' USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orbi_goals_guard ON public.goals;
CREATE TRIGGER trg_orbi_goals_guard
  BEFORE INSERT OR UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.orbi_goals_guard();

CREATE OR REPLACE FUNCTION public.orbi_goal_allocations_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner uuid;
  v_saved numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Cascata vinda da exclusão da própria meta: nada a proteger.
    IF NOT EXISTS (SELECT 1 FROM public.goals g WHERE g.id = OLD.goal_id) THEN
      RETURN OLD;
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

  SELECT g.user_id INTO v_owner FROM public.goals g WHERE g.id = NEW.goal_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Meta inexistente.' USING ERRCODE = '23503';
  END IF;

  -- No Plano Casal o parceiro LÊ a meta, mas só o dono movimenta.
  IF v_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Só o dono da meta pode registrar aportes nela.' USING ERRCODE = '42501';
  END IF;

  NEW.amount := round(NEW.amount, 2);
  NEW.note := NULLIF(btrim(NEW.note), '');

  -- Serializa movimentos concorrentes da mesma meta antes de somar o saldo.
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

DROP TRIGGER IF EXISTS trg_orbi_goal_allocations_guard ON public.goal_allocations;
CREATE TRIGGER trg_orbi_goal_allocations_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.goal_allocations
  FOR EACH ROW EXECUTE FUNCTION public.orbi_goal_allocations_guard();

-- Progresso por meta. security_invoker: RLS de goals/goal_allocations vale.
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
  END                                                                   AS monthly_needed
FROM public.goals g
LEFT JOIN LATERAL (
  SELECT SUM(ga.amount) AS saved, COUNT(*) AS movements, MAX(ga.allocated_on) AS last_allocation_on
    FROM public.goal_allocations ga
   WHERE ga.goal_id = g.id
) a ON true;

COMMENT ON VIEW public.vw_goal_progress IS
  'Saldo, % e aporte mensal necessário por meta. security_invoker = true: RLS de goals/goal_allocations aplicado ao chamador.';

-- ============================================================================
-- 4. RLS — FORCE + policies por verbo (padrão 20260910000000)
-- ============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['budgets', 'goals', 'goal_allocations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS orbi_service_bypass ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY orbi_service_bypass ON public.%I AS PERMISSIVE FOR ALL TO %s USING (true) WITH CHECK (true)',
      t, public.orbi_service_roles()
    );
  END LOOP;
END;
$$;

-- budgets ------------------------------------------------------------------
DROP POLICY IF EXISTS orbi_budgets_select ON public.budgets;
CREATE POLICY orbi_budgets_select ON public.budgets
  FOR SELECT TO authenticated
  USING (
    (SELECT public.orbi_has_feature('orcamentos'))
    AND user_id = ANY ((SELECT public.orbi_family_user_ids())::uuid[])
  );

DROP POLICY IF EXISTS orbi_budgets_insert ON public.budgets;
CREATE POLICY orbi_budgets_insert ON public.budgets
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.orbi_has_feature('orcamentos')) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_budgets_update ON public.budgets;
CREATE POLICY orbi_budgets_update ON public.budgets
  FOR UPDATE TO authenticated
  USING ((SELECT public.orbi_has_feature('orcamentos')) AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT public.orbi_has_feature('orcamentos')) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_budgets_delete ON public.budgets;
CREATE POLICY orbi_budgets_delete ON public.budgets
  FOR DELETE TO authenticated
  USING ((SELECT public.orbi_has_feature('orcamentos')) AND user_id = (SELECT auth.uid()));

-- goals --------------------------------------------------------------------
DROP POLICY IF EXISTS orbi_goals_select ON public.goals;
CREATE POLICY orbi_goals_select ON public.goals
  FOR SELECT TO authenticated
  USING (
    (SELECT public.orbi_has_feature('metas'))
    AND user_id = ANY ((SELECT public.orbi_family_user_ids())::uuid[])
  );

DROP POLICY IF EXISTS orbi_goals_insert ON public.goals;
CREATE POLICY orbi_goals_insert ON public.goals
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.orbi_has_feature('metas')) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_goals_update ON public.goals;
CREATE POLICY orbi_goals_update ON public.goals
  FOR UPDATE TO authenticated
  USING ((SELECT public.orbi_has_feature('metas')) AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT public.orbi_has_feature('metas')) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_goals_delete ON public.goals;
CREATE POLICY orbi_goals_delete ON public.goals
  FOR DELETE TO authenticated
  USING ((SELECT public.orbi_has_feature('metas')) AND user_id = (SELECT auth.uid()));

-- goal_allocations ---------------------------------------------------------
DROP POLICY IF EXISTS orbi_goal_allocations_select ON public.goal_allocations;
CREATE POLICY orbi_goal_allocations_select ON public.goal_allocations
  FOR SELECT TO authenticated
  USING (
    (SELECT public.orbi_has_feature('metas'))
    AND user_id = ANY ((SELECT public.orbi_family_user_ids())::uuid[])
  );

DROP POLICY IF EXISTS orbi_goal_allocations_insert ON public.goal_allocations;
CREATE POLICY orbi_goal_allocations_insert ON public.goal_allocations
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.orbi_has_feature('metas')) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_goal_allocations_update ON public.goal_allocations;
CREATE POLICY orbi_goal_allocations_update ON public.goal_allocations
  FOR UPDATE TO authenticated
  USING ((SELECT public.orbi_has_feature('metas')) AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT public.orbi_has_feature('metas')) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS orbi_goal_allocations_delete ON public.goal_allocations;
CREATE POLICY orbi_goal_allocations_delete ON public.goal_allocations
  FOR DELETE TO authenticated
  USING ((SELECT public.orbi_has_feature('metas')) AND user_id = (SELECT auth.uid()));

-- ============================================================================
-- 5. RPC — ORÇAMENTOS DO MÊS (consumo + sugestões inteligentes)
-- ============================================================================
-- Consumo = gastos do mês na categoria (data de competência), PAID + PENDING,
-- CANCELED fora, valor líquido de rateio (value − compensation_value), igual
-- ao Dashboard. Sugestão = média dos 3 meses fechados anteriores.
CREATE OR REPLACE FUNCTION public.orbi_budget_overview(p_month date DEFAULT NULL, p_scope text DEFAULT 'personal')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := public.orbi_require_auth();
  v_month  date := date_trunc('month', COALESCE(p_month, CURRENT_DATE))::date;
  v_prev   date;
  v_next   date;
  v_from   date;
  v_scope  uuid[];
  v_result jsonb;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'orcamentos', 'Orçamentos');

  IF v_month < DATE '2000-01-01' OR v_month > DATE '2100-12-01' THEN
    RAISE EXCEPTION 'Mês fora do intervalo permitido.' USING ERRCODE = '22023';
  END IF;

  v_prev  := (v_month - INTERVAL '1 month')::date;
  v_next  := (v_month + INTERVAL '1 month')::date;
  v_from  := (v_month - INTERVAL '3 months')::date;
  v_scope := public.orbi_scope_user_ids(p_scope);

  WITH spend AS (
    SELECT t.user_id,
           t.category_id,
           SUM(GREATEST(t.value - COALESCE(t.compensation_value, 0), 0))
             FILTER (WHERE t.date >= v_month)                                   AS spent,
           SUM(GREATEST(t.value - COALESCE(t.compensation_value, 0), 0))
             FILTER (WHERE t.date >= v_month AND t.status = 'PENDING')          AS scheduled,
           SUM(GREATEST(t.value - COALESCE(t.compensation_value, 0), 0))
             FILTER (WHERE t.date >= v_prev AND t.date < v_month)               AS previous,
           SUM(GREATEST(t.value - COALESCE(t.compensation_value, 0), 0))
             FILTER (WHERE t.date < v_month) / 3.0                              AS avg_3m
      FROM public.transactions t
     WHERE t.user_id = ANY (v_scope)
       AND t.date >= v_from
       AND t.date < v_next
       AND t.type = 'expense'
       AND t.status <> 'CANCELED'
       AND t.category_id IS NOT NULL
     GROUP BY t.user_id, t.category_id
  ),
  bud AS (
    SELECT b.id, b.user_id, b.category_id, b.amount_limit
      FROM public.budgets b
     WHERE b.user_id = ANY (v_scope)
       AND b.period_month = v_month
  ),
  brow AS (
    SELECT b.id,
           b.user_id,
           b.category_id,
           c.name                                              AS category_name,
           c.icon                                              AS category_icon,
           b.amount_limit,
           round(COALESCE(s.spent, 0), 2)                      AS spent,
           round(COALESCE(s.scheduled, 0), 2)                  AS scheduled,
           round(COALESCE(s.previous, 0), 2)                   AS previous_spent,
           round(COALESCE(s.avg_3m, 0), 2)                     AS avg_3m,
           round(b.amount_limit - COALESCE(s.spent, 0), 2)     AS remaining,
           round(COALESCE(s.spent, 0) / b.amount_limit * 100, 1) AS used_pct
      FROM bud b
      JOIN public.categories c ON c.id = b.category_id
      LEFT JOIN spend s ON s.user_id = b.user_id AND s.category_id = b.category_id
  ),
  sugg AS (
    SELECT s.category_id,
           c.name                     AS category_name,
           c.icon                     AS category_icon,
           round(s.avg_3m, 2)         AS avg_3m,
           round(COALESCE(s.spent, 0), 2) AS spent
      FROM spend s
      JOIN public.categories c ON c.id = s.category_id
     WHERE s.user_id = v_uid
       AND c.category_type = 'expense'
       AND (COALESCE(c.is_system, false) OR c.user_id = v_uid)
       AND COALESCE(s.avg_3m, 0) > 0
       AND NOT EXISTS (
         SELECT 1 FROM bud b WHERE b.user_id = v_uid AND b.category_id = s.category_id
       )
     ORDER BY s.avg_3m DESC
     LIMIT 5
  )
  SELECT jsonb_build_object(
    'month', v_month,
    'scope', CASE WHEN p_scope = 'couple' THEN 'couple' ELSE 'personal' END,
    'budgets', COALESCE(
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.used_pct DESC, r.category_name) FROM brow r),
      '[]'::jsonb
    ),
    'suggestions', COALESCE(
      (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.avg_3m DESC) FROM sugg x),
      '[]'::jsonb
    ),
    'previous_month_budgets', (
      SELECT COUNT(*) FROM public.budgets b WHERE b.user_id = v_uid AND b.period_month = v_prev
    ),
    'totals', (
      SELECT jsonb_build_object(
        'limit',         COALESCE(SUM(r.amount_limit), 0),
        'spent',         COALESCE(SUM(r.spent), 0),
        'scheduled',     COALESCE(SUM(r.scheduled), 0),
        'remaining',     COALESCE(SUM(r.amount_limit), 0) - COALESCE(SUM(r.spent), 0),
        'over_count',    COUNT(*) FILTER (WHERE r.spent > r.amount_limit),
        'warning_count', COUNT(*) FILTER (WHERE r.used_pct >= 80 AND r.spent <= r.amount_limit),
        'count',         COUNT(*)
      )
      FROM brow r
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

-- Copia os tetos do mês anterior (só os do próprio usuário). INVOKER: RLS e
-- trigger de feature continuam valendo.
CREATE OR REPLACE FUNCTION public.orbi_budget_copy_previous(p_month date)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := public.orbi_require_auth();
  v_month date := date_trunc('month', p_month)::date;
  v_count integer;
BEGIN
  INSERT INTO public.budgets (user_id, category_id, amount_limit, period_month)
  SELECT b.user_id, b.category_id, b.amount_limit, v_month
    FROM public.budgets b
   WHERE b.user_id = v_uid
     AND b.period_month = (v_month - INTERVAL '1 month')::date
  ON CONFLICT (user_id, period_month, category_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- 6. RPC — FECHAMENTO DO MÊS (DRE PESSOAL)
-- ============================================================================
-- Estrutura:
--   Receitas (recebidas + a receber)
--   (−) Despesas fixas        is_fixed na transação ou na série
--   (−) Parcelamentos         série com >1 parcela, sem rateio
--   (−) Despesas variáveis    o resto
--   (=) Resultado do mês      → taxa de poupança = resultado / receitas
--   (−) Aportes em metas
--   (=) Sobra livre
--
-- Receita de rateio (linha B: income + is_shared + linked_txn_id) fica fora:
-- a despesa A já entra líquida (value − compensation_value). Contar as duas
-- duplicaria o efeito do rateio.
CREATE OR REPLACE FUNCTION public.orbi_monthly_closing(p_month date DEFAULT NULL, p_scope text DEFAULT 'personal')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := public.orbi_require_auth();
  v_month  date := date_trunc('month', COALESCE(p_month, CURRENT_DATE))::date;
  v_prev   date;
  v_next   date;
  v_from   date;
  v_scope  uuid[];
  v_result jsonb;
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
     WHERE t.user_id = ANY (v_scope)
       AND t.date >= v_from
       AND t.date < v_next
       AND t.status <> 'CANCELED'
       AND t.type IN ('income', 'expense')
       AND NOT (t.type = 'income' AND COALESCE(t.is_shared, false) AND t.linked_txn_id IS NOT NULL)
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
      COALESCE(c.income_pending, 0)    AS income_pending,
      COALESCE(c.expenses, 0)          AS expenses,
      COALESCE(c.expenses_paid, 0)     AS expenses_paid,
      COALESCE(c.expenses_pending, 0)  AS expenses_pending,
      COALESCE(c.fixed, 0)             AS fixed,
      COALESCE(c.installments, 0)      AS installments,
      COALESCE(c.variable, 0)          AS variable,
      COALESCE(c.transactions_count, 0) AS transactions_count,
      COALESCE(c.pending_count, 0)     AS pending_count,
      COALESCE(p.income, 0)            AS p_income,
      COALESCE(p.expenses, 0)          AS p_expenses,
      COALESCE(p.fixed, 0)             AS p_fixed,
      COALESCE(p.installments, 0)      AS p_installments,
      COALESCE(p.variable, 0)          AS p_variable,
      (p.m IS NOT NULL)                AS has_previous,
      g.current_total                  AS goals_current,
      g.previous_total                 AS goals_previous
    FROM goal_m g
    LEFT JOIN cur c ON true
    LEFT JOIN prv p ON true
  )
  SELECT jsonb_build_object(
    'month',          v_month,
    'previous_month', v_prev,
    'scope',          CASE WHEN p_scope = 'couple' THEN 'couple' ELSE 'personal' END,
    'has_data',       s.transactions_count > 0,
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
    )
  )
  INTO v_result
  FROM summary s;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 7. PRIVILÉGIOS
-- ============================================================================
REVOKE ALL ON public.budgets, public.goals, public.goal_allocations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets, public.goals, public.goal_allocations TO authenticated;
GRANT ALL ON public.budgets, public.goals, public.goal_allocations TO service_role;

REVOKE ALL ON public.vw_goal_progress FROM anon, authenticated;
GRANT SELECT ON public.vw_goal_progress TO authenticated;
GRANT SELECT ON public.vw_goal_progress TO service_role;

-- Internos: só chamados por triggers / RPCs SECURITY DEFINER.
REVOKE EXECUTE ON FUNCTION public.orbi_require_feature(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_scope_user_ids(text)             FROM PUBLIC, anon, authenticated;

-- Policies avaliam orbi_has_feature com o papel do chamador.
REVOKE EXECUTE ON FUNCTION public.orbi_has_feature(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.orbi_has_feature(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.orbi_pct_change(numeric, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.orbi_pct_change(numeric, numeric) TO authenticated;

-- Triggers (paridade com check_*_limit em 20260910120001).
REVOKE EXECUTE ON FUNCTION public.orbi_budgets_guard()          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.orbi_goals_guard()            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.orbi_goal_allocations_guard() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.orbi_budgets_guard()          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.orbi_goals_guard()            TO authenticated;
GRANT  EXECUTE ON FUNCTION public.orbi_goal_allocations_guard() TO authenticated;

-- RPCs do cliente.
REVOKE EXECUTE ON FUNCTION public.orbi_budget_overview(date, text)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.orbi_budget_copy_previous(date)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.orbi_monthly_closing(date, text)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.orbi_budget_overview(date, text)  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.orbi_budget_copy_previous(date)   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.orbi_monthly_closing(date, text)  TO authenticated;

COMMENT ON FUNCTION public.orbi_budget_overview(date, text) IS
  'Orçamentos do mês com consumo, agendado, média de 3 meses e sugestões de categorias sem teto. Exige feature orcamentos.';
COMMENT ON FUNCTION public.orbi_monthly_closing(date, text) IS
  'DRE pessoal do mês: receitas, despesas fixas/parcelas/variáveis, resultado, taxa de poupança, variação vs mês anterior, maior despesa, categorias e tendência de 6 meses. Exige feature dre_pessoal.';
COMMENT ON FUNCTION public.orbi_has_feature(text) IS
  'true se o plano vigente do usuário do JWT inclui a feature. Usada nas policies dos módulos premium.';

-- Lista canônica de tabelas multi-tenant (20260910000000) passa a incluir os módulos.
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
    'family_group_members', 'budgets', 'goals', 'goal_allocations'
  ];
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
