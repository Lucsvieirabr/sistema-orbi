-- ============================================================================
-- SEED DE TESTE — SISTEMA ORBI  (executado por `supabase db reset --linked`)
-- ----------------------------------------------------------------------------
-- Objetivo: recriar, de forma determinística e idempotente, 3 cenários de
-- plano com integridade referencial completa da cadeia:
--
--     auth.users -> public.user_profiles -> public.user_subscriptions
--                -> public.subscription_plans      (Auth -> Public -> Tenant -> Plan)
--
-- Cenários:
--   [1] admin@orbi.test  — Admin Global (super_admin) + plano Pro ativo
--   [2] free@orbi.test   — plano Free  (slug `basic`) ATIVO, no TETO das cotas
--   [3] pro@orbi.test    — plano Pro   ATIVO (ilimitado), dados ricos
--
-- Senha de todos: Orbi@2026!seed
--
-- ORDEM OBRIGATÓRIA: a assinatura é criada ANTES de qualquer dado de domínio.
-- Os triggers de cota (20260910120001) levantam P0004 "sem assinatura ativa"
-- em qualquer INSERT de conta/cartão/pessoa/transação sem assinatura vigente.
--
-- Categorias NÃO são criadas aqui: desde 20251010100000 são globais
-- (user_id IS NULL, is_system = true) e vêm das migrations.
-- ============================================================================

SET search_path = public, extensions, pg_temp;
SET row_security = off;          -- seed roda como `postgres` (BYPASSRLS); FORCE RLS de 20260910000000 não se aplica
SET client_min_messages = notice;

BEGIN;

-- ============================================================================
-- 0. PRÉ-CONDIÇÃO — as migrations de plano precisam ter rodado
-- ============================================================================
DO $precheck$
DECLARE
  v_planos integer;
  v_cats   integer;
BEGIN
  SELECT COUNT(*) INTO v_planos
    FROM public.subscription_plans WHERE slug IN ('basic', 'pro') AND is_active;
  IF v_planos <> 2 THEN
    RAISE EXCEPTION 'Seed abortado: planos basic/pro ausentes (achei %). Rode as migrations primeiro.', v_planos;
  END IF;

  SELECT COUNT(*) INTO v_cats FROM public.categories WHERE is_system;
  IF v_cats = 0 THEN
    RAISE EXCEPTION 'Seed abortado: categorias globais (is_system) ausentes.';
  END IF;
END
$precheck$;

-- ============================================================================
-- 1. LIMPEZA IDEMPOTENTE — só os usuários DESTE seed
--    Atenção: as tabelas de domínio de 20240101000001 (accounts, categories,
--    people, credit_cards, transactions, series) referenciam auth.users SEM
--    ON DELETE CASCADE — só as tabelas SaaS (20251016000001) têm cascade.
--    Por isso a limpeza apaga o domínio explicitamente, na ordem de dependência,
--    antes de remover o usuário do GoTrue. Sem isso, rodar o seed 2x quebra em
--    "violates foreign key constraint accounts_user_id_fkey".
-- ============================================================================
DO $cleanup$
DECLARE
  v_ids uuid[];
  v_tbl text;
  -- ordem de dependência (filhos primeiro)
  v_ordered text[] := ARRAY[
    -- `series` PRIMEIRO: transactions.series_id é ON DELETE CASCADE, então
    -- apagar a série leva junto as parcelas SEM disparar o recálculo de
    -- total_installments = 0 no trigger update_series_total_value (que
    -- violaria o CHECK orbi_series_installments_range >= 1).
    'series', 'transactions', 'credit_cards', 'accounts',
    'people', 'categories', 'family_group_members', 'family_groups',
    'payment_history', 'user_usage', 'user_subscriptions',
    'admin_users', 'bug_reports', 'notes', 'learned_patterns',
    'audit_logs', 'user_profiles'
  ];
  r record;
BEGIN
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_ids
    FROM auth.users
   WHERE id IN ('11111111-1111-4111-8111-111111111111',
                '22222222-2222-4222-8222-222222222222',
                '33333333-3333-4333-8333-333333333333',
                '44444444-4444-4444-8444-444444444444')
      OR lower(email) IN ('admin@orbi.test', 'free@orbi.test',
                          'pro@orbi.test', 'nosub@orbi.test');

  IF array_length(v_ids, 1) IS NULL THEN
    RAISE NOTICE '[seed] nada a limpar (banco novo)';
    RETURN;
  END IF;

  -- 1.1 grupos de família são por owner_id, não user_id
  IF to_regclass('public.family_groups') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.family_group_members WHERE family_group_id IN '
         || '(SELECT id FROM public.family_groups WHERE owner_id = ANY($1))' USING v_ids;
    EXECUTE 'DELETE FROM public.family_groups WHERE owner_id = ANY($1)' USING v_ids;
  END IF;

  -- 1.2 tabelas conhecidas, na ordem de dependência
  FOREACH v_tbl IN ARRAY v_ordered LOOP
    IF to_regclass('public.' || v_tbl) IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = v_tbl
                      AND column_name = 'user_id')
    THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = ANY($1)', v_tbl) USING v_ids;
    END IF;
  END LOOP;

  -- 1.3 varredura final: qualquer outra tabela de public com user_id
  FOR r IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND c.column_name = 'user_id'
       AND t.table_type = 'BASE TABLE'
       AND NOT (c.table_name = ANY (v_ordered))
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE user_id = ANY($1)', r.table_name) USING v_ids;
  END LOOP;

  -- 1.4 por fim o GoTrue (identities caem por cascade)
  DELETE FROM auth.users WHERE id = ANY(v_ids);

  RAISE NOTICE '[seed] limpeza concluída: % usuário(s) removido(s)', array_length(v_ids, 1);
END
$cleanup$;

-- ============================================================================
-- 2. HELPERS (temporários — morrem com a sessão)
-- ============================================================================

-- Cria usuário no GoTrue (auth.users + auth.identities) com e-mail confirmado.
-- O trigger on_auth_user_created (20251016000004) cria o user_profiles.
CREATE OR REPLACE FUNCTION pg_temp.orbi_seed_user(
  p_id uuid, p_email text, p_password text, p_full_name text
) RETURNS uuid
LANGUAGE plpgsql
AS $fn$
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at,
    email_change_token_new, email_change, email_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    created_at, updated_at, phone, phone_confirmed_at, phone_change,
    phone_change_token, phone_change_sent_at, banned_until,
    reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')), NOW(),
    NULL, '', NULL,
    '', NULL,
    '', '', NULL,
    '', 0,
    NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'email_verified', true, 'seed', true),
    false, NOW(), NOW(), NULL, NULL, '',
    '', NULL, NULL,
    '', NULL, false, NULL
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', lower(p_email),
                       'email_verified', true, 'phone_verified', false),
    'email', NOW(), NOW(), NOW()
  );

  -- Rede de segurança: se o trigger de perfil não existir neste banco.
  INSERT INTO public.user_profiles (user_id, email, full_name, onboarding_completed)
  SELECT p_id, lower(p_email), p_full_name, true
   WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = p_id);

  UPDATE public.user_profiles
     SET full_name = p_full_name,
         email = lower(p_email),
         onboarding_completed = true,
         updated_at = NOW()
   WHERE user_id = p_id;

  RETURN p_id;
END;
$fn$;

-- Amarra o usuário ao plano (por slug) — a "tenant -> plan" da cadeia.
CREATE OR REPLACE FUNCTION pg_temp.orbi_seed_subscription(
  p_user uuid, p_slug text, p_status text, p_cycle text
) RETURNS uuid
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_plan uuid;
  v_id   uuid;
BEGIN
  SELECT id INTO v_plan FROM public.subscription_plans WHERE slug = p_slug;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Plano de slug "%" não existe — seed de planos não rodou.', p_slug;
  END IF;

  INSERT INTO public.user_subscriptions (
    user_id, plan_id, status, billing_cycle,
    current_period_start, current_period_end,
    cancel_at_period_end, trial_start, trial_end, metadata
  ) VALUES (
    p_user, v_plan, p_status, p_cycle,
    date_trunc('month', NOW()), date_trunc('month', NOW()) + INTERVAL '1 month',
    false,
    CASE WHEN p_status = 'trial' THEN NOW() END,
    CASE WHEN p_status = 'trial' THEN NOW() + INTERVAL '14 days' END,
    jsonb_build_object('source', 'seed', 'scenario', p_slug)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- Categoria global por nome (is_system).
CREATE OR REPLACE FUNCTION pg_temp.cat(p_name text)
RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT id FROM public.categories
   WHERE is_system = true AND name = p_name
   LIMIT 1;
$fn$;

-- ============================================================================
-- 3. CENÁRIO 1 — ADMIN GLOBAL (super_admin)
-- ============================================================================
DO $admin$
DECLARE
  v_uid uuid := '11111111-1111-4111-8111-111111111111';
BEGIN
  PERFORM pg_temp.orbi_seed_user(v_uid, 'admin@orbi.test', 'Orbi@2026!seed', 'Orbi Admin Global');

  -- Assinatura Pro ativa: o admin também navega no app autenticado.
  -- billing_cycle aceito pelo banco = 'monthly' | 'yearly' (20251016000009).
  PERFORM pg_temp.orbi_seed_subscription(v_uid, 'pro', 'active', 'yearly');

  INSERT INTO public.admin_users (user_id, role, permissions, is_active)
  VALUES (v_uid, 'super_admin',
          '["users:read","users:write","plans:read","plans:write","audit:read","billing:read"]'::jsonb,
          true);

  RAISE NOTICE '[seed] admin@orbi.test criado (super_admin + plano Pro)';
END
$admin$;

-- ============================================================================
-- 4. CENÁRIO 2 — USUÁRIO PLANO FREE (slug `basic`) — NO TETO DAS COTAS
--    limits: max_contas 1 | max_cartoes 1 | max_pessoas 2 | max_transacoes_mes 100
--    Os volumes abaixo batem EXATAMENTE no teto de contas/cartões/pessoas,
--    para que o próximo INSERT do QA estoure P0005 de propósito.
-- ============================================================================
DO $free$
DECLARE
  v_uid  uuid := '22222222-2222-4222-8222-222222222222';
  v_acc  uuid;
  v_card uuid;
BEGIN
  PERFORM pg_temp.orbi_seed_user(v_uid, 'free@orbi.test', 'Orbi@2026!seed', 'Fernanda Free');
  PERFORM pg_temp.orbi_seed_subscription(v_uid, 'basic', 'active', 'monthly');

  INSERT INTO public.accounts (user_id, name, type, initial_balance, color)
  VALUES (v_uid, 'Conta Corrente', 'Corrente', 1200.00, '#3B82F6')
  RETURNING id INTO v_acc;

  INSERT INTO public.credit_cards (user_id, name, brand, "limit", statement_date, due_date, connected_account_id)
  VALUES (v_uid, 'Cartão Free', 'Visa', 1500.00, 5, 12, v_acc)
  RETURNING id INTO v_card;

  INSERT INTO public.people (user_id, name, pix) VALUES
    (v_uid, 'Fernanda', 'free@orbi.test'),
    (v_uid, 'Rafael',   '11999990001');

  INSERT INTO public.transactions
    (user_id, description, value, date, type, payment_method, status, account_id, category_id)
  VALUES
    (v_uid, 'Salário mensal', 3200.00, date_trunc('month', CURRENT_DATE)::date + 4,
     'income',  'debit', 'PAID',    v_acc, pg_temp.cat('Salário / 13° Salário / Férias')),
    (v_uid, 'Supermercado', 480.50, date_trunc('month', CURRENT_DATE)::date + 6,
     'expense', 'debit', 'PAID',    v_acc, pg_temp.cat('Alimentação')),
    (v_uid, 'Conta de luz', 189.90, date_trunc('month', CURRENT_DATE)::date + 9,
     'expense', 'debit', 'PENDING', v_acc, pg_temp.cat('Casa'));

  INSERT INTO public.transactions
    (user_id, description, value, date, type, payment_method, status, credit_card_id, category_id)
  VALUES
    (v_uid, 'Streaming', 39.90, date_trunc('month', CURRENT_DATE)::date + 2,
     'expense', 'credit', 'PENDING', v_card, pg_temp.cat('Assinaturas')),
    (v_uid, 'Combustível', 250.00, date_trunc('month', CURRENT_DATE)::date + 11,
     'expense', 'credit', 'PENDING', v_card, pg_temp.cat('Transporte'));

  RAISE NOTICE '[seed] free@orbi.test criado (plano Free no teto: 1 conta / 1 cartão / 2 pessoas)';
END
$free$;

-- ============================================================================
-- 5. CENÁRIO 3 — USUÁRIO PLANO PRO (ATIVO, ilimitado)
--    Cobre: multi-conta, cartão ligado à conta pagadora, parcelamento via
--    `series`, recorrência fixa e par de rateio via `linked_txn_id`.
-- ============================================================================
DO $pro$
DECLARE
  v_uid     uuid := '33333333-3333-4333-8333-333333333333';
  v_acc     uuid;
  v_poup    uuid;
  v_card    uuid;
  v_person  uuid;
  v_serie   uuid;
  v_fixa    uuid;
  v_txn_a   uuid;
  v_mes     date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  PERFORM pg_temp.orbi_seed_user(v_uid, 'pro@orbi.test', 'Orbi@2026!seed', 'Paulo Pro');
  PERFORM pg_temp.orbi_seed_subscription(v_uid, 'pro', 'active', 'monthly');

  -- Contas
  INSERT INTO public.accounts (user_id, name, type, initial_balance, color)
  VALUES (v_uid, 'Conta Corrente', 'Corrente', 8400.00, '#3B82F6')
  RETURNING id INTO v_acc;

  INSERT INTO public.accounts (user_id, name, type, initial_balance, color)
  VALUES (v_uid, 'Reserva de Emergência', 'Poupanca', 25000.00, '#10B981')
  RETURNING id INTO v_poup;

  -- Cartão pago pela conta corrente
  INSERT INTO public.credit_cards (user_id, name, brand, "limit", statement_date, due_date, connected_account_id)
  VALUES (v_uid, 'Cartão Pro', 'Mastercard', 12000.00, 20, 27, v_acc)
  RETURNING id INTO v_card;

  -- Pessoas (rateio)
  INSERT INTO public.people (user_id, name, pix)
  VALUES (v_uid, 'Marina', 'marina@orbi.test')
  RETURNING id INTO v_person;

  INSERT INTO public.people (user_id, name, pix) VALUES
    (v_uid, 'Paulo',  'pro@orbi.test'),
    (v_uid, 'Lucas',  '11999990002');

  -- Receita do mês
  INSERT INTO public.transactions
    (user_id, description, value, date, type, payment_method, status, account_id, category_id)
  VALUES
    (v_uid, 'Salário mensal', 14500.00, v_mes + 4, 'income', 'debit', 'PAID',
     v_acc, pg_temp.cat('Salário / 13° Salário / Férias')),
    (v_uid, 'Rendimento CDB', 320.75, v_mes + 14, 'income', 'debit', 'PAID',
     v_poup, pg_temp.cat('Renda de Investimentos'));

  -- ---- Parcelamento: 1 série + 3 parcelas (3x de 899.67 => 2699.01) --------
  v_serie := gen_random_uuid();
  INSERT INTO public.series
    (id, user_id, description, total_value, total_installments, is_fixed, frequency, start_date, category_id)
  VALUES
    (v_serie, v_uid, 'Notebook 3x', 2699.01, 3, false, 'monthly', v_mes + 7,
     pg_temp.cat('Presentes / Compras'));

  INSERT INTO public.transactions
    (user_id, description, value, date, type, payment_method, status,
     credit_card_id, category_id, series_id, installment_number)
  VALUES
    (v_uid, 'Notebook (1/3)', 899.67, v_mes + 7,                       'expense', 'credit', 'PAID',    v_card, pg_temp.cat('Presentes / Compras'), v_serie, 1),
    (v_uid, 'Notebook (2/3)', 899.67, (v_mes + INTERVAL '1 month')::date + 7, 'expense', 'credit', 'PENDING', v_card, pg_temp.cat('Presentes / Compras'), v_serie, 2),
    (v_uid, 'Notebook (3/3)', 899.67, (v_mes + INTERVAL '2 month')::date + 7, 'expense', 'credit', 'PENDING', v_card, pg_temp.cat('Presentes / Compras'), v_serie, 3);

  -- ---- Recorrência fixa: série is_fixed + 2 ocorrências --------------------
  v_fixa := gen_random_uuid();
  INSERT INTO public.series
    (id, user_id, description, total_value, total_installments, is_fixed, frequency, start_date, category_id)
  VALUES
    (v_fixa, v_uid, 'Aluguel', 4800.00, 2, true, 'monthly', v_mes + 5, pg_temp.cat('Casa'));

  -- CHECK transactions_installment_number_check: series_id preenchido exige
  -- installment_number preenchido (vale também para recorrência fixa).
  INSERT INTO public.transactions
    (user_id, description, value, date, type, payment_method, status,
     account_id, category_id, series_id, installment_number, is_fixed)
  VALUES
    (v_uid, 'Aluguel', 2400.00, v_mes + 5,                       'expense', 'debit', 'PAID',    v_acc, pg_temp.cat('Casa'), v_fixa, 1, true),
    (v_uid, 'Aluguel', 2400.00, (v_mes + INTERVAL '1 month')::date + 5, 'expense', 'debit', 'PENDING', v_acc, pg_temp.cat('Casa'), v_fixa, 2, true);

  -- ---- Rateio (par ligado por linked_txn_id) ------------------------------
  -- A: gasto bruto pago pelo usuário, metade a ressarcir.
  INSERT INTO public.transactions
    (user_id, description, value, date, type, payment_method, status,
     credit_card_id, category_id, is_shared, compensation_value)
  VALUES
    (v_uid, 'Jantar compartilhado', 360.00, v_mes + 12, 'expense', 'credit', 'PENDING',
     v_card, pg_temp.cat('Alimentação'), true, 180.00)
  RETURNING id INTO v_txn_a;

  -- B: a receber da pessoa, apontando para A.
  INSERT INTO public.transactions
    (user_id, description, value, date, type, payment_method, status,
     account_id, category_id, person_id, is_shared, compensation_value, linked_txn_id)
  VALUES
    (v_uid, 'Reembolso jantar — Marina', 180.00, v_mes + 12, 'income', 'debit', 'PENDING',
     v_acc, pg_temp.cat('Outras Receitas (Aluguéis, extras, reembolso etc.)'),
     v_person, true, 0, v_txn_a);

  RAISE NOTICE '[seed] pro@orbi.test criado (Pro ativo: 2 contas, série 3x, fixa e rateio)';
END
$pro$;

-- ============================================================================
-- 6. TESTES DE INTEGRIDADE ESTRUTURAL (falham o seed inteiro se quebrarem)
-- ============================================================================

-- 6.1 Cadeia Auth -> Public -> Tenant -> Plan fechada para os 3 usuários
DO $chain$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT u.id, u.email, p.user_id AS profile_user, s.id AS sub_id, pl.slug, s.status
      FROM auth.users u
      LEFT JOIN public.user_profiles      p  ON p.user_id = u.id
      LEFT JOIN public.user_subscriptions s  ON s.user_id = u.id AND s.status IN ('trial','active')
      LEFT JOIN public.subscription_plans pl ON pl.id = s.plan_id
     WHERE u.id IN ('11111111-1111-4111-8111-111111111111',
                    '22222222-2222-4222-8222-222222222222',
                    '33333333-3333-4333-8333-333333333333')
  LOOP
    IF r.profile_user IS NULL THEN
      RAISE EXCEPTION 'Integridade: % sem user_profiles', r.email;
    END IF;
    IF r.sub_id IS NULL OR r.slug IS NULL THEN
      RAISE EXCEPTION 'Integridade: % sem assinatura vigente amarrada a um plano', r.email;
    END IF;
    RAISE NOTICE '[seed] OK  % -> perfil OK, assinatura % (%).', r.email, r.slug, r.status;
  END LOOP;
END
$chain$;

-- 6.2 Nenhum órfão nas tabelas de domínio dos usuários do seed
DO $orphan$
DECLARE
  v_bad integer;
BEGIN
  SELECT COUNT(*) INTO v_bad
    FROM public.transactions t
    LEFT JOIN auth.users u ON u.id = t.user_id
   WHERE u.id IS NULL;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Integridade: % transações órfãs (user_id inexistente)', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_bad
    FROM public.transactions t
   WHERE t.series_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.series s WHERE s.id = t.series_id);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Integridade: % transações com series_id inexistente', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_bad
    FROM public.transactions t
   WHERE t.linked_txn_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.transactions x WHERE x.id = t.linked_txn_id);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Integridade: % pares de rateio com linked_txn_id quebrado', v_bad;
  END IF;
END
$orphan$;

-- 6.3 O trigger de cota do plano Free realmente bloqueia (subtransação: o
--     INSERT proposital é revertido, o seed continua).
DO $quota$
DECLARE
  v_uid uuid := '22222222-2222-4222-8222-222222222222';
BEGIN
  BEGIN
    INSERT INTO public.accounts (user_id, name, type, initial_balance)
    VALUES (v_uid, 'ESTOURO DE COTA', 'Corrente', 0);
    RAISE EXCEPTION 'Integridade: cota do plano Free NÃO bloqueou a 2ª conta (esperado P0005)';
  EXCEPTION
    WHEN sqlstate 'P0005' THEN
      RAISE NOTICE '[seed] OK  cota Free bloqueou a 2ª conta (P0005)';
  END;
END
$quota$;

-- 6.4 Sem assinatura => P0004 (usuário efêmero, revertido na subtransação)
DO $nosub$
DECLARE
  v_tmp uuid := '44444444-4444-4444-8444-444444444444';
BEGIN
  BEGIN
    PERFORM pg_temp.orbi_seed_user(v_tmp, 'nosub@orbi.test', 'Orbi@2026!seed', 'Sem Assinatura');
    INSERT INTO public.accounts (user_id, name, type, initial_balance)
    VALUES (v_tmp, 'SEM PLANO', 'Corrente', 0);
    RAISE EXCEPTION 'Integridade: INSERT sem assinatura NÃO foi bloqueado (esperado P0004)';
  EXCEPTION
    WHEN sqlstate 'P0004' THEN
      RAISE NOTICE '[seed] OK  usuário sem assinatura bloqueado (P0004)';
  END;
  DELETE FROM auth.users WHERE id = v_tmp;
END
$nosub$;

-- 6.5 Resumo final
DO $resumo$
DECLARE
  r record;
BEGIN
  RAISE NOTICE '--------------------------------------------------------------';
  FOR r IN
    SELECT u.email,
           pl.slug AS plano,
           s.status,
           (SELECT COUNT(*) FROM public.accounts      a WHERE a.user_id = u.id) AS contas,
           (SELECT COUNT(*) FROM public.credit_cards  c WHERE c.user_id = u.id) AS cartoes,
           (SELECT COUNT(*) FROM public.people        p WHERE p.user_id = u.id) AS pessoas,
           (SELECT COUNT(*) FROM public.transactions  t WHERE t.user_id = u.id) AS transacoes
      FROM auth.users u
      JOIN public.user_subscriptions s  ON s.user_id = u.id AND s.status IN ('trial','active')
      JOIN public.subscription_plans pl ON pl.id = s.plan_id
     WHERE u.id IN ('11111111-1111-4111-8111-111111111111',
                    '22222222-2222-4222-8222-222222222222',
                    '33333333-3333-4333-8333-333333333333')
     ORDER BY pl.display_order, u.email
  LOOP
    RAISE NOTICE '[seed] % | plano=% (%) | contas=% cartoes=% pessoas=% txns=%',
      rpad(r.email, 18), r.plano, r.status, r.contas, r.cartoes, r.pessoas, r.transacoes;
  END LOOP;
  RAISE NOTICE '[seed] senha de todos os usuários: Orbi@2026!seed';
  RAISE NOTICE '--------------------------------------------------------------';
END
$resumo$;

COMMIT;
