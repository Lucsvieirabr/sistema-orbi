-- ============================================================================
-- HARDENING DE ISOLAMENTO MULTI-TENANT NAS RPCs (SECURITY DEFINER)
-- ============================================================================
-- Contexto: funções SECURITY DEFINER rodam como owner e IGNORAM RLS. Várias
-- RPCs expostas a `authenticated` recebiam o alvo (transaction_id, series_id)
-- e/ou o dono (p_user_id) direto do payload do cliente, sem confrontar com
-- auth.uid(). Resultado: IDOR cross-tenant — o tenant A lia, alterava e
-- apagava dados do tenant B apenas trocando o UUID enviado.
--
-- Este arquivo:
--   1. Cria helper `require_self()` que amarra qualquer p_user_id ao JWT.
--   2. Reescreve as RPCs vivas forçando auth.uid() como dono efetivo.
--   3. Remove RPCs mortas E quebradas (referenciam colunas inexistentes) que
--      permaneciam com GRANT para `authenticated` — superfície de ataque pura.
--   4. Fixa search_path em toda função SECURITY DEFINER (anti-hijacking).
--   5. Revoga o GRANT EXECUTE genérico concedido a PUBLIC/anon.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. HELPER DE IDENTIDADE — fonte da verdade do dono em qualquer RPC
-- ============================================================================
-- Regra: se há JWT de usuário final, o dono É auth.uid() e um p_user_id
-- divergente é ataque (42501). Sem JWT (service_role / job interno / psql),
-- o parâmetro é aceito para não quebrar rotinas administrativas.

CREATE OR REPLACE FUNCTION public.require_self(p_claimed uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_role text := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    ''
  );
BEGIN
  -- Requisição vinda do PostgREST com token de usuário final
  IF v_role IN ('authenticated', 'anon') OR v_uid IS NOT NULL THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
    END IF;

    IF p_claimed IS NOT NULL AND p_claimed <> v_uid THEN
      RAISE EXCEPTION 'Acesso negado: user_id do payload difere do usuário autenticado'
        USING ERRCODE = '42501';
    END IF;

    RETURN v_uid;
  END IF;

  -- service_role / contexto interno sem JWT de usuário
  IF p_claimed IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatório fora de contexto autenticado'
      USING ERRCODE = '42501';
  END IF;

  RETURN p_claimed;
END;
$$;

COMMENT ON FUNCTION public.require_self(uuid) IS
  'Resolve o dono efetivo de uma operação: sempre auth.uid() quando há JWT de usuário final. Rejeita p_user_id divergente (IDOR).';

GRANT EXECUTE ON FUNCTION public.require_self(uuid) TO authenticated, service_role;

-- ============================================================================
-- 2. REMOÇÃO DE RPCs MORTAS E QUEBRADAS COM GRANT PARA `authenticated`
-- ============================================================================
-- Todas abaixo referenciam colunas que não existem mais no schema vigente
-- (transactions.installments, transactions.family_member_id, series.account_id,
-- series.credit_card_id, series.person_id). Nenhuma é chamada pelo frontend —
-- o caminho de produção faz INSERT/UPDATE direto em series/transactions
-- (ver CLAUDE.md §GOTCHAS #2 e #3). Estavam apenas expostas via
-- `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated`:
--
--   * update_transaction_with_balance         — UPDATE transactions WHERE id = <payload>
--                                               e UPDATE accounts SET initial_balance
--                                               WHERE id = <payload>, sem checar dono.
--   * update_transaction_series_with_balance  — idem, em série inteira.
--   * maintain_fixed_transaction_series       — varre e escreve em séries de TODOS os tenants.
--   * run_fixed_transaction_maintenance       — wrapper da anterior.
--   * generate_future_fixed_transactions      — INSERT em qualquer series_id.
--
-- Derrubar é a correção: função quebrada não tem lógica de negócio a preservar.

DROP FUNCTION IF EXISTS public.update_transaction_with_balance(
  UUID, TEXT, NUMERIC, TEXT, DATE, UUID, UUID, TEXT, UUID, UUID, BOOLEAN, INTEGER, NUMERIC, UUID
);
DROP FUNCTION IF EXISTS public.update_transaction_series_with_balance(
  UUID, DATE, TEXT, NUMERIC, TEXT, UUID, UUID, TEXT, UUID, UUID, BOOLEAN, INTEGER, NUMERIC, UUID
);
DROP FUNCTION IF EXISTS public.run_fixed_transaction_maintenance();
DROP FUNCTION IF EXISTS public.maintain_fixed_transaction_series();
DROP FUNCTION IF EXISTS public.generate_future_fixed_transactions(UUID, DATE, INTEGER);

-- ============================================================================
-- 3. create_installment_series — dono passa a vir do JWT, não do payload
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_installment_series(
  p_user_id UUID,
  p_description TEXT,
  p_type TEXT,
  p_account_id UUID,
  p_category_id UUID,
  p_payment_method TEXT,
  p_credit_card_id UUID,
  p_person_id UUID,
  p_is_fixed BOOLEAN,
  p_installments_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  series_id UUID;
  installment_record JSONB;
  total_value NUMERIC;
  total_installments INTEGER;
  i INTEGER;
BEGIN
  -- SEGURANÇA: ignora o p_user_id do payload quando há JWT de usuário final.
  v_user_id := public.require_self(p_user_id);

  IF jsonb_typeof(p_installments_data) != 'array' THEN
    RAISE EXCEPTION 'installments_data deve ser um array JSON';
  END IF;

  total_installments := jsonb_array_length(p_installments_data);

  -- Limite de volume: impede payload gigante como vetor de DoS/estouro de plano.
  IF total_installments < 1 OR total_installments > 480 THEN
    RAISE EXCEPTION 'Número de parcelas inválido (1 a 480): %', total_installments;
  END IF;

  -- SEGURANÇA: toda FK precisa pertencer ao mesmo tenant. Sem isso o usuário
  -- amarraria suas transações à conta/cartão/pessoa/categoria de outro tenant.
  IF p_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE id = p_account_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Conta não pertence ao usuário' USING ERRCODE = '42501';
  END IF;

  IF p_credit_card_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.credit_cards WHERE id = p_credit_card_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Cartão não pertence ao usuário' USING ERRCODE = '42501';
  END IF;

  IF p_person_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.people WHERE id = p_person_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Pessoa não pertence ao usuário' USING ERRCODE = '42501';
  END IF;

  -- Categoria: própria do usuário OU categoria global de sistema.
  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE id = p_category_id
      AND (user_id = v_user_id OR is_system = TRUE)
  ) THEN
    RAISE EXCEPTION 'Categoria não pertence ao usuário' USING ERRCODE = '42501';
  END IF;

  total_value := 0;
  FOR i IN 0..total_installments - 1 LOOP
    installment_record := p_installments_data->i;
    total_value := total_value + (installment_record->>'value')::numeric;
  END LOOP;

  series_id := gen_random_uuid();

  INSERT INTO public.series (
    id, user_id, description, total_value, total_installments, is_fixed, category_id
  ) VALUES (
    series_id, v_user_id, p_description, total_value, total_installments, p_is_fixed, p_category_id
  );

  FOR i IN 0..total_installments - 1 LOOP
    installment_record := p_installments_data->i;

    IF NOT (installment_record ? 'value' AND installment_record ? 'date' AND installment_record ? 'status') THEN
      RAISE EXCEPTION 'Cada parcela deve ter os campos: value, date, status';
    END IF;

    -- Whitelist de status: impede gravar valor arbitrário vindo do JSON.
    IF (installment_record->>'status') NOT IN ('PENDING', 'PAID', 'CANCELED') THEN
      RAISE EXCEPTION 'Status inválido: %', installment_record->>'status';
    END IF;

    INSERT INTO public.transactions (
      user_id, description, type, value, date, status,
      account_id, category_id, payment_method, credit_card_id, person_id, series_id,
      installment_number
    ) VALUES (
      v_user_id,
      p_description,
      p_type,
      (installment_record->>'value')::numeric,
      (installment_record->>'date')::date,
      installment_record->>'status',
      p_account_id,
      p_category_id,
      p_payment_method,
      p_credit_card_id,
      p_person_id,
      series_id,
      i + 1
    );
  END LOOP;

  RETURN series_id;
END;
$$;

COMMENT ON FUNCTION public.create_installment_series(UUID, TEXT, TEXT, UUID, UUID, TEXT, UUID, UUID, BOOLEAN, JSONB) IS
  'Cria série de parcelas. p_user_id é ignorado quando há JWT: o dono é sempre auth.uid(). Valida que todas as FKs pertencem ao mesmo tenant.';

-- ============================================================================
-- 4. update_installment_series — o p_user_id não pode mais escolher a vítima
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_installment_series(
  p_installments_data JSONB,
  p_series_id UUID,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  updated_count INTEGER;
  installment_record JSONB;
  calculated_total_value NUMERIC;
  calculated_total_installments INTEGER;
  i INTEGER;
  original_txn RECORD;
BEGIN
  -- SEGURANÇA: antes, a checagem de dono usava o p_user_id do payload —
  -- bastava enviar o user_id da vítima junto com o series_id dela.
  v_user_id := public.require_self(p_user_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.series WHERE id = p_series_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Série não encontrada ou não pertence ao usuário' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_installments_data) != 'array' THEN
    RAISE EXCEPTION 'installments_data deve ser um array JSON';
  END IF;

  calculated_total_installments := jsonb_array_length(p_installments_data);

  IF calculated_total_installments < 1 OR calculated_total_installments > 480 THEN
    RAISE EXCEPTION 'Número de parcelas inválido (1 a 480): %', calculated_total_installments;
  END IF;

  calculated_total_value := 0;
  FOR i IN 0..calculated_total_installments - 1 LOOP
    installment_record := p_installments_data->i;
    calculated_total_value := calculated_total_value + (installment_record->>'value')::numeric;
  END LOOP;

  UPDATE public.series
  SET
    total_value = calculated_total_value,
    total_installments = calculated_total_installments,
    updated_at = NOW()
  WHERE id = p_series_id AND user_id = v_user_id;

  SELECT
    t.user_id, t.description, t.type, t.account_id, t.category_id,
    t.payment_method, t.credit_card_id, t.person_id
  INTO original_txn
  FROM public.transactions t
  WHERE t.series_id = p_series_id AND t.user_id = v_user_id
  LIMIT 1;

  IF original_txn IS NULL THEN
    RAISE EXCEPTION 'Série sem transações para atualizar';
  END IF;

  DELETE FROM public.transactions
  WHERE series_id = p_series_id AND user_id = v_user_id;

  FOR i IN 0..calculated_total_installments - 1 LOOP
    installment_record := p_installments_data->i;

    IF NOT (installment_record ? 'value' AND installment_record ? 'date' AND installment_record ? 'status') THEN
      RAISE EXCEPTION 'Cada parcela deve ter os campos: value, date, status';
    END IF;

    IF (installment_record->>'status') NOT IN ('PENDING', 'PAID', 'CANCELED') THEN
      RAISE EXCEPTION 'Status inválido: %', installment_record->>'status';
    END IF;

    INSERT INTO public.transactions (
      user_id, description, type, value, date, status,
      account_id, category_id, payment_method, credit_card_id, person_id, series_id,
      installment_number
    ) VALUES (
      v_user_id,                      -- nunca original_txn.user_id: fixa o tenant
      original_txn.description,
      original_txn.type,
      (installment_record->>'value')::numeric,
      (installment_record->>'date')::date,
      installment_record->>'status',
      original_txn.account_id,
      original_txn.category_id,
      original_txn.payment_method,
      original_txn.credit_card_id,
      original_txn.person_id,
      p_series_id,
      i + 1
    );
  END LOOP;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.update_installment_series(JSONB, UUID, UUID) IS
  'Atualiza série de parcelas. O dono é sempre auth.uid(); p_user_id divergente é rejeitado (42501).';

-- ============================================================================
-- 5. delete_installment_series — DELETE cross-tenant era o pior caso
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_installment_series(
  p_series_id UUID,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  deleted_count INTEGER;
BEGIN
  -- SEGURANÇA: com o p_user_id do payload, qualquer usuário apagava a série
  -- inteira (e todas as transações) de outro tenant.
  v_user_id := public.require_self(p_user_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.series WHERE id = p_series_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Série não encontrada ou não pertence ao usuário' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.transactions
  WHERE series_id = p_series_id AND user_id = v_user_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  DELETE FROM public.series
  WHERE id = p_series_id AND user_id = v_user_id;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.delete_installment_series(UUID, UUID) IS
  'Remove série e suas transações. Escopo travado em auth.uid().';

-- ============================================================================
-- 6. cleanup_orphaned_series — apagava séries órfãs de TODOS os tenants
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_series()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  deleted_count INTEGER;
BEGIN
  -- SEGURANÇA: sem escopo, um único usuário autenticado disparava um DELETE
  -- global em public.series. Agora só limpa o próprio tenant.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.series s
  WHERE s.user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.series_id = s.id AND t.user_id = v_user_id
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_orphaned_series() IS
  'Remove séries órfãs APENAS do usuário autenticado (antes era global).';

-- ============================================================================
-- 7. update_series_total_value (trigger) — fixa search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_series_total_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  series_total_value NUMERIC;
  series_total_installments INTEGER;
  v_series_id UUID;
  v_user_id UUID;
BEGIN
  v_series_id := COALESCE(NEW.series_id, OLD.series_id);
  v_user_id   := COALESCE(NEW.user_id, OLD.user_id);

  IF v_series_id IS NOT NULL THEN
    SELECT COALESCE(SUM(value), 0), COUNT(*)
    INTO series_total_value, series_total_installments
    FROM public.transactions
    WHERE series_id = v_series_id AND user_id = v_user_id;

    UPDATE public.series
    SET
      total_value = series_total_value,
      total_installments = series_total_installments,
      updated_at = NOW()
    WHERE id = v_series_id AND user_id = v_user_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- 8. SEARCH_PATH EM TODA FUNÇÃO SECURITY DEFINER REMANESCENTE
-- ============================================================================
-- Sem `SET search_path`, o dono da chamada pode plantar um objeto homônimo em
-- um schema que ele controla e fazer a função (rodando como owner) executá-lo.

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema_name,
           p.proname  AS fn_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = TRUE
      AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
          ))
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
      fn.schema_name, fn.fn_name, fn.args
    );
    RAISE NOTICE 'search_path fixado em %.%(%)', fn.schema_name, fn.fn_name, fn.args;
  END LOOP;
END;
$$;

-- ============================================================================
-- 9. REVOGAR EXECUTE GENÉRICO PARA PUBLIC/anon
-- ============================================================================
-- A migration 20251001000000 fez `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA
-- public TO authenticated`, e o Postgres já concede EXECUTE a PUBLIC por
-- padrão em toda função nova. Resultado: qualquer função nova nasce chamável
-- por anônimos. Fecha-se o default e revoga-se o acumulado.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Reconcede explicitamente apenas o que o app precisa.
GRANT EXECUTE ON FUNCTION public.create_installment_series(UUID, TEXT, TEXT, UUID, UUID, TEXT, UUID, UUID, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_installment_series(JSONB, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_installment_series(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_series() TO authenticated;

COMMIT;
