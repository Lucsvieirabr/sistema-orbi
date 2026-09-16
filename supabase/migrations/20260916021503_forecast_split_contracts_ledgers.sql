-- ============================================================================
-- Motor Preditivo de Fluxo de Caixa + Contratos de Rateio + Acertos em Lote
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
-- 1. Features nos planos (espelham o que Orçamentos já liga: Pro e Casal)
-- ----------------------------------------------------------------------------
UPDATE public.subscription_plans
   SET features = COALESCE(features, '{}'::jsonb)
                  || jsonb_build_object(
                       'motor_preditivo',  COALESCE((features ->> 'orcamentos')::boolean, false),
                       'contratos_rateio', COALESCE((features ->> 'orcamentos')::boolean, false)
                     );

-- ----------------------------------------------------------------------------
-- 2. Contratos de rateio: pessoa × categoria → % que a pessoa compensa
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.split_contracts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id             uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  category_id           uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  proportion_percentage numeric(5,2) NOT NULL,
  note                  text,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT split_contracts_pct_range CHECK (proportion_percentage >= 0 AND proportion_percentage <= 100),
  CONSTRAINT split_contracts_note_safe CHECK (note IS NULL OR (length(btrim(note)) <= 140 AND public.orbi_is_safe_text(note, 140))),
  CONSTRAINT split_contracts_unique UNIQUE (user_id, person_id, category_id)
);

COMMENT ON TABLE public.split_contracts IS
  'Contratos de rateio (Pro/Casal): pessoa + categoria → proportion_percentage = % do valor que a pessoa compensa. Sugestão pré-preenchida no lançamento, sempre editável.';

CREATE INDEX IF NOT EXISTS idx_split_contracts_user ON public.split_contracts (user_id);

-- ----------------------------------------------------------------------------
-- 3. Ledgers (eventos / viagens) + participantes + gastos pagos por terceiros
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledgers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  start_date   date,
  end_date     date,
  owner_weight numeric(6,2) NOT NULL DEFAULT 1,
  pix_key      text,
  pix_name     text,
  status       text NOT NULL DEFAULT 'open',
  settled_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledgers_name_safe CHECK (length(btrim(name)) BETWEEN 1 AND 80 AND public.orbi_is_safe_text(name, 80)),
  CONSTRAINT ledgers_description_safe CHECK (description IS NULL OR public.orbi_is_safe_text(description, 280)),
  CONSTRAINT ledgers_dates_range CHECK (
    (start_date IS NULL OR start_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31')
    AND (end_date IS NULL OR end_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31')
    AND (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
  ),
  CONSTRAINT ledgers_owner_weight_range CHECK (owner_weight >= 0 AND owner_weight <= 100),
  CONSTRAINT ledgers_pix_key_safe CHECK (pix_key IS NULL OR (length(pix_key) <= 77 AND public.orbi_is_safe_text(pix_key, 77))),
  CONSTRAINT ledgers_pix_name_safe CHECK (pix_name IS NULL OR (length(pix_name) <= 25 AND public.orbi_is_safe_text(pix_name, 25))),
  CONSTRAINT ledgers_status_whitelist CHECK (status IN ('open', 'settled'))
);

COMMENT ON TABLE public.ledgers IS
  'Mini-ledger de evento (viagem, festa) — Pro/Casal. Transações do dono ligadas via transactions.ledger_id; gastos pagos por terceiros em ledger_entries.';

CREATE INDEX IF NOT EXISTS idx_ledgers_user ON public.ledgers (user_id);

CREATE TABLE IF NOT EXISTS public.ledger_participants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id  uuid NOT NULL REFERENCES public.ledgers(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  weight     numeric(6,2) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_participants_weight_range CHECK (weight >= 0 AND weight <= 100),
  CONSTRAINT ledger_participants_unique UNIQUE (ledger_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_participants_ledger ON public.ledger_participants (ledger_id);
CREATE INDEX IF NOT EXISTS idx_ledger_participants_user ON public.ledger_participants (user_id);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id         uuid NOT NULL REFERENCES public.ledgers(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paid_by_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  description       text NOT NULL,
  value             numeric(12,2) NOT NULL,
  entry_date        date NOT NULL DEFAULT CURRENT_DATE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_entries_description_safe CHECK (length(btrim(description)) BETWEEN 1 AND 140 AND public.orbi_is_safe_text(description, 140)),
  CONSTRAINT ledger_entries_value_range CHECK (value > 0 AND value <= 1000000000),
  CONSTRAINT ledger_entries_date_range CHECK (entry_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31')
);

COMMENT ON TABLE public.ledger_entries IS
  'Gastos de um ledger pagos por outro participante (não passam pelo extrato do dono).';

CREATE INDEX IF NOT EXISTS idx_ledger_entries_ledger ON public.ledger_entries (ledger_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_user ON public.ledger_entries (user_id);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS ledger_id uuid REFERENCES public.ledgers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_ledger ON public.transactions (ledger_id) WHERE ledger_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. RLS: FORCE, feature exigida, leitura em família, escrita só do dono
-- ----------------------------------------------------------------------------
DO $rls$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['split_contracts', 'ledgers', 'ledger_participants', 'ledger_entries'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', v_table);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', v_table);

    EXECUTE format('DROP POLICY IF EXISTS orbi_service_bypass ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY orbi_service_bypass ON public.%I AS PERMISSIVE FOR ALL TO postgres, service_role, supabase_admin USING (true) WITH CHECK (true)',
      v_table
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'orbi_' || v_table || '_select', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.orbi_has_feature(''contratos_rateio'')) AND user_id = ANY ((SELECT public.orbi_family_user_ids())::uuid[]))',
      'orbi_' || v_table || '_select', v_table
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'orbi_' || v_table || '_insert', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.orbi_has_feature(''contratos_rateio'')) AND user_id = (SELECT auth.uid()))',
      'orbi_' || v_table || '_insert', v_table
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'orbi_' || v_table || '_update', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.orbi_has_feature(''contratos_rateio'')) AND user_id = (SELECT auth.uid())) WITH CHECK ((SELECT public.orbi_has_feature(''contratos_rateio'')) AND user_id = (SELECT auth.uid()))',
      'orbi_' || v_table || '_update', v_table
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'orbi_' || v_table || '_delete', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT public.orbi_has_feature(''contratos_rateio'')) AND user_id = (SELECT auth.uid()))',
      'orbi_' || v_table || '_delete', v_table
    );
  END LOOP;
END
$rls$;

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
    'split_contracts', 'ledgers', 'ledger_participants', 'ledger_entries'
  ];
$$;

-- ----------------------------------------------------------------------------
-- 5. Triggers de guarda
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orbi_split_contracts_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_category record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'O dono do contrato não pode mudar.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.orbi_require_feature(NEW.user_id, 'contratos_rateio', 'Contratos de rateio');

  IF NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = NEW.person_id AND p.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Pessoa inexistente ou de outro usuário.' USING ERRCODE = '42501';
  END IF;

  SELECT c.user_id, COALESCE(c.is_system, false) AS is_system, c.category_type
    INTO v_category
    FROM public.categories c
   WHERE c.id = NEW.category_id;

  IF NOT FOUND OR NOT (v_category.is_system OR v_category.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Categoria inexistente ou de outro usuário.' USING ERRCODE = '42501';
  END IF;

  IF v_category.category_type IS DISTINCT FROM 'expense' THEN
    RAISE EXCEPTION 'Contratos de rateio só valem para categorias de gasto.' USING ERRCODE = '23514';
  END IF;

  NEW.proportion_percentage := round(NEW.proportion_percentage, 2);
  NEW.note := NULLIF(btrim(NEW.note), '');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_ledgers_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'O dono do evento não pode mudar.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.orbi_require_feature(NEW.user_id, 'contratos_rateio', 'Acertos de viagem');

  NEW.name := btrim(NEW.name);
  NEW.description := NULLIF(btrim(NEW.description), '');
  NEW.pix_key := NULLIF(btrim(NEW.pix_key), '');
  NEW.pix_name := NULLIF(btrim(NEW.pix_name), '');
  NEW.owner_weight := round(NEW.owner_weight, 2);

  IF NEW.status = 'settled' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'settled') THEN
    NEW.settled_at := now();
  ELSIF NEW.status = 'open' THEN
    NEW.settled_at := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_ledger_children_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner  uuid;
  v_person uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.ledger_id IS DISTINCT FROM OLD.ledger_id)
  THEN
    RAISE EXCEPTION 'Um item não pode trocar de dono nem de evento.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.orbi_require_feature(NEW.user_id, 'contratos_rateio', 'Acertos de viagem');

  SELECT l.user_id INTO v_owner FROM public.ledgers l WHERE l.id = NEW.ledger_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Evento inexistente.' USING ERRCODE = '23503';
  END IF;
  IF v_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Só o dono do evento pode alterá-lo.' USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'ledger_participants' THEN
    v_person := NEW.person_id;
    NEW.weight := round(NEW.weight, 2);
  ELSE
    v_person := NEW.paid_by_person_id;
    NEW.description := btrim(NEW.description);
    NEW.value := round(NEW.value, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = v_person AND p.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Pessoa inexistente ou de outro usuário.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Quem pagou um gasto do evento passa a participar dele.
CREATE OR REPLACE FUNCTION public.orbi_ledger_entries_autoparticipant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.ledger_participants (ledger_id, user_id, person_id)
  VALUES (NEW.ledger_id, NEW.user_id, NEW.paid_by_person_id)
  ON CONFLICT (ledger_id, person_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_transactions_ledger_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ledger record;
BEGIN
  IF NEW.ledger_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.ledger_id IS NOT DISTINCT FROM OLD.ledger_id THEN
    RETURN NEW;
  END IF;

  PERFORM public.orbi_require_feature(NEW.user_id, 'contratos_rateio', 'Acertos de viagem');

  SELECT l.user_id, l.status INTO v_ledger FROM public.ledgers l WHERE l.id = NEW.ledger_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento inexistente.' USING ERRCODE = '23503';
  END IF;
  IF v_ledger.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'A transação só pode entrar em um evento seu.' USING ERRCODE = '42501';
  END IF;
  IF v_ledger.status = 'settled' THEN
    RAISE EXCEPTION 'Este evento já foi liquidado. Reabra-o para lançar novos gastos.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orbi_split_contracts_guard ON public.split_contracts;
CREATE TRIGGER orbi_split_contracts_guard
  BEFORE INSERT OR UPDATE ON public.split_contracts
  FOR EACH ROW EXECUTE FUNCTION public.orbi_split_contracts_guard();

DROP TRIGGER IF EXISTS orbi_ledgers_guard ON public.ledgers;
CREATE TRIGGER orbi_ledgers_guard
  BEFORE INSERT OR UPDATE ON public.ledgers
  FOR EACH ROW EXECUTE FUNCTION public.orbi_ledgers_guard();

DROP TRIGGER IF EXISTS orbi_ledger_participants_guard ON public.ledger_participants;
CREATE TRIGGER orbi_ledger_participants_guard
  BEFORE INSERT OR UPDATE ON public.ledger_participants
  FOR EACH ROW EXECUTE FUNCTION public.orbi_ledger_children_guard();

DROP TRIGGER IF EXISTS orbi_ledger_entries_guard ON public.ledger_entries;
CREATE TRIGGER orbi_ledger_entries_guard
  BEFORE INSERT OR UPDATE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.orbi_ledger_children_guard();

DROP TRIGGER IF EXISTS orbi_ledger_entries_autoparticipant ON public.ledger_entries;
CREATE TRIGGER orbi_ledger_entries_autoparticipant
  AFTER INSERT OR UPDATE OF paid_by_person_id ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.orbi_ledger_entries_autoparticipant();

DROP TRIGGER IF EXISTS orbi_transactions_ledger_guard ON public.transactions;
CREATE TRIGGER orbi_transactions_ledger_guard
  BEFORE INSERT OR UPDATE OF ledger_id ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.orbi_transactions_ledger_guard();

REVOKE ALL ON FUNCTION public.orbi_split_contracts_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_ledgers_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_ledger_children_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_ledger_entries_autoparticipant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_transactions_ledger_guard() FROM PUBLIC, anon, authenticated;

