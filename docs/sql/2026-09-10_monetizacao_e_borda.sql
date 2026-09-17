-- ============================================================================
--  ORBI — PACOTE DE MONETIZACAO E PROTECAO DE BORDA
--  Gerado em 2026-09-10 a partir de supabase/migrations/20260910120000..120003
-- ----------------------------------------------------------------------------
--  COMO USAR
--    Cole o arquivo INTEIRO no SQL Editor do Supabase e execute uma vez.
--    Roda dentro de UMA transacao: ou aplica tudo, ou nao aplica nada.
--
--  O QUE ELE FAZ
--    1. rate_limit_counters + consume_rate_limit_key  (rate limit por IP e por
--       usuario, usado pelas Edge Functions; substitui edge_rate_limits)
--    2. Triggers de cota reescritos com pg_advisory_xact_lock — fecha a race
--       condition que deixava N requisicoes simultaneas furarem o limite do
--       plano. Mais orbi_quota_snapshot() para o fail-fast da UI.
--    3. Remove o sistema de logos (coluna series.logo_url, bucket
--       company-logos, feature ia_deteccao_logos)
--    4. Seed idempotente dos planos Free / Pro / Casal (UPSERT por slug —
--       NUNCA apaga plano, portanto nao derruba assinatura de cliente)
--
--  IDEMPOTENTE: pode rodar de novo sem efeito colateral.
--  TOLERANTE: nao exige que as migrations 20260910000000..000002 (zero-trust,
--  validacao de input, sanitizacao de RPC) nem a do Plano Casal ja estejam
--  aplicadas — cada dependencia opcional e checada em tempo de execucao.
--
--  DEPOIS DE RODAR, faca o deploy das Edge Functions (elas chamam a RPC nova):
--    supabase functions deploy classify-transactions extract-pdf-text \
--      asaas-create-customer asaas-create-payment asaas-manage-subscription \
--      asaas-sync-subscription asaas-webhook-handler
--    supabase secrets set ALLOWED_ORIGINS="https://app.meuorbi.com"
--    supabase secrets unset LOGO_DEV_TOKEN LOGO_DEV_TOKEN_IMAGES
-- ============================================================================

BEGIN;


-- ############################################################################
-- ## BLOCO 1/4 — RATE LIMIT v2 — contador por identidade (user OU ip)
-- ## origem: supabase/migrations/20260910120000_rate_limit_v2.sql
-- ############################################################################

-- ============================================================================
-- RATE LIMIT v2 — contador genérico por IDENTIDADE (user_id OU IP OU chave)
-- ----------------------------------------------------------------------------
-- Problema da v1 (20260909000001_edge_rate_limiting.sql):
--   `edge_rate_limits.user_id UUID NOT NULL REFERENCES auth.users` só permitia
--   limitar quem já estava autenticado. Endpoints anônimos (webhook do Asaas,
--   preflight de checkout, qualquer rota antes do JWT) ficavam sem teto, e
--   um atacante sem conta pagava zero para inundar a Edge Function.
--
-- v2: a chave vira TEXT com prefixo de escopo ("user:<uuid>", "ip:<addr>",
--     "sub:<asaas_id>"). Mesmo algoritmo de janela fixa, mesmo UPSERT atômico
--     numa única ida ao banco, mesma exclusividade de service_role.
--
-- FAIL-FAST: a decisão acontece na borda (Edge Function) antes de qualquer
-- trabalho pesado — parsing de PDF, chamada ao Asaas, varredura de ML.
-- ============================================================================


CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  identity     TEXT        NOT NULL,
  bucket       TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER     NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identity, bucket)
);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy para authenticated/anon: a tabela é invisível ao cliente.
REVOKE ALL ON public.rate_limit_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_counters TO service_role;

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_updated
  ON public.rate_limit_counters (updated_at);

-- ----------------------------------------------------------------------------
-- Migra os contadores da v1, se a tabela antiga existir.
-- ----------------------------------------------------------------------------
DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'edge_rate_limits'
  ) THEN
    INSERT INTO public.rate_limit_counters (identity, bucket, window_start, hits, updated_at)
    SELECT 'user:' || user_id::text, bucket, window_start, hits, updated_at
      FROM public.edge_rate_limits
    ON CONFLICT (identity, bucket) DO NOTHING;
  END IF;
END
$migrate$;

-- ----------------------------------------------------------------------------
-- consume_rate_limit_key: incrementa e decide numa única ida ao banco.
-- Janela fixa alinhada ao relógio — previsível, sem varredura de histórico.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_rate_limit_key(
  p_identity       TEXT,
  p_bucket         TEXT,
  p_limit          INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now          TIMESTAMPTZ := NOW();
  v_window       INTEGER     := GREATEST(COALESCE(p_window_seconds, 60), 1);
  v_window_start TIMESTAMPTZ;
  v_hits         INTEGER;
BEGIN
  IF p_identity IS NULL OR btrim(p_identity) = '' OR p_bucket IS NULL THEN
    RAISE EXCEPTION 'identity e bucket são obrigatórios' USING ERRCODE = '22004';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / v_window) * v_window
  );

  INSERT INTO public.rate_limit_counters AS rlc (identity, bucket, window_start, hits, updated_at)
  VALUES (left(p_identity, 200), p_bucket, v_window_start, 1, v_now)
  ON CONFLICT (identity, bucket) DO UPDATE
    SET hits = CASE
                 WHEN rlc.window_start < v_window_start THEN 1
                 ELSE rlc.hits + 1
               END,
        window_start = GREATEST(rlc.window_start, v_window_start),
        updated_at = v_now
  RETURNING rlc.hits INTO v_hits;

  IF v_hits > p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'hits', v_hits,
      'limit', p_limit,
      'remaining', 0,
      'reset_at', v_window_start + make_interval(secs => v_window),
      'retry_after_seconds',
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_window_start + make_interval(secs => v_window) - v_now)))::int)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'hits', v_hits,
    'limit', p_limit,
    'remaining', GREATEST(0, p_limit - v_hits),
    'reset_at', v_window_start + make_interval(secs => v_window)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit_key(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit_key(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.consume_rate_limit_key(TEXT, TEXT, INTEGER, INTEGER) IS
  'Janela fixa por (identity, bucket). identity usa prefixo de escopo: user:<uuid> | ip:<addr>. Exclusiva de service_role.';

-- ----------------------------------------------------------------------------
-- Compatibilidade: a assinatura antiga continua existindo e delega para a nova
-- (deploy de Edge Function e migration não são atômicos entre si).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_user_id        UUID,
  p_bucket         TEXT,
  p_limit          INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.consume_rate_limit_key('user:' || p_user_id::text, p_bucket, p_limit, p_window_seconds);
$$;

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO service_role;

-- A tabela v1 vira redundante depois do backfill.
DROP TABLE IF EXISTS public.edge_rate_limits;
DROP FUNCTION IF EXISTS public.cleanup_edge_rate_limits(INTEGER);

-- ----------------------------------------------------------------------------
-- Higiene: remove janelas antigas (chamar via cron/pg_cron ou manualmente).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_counters(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limit_counters
  WHERE updated_at < NOW() - make_interval(hours => GREATEST(p_older_than_hours, 1));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_counters(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_counters(INTEGER) TO service_role;

-- ----------------------------------------------------------------------------
-- Compatibilidade com o zero-trust (20260910000000_zero_trust_rls_force):
-- a tabela nova nasce depois daquela migration, então recebe aqui o mesmo
-- tratamento: FORCE RLS + válvula explícita para as roles de infraestrutura.
-- Sem a policy de bypass, a própria RPC SECURITY DEFINER (que roda como o dono
-- da tabela) deixaria de enxergar as linhas sob FORCE.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS orbi_service_bypass ON public.rate_limit_counters;
CREATE POLICY orbi_service_bypass ON public.rate_limit_counters
  AS PERMISSIVE FOR ALL
  TO postgres, service_role, supabase_admin
  USING (true) WITH CHECK (true);

ALTER TABLE public.rate_limit_counters FORCE ROW LEVEL SECURITY;

-- Substitui edge_rate_limits por rate_limit_counters na lista canônica de
-- tabelas que a varredura de zero-trust percorre.
DO $tenant$
BEGIN
  IF to_regprocedure('public.orbi_tenant_tables()') IS NOT NULL THEN
    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION public.orbi_tenant_tables()
      RETURNS text[]
      LANGUAGE sql
      IMMUTABLE
      AS 'SELECT ARRAY[
        ''accounts'', ''categories'', ''credit_cards'', ''people'', ''series'', ''transactions'',
        ''notes'', ''bug_reports'', ''user_learned_patterns'', ''user_profiles'',
        ''user_subscriptions'', ''user_usage'', ''payment_history'', ''admin_users'',
        ''audit_logs'', ''asaas_webhook_events'', ''subscription_plans'',
        ''merchants_dictionary'', ''rate_limit_counters'', ''family_groups'',
        ''family_group_members''
      ]';
    $ddl$;
  END IF;
END
$tenant$;

NOTIFY pgrst, 'reload schema';


-- ############################################################################
-- ## BLOCO 2/4 — COTAS DE PLANO — atomicidade (advisory lock) e fail-fast
-- ## origem: supabase/migrations/20260910120001_plan_quota_atomic.sql
-- ############################################################################

-- ============================================================================
-- COTAS DE PLANO — ATOMICIDADE E FAIL-FAST
-- ----------------------------------------------------------------------------
-- Problema corrigido aqui (race condition real, não teórica):
--   Os triggers de 20251017085430 faziam SELECT COUNT(*) e só depois deixavam
--   o INSERT passar. Em READ COMMITTED, N requisições simultâneas do MESMO
--   usuário leem o MESMO count (nenhuma enxerga as linhas ainda não commitadas
--   das outras) e TODAS passam. Bastava disparar 10 POSTs em paralelo para
--   estourar o limite do plano Free — exatamente o vetor que a cobrança tenta
--   fechar.
--
-- Correção: pg_advisory_xact_lock(hashtext(recurso), hashtext(user_id)) ANTES
--   da contagem. O lock é por (usuário, recurso), some sozinho no fim da
--   transação e serializa apenas as inserções concorrentes daquele usuário
--   naquele recurso — não há contenção global.
--
-- Também nesta migration:
--   * SECURITY DEFINER + search_path fixo nos triggers (antes rodavam como
--     invoker e dependiam de RLS para enxergar a própria assinatura).
--   * ERRCODE dedicados: P0004 = sem assinatura ativa, P0005 = cota estourada.
--     O front distingue "assine" de "faça upgrade" sem parsear string.
--   * orbi_quota_snapshot(): 1 round-trip com limites + uso atual, para a
--     camada de UX fazer fail-fast antes de montar o payload.
-- ============================================================================


-- ---------------------------------------------------------------- HELPERS ---

-- Limites do plano vigente do usuário. NULL = nenhuma assinatura ativa.
CREATE OR REPLACE FUNCTION public.orbi_active_plan_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sp.limits, '{}'::jsonb)
    FROM public.user_subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
   WHERE s.user_id = p_user_id
     AND s.status IN ('trial', 'active')
   ORDER BY s.created_at DESC
   LIMIT 1;
$$;

-- Features do plano vigente do usuário.
CREATE OR REPLACE FUNCTION public.orbi_active_plan_features(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sp.features, '{}'::jsonb)
    FROM public.user_subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
   WHERE s.user_id = p_user_id
     AND s.status IN ('trial', 'active')
   ORDER BY s.created_at DESC
   LIMIT 1;
$$;

-- Serializa inserções concorrentes do mesmo usuário no mesmo recurso.
-- Liberado automaticamente no COMMIT/ROLLBACK.
CREATE OR REPLACE FUNCTION public.orbi_quota_lock(p_user_id uuid, p_resource text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pg_advisory_xact_lock(hashtext('orbi:quota:' || p_resource), hashtext(p_user_id::text));
$$;

-- Limite numérico do plano; -1 = ilimitado; usa o default quando a key falta.
CREATE OR REPLACE FUNCTION public.orbi_quota_max(
  p_limits jsonb, p_key text, p_default integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(p_limits ->> p_key, '')::integer, p_default);
$$;

-- Erro padronizado.
CREATE OR REPLACE FUNCTION public.orbi_quota_reject(p_label text, p_max integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Limite de % atingido. Seu plano permite %. Faça upgrade para criar mais.',
    p_label, p_max
    USING ERRCODE = 'P0005', HINT = 'plan_quota_exceeded';
END;
$$;

CREATE OR REPLACE FUNCTION public.orbi_no_subscription(p_label text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada para criar %.', p_label
    USING ERRCODE = 'P0004', HINT = 'no_active_subscription';
END;
$$;

-- --------------------------------------------------------------- CONTAS ----
CREATE OR REPLACE FUNCTION public.check_accounts_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limits jsonb;
  v_max    integer;
  v_count  integer;
BEGIN
  v_limits := public.orbi_active_plan_limits(NEW.user_id);
  IF v_limits IS NULL THEN PERFORM public.orbi_no_subscription('contas'); END IF;

  v_max := public.orbi_quota_max(v_limits, 'max_contas', 3);
  IF v_max = -1 THEN RETURN NEW; END IF;

  PERFORM public.orbi_quota_lock(NEW.user_id, 'accounts');

  SELECT COUNT(*) INTO v_count FROM public.accounts WHERE user_id = NEW.user_id;

  IF v_count >= v_max THEN PERFORM public.orbi_quota_reject('contas', v_max); END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------- CATEGORIAS ----
CREATE OR REPLACE FUNCTION public.check_categories_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limits jsonb;
  v_max    integer;
  v_count  integer;
BEGIN
  -- Categoria de sistema (user_id NULL / is_system) não consome cota.
  IF NEW.user_id IS NULL OR COALESCE(NEW.is_system, false) THEN RETURN NEW; END IF;

  v_limits := public.orbi_active_plan_limits(NEW.user_id);
  IF v_limits IS NULL THEN PERFORM public.orbi_no_subscription('categorias'); END IF;

  v_max := public.orbi_quota_max(v_limits, 'max_categorias', 20);
  IF v_max = -1 THEN RETURN NEW; END IF;

  PERFORM public.orbi_quota_lock(NEW.user_id, 'categories');

  SELECT COUNT(*) INTO v_count
    FROM public.categories
   WHERE user_id = NEW.user_id AND COALESCE(is_system, false) = false;

  IF v_count >= v_max THEN PERFORM public.orbi_quota_reject('categorias', v_max); END IF;
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------- CARTÕES ----
CREATE OR REPLACE FUNCTION public.check_credit_cards_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limits jsonb;
  v_max    integer;
  v_count  integer;
BEGIN
  v_limits := public.orbi_active_plan_limits(NEW.user_id);
  IF v_limits IS NULL THEN PERFORM public.orbi_no_subscription('cartões'); END IF;

  v_max := public.orbi_quota_max(v_limits, 'max_cartoes', 2);
  IF v_max = -1 THEN RETURN NEW; END IF;

  PERFORM public.orbi_quota_lock(NEW.user_id, 'credit_cards');

  SELECT COUNT(*) INTO v_count FROM public.credit_cards WHERE user_id = NEW.user_id;

  IF v_count >= v_max THEN PERFORM public.orbi_quota_reject('cartões', v_max); END IF;
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------- PESSOAS ----
CREATE OR REPLACE FUNCTION public.check_people_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limits jsonb;
  v_max    integer;
  v_count  integer;
BEGIN
  v_limits := public.orbi_active_plan_limits(NEW.user_id);
  IF v_limits IS NULL THEN PERFORM public.orbi_no_subscription('pessoas'); END IF;

  v_max := public.orbi_quota_max(v_limits, 'max_pessoas', 10);
  IF v_max = -1 THEN RETURN NEW; END IF;

  PERFORM public.orbi_quota_lock(NEW.user_id, 'people');

  SELECT COUNT(*) INTO v_count FROM public.people WHERE user_id = NEW.user_id;

  IF v_count >= v_max THEN PERFORM public.orbi_quota_reject('pessoas', v_max); END IF;
  RETURN NEW;
END;
$$;

-- --------------------------------------------------- TRANSAÇÕES (MENSAL) ---
CREATE OR REPLACE FUNCTION public.check_transactions_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limits jsonb;
  v_max    integer;
  v_count  integer;
  v_month  date;
BEGIN
  v_limits := public.orbi_active_plan_limits(NEW.user_id);
  IF v_limits IS NULL THEN PERFORM public.orbi_no_subscription('transações'); END IF;

  v_max := public.orbi_quota_max(v_limits, 'max_transacoes_mes', 500);
  IF v_max = -1 THEN RETURN NEW; END IF;

  v_month := DATE_TRUNC('month', NEW.date::date)::date;

  -- Lock por (usuário, mês): parcelamento insere N linhas na mesma transação
  -- e o lock é reentrante, então não há deadlock com o próprio fluxo.
  PERFORM public.orbi_quota_lock(NEW.user_id, 'transactions:' || to_char(v_month, 'YYYY-MM'));

  SELECT COUNT(*) INTO v_count
    FROM public.transactions
   WHERE user_id = NEW.user_id
     AND DATE_TRUNC('month', date::date) = v_month;

  IF v_count >= v_max THEN
    PERFORM public.orbi_quota_reject('transações no mês', v_max);
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------- PLANO CASAL (family members) ---
-- Além do teto de 2 pessoas, passa a exigir a feature no plano vigente:
-- sem isso qualquer conta Free criava grupo e liberava leitura compartilhada.
CREATE OR REPLACE FUNCTION public.check_family_members_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id    uuid;
  v_owner_email text;
  v_features    jsonb;
  v_limits      jsonb;
  v_max         integer;
  v_count       integer;
BEGIN
  SELECT fg.owner_id INTO v_owner_id
    FROM public.family_groups fg
   WHERE fg.id = NEW.family_group_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Grupo familiar inexistente.' USING ERRCODE = 'P0002';
  END IF;

  v_features := public.orbi_active_plan_features(v_owner_id);
  v_limits   := public.orbi_active_plan_limits(v_owner_id);

  IF v_features IS NULL THEN PERFORM public.orbi_no_subscription('convites'); END IF;

  IF COALESCE((v_features ->> 'familia_compartilhada')::boolean, false) = false THEN
    RAISE EXCEPTION 'Compartilhamento é exclusivo do Plano Casal.'
      USING ERRCODE = 'P0005', HINT = 'plan_feature_required';
  END IF;

  v_max := public.orbi_quota_max(v_limits, 'max_membros_familia', 1);

  PERFORM public.orbi_quota_lock(v_owner_id, 'family_members');

  SELECT COUNT(*) INTO v_count
    FROM public.family_group_members
   WHERE family_group_id = NEW.family_group_id;

  IF v_max <> -1 AND v_count >= v_max THEN
    PERFORM public.orbi_quota_reject('pessoas no Plano Casal', v_max + 1);
  END IF;

  SELECT lower(u.email) INTO v_owner_email FROM auth.users u WHERE u.id = v_owner_id;

  NEW.email := lower(btrim(NEW.email));

  IF v_owner_email IS NOT NULL AND NEW.email = v_owner_email THEN
    RAISE EXCEPTION 'Você não pode convidar a si mesmo.' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.user_id IS NULL THEN
    SELECT u.id INTO NEW.user_id FROM auth.users u WHERE lower(u.email) = NEW.email LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------- TRIGGERS -----
DROP TRIGGER IF EXISTS validate_accounts_limit ON public.accounts;
CREATE TRIGGER validate_accounts_limit
  BEFORE INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.check_accounts_limit();

DROP TRIGGER IF EXISTS validate_categories_limit ON public.categories;
CREATE TRIGGER validate_categories_limit
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.check_categories_limit();

DROP TRIGGER IF EXISTS validate_credit_cards_limit ON public.credit_cards;
CREATE TRIGGER validate_credit_cards_limit
  BEFORE INSERT ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.check_credit_cards_limit();

DROP TRIGGER IF EXISTS validate_people_limit ON public.people;
CREATE TRIGGER validate_people_limit
  BEFORE INSERT ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.check_people_limit();

DROP TRIGGER IF EXISTS validate_transactions_limit ON public.transactions;
CREATE TRIGGER validate_transactions_limit
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.check_transactions_limit();

-- Condicional: o Plano Casal (20260909120000) pode não estar aplicado ainda.
DO $family$
BEGIN
  IF to_regclass('public.family_group_members') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_check_family_members_limit ON public.family_group_members;
    CREATE TRIGGER trg_check_family_members_limit
      BEFORE INSERT ON public.family_group_members
      FOR EACH ROW EXECUTE FUNCTION public.check_family_members_limit();
  ELSE
    RAISE NOTICE 'family_group_members ausente — trigger do Plano Casal não criado.';
  END IF;
END
$family$;

-- ------------------------------------------------- FAIL-FAST PARA O FRONT ---
-- 1 round-trip: limites do plano + uso atual. Substitui as N queries de
-- contagem que a UI fazia para decidir se habilita um botão.
CREATE OR REPLACE FUNCTION public.orbi_quota_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_plan   record;
  v_month  date := DATE_TRUNC('month', NOW())::date;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT sp.slug, sp.name, sp.limits, sp.features, s.status
    INTO v_plan
    FROM public.user_subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
   WHERE s.user_id = v_user
     AND s.status IN ('trial', 'active')
   ORDER BY s.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_subscription', false);
  END IF;

  RETURN jsonb_build_object(
    'has_subscription', true,
    'plan_slug', v_plan.slug,
    'plan_name', v_plan.name,
    'status',    v_plan.status,
    'features',  COALESCE(v_plan.features, '{}'::jsonb),
    'limits',    COALESCE(v_plan.limits, '{}'::jsonb),
    'usage', jsonb_build_object(
      'max_contas',         (SELECT COUNT(*) FROM public.accounts     WHERE user_id = v_user),
      'max_cartoes',        (SELECT COUNT(*) FROM public.credit_cards WHERE user_id = v_user),
      'max_pessoas',        (SELECT COUNT(*) FROM public.people       WHERE user_id = v_user),
      'max_categorias',     (SELECT COUNT(*) FROM public.categories
                              WHERE user_id = v_user AND COALESCE(is_system, false) = false),
      'max_transacoes_mes', (SELECT COUNT(*) FROM public.transactions
                              WHERE user_id = v_user
                                AND DATE_TRUNC('month', date::date) = v_month)
    )
  );
END;
$$;

-- Paridade com 20251017085430 (que concedia EXECUTE a authenticated) e
-- reconcessao apos o REVOKE ALL de 20260909000000.
GRANT EXECUTE ON FUNCTION public.check_accounts_limit()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_categories_limit()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_credit_cards_limit()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_people_limit()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_transactions_limit()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_family_members_limit()  TO authenticated;

-- Helpers de cota: o cliente nunca chama diretamente.
REVOKE EXECUTE ON FUNCTION public.orbi_quota_lock(uuid, text)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_quota_reject(text, integer)     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_no_subscription(text)           FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.orbi_quota_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_quota_snapshot() TO authenticated;

GRANT EXECUTE ON FUNCTION public.orbi_active_plan_limits(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_active_plan_features(uuid) TO authenticated;

COMMENT ON FUNCTION public.orbi_quota_lock(uuid, text) IS
  'Advisory lock por (usuário, recurso). Fecha a race condition de cota em inserts concorrentes.';
COMMENT ON FUNCTION public.orbi_quota_snapshot() IS
  'Limites do plano + uso atual num único round-trip. Camada de UX (fail-fast); a autoridade continua nos triggers.';

NOTIFY pgrst, 'reload schema';


-- ############################################################################
-- ## BLOCO 3/4 — REMOCAO DO SISTEMA DE LOGOS (logo.dev)
-- ## origem: supabase/migrations/20260910120002_drop_logo_system.sql
-- ############################################################################

-- ============================================================================
-- REMOÇÃO DO SISTEMA DE LOGOS (logo.dev)
-- ----------------------------------------------------------------------------
-- Motivo: era a única dependência de API paga de terceiros fora do gateway de
-- pagamento, com dois tokens no servidor (LOGO_DEV_TOKEN e
-- LOGO_DEV_TOKEN_IMAGES), cota consumível por qualquer usuário autenticado e
-- um bucket público de Storage escrito por `authenticated` (qualquer conta
-- podia gravar objetos arbitrários em `company-logos`).
--
-- Removidos junto com esta migration:
--   * Edge Functions  supabase/functions/search-logo, .../get-company-logo
--   * Scripts         scripts/setup-logo-integration.sh, scripts/start-logo-function.sh
--   * Migrations      20251009000002_add_logo_url_to_series.sql
--                     20251010000001_create_logos_storage_bucket.sql
--   * Feature de plano `ia_deteccao_logos`
--
-- Idempotente: roda tanto num banco que já tinha o sistema quanto num banco
-- novo em que as migrations removidas nunca existiram.
-- ============================================================================


-- ------------------------------------------------------------ series.logo_url
DROP INDEX IF EXISTS public.idx_series_logo_url;
-- A constraint orbi_series_logo_url_safe (20260910000001) cai junto com a coluna.
ALTER TABLE public.series DROP CONSTRAINT IF EXISTS orbi_series_logo_url_safe;
ALTER TABLE public.series DROP COLUMN IF EXISTS logo_url;

-- --------------------------------------------------- Storage: company-logos
DROP POLICY IF EXISTS "Public read access to company logos"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;
-- Policies reescritas por 20260910000000_zero_trust_rls_force.
DROP POLICY IF EXISTS "orbi_logos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "orbi_logos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "orbi_logos_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "orbi_logos_select_public" ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'company-logos';
DELETE FROM storage.buckets WHERE id = 'company-logos';

-- ------------------------------------------- Feature de plano correspondente
UPDATE public.subscription_plans
   SET features = features - 'ia_deteccao_logos',
       updated_at = NOW()
 WHERE features ? 'ia_deteccao_logos';

-- --------------------------------- Contadores de rate limit órfãos dos logos
DELETE FROM public.rate_limit_counters
 WHERE bucket IN ('search-logo', 'get-company-logo');

NOTIFY pgrst, 'reload schema';


-- ############################################################################
-- ## BLOCO 4/4 — SEED DOS PLANOS — Free / Pro / Casal
-- ## origem: supabase/migrations/20260910120003_seed_business_plans.sql
-- ############################################################################

-- ============================================================================
-- SEED CANÔNICO DOS PLANOS DE NEGÓCIO — Free / Pro / Casal
-- ----------------------------------------------------------------------------
-- Substitui 20251016000008_seed_default_subscription_plans.sql como fonte de
-- verdade dos planos. Duas diferenças importantes em relação àquele arquivo:
--
--  1. NÃO usa DELETE. `user_subscriptions.plan_id` é
--     `REFERENCES subscription_plans(id) ON DELETE CASCADE` — reexecutar o seed
--     antigo apagava as assinaturas de TODOS os clientes daquele plano junto
--     com o plano. Aqui é UPSERT por slug: o `id` do plano nunca muda.
--  2. Colunas de cobrança (asaas_plan_id, URLs de pagamento, trial_days) NÃO
--     são sobrescritas — são operadas fora do versionamento.
--
-- Chaves de limite: -1 = ilimitado. Devem casar 1:1 com as keys lidas pelos
-- triggers de cota (20260910000001) e por src/lib/features/orbi-features.ts.
-- Feature `ia_deteccao_logos` foi removida junto com o sistema de logos.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- FREE (slug histórico `basic` — preservado para não órfãos nas assinaturas)
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription_plans (
  name, slug, description, price_monthly, price_yearly,
  is_active, is_featured, display_order, features, limits
) VALUES (
  'Free',
  'basic',
  'Gestão financeira essencial: lançamento manual, extrato mensal e saldo das contas.',
  0.00, 0.00, true, false, 0,
  '{
    "dashboard": false,
    "dashboard_assinaturas": false,
    "extrato": true,
    "contas": true,
    "categorias": true,
    "cartoes": true,
    "pessoas": true,
    "ia_classificador": false,
    "familia_compartilhada": false,
    "transacoes_criar": true,
    "transacoes_editar": true,
    "transacoes_excluir": true,
    "transacoes_importar_csv": false,
    "contas_criar": true,
    "contas_editar": true,
    "contas_excluir": true,
    "categorias_criar": true,
    "categorias_editar": true,
    "categorias_excluir": true,
    "cartoes_criar": true,
    "cartoes_editar": true,
    "cartoes_excluir": true,
    "cartoes_faturas": true,
    "pessoas_criar": true,
    "pessoas_editar": true,
    "pessoas_excluir": true,
    "ia_classificacao_automatica": false
  }'::jsonb,
  '{
    "max_contas": 1,
    "max_cartoes": 1,
    "max_transacoes_mes": 100,
    "max_pessoas": 2,
    "max_categorias": 10,
    "max_membros_familia": 0,
    "retencao_dados_meses": 6
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  is_active     = EXCLUDED.is_active,
  is_featured   = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order,
  features      = EXCLUDED.features,
  limits        = EXCLUDED.limits,
  updated_at    = NOW();

-- ---------------------------------------------------------------------------
-- PRO
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription_plans (
  name, slug, description, price_monthly, price_yearly,
  is_active, is_featured, display_order, features, limits
) VALUES (
  'Pro',
  'pro',
  'Automatização completa: importação de extrato, IA classificadora e uso ilimitado.',
  10.99, 109.99, true, true, 1,
  '{
    "dashboard": true,
    "dashboard_assinaturas": true,
    "extrato": true,
    "contas": true,
    "categorias": true,
    "cartoes": true,
    "pessoas": true,
    "ia_classificador": true,
    "familia_compartilhada": false,
    "transacoes_criar": true,
    "transacoes_editar": true,
    "transacoes_excluir": true,
    "transacoes_importar_csv": true,
    "contas_criar": true,
    "contas_editar": true,
    "contas_excluir": true,
    "categorias_criar": true,
    "categorias_editar": true,
    "categorias_excluir": true,
    "cartoes_criar": true,
    "cartoes_editar": true,
    "cartoes_excluir": true,
    "cartoes_faturas": true,
    "pessoas_criar": true,
    "pessoas_editar": true,
    "pessoas_excluir": true,
    "ia_classificacao_automatica": true
  }'::jsonb,
  '{
    "max_contas": -1,
    "max_cartoes": -1,
    "max_transacoes_mes": -1,
    "max_pessoas": -1,
    "max_categorias": -1,
    "max_membros_familia": 0,
    "retencao_dados_meses": -1
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  is_active     = EXCLUDED.is_active,
  is_featured   = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order,
  features      = EXCLUDED.features,
  limits        = EXCLUDED.limits,
  updated_at    = NOW();

-- ---------------------------------------------------------------------------
-- CASAL — Pro + compartilhamento de leitura com 1 parceiro (2 acessos)
-- `max_membros_familia` = 1 convidado; o dono é o 2º acesso.
-- É a chave lida por check_family_members_limit (20260910000001).
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription_plans (
  name, slug, description, price_monthly, price_yearly,
  is_active, is_featured, display_order, features, limits
) VALUES (
  'Casal',
  'casal',
  'Tudo do Pro e mais um acesso: você e seu parceiro enxergam as mesmas finanças, com uma única assinatura.',
  16.99, 169.99, true, false, 2,
  '{
    "dashboard": true,
    "dashboard_assinaturas": true,
    "extrato": true,
    "contas": true,
    "categorias": true,
    "cartoes": true,
    "pessoas": true,
    "ia_classificador": true,
    "familia_compartilhada": true,
    "transacoes_criar": true,
    "transacoes_editar": true,
    "transacoes_excluir": true,
    "transacoes_importar_csv": true,
    "contas_criar": true,
    "contas_editar": true,
    "contas_excluir": true,
    "categorias_criar": true,
    "categorias_editar": true,
    "categorias_excluir": true,
    "cartoes_criar": true,
    "cartoes_editar": true,
    "cartoes_excluir": true,
    "cartoes_faturas": true,
    "pessoas_criar": true,
    "pessoas_editar": true,
    "pessoas_excluir": true,
    "ia_classificacao_automatica": true
  }'::jsonb,
  '{
    "max_contas": -1,
    "max_cartoes": -1,
    "max_transacoes_mes": -1,
    "max_pessoas": -1,
    "max_categorias": -1,
    "max_membros_familia": 1,
    "retencao_dados_meses": -1
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  is_active     = EXCLUDED.is_active,
  is_featured   = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order,
  features      = EXCLUDED.features,
  limits        = EXCLUDED.limits,
  updated_at    = NOW();

-- ---------------------------------------------------------------------------
-- Higiene: a feature de logos não existe mais em plano nenhum.
-- ---------------------------------------------------------------------------
UPDATE public.subscription_plans
   SET features = features - 'ia_deteccao_logos', updated_at = NOW()
 WHERE features ? 'ia_deteccao_logos';

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.subscription_plans
   WHERE slug IN ('basic', 'pro', 'casal') AND is_active;

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Seed de planos incompleto: % de 3 planos ativos', v_count;
  END IF;
END
$verify$;


COMMIT;

-- ============================================================================
-- VERIFICACAO (roda fora da transacao; so leitura)
-- ============================================================================

-- 1. Planos ativos e seus tetos
SELECT slug, name, price_monthly, price_yearly,
       limits ->> 'max_contas'          AS contas,
       limits ->> 'max_transacoes_mes'  AS transacoes_mes,
       limits ->> 'max_membros_familia' AS acessos_extras,
       features ->> 'familia_compartilhada' AS plano_casal,
       features ->> 'ia_classificador'      AS ia
  FROM public.subscription_plans
 WHERE is_active
 ORDER BY display_order;

-- 2. Triggers de cota instalados
SELECT c.relname AS tabela, t.tgname AS trigger
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
 WHERE NOT t.tgisinternal
   AND t.tgname IN ('validate_accounts_limit','validate_categories_limit',
                    'validate_credit_cards_limit','validate_people_limit',
                    'validate_transactions_limit','trg_check_family_members_limit')
 ORDER BY 1;

-- 3. Infra de rate limit no lugar
SELECT to_regclass('public.rate_limit_counters')            AS tabela_contadores,
       to_regprocedure('public.consume_rate_limit_key(text,text,integer,integer)') AS rpc_nova,
       to_regprocedure('public.consume_rate_limit(uuid,text,integer,integer)')     AS rpc_compat,
       to_regclass('public.edge_rate_limits')               AS tabela_antiga_deve_ser_null;

-- 4. Sistema de logos removido
SELECT (SELECT count(*) FROM information_schema.columns
         WHERE table_schema='public' AND table_name='series' AND column_name='logo_url') AS coluna_logo_url_deve_ser_0,
       (SELECT count(*) FROM storage.buckets WHERE id='company-logos')                   AS bucket_deve_ser_0,
       (SELECT count(*) FROM public.subscription_plans WHERE features ? 'ia_deteccao_logos') AS feature_deve_ser_0;

-- 5. Fumaca: o rate limiter responde? (limite 2 -> a 3a deve vir allowed=false)
SELECT i, public.consume_rate_limit_key('ip:smoke-test','smoke',2,60) ->> 'allowed' AS allowed
  FROM generate_series(1,3) i;
DELETE FROM public.rate_limit_counters WHERE identity = 'ip:smoke-test';
