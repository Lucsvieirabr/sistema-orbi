-- ============================================================================
-- RPCs — Motor Preditivo e Acertos em Lote (tabelas em 20260916021503)
-- ============================================================================
-- Exclusivos Pro/Casal. Features no jsonb do plano:
--   motor_preditivo   → RPCs orbi_daily_burn_rate / orbi_cash_forecast
--   contratos_rateio  → split_contracts, ledgers, ledger_participants,
--                       ledger_entries, transactions.ledger_id,
--                       RPCs orbi_ledger_summary / orbi_ledger_settle
-- Mesma defesa em 4 camadas dos módulos de planejamento (20260915161252):
-- RLS com orbi_has_feature → trigger de guarda (P0004/P0005 + tenant) →
-- RPC com orbi_require_feature → PremiumRoute no front.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6. RPC: ralo diário — média de gastos variáveis dos últimos N dias
-- ----------------------------------------------------------------------------
-- Variável = despesa não cancelada, sem is_fixed (transação ou série) e fora de
-- parcelamento (série com > 1 parcela: essas já estão agendadas). Valor líquido
-- de rateio (value − compensation_value), mesma regra do Dashboard/DRE.
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

-- ----------------------------------------------------------------------------
-- 7. RPC: projeção de caixa — saldo real + compromissos agendados + ralo
-- ----------------------------------------------------------------------------
-- Eventos (o cliente monta a curva dia a dia e soma os Eventos Fantasmas):
--   scheduled  transação não-cartão futura, não cancelada
--   invoice    compras de cartão agrupadas por fatura, no dia do vencimento
--   recurring  próximas ocorrências de séries fixas ainda não geradas
CREATE OR REPLACE FUNCTION public.orbi_cash_forecast(p_horizon_days integer DEFAULT 90, p_scope text DEFAULT 'personal')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := public.orbi_require_auth();
  v_horizon integer := COALESCE(p_horizon_days, 90);
  v_scope   uuid[];
  v_end     date;
  v_balance numeric;
  v_events  jsonb;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'motor_preditivo', 'Motor preditivo');

  IF v_horizon < 7 OR v_horizon > 400 THEN
    RAISE EXCEPTION 'Horizonte precisa estar entre 7 e 400 dias.' USING ERRCODE = '22023';
  END IF;

  v_scope := public.orbi_scope_user_ids(p_scope);
  v_end   := CURRENT_DATE + v_horizon;

  -- Mesmo "saldo real" das telas de Contas/Dashboard.
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
           -- Fechamento: compra antes do dia de fechamento cai na fatura do mês; senão, na do mês seguinte.
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
  all_events AS (
    SELECT * FROM scheduled
    UNION ALL SELECT * FROM invoices
    UNION ALL SELECT * FROM recurring
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'date', e.event_date,
           'amount', round(e.amount, 2),
           'description', e.description,
           'kind', e.kind
         ) ORDER BY e.event_date, e.amount), '[]'::jsonb)
    INTO v_events
    FROM (SELECT * FROM all_events WHERE amount <> 0 ORDER BY event_date LIMIT 3000) e;

  RETURN jsonb_build_object(
    'as_of', CURRENT_DATE,
    'horizon_days', v_horizon,
    'scope', CASE WHEN p_scope = 'couple' THEN 'couple' ELSE 'personal' END,
    'current_balance', round(v_balance, 2),
    'burn', public.orbi_daily_burn_rate(90, p_scope),
    'events', v_events
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. RPC: extrato de fechamento do ledger (saldo consolidado + transferências)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orbi_ledger_summary(p_ledger_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        uuid := public.orbi_require_auth();
  v_ledger     public.ledgers%ROWTYPE;
  v_owner_name text;
  v_total      numeric := 0;
  v_parts      jsonb;
  v_transfers  jsonb := '[]'::jsonb;
  v_debtors    jsonb;
  v_creditors  jsonb;
  i            integer := 0;
  j            integer := 0;
  v_debt       numeric;
  v_credit     numeric;
  v_amount     numeric;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'contratos_rateio', 'Acertos de viagem');

  IF p_ledger_id IS NULL THEN
    RAISE EXCEPTION 'Evento inexistente.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ledger
    FROM public.ledgers l
   WHERE l.id = p_ledger_id
     AND l.user_id = ANY (public.orbi_family_user_ids());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento inexistente.' USING ERRCODE = '42501';
  END IF;

  IF v_ledger.user_id = v_uid THEN
    v_owner_name := 'Você';
  ELSE
    SELECT NULLIF(btrim(up.full_name), '') INTO v_owner_name
      FROM public.user_profiles up WHERE up.user_id = v_ledger.user_id;
    v_owner_name := COALESCE(v_owner_name, 'Titular');
  END IF;

  WITH raw AS (
    SELECT 'owner'::text AS key, NULL::uuid AS person_id, v_owner_name AS name, v_ledger.pix_key AS pix,
           v_ledger.owner_weight AS weight,
           COALESCE((
             SELECT SUM(t.value)
               FROM public.transactions t
              WHERE t.ledger_id = v_ledger.id
                AND t.user_id = v_ledger.user_id
                AND t.type = 'expense'
                AND t.status <> 'CANCELED'
           ), 0) AS paid
    UNION ALL
    SELECT p.id::text, p.id, p.name, p.pix, lp.weight,
           COALESCE((SELECT SUM(e.value) FROM public.ledger_entries e
                      WHERE e.ledger_id = v_ledger.id AND e.paid_by_person_id = p.id), 0)
      FROM public.ledger_participants lp
      JOIN public.people p ON p.id = lp.person_id
     WHERE lp.ledger_id = v_ledger.id
  ),
  totals AS (
    SELECT COALESCE(SUM(paid), 0) AS total, COALESCE(SUM(weight), 0) AS weights FROM raw
  ),
  parts AS (
    SELECT r.*,
           CASE WHEN t.weights > 0 THEN round(t.total * r.weight / t.weights, 2) ELSE 0 END AS share
      FROM raw r CROSS JOIN totals t
  )
  SELECT (SELECT total FROM totals),
         COALESCE(jsonb_agg(jsonb_build_object(
           'key', key, 'person_id', person_id, 'name', name, 'pix', pix,
           'weight', weight, 'paid', round(paid, 2), 'share', share,
           'balance', round(paid - share, 2)
         ) ORDER BY (key <> 'owner'), name), '[]'::jsonb)
    INTO v_total, v_parts
    FROM parts;

  -- Liquidação gulosa: maior devedor paga o maior credor até zerar.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('key', e ->> 'key', 'name', e ->> 'name',
                                               'amount', -((e ->> 'balance')::numeric))
                            ORDER BY (e ->> 'balance')::numeric ASC), '[]'::jsonb)
    INTO v_debtors
    FROM jsonb_array_elements(v_parts) e
   WHERE (e ->> 'balance')::numeric <= -0.01;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('key', e ->> 'key', 'name', e ->> 'name', 'pix', e ->> 'pix',
                                               'amount', (e ->> 'balance')::numeric)
                            ORDER BY (e ->> 'balance')::numeric DESC), '[]'::jsonb)
    INTO v_creditors
    FROM jsonb_array_elements(v_parts) e
   WHERE (e ->> 'balance')::numeric >= 0.01;

  IF jsonb_array_length(v_debtors) > 0 THEN v_debt := (v_debtors -> 0 ->> 'amount')::numeric; END IF;
  IF jsonb_array_length(v_creditors) > 0 THEN v_credit := (v_creditors -> 0 ->> 'amount')::numeric; END IF;

  WHILE i < jsonb_array_length(v_debtors) AND j < jsonb_array_length(v_creditors) LOOP
    v_amount := round(LEAST(v_debt, v_credit), 2);
    IF v_amount >= 0.01 THEN
      v_transfers := v_transfers || jsonb_build_array(jsonb_build_object(
        'from_key',  v_debtors -> i ->> 'key',
        'from_name', v_debtors -> i ->> 'name',
        'to_key',    v_creditors -> j ->> 'key',
        'to_name',   v_creditors -> j ->> 'name',
        'to_pix',    v_creditors -> j ->> 'pix',
        'amount',    v_amount
      ));
    END IF;
    v_debt   := round(v_debt - v_amount, 2);
    v_credit := round(v_credit - v_amount, 2);
    IF v_debt < 0.01 THEN
      i := i + 1;
      IF i < jsonb_array_length(v_debtors) THEN v_debt := (v_debtors -> i ->> 'amount')::numeric; END IF;
    END IF;
    IF v_credit < 0.01 THEN
      j := j + 1;
      IF j < jsonb_array_length(v_creditors) THEN v_credit := (v_creditors -> j ->> 'amount')::numeric; END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ledger_id', v_ledger.id,
    'status', v_ledger.status,
    'settled_at', v_ledger.settled_at,
    'total', round(COALESCE(v_total, 0), 2),
    'participants', v_parts,
    'transfers', v_transfers,
    'transactions_count', (
      SELECT COUNT(*) FROM public.transactions t
       WHERE t.ledger_id = v_ledger.id AND t.user_id = v_ledger.user_id AND t.status <> 'CANCELED'
    ),
    'pending_count', (
      SELECT COUNT(*) FROM public.transactions t
       WHERE t.user_id = v_ledger.user_id
         AND t.status = 'PENDING'
         AND (t.ledger_id = v_ledger.id
              OR t.linked_txn_id IN (SELECT x.id FROM public.transactions x
                                      WHERE x.ledger_id = v_ledger.id AND x.user_id = v_ledger.user_id))
    ),
    'entries_count', (SELECT COUNT(*) FROM public.ledger_entries e WHERE e.ledger_id = v_ledger.id)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. RPC: liquidar lote — PENDING → PAID em todas as transações do evento
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orbi_ledger_settle(p_ledger_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := public.orbi_require_auth();
  v_owner   uuid;
  v_updated integer;
BEGIN
  PERFORM public.orbi_require_feature(v_uid, 'contratos_rateio', 'Acertos de viagem');

  SELECT l.user_id INTO v_owner FROM public.ledgers l WHERE l.id = p_ledger_id FOR UPDATE;

  IF v_owner IS NULL OR v_owner <> v_uid THEN
    RAISE EXCEPTION 'Só o dono do evento pode liquidá-lo.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.orbi_quota_lock(v_uid, 'ledger:' || p_ledger_id::text);

  -- Inclui as linhas "a receber" dos rateios lançados dentro do evento (linked_txn_id).
  WITH targets AS (
    SELECT t.id
      FROM public.transactions t
     WHERE t.user_id = v_uid
       AND t.status = 'PENDING'
       AND (t.ledger_id = p_ledger_id
            OR t.linked_txn_id IN (SELECT x.id FROM public.transactions x WHERE x.ledger_id = p_ledger_id AND x.user_id = v_uid))
  ), upd AS (
    UPDATE public.transactions t
       SET status = 'PAID'
      FROM targets
     WHERE t.id = targets.id
    RETURNING t.id
  )
  SELECT COUNT(*) INTO v_updated FROM upd;

  UPDATE public.ledgers SET status = 'settled' WHERE id = p_ledger_id;

  RETURN jsonb_build_object('ledger_id', p_ledger_id, 'updated', v_updated, 'status', 'settled');
END;
$$;

REVOKE ALL ON FUNCTION public.orbi_daily_burn_rate(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_cash_forecast(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_ledger_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orbi_ledger_settle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_daily_burn_rate(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_cash_forecast(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_ledger_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_ledger_settle(uuid) TO authenticated;
