-- ============================================================================
-- ZERO TRUST — VALIDACAO DE INPUT NA BORDA DO BANCO
-- ============================================================================
-- O frontend usa react-hook-form + zod, mas o PostgREST esta exposto: qualquer
-- token valido faz `POST /rest/v1/transactions` direto, sem passar por
-- componente nenhum. Ate agora o banco aceitava:
--
--   * `description` de tamanho arbitrario (payload de MBs por linha => custo
--     de storage e DoS na busca por trigram/LIKE do classificador);
--   * `type`, `status`, `payment_method`, `category_type`, `frequency` com
--     QUALQUER string — os "enums" so existiam no TypeScript. Um status
--     inventado escapa dos filtros das views de saldo e some do extrato;
--   * `value`/`initial_balance`/`limit` sem faixa — overflow de numeric e
--     saldo envenenado;
--   * `statement_date`/`due_date` fora de 1..31 — fatura calculada errado;
--   * `logo_url` com esquema livre (`javascript:`, `vbscript:`) indo direto
--     para `<img src>`/`<a href>` no dashboard => XSS armazenado;
--   * bytes NUL e caracteres de controle em texto — quebram export CSV/PDF e
--     viabilizam log/CSV injection.
--
-- Todas as constraints entram como NOT VALID (linhas legadas seguem existindo)
-- e sao validadas em seguida quando os dados permitem. NOT VALID ja e
-- ENFORCED para todo INSERT/UPDATE novo — que e a superficie de ataque.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. HELPERS DE SANITIZACAO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.orbi_is_safe_text(p_value text, p_max int)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT p_value IS NULL
     OR (
          length(p_value) <= p_max
          -- Campo de uma linha: nenhum caractere de controle (inclui NUL,
          -- CR/LF e ESC — vetores de CSV injection e de quebra de log).
          AND p_value !~ '[[:cntrl:]]'
        );
$fn$;

COMMENT ON FUNCTION public.orbi_is_safe_text(text, int) IS
  'Texto de uma linha vindo do usuario: tamanho limitado e sem caracteres de controle (anti CSV/log injection e anti payload gigante).';

CREATE OR REPLACE FUNCTION public.orbi_is_safe_multiline(p_value text, p_max int)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT p_value IS NULL
     OR (
          length(p_value) <= p_max
          -- Igual ao acima, mas TAB/LF/CR sao legitimos: sao trocados por
          -- espaco antes do teste, em vez de depender de escape hexadecimal
          -- no regex (mais portavel entre versoes do Postgres).
          AND translate(p_value, chr(9) || chr(10) || chr(13), '   ') !~ '[[:cntrl:]]'
        );
$fn$;

COMMENT ON FUNCTION public.orbi_is_safe_multiline(text, int) IS
  'Texto multilinha do usuario: permite tab/CR/LF, bloqueia o resto dos caracteres de controle.';

CREATE OR REPLACE FUNCTION public.orbi_is_safe_url(p_value text, p_max int)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT p_value IS NULL
     OR (
          length(p_value) <= p_max
          -- Allowlist de esquema: mata javascript:/vbscript:/data:text/html.
          AND (
            p_value ~* '^https://'
            OR p_value ~* '^data:image/(png|jpe?g|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,'
          )
        );
$fn$;

COMMENT ON FUNCTION public.orbi_is_safe_url(text, int) IS
  'URL vinda do cliente: so https:// ou data:image/*;base64. Bloqueia javascript:/vbscript:/data:text/html (XSS armazenado).';

-- ============================================================================
-- 1. transactions — entidade central
-- ============================================================================

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS orbi_txn_description_safe,
  DROP CONSTRAINT IF EXISTS orbi_txn_type_whitelist,
  DROP CONSTRAINT IF EXISTS orbi_txn_status_whitelist,
  DROP CONSTRAINT IF EXISTS orbi_txn_payment_method_whitelist,
  DROP CONSTRAINT IF EXISTS orbi_txn_value_range,
  DROP CONSTRAINT IF EXISTS orbi_txn_compensation_range,
  DROP CONSTRAINT IF EXISTS orbi_txn_installment_range,
  DROP CONSTRAINT IF EXISTS orbi_txn_date_range,
  DROP CONSTRAINT IF EXISTS orbi_txn_composition_size,
  DROP CONSTRAINT IF EXISTS orbi_txn_no_self_link;

ALTER TABLE public.transactions
  ADD CONSTRAINT orbi_txn_description_safe
    CHECK (length(btrim(description)) BETWEEN 1 AND 300
           AND public.orbi_is_safe_text(description, 300)) NOT VALID,
  ADD CONSTRAINT orbi_txn_type_whitelist
    CHECK (type IN ('expense', 'income', 'transfer')) NOT VALID,
  ADD CONSTRAINT orbi_txn_status_whitelist
    CHECK (status IN ('PENDING', 'PAID', 'CANCELED')) NOT VALID,
  ADD CONSTRAINT orbi_txn_payment_method_whitelist
    CHECK (payment_method IS NULL OR payment_method IN ('debit', 'credit')) NOT VALID,
  -- Faixa monetaria: acima disso e abuso, nao financa pessoal.
  ADD CONSTRAINT orbi_txn_value_range
    CHECK (value >= -1000000000 AND value <= 1000000000) NOT VALID,
  ADD CONSTRAINT orbi_txn_compensation_range
    CHECK (compensation_value IS NULL
           OR (compensation_value >= 0 AND compensation_value <= 1000000000)) NOT VALID,
  ADD CONSTRAINT orbi_txn_installment_range
    CHECK (installment_number IS NULL
           OR (installment_number >= 1 AND installment_number <= 480)) NOT VALID,
  ADD CONSTRAINT orbi_txn_date_range
    CHECK (date >= DATE '1900-01-01' AND date <= DATE '2200-01-01') NOT VALID,
  -- composition_details e TEXTO JSON exibido na UI: limite duro de payload.
  ADD CONSTRAINT orbi_txn_composition_size
    CHECK (composition_details IS NULL OR length(composition_details) <= 20000) NOT VALID,
  -- Auto-referencia criaria loop de propagacao de status.
  ADD CONSTRAINT orbi_txn_no_self_link
    CHECK (linked_txn_id IS NULL OR linked_txn_id <> id) NOT VALID;

-- ============================================================================
-- 2. accounts
-- ============================================================================

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS orbi_account_name_safe,
  DROP CONSTRAINT IF EXISTS orbi_account_type_whitelist,
  DROP CONSTRAINT IF EXISTS orbi_account_balance_range,
  DROP CONSTRAINT IF EXISTS orbi_account_color_format;

ALTER TABLE public.accounts
  ADD CONSTRAINT orbi_account_name_safe
    CHECK (length(btrim(name)) BETWEEN 1 AND 120
           AND public.orbi_is_safe_text(name, 120)) NOT VALID,
  ADD CONSTRAINT orbi_account_type_whitelist
    CHECK (type IN ('Corrente', 'Poupanca', 'Dinheiro', 'Investimento', 'Carteira')
           OR type = ('Poupan' || chr(231) || 'a')) NOT VALID,
  ADD CONSTRAINT orbi_account_balance_range
    CHECK (initial_balance >= -1000000000 AND initial_balance <= 1000000000) NOT VALID,
  -- Cor vai para style/CSS: so hex. Fecha injecao de CSS via atributo.
  ADD CONSTRAINT orbi_account_color_format
    CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{3,8}$') NOT VALID;

-- ============================================================================
-- 3. credit_cards
-- ============================================================================

ALTER TABLE public.credit_cards
  DROP CONSTRAINT IF EXISTS orbi_card_name_safe,
  DROP CONSTRAINT IF EXISTS orbi_card_brand_safe,
  DROP CONSTRAINT IF EXISTS orbi_card_limit_range,
  DROP CONSTRAINT IF EXISTS orbi_card_statement_day,
  DROP CONSTRAINT IF EXISTS orbi_card_due_day;

ALTER TABLE public.credit_cards
  ADD CONSTRAINT orbi_card_name_safe
    CHECK (length(btrim(name)) BETWEEN 1 AND 120
           AND public.orbi_is_safe_text(name, 120)) NOT VALID,
  ADD CONSTRAINT orbi_card_brand_safe
    CHECK (public.orbi_is_safe_text(brand, 60)) NOT VALID,
  ADD CONSTRAINT orbi_card_limit_range
    CHECK ("limit" IS NULL OR ("limit" >= 0 AND "limit" <= 1000000000)) NOT VALID,
  -- Fora de 1..31 o calculo de periodo de fatura vira lixo silencioso.
  ADD CONSTRAINT orbi_card_statement_day
    CHECK (statement_date IS NULL OR (statement_date >= 1 AND statement_date <= 31)) NOT VALID,
  ADD CONSTRAINT orbi_card_due_day
    CHECK (due_date IS NULL OR (due_date >= 1 AND due_date <= 31)) NOT VALID;

-- ============================================================================
-- 4. people
-- ============================================================================

ALTER TABLE public.people
  DROP CONSTRAINT IF EXISTS orbi_person_name_safe,
  DROP CONSTRAINT IF EXISTS orbi_person_pix_safe;

ALTER TABLE public.people
  ADD CONSTRAINT orbi_person_name_safe
    CHECK (length(btrim(name)) BETWEEN 1 AND 120
           AND public.orbi_is_safe_text(name, 120)) NOT VALID,
  ADD CONSTRAINT orbi_person_pix_safe
    CHECK (public.orbi_is_safe_text(pix, 140)) NOT VALID;

-- ============================================================================
-- 5. categories
-- ============================================================================

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS orbi_category_name_safe,
  DROP CONSTRAINT IF EXISTS orbi_category_type_whitelist,
  DROP CONSTRAINT IF EXISTS orbi_category_icon_safe,
  DROP CONSTRAINT IF EXISTS orbi_category_system_owner;

ALTER TABLE public.categories
  ADD CONSTRAINT orbi_category_name_safe
    CHECK (length(btrim(name)) BETWEEN 1 AND 80
           AND public.orbi_is_safe_text(name, 80)) NOT VALID,
  ADD CONSTRAINT orbi_category_type_whitelist
    CHECK (category_type IS NULL OR category_type IN ('expense', 'income')) NOT VALID,
  ADD CONSTRAINT orbi_category_icon_safe
    CHECK (public.orbi_is_safe_text(icon, 60)) NOT VALID,
  -- Invariante do modelo: categoria de sistema nao tem dono; a de usuario tem.
  ADD CONSTRAINT orbi_category_system_owner
    CHECK ((is_system = TRUE AND user_id IS NULL)
           OR (COALESCE(is_system, FALSE) = FALSE AND user_id IS NOT NULL)) NOT VALID;

-- ============================================================================
-- 6. series
-- ============================================================================

ALTER TABLE public.series
  DROP CONSTRAINT IF EXISTS orbi_series_description_safe,
  DROP CONSTRAINT IF EXISTS orbi_series_frequency_whitelist,
  DROP CONSTRAINT IF EXISTS orbi_series_installments_range,
  DROP CONSTRAINT IF EXISTS orbi_series_total_range,
  DROP CONSTRAINT IF EXISTS orbi_series_logo_url_safe,
  DROP CONSTRAINT IF EXISTS orbi_series_date_order;

ALTER TABLE public.series
  ADD CONSTRAINT orbi_series_description_safe
    CHECK (length(btrim(description)) BETWEEN 1 AND 300
           AND public.orbi_is_safe_text(description, 300)) NOT VALID,
  ADD CONSTRAINT orbi_series_frequency_whitelist
    CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')) NOT VALID,
  ADD CONSTRAINT orbi_series_installments_range
    CHECK (total_installments >= 1 AND total_installments <= 480) NOT VALID,
  ADD CONSTRAINT orbi_series_total_range
    CHECK (total_value >= -1000000000 AND total_value <= 1000000000) NOT VALID,
  ADD CONSTRAINT orbi_series_date_order
    CHECK (end_date IS NULL OR end_date >= start_date) NOT VALID;

-- series.logo_url: allowlist de esquema porque o valor era renderizado direto
-- como `<img src>`. Condicional porque o sistema de logos foi removido em
-- 20260910120002_drop_logo_system (junto com a migration que criava a coluna),
-- e esta migration precisa rodar tanto num banco legado quanto num banco novo.
DO $blk$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'series' AND column_name = 'logo_url'
  ) THEN
    EXECUTE 'ALTER TABLE public.series DROP CONSTRAINT IF EXISTS orbi_series_logo_url_safe';
    EXECUTE 'ALTER TABLE public.series ADD CONSTRAINT orbi_series_logo_url_safe '
         || 'CHECK (public.orbi_is_safe_url(logo_url, 1500000)) NOT VALID';
  END IF;
END;
$blk$;

-- ============================================================================
-- 7. user_profiles / user_learned_patterns / notes / bug_reports
-- ============================================================================

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS orbi_profile_name_safe,
  DROP CONSTRAINT IF EXISTS orbi_profile_email_format,
  DROP CONSTRAINT IF EXISTS orbi_profile_avatar_safe;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT orbi_profile_name_safe
    CHECK (public.orbi_is_safe_text(full_name, 120)) NOT VALID,
  ADD CONSTRAINT orbi_profile_email_format
    CHECK (email IS NULL OR (length(email) <= 255 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')) NOT VALID,
  ADD CONSTRAINT orbi_profile_avatar_safe
    CHECK (public.orbi_is_safe_url(avatar_url, 1500000)) NOT VALID;

-- `user_learned_patterns` e opcional (bancos anteriores a 20251015100013 nao
-- a tem): guardado para nao abortar o script inteiro.
DO $blk$
BEGIN
  IF to_regclass('public.user_learned_patterns') IS NULL THEN
    RAISE NOTICE 'ignorado: public.user_learned_patterns nao existe neste banco';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.user_learned_patterns '
       || 'DROP CONSTRAINT IF EXISTS orbi_ulp_description_safe, '
       || 'DROP CONSTRAINT IF EXISTS orbi_ulp_category_safe, '
       || 'DROP CONSTRAINT IF EXISTS orbi_ulp_confidence_range';

  EXECUTE 'ALTER TABLE public.user_learned_patterns '
       || 'ADD CONSTRAINT orbi_ulp_description_safe '
       || 'CHECK (public.orbi_is_safe_text(description, 300) '
       || 'AND public.orbi_is_safe_text(normalized_description, 300)) NOT VALID, '
       || 'ADD CONSTRAINT orbi_ulp_category_safe '
       || 'CHECK (public.orbi_is_safe_text(category, 120) '
       || 'AND public.orbi_is_safe_text(subcategory, 120)) NOT VALID, '
       || 'ADD CONSTRAINT orbi_ulp_confidence_range '
       || 'CHECK (confidence >= 0 AND confidence <= 100) NOT VALID';
END;
$blk$;

DO $blk$
BEGIN
  IF to_regclass('public.notes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS orbi_note_safe';
    EXECUTE 'ALTER TABLE public.notes ADD CONSTRAINT orbi_note_safe '
         || 'CHECK (length(btrim(content)) BETWEEN 1 AND 20000 '
         || 'AND public.orbi_is_safe_multiline(content, 20000)) NOT VALID';
  END IF;

  IF to_regclass('public.bug_reports') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.bug_reports DROP CONSTRAINT IF EXISTS orbi_bug_safe';
    -- `imagem_url` era exibida no painel admin sem checagem de esquema: um
    -- relatorio de bug com `javascript:...` virava XSS refletido contra o
    -- proprio administrador (privilege escalation por um clique).
    EXECUTE 'ALTER TABLE public.bug_reports ADD CONSTRAINT orbi_bug_safe '
         || 'CHECK (length(btrim(titulo)) BETWEEN 1 AND 200 '
         || 'AND public.orbi_is_safe_text(titulo, 200) '
         || 'AND public.orbi_is_safe_multiline(descricao, 10000) '
         || 'AND public.orbi_is_safe_url(imagem_url, 1500000)) NOT VALID';

    EXECUTE 'ALTER TABLE public.bug_reports DROP CONSTRAINT IF EXISTS orbi_bug_status_whitelist';
    EXECUTE 'ALTER TABLE public.bug_reports ADD CONSTRAINT orbi_bug_status_whitelist '
         || $ck$CHECK (status IN ('novo','em-analise','em-desenvolvimento','resolvido','rejeitado')) NOT VALID$ck$;
  END IF;
END;
$blk$;

-- ============================================================================
-- 8. VALIDACAO OPORTUNISTA DO LEGADO
-- ============================================================================
-- NOT VALID ja bloqueia INSERT/UPDATE novos. Aqui tentamos promover cada
-- constraint a VALID; se houver linha legada em desacordo, a constraint segue
-- NOT VALID (e o log diz qual) em vez de a migration inteira falhar.

DO $blk$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT rel.relname AS table_name, con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND con.contype = 'c'
      AND con.convalidated = FALSE
      AND con.conname LIKE 'orbi=_%' ESCAPE '='
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', c.table_name, c.conname);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Constraint %.% permanece NOT VALID (dado legado em desacordo): %',
        c.table_name, c.conname, SQLERRM;
    END;
  END LOOP;
END;
$blk$;

COMMIT;
