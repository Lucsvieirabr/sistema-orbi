CREATE OR REPLACE FUNCTION public.orbi_norm_text(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT btrim(regexp_replace(
           lower(translate(COALESCE(p_value, ''),
             'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
             'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
           '[^a-z0-9]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.orbi_merchant_root(p_normalized text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(array_to_string(ARRAY(
    SELECT u.tok
      FROM unnest(string_to_array(COALESCE(p_normalized, ''), ' ')) WITH ORDINALITY AS u(tok, ord)
     WHERE length(u.tok) >= 3
       AND u.tok !~ '[0-9]'
       AND u.tok <> ALL (ARRAY[
         'pag', 'ifd', 'mercadopago', 'pagseguro', 'pagamento', 'pagto', 'pgto', 'compra', 'compras', 'cartao',
         'debito', 'credito', 'pix', 'ted', 'doc', 'boleto', 'transferencia', 'transf', 'enviado', 'enviada',
         'recebido', 'recebida', 'total', 'parcela', 'parc', 'elo', 'visa', 'master', 'mastercard', 'int',
         'com', 'ltda', 'eireli', 'epp', 'www', 'http', 'https', 'brasil', 'bra', 'nacional', 'internacional',
         'online', 'app', 'loja', 'estab', 'estabelecimento', 'deb', 'cred', 'aut', 'automatico', 'nfc', 'contactless'
       ])
     ORDER BY u.ord
     LIMIT 2
  ), ' '), '');
$$;

CREATE OR REPLACE FUNCTION public.orbi_is_essential_category(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT public.orbi_norm_text(p_name) ~ '\m(aliment|mercad|supermerc|hortifrut|padari|acougue|refei|restaurant|delivery|farmac|drogar|saude|remedio|combust|gasolin|posto|transporte|assinatura|streaming|software|saas|nuvem|casa|moradia|energia|luz\M|agua\M|internet|telefon|celular|condominio|gas\M|pet\M)';
$$;

CREATE OR REPLACE FUNCTION public.orbi_personal_inflation_compute(p_user_id uuid, p_month date)
RETURNS public.monthly_summaries
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ref        date := date_trunc('month', COALESCE(p_month, CURRENT_DATE))::date;
  v_cur_start  date;
  v_cur_end    date;
  v_i3         numeric;
  v_i6         numeric;
  v_i12        numeric;
  v_essential  numeric;
  v_matched    integer;
  v_sample     integer;
  v_categories jsonb;
  v_basis      smallint;
  v_headline   numeric;
  v_row        public.monthly_summaries;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário obrigatório.' USING ERRCODE = '22023';
  END IF;
  IF v_ref < DATE '2001-01-01' OR v_ref > DATE '2100-12-01' THEN
    RAISE EXCEPTION 'Mês fora do intervalo permitido.' USING ERRCODE = '22023';
  END IF;

  v_cur_start := (v_ref - INTERVAL '2 months')::date;
  v_cur_end   := (v_ref + INTERVAL '1 month')::date;

  WITH dict AS MATERIALIZED (
    SELECT DISTINCT ON (x.k) x.k, x.entity_name
      FROM (
        SELECT public.orbi_norm_text(d.merchant_key) AS k, d.entity_name
          FROM public.merchants_dictionary d
         WHERE COALESCE(d.is_active, true)
      ) x
     WHERE length(x.k) >= 4
     ORDER BY x.k, x.entity_name
  ),
  raw AS MATERIALIZED (
    SELECT t.date,
           t.category_id,
           GREATEST(t.value - COALESCE(t.compensation_value, 0), 0)::numeric AS net,
           public.orbi_norm_text(regexp_replace(t.description, '\(pagamento total\)', '', 'i')) AS nd
      FROM public.transactions t
      JOIN public.categories c ON c.id = t.category_id
      LEFT JOIN public.series s ON s.id = t.series_id
     WHERE t.user_id = p_user_id
       AND t.type = 'expense'
       AND t.status <> 'CANCELED'
       AND t.project_id IS NULL
       AND t.date >= (v_cur_start - INTERVAL '12 months')::date
       AND t.date < v_cur_end
       AND public.orbi_is_essential_category(c.name)
       AND NOT (
         COALESCE(s.total_installments, 1) > 1
         AND NOT COALESCE(s.is_fixed, false)
         AND NOT COALESCE(t.is_fixed, false)
       )
  ),
  keyed AS (
    SELECT d.nd,
           COALESCE(
             (SELECT x.entity_name FROM dict x WHERE ' ' || d.nd || ' ' LIKE '% ' || x.k || ' %' ORDER BY length(x.k) DESC LIMIT 1),
             initcap(public.orbi_merchant_root(d.nd))
           ) AS mk
      FROM (SELECT DISTINCT nd FROM raw) d
  ),
  rows_k AS MATERIALIZED (
    SELECT r.date, r.category_id, r.net, k.mk
      FROM raw r
      JOIN keyed k ON k.nd = r.nd
     WHERE r.net > 0
  ),
  bases AS (
    SELECT b.b::integer AS b,
           (v_cur_start - make_interval(months => b.b))::date AS bs,
           (v_cur_end - make_interval(months => b.b))::date AS be
      FROM unnest(ARRAY[3, 6, 12]) AS b(b)
  ),
  cur AS (
    SELECT r.category_id, r.mk, COUNT(*) AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY r.net)::numeric AS med,
           SUM(r.net) AS total
      FROM rows_k r
     WHERE r.date >= v_cur_start AND r.date < v_cur_end
     GROUP BY r.category_id, r.mk
  ),
  cur_cat AS (
    SELECT c.category_id, SUM(c.total) AS total FROM cur c GROUP BY c.category_id
  ),
  base AS (
    SELECT bb.b, r.category_id, r.mk, COUNT(*) AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY r.net)::numeric AS med,
           SUM(r.net) AS total
      FROM bases bb
      JOIN rows_k r ON r.date >= bb.bs AND r.date < bb.be
     GROUP BY bb.b, r.category_id, r.mk
  ),
  base_cat AS (
    SELECT ba.b, ba.category_id, SUM(ba.total) AS total FROM base ba GROUP BY ba.b, ba.category_id
  ),
  pairs AS (
    SELECT ba.b, ba.category_id, ba.mk, c.med AS cur_med, ba.med AS base_med,
           LEAST(GREATEST(c.med / ba.med, 0.5), 2.0) AS r,
           ba.total AS w
      FROM base ba
      JOIN cur c ON c.category_id = ba.category_id AND c.mk = ba.mk
     WHERE ba.mk IS NOT NULL AND ba.med > 0 AND c.med > 0
  ),
  cat_idx AS (
    SELECT bc.b, bc.category_id, bc.total AS base_total, COALESCE(cc.total, 0) AS cur_total,
           COUNT(p.mk) AS paired,
           CASE
             WHEN COUNT(p.mk) > 0 THEN SUM(p.r * p.w) / NULLIF(SUM(p.w), 0)
             WHEN COALESCE(cc.total, 0) > 0 THEN LEAST(GREATEST(cc.total / bc.total, 0.5), 2.0)
           END AS idx
      FROM base_cat bc
      LEFT JOIN cur_cat cc ON cc.category_id = bc.category_id
      LEFT JOIN pairs p ON p.b = bc.b AND p.category_id = bc.category_id
     WHERE bc.total > 0
     GROUP BY bc.b, bc.category_id, bc.total, cc.total
  ),
  overall AS (
    SELECT ci.b, round(SUM(ci.base_total * (ci.idx - 1)) / NULLIF(SUM(ci.base_total), 0) * 100, 2) AS pct
      FROM cat_idx ci
     WHERE ci.idx IS NOT NULL
     GROUP BY ci.b
  ),
  cats AS (
    SELECT DISTINCT u.category_id
      FROM (SELECT category_id FROM cur_cat UNION SELECT category_id FROM base_cat) u
  )
  SELECT
    (SELECT o.pct FROM overall o WHERE o.b = 3),
    (SELECT o.pct FROM overall o WHERE o.b = 6),
    (SELECT o.pct FROM overall o WHERE o.b = 12),
    round(COALESCE((SELECT SUM(cc.total) FROM cur_cat cc), 0) / 3.0, 2),
    (SELECT COUNT(DISTINCT p.mk)::integer FROM pairs p),
    (SELECT COUNT(*)::integer FROM rows_k),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'category_id', k.id,
               'name', k.name,
               'icon', k.icon,
               'monthly_spend', round(COALESCE((SELECT cc.total FROM cur_cat cc WHERE cc.category_id = k.id), 0) / 3.0, 2),
               'idx_3m', (SELECT round((ci.idx - 1) * 100, 2) FROM cat_idx ci WHERE ci.b = 3 AND ci.category_id = k.id),
               'idx_6m', (SELECT round((ci.idx - 1) * 100, 2) FROM cat_idx ci WHERE ci.b = 6 AND ci.category_id = k.id),
               'idx_12m', (SELECT round((ci.idx - 1) * 100, 2) FROM cat_idx ci WHERE ci.b = 12 AND ci.category_id = k.id),
               'method', CASE WHEN EXISTS (SELECT 1 FROM cat_idx ci WHERE ci.category_id = k.id AND ci.paired > 0) THEN 'merchant' ELSE 'category' END,
               'paired', COALESCE((SELECT MAX(ci.paired) FROM cat_idx ci WHERE ci.category_id = k.id), 0),
               'movers', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object(
                          'merchant', m.mk,
                          'basis', m.b,
                          'cur_ticket', round(m.cur_med, 2),
                          'base_ticket', round(m.base_med, 2),
                          'change_pct', round((m.cur_med / m.base_med - 1) * 100, 1)
                        ) ORDER BY abs(m.cur_med / m.base_med - 1) DESC)
                   FROM (
                     SELECT * FROM (
                       SELECT DISTINCT ON (p.mk) p.* FROM pairs p WHERE p.category_id = k.id ORDER BY p.mk, p.b DESC
                     ) d
                     ORDER BY abs(d.cur_med / d.base_med - 1) DESC
                     LIMIT 4
                   ) m
               ), '[]'::jsonb)
             ) ORDER BY COALESCE((SELECT cc.total FROM cur_cat cc WHERE cc.category_id = k.id), 0) DESC)
        FROM cats
        JOIN public.categories k ON k.id = cats.category_id
    ), '[]'::jsonb)
  INTO v_i3, v_i6, v_i12, v_essential, v_matched, v_sample, v_categories;

  IF v_i12 IS NOT NULL THEN
    v_basis := 12; v_headline := v_i12;
  ELSIF v_i6 IS NOT NULL THEN
    v_basis := 6; v_headline := v_i6;
  ELSIF v_i3 IS NOT NULL THEN
    v_basis := 3; v_headline := v_i3;
  ELSE
    v_basis := NULL; v_headline := NULL;
  END IF;

  INSERT INTO public.monthly_summaries AS ms (
    user_id, period_month, essential_monthly, inflation_3m, inflation_6m, inflation_12m,
    headline_pct, headline_basis, categories, matched_merchants, sample_size, computed_at
  )
  VALUES (
    p_user_id, v_ref, COALESCE(v_essential, 0), v_i3, v_i6, v_i12,
    v_headline, v_basis, COALESCE(v_categories, '[]'::jsonb), COALESCE(v_matched, 0), COALESCE(v_sample, 0), NOW()
  )
  ON CONFLICT (user_id, period_month) DO UPDATE
     SET essential_monthly = EXCLUDED.essential_monthly,
         inflation_3m      = EXCLUDED.inflation_3m,
         inflation_6m      = EXCLUDED.inflation_6m,
         inflation_12m     = EXCLUDED.inflation_12m,
         headline_pct      = EXCLUDED.headline_pct,
         headline_basis    = EXCLUDED.headline_basis,
         categories        = EXCLUDED.categories,
         matched_merchants = EXCLUDED.matched_merchants,
         sample_size       = EXCLUDED.sample_size,
         computed_at       = EXCLUDED.computed_at
  RETURNING ms.* INTO v_row;

  IF v_basis IS NOT NULL
     AND v_ref = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date
     AND COALESCE(public.orbi_active_plan_features(p_user_id) ->> 'orcamentos', 'false') = 'true'
  THEN
    INSERT INTO public.user_notifications (user_id, kind, title, body, action_path, payload, dedupe_key)
    SELECT p_user_id,
           'budget_inflation',
           left('Reajuste o teto de ' || c.name, 120),
           left(format(
             'Os gastos essenciais em %s ficaram %s%% mais caros no seu histórico. Reajuste o teto antes que ele estoure na segunda semana do mês.',
             c.name, replace(round(x.pct, 1)::text, '.', ',')
           ), 400),
           '/sistema/budgets',
           jsonb_build_object(
             'budget_id', b.id,
             'category_id', b.category_id,
             'category_name', c.name,
             'period_month', b.period_month,
             'current_limit', b.amount_limit,
             'suggested_limit', round(b.amount_limit * (1 + x.pct / 100), 2),
             'inflation_pct', round(x.pct, 1),
             'basis', v_basis,
             'reference_month', v_ref
           ),
           'budget_inflation:' || b.id::text || ':' || v_ref::text
      FROM public.budgets b
      JOIN public.categories c ON c.id = b.category_id
      JOIN LATERAL (
        SELECT (e ->> CASE v_basis WHEN 12 THEN 'idx_12m' WHEN 6 THEN 'idx_6m' ELSE 'idx_3m' END)::numeric AS pct
          FROM jsonb_array_elements(v_row.categories) e
         WHERE (e ->> 'category_id')::uuid = b.category_id
      ) x ON true
     WHERE b.user_id = p_user_id
       AND b.period_month = date_trunc('month', CURRENT_DATE)::date
       AND x.pct > 10
    ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_personal_inflation(p_months integer DEFAULT 12, p_refresh boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      uuid := public.orbi_require_auth();
  v_months   integer := COALESCE(p_months, 12);
  v_ref      date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
  v_month    date;
  v_computed timestamptz;
  v_cur      public.monthly_summaries;
  v_history  jsonb;
  v_alerts   jsonb;
  i          integer;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'inflacao_pessoal', 'A Inflação Pessoal');

  IF v_months < 3 OR v_months > 24 THEN
    RAISE EXCEPTION 'Janela precisa estar entre 3 e 24 meses.' USING ERRCODE = '22023';
  END IF;

  PERFORM public.orbi_quota_lock(v_uid, 'inflation');

  FOR i IN REVERSE (v_months - 1)..0 LOOP
    v_month := (v_ref - make_interval(months => i))::date;
    v_computed := NULL;
    SELECT ms.computed_at INTO v_computed
      FROM public.monthly_summaries ms
     WHERE ms.user_id = v_uid AND ms.period_month = v_month;

    IF v_computed IS NULL
       OR (v_month = v_ref AND v_computed < NOW() - INTERVAL '6 hours')
       OR (COALESCE(p_refresh, false) AND v_computed < NOW() - INTERVAL '2 minutes')
    THEN
      PERFORM public.orbi_personal_inflation_compute(v_uid, v_month);
    END IF;
  END LOOP;

  SELECT * INTO v_cur FROM public.monthly_summaries ms WHERE ms.user_id = v_uid AND ms.period_month = v_ref;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'month', ms.period_month,
           'inflation_3m', ms.inflation_3m,
           'inflation_6m', ms.inflation_6m,
           'inflation_12m', ms.inflation_12m,
           'headline_pct', ms.headline_pct,
           'headline_basis', ms.headline_basis,
           'essential_monthly', ms.essential_monthly,
           'sample_size', ms.sample_size,
           'categories', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'category_id', e ->> 'category_id',
                      'name', e ->> 'name',
                      'idx_3m', e -> 'idx_3m',
                      'idx_6m', e -> 'idx_6m',
                      'idx_12m', e -> 'idx_12m'
                    ))
               FROM jsonb_array_elements(ms.categories) e
           ), '[]'::jsonb)
         ) ORDER BY ms.period_month), '[]'::jsonb)
    INTO v_history
    FROM public.monthly_summaries ms
   WHERE ms.user_id = v_uid
     AND ms.period_month >= (v_ref - make_interval(months => v_months - 1))::date
     AND ms.period_month <= v_ref;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'title', n.title,
           'body', n.body,
           'payload', n.payload,
           'created_at', n.created_at
         ) ORDER BY n.created_at DESC), '[]'::jsonb)
    INTO v_alerts
    FROM public.user_notifications n
   WHERE n.user_id = v_uid
     AND n.kind = 'budget_inflation'
     AND n.read_at IS NULL;

  RETURN jsonb_build_object(
    'reference_month', v_ref,
    'window_start', (v_ref - INTERVAL '2 months')::date,
    'computed_at', v_cur.computed_at,
    'essential_monthly', COALESCE(v_cur.essential_monthly, 0),
    'inflation_3m', v_cur.inflation_3m,
    'inflation_6m', v_cur.inflation_6m,
    'inflation_12m', v_cur.inflation_12m,
    'headline_pct', v_cur.headline_pct,
    'headline_basis', v_cur.headline_basis,
    'matched_merchants', COALESCE(v_cur.matched_merchants, 0),
    'sample_size', COALESCE(v_cur.sample_size, 0),
    'categories', COALESCE(v_cur.categories, '[]'::jsonb),
    'history', v_history,
    'alerts', v_alerts
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_personal_inflation_run_monthly()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ref   date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
  v_user  uuid;
  v_count integer := 0;
BEGIN
  FOR v_user IN
    SELECT DISTINCT s.user_id FROM public.user_subscriptions s WHERE s.status IN ('trial', 'active')
  LOOP
    IF COALESCE(public.orbi_active_plan_features(v_user) ->> 'inflacao_pessoal', 'false') = 'true' THEN
      BEGIN
        PERFORM public.orbi_personal_inflation_compute(v_user, v_ref);
        v_count := v_count + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'orbi_personal_inflation_run_monthly: falha para um usuário (%)', SQLSTATE;
      END;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_daily_burn_rate(p_days integer DEFAULT 90, p_scope text DEFAULT 'personal')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := public.orbi_require_auth();
  v_days   integer := COALESCE(p_days, 90);
  v_scope  uuid[];
  v_from   date;
  v_result jsonb;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'motor_preditivo', 'Motor preditivo');

  IF v_days < 7 OR v_days > 365 THEN
    RAISE EXCEPTION 'Janela precisa estar entre 7 e 365 dias.' USING ERRCODE = '22023';
  END IF;

  v_scope := public.orbi_scope_user_ids(p_scope);
  v_from  := CURRENT_DATE - (v_days - 1);

  WITH variable AS (
    SELECT t.category_id,
           GREATEST(t.value - COALESCE(t.compensation_value, 0), 0) AS net
      FROM public.transactions t
      LEFT JOIN public.series s ON s.id = t.series_id
     WHERE t.user_id = ANY (v_scope)
       AND t.type = 'expense'
       AND t.status <> 'CANCELED'
       AND t.date >= v_from
       AND t.date <= CURRENT_DATE
       AND t.project_id IS NULL
       AND COALESCE(t.is_fixed, false) = false
       AND COALESCE(s.is_fixed, false) = false
       AND COALESCE(s.total_installments, 1) <= 1
  ),
  cats AS (
    SELECT v.category_id, SUM(v.net) AS total, COUNT(*) AS n
      FROM variable v
     GROUP BY v.category_id
  )
  SELECT jsonb_build_object(
    'window_days', v_days,
    'from', v_from,
    'to', CURRENT_DATE,
    'total', round(COALESCE((SELECT SUM(net) FROM variable), 0), 2),
    'transactions', (SELECT COUNT(*) FROM variable),
    'daily', round(COALESCE((SELECT SUM(net) FROM variable), 0) / v_days, 2),
    'top_categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'category_id', x.category_id,
               'name', COALESCE(c.name, 'Sem categoria'),
               'icon', c.icon,
               'total', round(x.total, 2),
               'daily', round(x.total / v_days, 2)
             ) ORDER BY x.total DESC)
        FROM (SELECT * FROM cats ORDER BY total DESC LIMIT 5) x
        LEFT JOIN public.categories c ON c.id = x.category_id
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_cash_forecast(p_horizon_days integer DEFAULT 90, p_scope text DEFAULT 'personal')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    SELECT t.date AS event_date,
           CASE WHEN t.type = 'income' THEN t.value ELSE -t.value END AS amount,
           t.description,
           'scheduled'::text AS kind
      FROM public.transactions t
     WHERE t.user_id = ANY (v_scope)
       AND t.credit_card_id IS NULL
       AND t.type IN ('income', 'expense')
       AND t.status <> 'CANCELED'
       AND t.date > CURRENT_DATE
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
$$;

REVOKE ALL ON FUNCTION public.orbi_personal_inflation_compute(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_personal_inflation_run_monthly() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_norm_text(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_merchant_root(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_is_essential_category(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_norm_text(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orbi_merchant_root(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orbi_is_essential_category(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.orbi_personal_inflation(integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_daily_burn_rate(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_cash_forecast(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_personal_inflation(integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_daily_burn_rate(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_cash_forecast(integer, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
