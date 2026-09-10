-- ============================================================================
--  ORBI - HARDENING DE SEGURANCA (RLS FORCE + VALIDACAO DE INPUT + RPCs)
--  Gerado em 2026-09-10 | colar INTEIRO no Supabase SQL Editor e executar
-- ============================================================================
--
--  Equivale as migrations:
--    supabase/migrations/20260910000000_zero_trust_rls_force.sql
--    supabase/migrations/20260910000001_input_validation_constraints.sql
--    supabase/migrations/20260910000002_search_rpc_input_sanitization.sql
--
--  COMO USAR
--    1. Supabase Dashboard -> SQL Editor -> New query
--    2. Colar este arquivo inteiro e clicar em RUN
--    3. O editor roda tudo em UMA transacao: se qualquer passo falhar, NADA e
--       aplicado (rollback total). A ultima consulta devolve o relatorio de
--       verificacao - confira que todas as linhas estao "OK".
--
--  IDEMPOTENTE: pode ser executado mais de uma vez sem efeito colateral.
--
--  NAO contem BEGIN/COMMIT de proposito - o SQL Editor ja abre a transacao.
--  Se voce for rodar via psql, envolva a execucao em BEGIN; ... COMMIT;
-- ============================================================================

-- ============================================================================
--  PREFLIGHT - confere pre-requisitos e ABORTA com mensagem legivel
-- ============================================================================
-- Falhar aqui e melhor do que falhar no meio: o script assume que as migrations
-- anteriores do repo ja foram aplicadas neste banco.

DO $preflight$
DECLARE
  v_missing_req   text[] := ARRAY[]::text[];
  v_missing_opt   text[] := ARRAY[]::text[];
  v_missing_funcs text[] := ARRAY[]::text[];
  t text;
  f text;
BEGIN
  -- OBRIGATORIAS: este script as referencia literalmente (ALTER TABLE ... ADD
  -- CONSTRAINT na PARTE 2). Sem elas, abortar com mensagem clara e melhor do
  -- que falhar no meio da execucao.
  FOREACH t IN ARRAY ARRAY[
    'accounts', 'categories', 'credit_cards', 'people', 'series',
    'transactions', 'user_profiles'
  ] LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      v_missing_req := v_missing_req || t;
    END IF;
  END LOOP;

  -- OPCIONAIS: cada bloco que as toca e guardado por existencia, entao a
  -- ausencia so vira aviso. Bancos em estagios diferentes de migration
  -- (ex.: `family_members` ja renomeada, `edge_rate_limits` ainda nao criada)
  -- passam sem erro e simplesmente pulam aquele trecho.
  FOREACH t IN ARRAY ARRAY[
    'user_usage', 'payment_history', 'audit_logs', 'merchants_dictionary',
    'user_learned_patterns', 'notes', 'bug_reports', 'asaas_webhook_events',
    'admin_users', 'subscription_plans', 'user_subscriptions',
    'family_groups', 'family_group_members'
  ] LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      v_missing_opt := v_missing_opt || t;
    END IF;
  END LOOP;

  -- Funcoes de que os wrappers da PARTE 3 dependem: se `search_merchant` nao
  -- existir, o wrapper criado apontaria para um `_impl` inexistente.
  FOREACH f IN ARRAY ARRAY['search_merchant', 'get_top_merchants'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN (f, f || '_impl')
    ) THEN
      v_missing_funcs := v_missing_funcs || f;
    END IF;
  END LOOP;

  IF array_length(v_missing_req, 1) > 0 OR array_length(v_missing_funcs, 1) > 0 THEN
    RAISE EXCEPTION E'PREFLIGHT FALHOU - migrations anteriores nao aplicadas neste banco.\n'
      '  Tabelas obrigatorias ausentes: %\n'
      '  Funcoes obrigatorias ausentes: %\n'
      'Aplique as migrations de supabase/migrations/ em ordem antes de rodar este script.',
      COALESCE(array_to_string(v_missing_req, ', '), '(nenhuma)'),
      COALESCE(array_to_string(v_missing_funcs, ', '), '(nenhuma)');
  END IF;

  IF array_length(v_missing_opt, 1) > 0 THEN
    RAISE NOTICE 'preflight ok - tabelas opcionais ausentes (blocos correspondentes serao pulados): %',
      array_to_string(v_missing_opt, ', ');
  ELSE
    RAISE NOTICE 'preflight ok - todas as tabelas esperadas presentes';
  END IF;
END;
$preflight$;



-- ============================================================================
-- ============================================================================
--  PARTE 1/3 - FORCE ROW LEVEL SECURITY + BLINDAGEM DE PRIVILEGIOS
--  (origem: 20260910000000_zero_trust_rls_force.sql)
-- ============================================================================
-- ============================================================================
-- ============================================================================
-- ZERO TRUST — FORCE ROW LEVEL SECURITY + BLINDAGEM DE PRIVILÉGIOS
-- ============================================================================
-- Achados que este arquivo corrige:
--
--  [A] NENHUMA tabela tinha FORCE ROW LEVEL SECURITY. `ENABLE` sozinho não
--      vale para o OWNER da tabela: qualquer função/rotina que rode como o
--      dono (e qualquer mudança futura de ownership) enxerga e escreve em
--      todos os tenants. FORCE fecha essa porta.
--
--  [B] `user_usage` tinha `GRANT SELECT, INSERT, UPDATE ... TO authenticated`
--      + policy `FOR ALL USING (auth.uid() = user_id)`. O usuário forjava as
--      próprias métricas de uso — a mesma tabela que alimenta limite de plano.
--      Métrica de consumo é dado do servidor, nunca do cliente.
--
--  [C] `user_profiles` permitia UPDATE de QUALQUER coluna, incluindo
--      `asaas_customer_id` (apontar o próprio perfil para o customer de
--      outro tenant no gateway = fraude de cobrança) e `email` (divergir do
--      e-mail do JWT quebra o convite de família, que casa por e-mail).
--
--  [D] Bucket de logos: as policies de UPDATE/DELETE exigiam apenas
--      `auth.role() = 'authenticated'`, sem checar dono do objeto — qualquer
--      usuário logado sobrescrevia/apagava o logo de qualquer outro.
--
--  [E] Policies `FOR ALL USING (...)` sem `WITH CHECK` explícito. O Postgres
--      hoje reaproveita o USING, mas isso é implícito demais para a fronteira
--      de tenant: aqui vira SELECT/INSERT/UPDATE/DELETE separados e explícitos.
--
--  [F] `audit_logs` e `merchants_dictionary` com GRANT de escrita para
--      `authenticated` (trilha de auditoria adulterável / dicionário de ML
--      envenenável por qualquer usuário).
-- ============================================================================


-- ============================================================================
-- 0. LISTA CANÔNICA DE TABELAS MULTI-TENANT
-- ============================================================================

-- Roles de infraestrutura que existem NESTE banco. `supabase_admin` nao existe
-- num Postgres local/self-host: montar a lista dinamicamente evita que a
-- migration inteira falhe num ambiente sem ele.
CREATE OR REPLACE FUNCTION public.orbi_service_roles()
RETURNS text
LANGUAGE sql
STABLE
AS $fn$
  SELECT string_agg(quote_ident(rolname), ', ' ORDER BY rolname)
  FROM pg_roles
  WHERE rolname IN ('postgres', 'service_role', 'supabase_admin');
$fn$;

-- Executa comandos DDL/DCL apenas se TODAS as tabelas citadas existirem.
-- Motivo: `DROP POLICY IF EXISTS ... ON t` e `REVOKE ... ON t` levantam 42P01
-- quando `t` nao existe (o IF EXISTS cobre a policy, nao a tabela). Bancos em
-- estagios diferentes de migration - ex.: `family_members` ja renomeada para
-- `people`, ou `edge_rate_limits` ainda nao criada - faziam o script inteiro
-- abortar. O PostgreSQL 16 e leniente em alguns desses casos e outras versoes
-- nao sao, entao a checagem e explicita e nao depende da versao.
CREATE OR REPLACE FUNCTION public.orbi_exec_if_tables(
  p_tables text[],
  p_commands text[]
)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  t   text;
  cmd text;
BEGIN
  FOREACH t IN ARRAY p_tables LOOP
    IF to_regclass(t) IS NULL THEN
      RAISE NOTICE 'ignorado (relacao % nao existe neste banco): %', t, p_commands[1];
      RETURN;
    END IF;
  END LOOP;

  FOREACH cmd IN ARRAY p_commands LOOP
    EXECUTE cmd;
  END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.orbi_tenant_tables()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'accounts', 'categories', 'credit_cards', 'people', 'series', 'transactions',
    'notes', 'bug_reports', 'user_learned_patterns', 'user_profiles',
    'user_subscriptions', 'user_usage', 'payment_history', 'admin_users',
    'audit_logs', 'asaas_webhook_events', 'subscription_plans',
    'merchants_dictionary', 'edge_rate_limits', 'family_groups',
    'family_group_members'
  ];
$$;

-- ============================================================================
-- 1. VÁLVULA DE SERVIÇO — precondição para FORCE RLS
-- ============================================================================
-- Com FORCE, o dono da tabela passa a obedecer RLS. Edge Functions
-- (service_role), triggers de sistema e RPCs SECURITY DEFINER precisam de um
-- caminho explícito, senão o produto quebra. Esta policy concede esse caminho
-- APENAS a roles de infraestrutura — `authenticated` e `anon` continuam
-- restritos às policies de tenant abaixo.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY public.orbi_tenant_tables() LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS orbi_service_bypass ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY orbi_service_bypass ON public.%I AS PERMISSIVE FOR ALL '
      'TO %s USING (true) WITH CHECK (true)',
      t, public.orbi_service_roles()
    );
    -- [A] O ponto do arquivo: dono da tabela deixa de ser exceção à RLS.
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

-- Varredura de segurança: qualquer outra tabela de public com RLS ligada
-- também recebe FORCE (evita que uma tabela nova fique de fora por esquecimento).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = TRUE
      AND c.relforcerowsecurity = FALSE
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS orbi_service_bypass ON public.%I', r.relname);
    EXECUTE format(
      'CREATE POLICY orbi_service_bypass ON public.%I AS PERMISSIVE FOR ALL '
      'TO %s USING (true) WITH CHECK (true)',
      r.relname, public.orbi_service_roles()
    );
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.relname);
    RAISE NOTICE 'FORCE RLS aplicado em public.%', r.relname;
  END LOOP;
END;
$$;

-- ============================================================================
-- 2. [E] POLICIES DE TENANT EXPLÍCITAS (USING + WITH CHECK em cada comando)
-- ============================================================================
-- `FOR ALL USING (auth.uid() = user_id)` nunca declarava WITH CHECK. Aqui cada
-- verbo é declarado, e o INSERT/UPDATE passa a exigir explicitamente que a
-- linha resultante pertença ao usuário do JWT — impossível "mudar de dono".

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts', 'credit_cards', 'people', 'series', 'transactions'] LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS orbi_%s_select ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS orbi_%s_insert ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS orbi_%s_update ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS orbi_%s_delete ON public.%I', t, t);

    EXECUTE format(
      'CREATE POLICY orbi_%s_select ON public.%I FOR SELECT TO authenticated '
      'USING (auth.uid() = user_id)', t, t);
    EXECUTE format(
      'CREATE POLICY orbi_%s_insert ON public.%I FOR INSERT TO authenticated '
      'WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format(
      'CREATE POLICY orbi_%s_update ON public.%I FOR UPDATE TO authenticated '
      'USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format(
      'CREATE POLICY orbi_%s_delete ON public.%I FOR DELETE TO authenticated '
      'USING (auth.uid() = user_id)', t, t);
  END LOOP;
END;
$$;

-- Nomes legados exatos (nao derivam do nome da tabela: "credit cards" com
-- espaco, e a de `people` ainda se chamava "family members" apos o rename).
-- `family_members` pode nao existir (renomeada para `people`): guardado.
SELECT public.orbi_exec_if_tables(
  ARRAY['public.accounts'],
  ARRAY[
    $cmd$DROP POLICY IF EXISTS "Users can manage their own accounts." ON public.accounts$cmd$
  ]);
SELECT public.orbi_exec_if_tables(
  ARRAY['public.credit_cards'],
  ARRAY[
    $cmd$DROP POLICY IF EXISTS "Users can manage their own credit cards." ON public.credit_cards$cmd$
  ]);
SELECT public.orbi_exec_if_tables(
  ARRAY['public.transactions'],
  ARRAY[
    $cmd$DROP POLICY IF EXISTS "Users can manage their own transactions." ON public.transactions$cmd$
  ]);
SELECT public.orbi_exec_if_tables(
  ARRAY['public.series'],
  ARRAY[
    $cmd$DROP POLICY IF EXISTS "Users can manage their own series." ON public.series$cmd$
  ]);
SELECT public.orbi_exec_if_tables(
  ARRAY['public.people'],
  ARRAY[
    $cmd$DROP POLICY IF EXISTS "Users can manage their own people." ON public.people$cmd$
  ]);
SELECT public.orbi_exec_if_tables(
  ARRAY['public.people'],
  ARRAY[
    $cmd$DROP POLICY IF EXISTS "Users can manage their own family members." ON public.people$cmd$
  ]);
SELECT public.orbi_exec_if_tables(
  ARRAY['public.family_members'],
  ARRAY[
    $cmd$DROP POLICY IF EXISTS "Users can manage their own family members." ON public.family_members$cmd$
  ]);

-- `user_learned_patterns`: a policy FOR ALL sem WITH CHECK convivia com uma
-- policy SELECT redundante. Reescrita explicita.
--
-- A tabela tinha policies de RLS mas NUNCA recebeu GRANT: o cliente levava
-- "permission denied for table user_learned_patterns" em toda leitura/escrita
-- (o classificador de extrato falhava silencioso no catch). Com o GRANT, o
-- isolamento continua sendo feito pela RLS, nao pela falta de privilegio.
SELECT public.orbi_exec_if_tables(
  ARRAY['public.user_learned_patterns'],
  ARRAY[
    $cmd$DROP POLICY IF EXISTS "Users can manage their own learned patterns" ON public.user_learned_patterns$cmd$,
    $cmd$DROP POLICY IF EXISTS "Users can view their own learned patterns" ON public.user_learned_patterns$cmd$,
    $cmd$DROP POLICY IF EXISTS orbi_ulp_select ON public.user_learned_patterns$cmd$,
    $cmd$CREATE POLICY orbi_ulp_select ON public.user_learned_patterns FOR SELECT TO authenticated USING (auth.uid() = user_id)$cmd$,
    $cmd$DROP POLICY IF EXISTS orbi_ulp_insert ON public.user_learned_patterns$cmd$,
    $cmd$CREATE POLICY orbi_ulp_insert ON public.user_learned_patterns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)$cmd$,
    $cmd$DROP POLICY IF EXISTS orbi_ulp_update ON public.user_learned_patterns$cmd$,
    $cmd$CREATE POLICY orbi_ulp_update ON public.user_learned_patterns FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)$cmd$,
    $cmd$DROP POLICY IF EXISTS orbi_ulp_delete ON public.user_learned_patterns$cmd$,
    $cmd$CREATE POLICY orbi_ulp_delete ON public.user_learned_patterns FOR DELETE TO authenticated USING (auth.uid() = user_id)$cmd$,
    $cmd$REVOKE ALL ON public.user_learned_patterns FROM anon$cmd$,
    $cmd$GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_learned_patterns TO authenticated$cmd$
  ]);

-- ============================================================================
-- 3. [B] user_usage — métrica de consumo vira somente-leitura para o cliente
-- ============================================================================

SELECT public.orbi_exec_if_tables(
  ARRAY['public.user_usage'],
  ARRAY[
    $cmd$REVOKE INSERT, UPDATE, DELETE ON public.user_usage FROM authenticated$cmd$,
    $cmd$REVOKE ALL ON public.user_usage FROM anon$cmd$,
    $cmd$GRANT SELECT ON public.user_usage TO authenticated$cmd$,
    $cmd$DROP POLICY IF EXISTS "Usuarios podem atualizar suas metricas de uso" ON public.user_usage$cmd$,
    $cmd$DROP POLICY IF EXISTS "Usuários podem atualizar suas métricas de uso" ON public.user_usage$cmd$,
    $cmd$DROP POLICY IF EXISTS "Usuários veem suas próprias métricas de uso" ON public.user_usage$cmd$,
    $cmd$DROP POLICY IF EXISTS orbi_user_usage_select ON public.user_usage$cmd$,
    $cmd$CREATE POLICY orbi_user_usage_select ON public.user_usage FOR SELECT TO authenticated USING (auth.uid() = user_id)$cmd$,
    $cmd$COMMENT ON TABLE public.user_usage IS 'Metricas de uso. ESCRITA EXCLUSIVA do backend (service_role/RPC): o cliente forjava consumo e burlava limite de plano.'$cmd$
  ]);

-- ============================================================================
-- 4. [F] audit_logs e merchants_dictionary — sem escrita pelo cliente
-- ============================================================================

SELECT public.orbi_exec_if_tables(
  ARRAY['public.audit_logs'],
  ARRAY[
    $cmd$REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated$cmd$,
    $cmd$REVOKE ALL ON public.audit_logs FROM anon$cmd$,
    $cmd$GRANT SELECT ON public.audit_logs TO authenticated$cmd$
  ]);

SELECT public.orbi_exec_if_tables(
  ARRAY['public.merchants_dictionary'],
  ARRAY[
    $cmd$REVOKE INSERT, UPDATE, DELETE ON public.merchants_dictionary FROM authenticated$cmd$,
    $cmd$REVOKE ALL ON public.merchants_dictionary FROM anon$cmd$,
    $cmd$GRANT SELECT ON public.merchants_dictionary TO authenticated$cmd$,
    $cmd$DROP POLICY IF EXISTS "Authenticated users can read merchants dictionary" ON public.merchants_dictionary$cmd$,
    $cmd$DROP POLICY IF EXISTS orbi_merchants_read ON public.merchants_dictionary$cmd$,
    $cmd$CREATE POLICY orbi_merchants_read ON public.merchants_dictionary FOR SELECT TO authenticated USING (true)$cmd$
  ]);

-- ============================================================================
-- 5. [C] user_profiles — colunas sensíveis imutáveis pelo cliente
-- ============================================================================

SELECT public.orbi_exec_if_tables(
  ARRAY['public.user_profiles'],
  ARRAY[
    $cmd$REVOKE DELETE ON public.user_profiles FROM authenticated$cmd$,
    $cmd$REVOKE ALL ON public.user_profiles FROM anon$cmd$,
    $cmd$GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated$cmd$,
    $cmd$DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.user_profiles$cmd$,
    $cmd$DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.user_profiles$cmd$,
    $cmd$DROP POLICY IF EXISTS "Usuários podem inserir seu próprio perfil" ON public.user_profiles$cmd$,
    $cmd$DROP POLICY IF EXISTS orbi_profiles_select ON public.user_profiles$cmd$,
    $cmd$CREATE POLICY orbi_profiles_select ON public.user_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id)$cmd$,
    $cmd$DROP POLICY IF EXISTS orbi_profiles_insert ON public.user_profiles$cmd$,
    $cmd$CREATE POLICY orbi_profiles_insert ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)$cmd$,
    $cmd$DROP POLICY IF EXISTS orbi_profiles_update ON public.user_profiles$cmd$,
    $cmd$CREATE POLICY orbi_profiles_update ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)$cmd$
  ]);

CREATE OR REPLACE FUNCTION public.guard_user_profile_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_end_user boolean := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', ''
  ) = 'authenticated';
BEGIN
  IF NOT v_is_end_user OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- O perfil nasce colado ao JWT; identificador de cobrança nunca vem do cliente.
    NEW.user_id           := auth.uid();
    NEW.email             := COALESCE(auth.jwt() ->> 'email', NEW.email);
    NEW.asaas_customer_id := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: colunas de identidade e de cobrança são congeladas.
  NEW.user_id           := OLD.user_id;
  NEW.email             := OLD.email;
  NEW.asaas_customer_id := OLD.asaas_customer_id;
  NEW.created_at        := OLD.created_at;
  NEW.updated_at        := NOW();

  RETURN NEW;
END;
$$;

SELECT public.orbi_exec_if_tables(
  ARRAY['public.user_profiles'],
  ARRAY[
    $cmd$DROP TRIGGER IF EXISTS guard_user_profiles_writes ON public.user_profiles$cmd$,
    $cmd$CREATE TRIGGER guard_user_profiles_writes BEFORE INSERT OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_user_profile_writes()$cmd$
  ]);

COMMENT ON FUNCTION public.guard_user_profile_writes() IS
  'Congela user_id/email/asaas_customer_id contra escrita do cliente (sequestro de customer no gateway e spoof de e-mail em convite de família).';

-- ============================================================================
-- 6. [D] Storage de logos — UPDATE/DELETE amarrados ao dono do objeto
-- ============================================================================

SELECT public.orbi_exec_if_tables(
  ARRAY['storage.objects'],
  ARRAY[
    $cmd$DROP POLICY IF EXISTS "Authenticated users can update company logos" ON storage.objects$cmd$,
    $cmd$DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects$cmd$,
    $cmd$DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects$cmd$,
    $cmd$DROP POLICY IF EXISTS "orbi_logos_insert_own" ON storage.objects$cmd$,
    $cmd$CREATE POLICY "orbi_logos_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('company-logos', 'logos') AND owner = auth.uid())$cmd$,
    $cmd$DROP POLICY IF EXISTS "orbi_logos_update_own" ON storage.objects$cmd$,
    $cmd$CREATE POLICY "orbi_logos_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('company-logos', 'logos') AND owner = auth.uid()) WITH CHECK (bucket_id IN ('company-logos', 'logos') AND owner = auth.uid())$cmd$,
    $cmd$DROP POLICY IF EXISTS "orbi_logos_delete_own" ON storage.objects$cmd$,
    $cmd$CREATE POLICY "orbi_logos_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('company-logos', 'logos') AND owner = auth.uid())$cmd$
  ]);

-- ============================================================================
-- 7. FECHAMENTO DE SUPERFÍCIE PARA `anon`
-- ============================================================================
-- O anônimo só precisa da vitrine de planos. Tudo mais é dado de tenant.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY public.orbi_tenant_tables() LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL OR t = 'subscription_plans' THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END;
$$;

SELECT public.orbi_exec_if_tables(
  ARRAY['public.subscription_plans'],
  ARRAY[
    $cmd$REVOKE INSERT, UPDATE, DELETE ON public.subscription_plans FROM anon$cmd$,
    $cmd$GRANT SELECT ON public.subscription_plans TO anon, authenticated$cmd$
  ]);

-- Contadores de rate limit: escrita so pela RPC (SECURITY DEFINER). O nome da
-- tabela mudou entre versoes (edge_rate_limits -> rate_limit_counters), por
-- isso as duas variantes sao tratadas e ambas sao opcionais.
SELECT public.orbi_exec_if_tables(
  ARRAY['public.edge_rate_limits'],
  ARRAY[
    $cmd$REVOKE ALL ON public.edge_rate_limits FROM anon, authenticated$cmd$
  ]);
SELECT public.orbi_exec_if_tables(
  ARRAY['public.rate_limit_counters'],
  ARRAY[
    $cmd$REVOKE ALL ON public.rate_limit_counters FROM anon, authenticated$cmd$
  ]);


-- ============================================================================
-- ============================================================================
--  PARTE 2/3 - VALIDACAO DE INPUT NA BORDA DO BANCO (CHECK CONSTRAINTS)
--  (origem: 20260910000001_input_validation_constraints.sql)
-- ============================================================================
-- ============================================================================
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


-- ============================================================================
-- ============================================================================
--  PARTE 3/3 - SANITIZACAO DE INPUT NAS RPCs DE BUSCA / APRENDIZADO
--  (origem: 20260910000002_search_rpc_input_sanitization.sql)
-- ============================================================================
-- ============================================================================
-- ============================================================================
-- SANITIZACAO DE INPUT NAS RPCs DE BUSCA / APRENDIZADO
-- ============================================================================
-- As RPCs do classificador (`search_merchant`, `search_merchant_compound_words`,
-- `search_banking_pattern`, `search_by_keywords`) recebem a descricao bruta da
-- transacao e a usam como PADRAO de LIKE:
--
--     WHERE lower(m.merchant_key) LIKE '%' || token || '%'
--
-- O parametro e passado de forma parametrizada (nao ha SQL injection classica),
-- mas o CONTEUDO do parametro vira sintaxe de padrao. Consequencias reais:
--
--   1. LIKE-pattern injection: descricao "%" casa com o dicionario inteiro e
--      a RPC devolve/classifica com base em lixo.
--   2. DoS: "%a%a%a%a%a%a%a%a%a%a%a%a%a%a%b" forca backtracking exponencial no
--      matcher de LIKE. Uma unica chamada trava um worker do Postgres; um laco
--      no cliente derruba a instancia — e o dicionario tem dezenas de milhares
--      de linhas.
--   3. Sem limite de tamanho: descricao de 1MB e tokenizada e cruzada contra
--      toda a tabela via trigram.
--   4. `p_limit` sem teto: `p_limit = 10000000` materializa a tabela inteira.
--   5. Nenhuma exigia autenticacao — `authenticated` tinha EXECUTE, mas nada
--      checava `auth.uid()` dentro da funcao.
--
-- Estrategia: nao reescrever o algoritmo (logica de negocio intacta). As
-- implementacoes originais sao renomeadas para `_impl`, perdem o EXECUTE de
-- `authenticated`, e passam a ser alcancadas apenas por um wrapper de mesmo
-- nome/assinatura que autentica, limita e higieniza a entrada.
-- ============================================================================


-- ============================================================================
-- 1. HIGIENIZADOR DE ENTRADA DE BUSCA
-- ============================================================================

CREATE OR REPLACE FUNCTION public.orbi_sanitize_search_text(
  p_value text,
  p_max int DEFAULT 200
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(
    btrim(
      regexp_replace(
        regexp_replace(
          -- 1) Neutraliza os metacaracteres de LIKE e o escape padrao.
          --    Viram espaco: preserva a tokenizacao por palavra do algoritmo.
          translate(left(COALESCE(p_value, ''), p_max), '%_\', '   '),
          -- 2) Remove caracteres de controle (NUL, ESC, CR/LF).
          '[[:cntrl:]]', ' ', 'g'
        ),
        -- 3) Colapsa espacos: evita explosao de tokens vazios.
        '[[:space:]]+', ' ', 'g'
      )
    ),
    ''
  );
$fn$;

COMMENT ON FUNCTION public.orbi_sanitize_search_text(text, int) IS
  'Higieniza texto que sera usado como padrao de LIKE: corta o tamanho, remove %/_/\\ (LIKE-pattern injection e backtracking exponencial) e caracteres de controle.';

CREATE OR REPLACE FUNCTION public.orbi_require_auth()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado' USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.orbi_sanitize_search_text(text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orbi_require_auth() TO authenticated, service_role;

-- ============================================================================
-- 2. RENOMEIA AS IMPLEMENTACOES E TRANCA O ACESSO DIRETO
-- ============================================================================

DO $blk$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'search_merchant',
        'search_merchant_compound_words',
        'search_banking_pattern',
        'search_by_keywords',
        'get_top_merchants'
      )
      -- Idempotencia: se o _impl ja existe, esta migration ja rodou e o que
      -- esta com o nome publico e o wrapper — nao renomear de novo.
      AND NOT EXISTS (
        SELECT 1 FROM pg_proc p2
        JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
        WHERE n2.nspname = 'public' AND p2.proname = p.proname || '_impl'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I',
                   f.proname, f.args, f.proname || '_impl');
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   f.proname || '_impl', f.args);
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
                   f.proname || '_impl', f.args);
    RAISE NOTICE 'implementacao isolada: public.%(%)', f.proname || '_impl', f.args;
  END LOOP;
END;
$blk$;

-- ============================================================================
-- 3. WRAPPERS PUBLICOS — autenticam, limitam e higienizam
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_merchant(
  p_description text,
  p_user_location text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  entity_name text,
  category text,
  subcategory text,
  confidence_modifier numeric,
  priority integer,
  match_score real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_desc text;
BEGIN
  PERFORM public.orbi_require_auth();

  v_desc := public.orbi_sanitize_search_text(p_description, 200);
  IF length(v_desc) < 2 THEN
    RETURN;  -- entrada inutil apos higienizacao: nao varre o dicionario
  END IF;

  RETURN QUERY
  SELECT * FROM public.search_merchant_impl(
    v_desc,
    NULLIF(public.orbi_sanitize_search_text(p_user_location, 60), ''),
    LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50)   -- teto de linhas
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.search_merchant_compound_words(
  p_description text,
  p_user_location text DEFAULT NULL,
  p_min_score real DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  entity_name text,
  category text,
  subcategory text,
  confidence_modifier numeric,
  priority integer,
  match_score real,
  matched_tokens text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_desc text;
BEGIN
  PERFORM public.orbi_require_auth();

  v_desc := public.orbi_sanitize_search_text(p_description, 200);
  IF length(v_desc) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.search_merchant_compound_words_impl(
    v_desc,
    NULLIF(public.orbi_sanitize_search_text(p_user_location, 60), ''),
    LEAST(GREATEST(COALESCE(p_min_score, 0.3), 0.0), 100.0)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.search_banking_pattern(
  p_description text,
  p_context text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  category text,
  subcategory text,
  confidence_modifier numeric,
  priority integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_desc text;
BEGIN
  PERFORM public.orbi_require_auth();

  v_desc := public.orbi_sanitize_search_text(p_description, 200);
  IF length(v_desc) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.search_banking_pattern_impl(
    v_desc,
    NULLIF(public.orbi_sanitize_search_text(p_context, 60), '')
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.search_by_keywords(
  p_description text,
  p_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  category text,
  subcategory text,
  confidence_modifier numeric,
  priority integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_desc text;
  v_type text;
BEGIN
  PERFORM public.orbi_require_auth();

  v_desc := public.orbi_sanitize_search_text(p_description, 200);
  IF length(v_desc) < 2 THEN
    RETURN;
  END IF;

  -- Whitelist: p_type alimenta comparacao de categoria, nao aceita texto livre.
  v_type := CASE WHEN p_type IN ('income', 'expense') THEN p_type ELSE NULL END;

  RETURN QUERY
  SELECT * FROM public.search_by_keywords_impl(v_desc, v_type);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_top_merchants(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  entity_name text,
  category text,
  subcategory text,
  aliases text[],
  confidence_modifier numeric,
  priority integer,
  entry_type text,
  usage_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  PERFORM public.orbi_require_auth();

  RETURN QUERY
  SELECT * FROM public.get_top_merchants_impl(
    LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)  -- antes: sem teto
  );
END;
$fn$;

-- ============================================================================
-- 4. update_user_learned_pattern — entrada limitada e categoria conferida
-- ============================================================================
-- A versao anterior gravava `p_description`/`p_category` sem qualquer limite
-- de tamanho e com `p_confidence` arbitrario (o cliente escolhia a confianca
-- do proprio padrao e sequestrava a classificacao futura).

CREATE OR REPLACE FUNCTION public.update_user_learned_pattern(
  p_description text,
  p_category text,
  p_subcategory text DEFAULT NULL,
  p_confidence numeric DEFAULT 85.00
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user_id    uuid := public.orbi_require_auth();
  v_desc       text;
  v_category   text;
  v_subcat     text;
  v_confidence numeric;
BEGIN
  v_desc := btrim(regexp_replace(left(COALESCE(p_description, ''), 300), '[[:cntrl:]]', ' ', 'g'));
  IF length(v_desc) < 2 THEN
    RAISE EXCEPTION 'Descricao invalida para aprendizado';
  END IF;

  v_category := btrim(regexp_replace(left(COALESCE(p_category, ''), 120), '[[:cntrl:]]', ' ', 'g'));
  IF length(v_category) < 1 THEN
    RAISE EXCEPTION 'Categoria obrigatoria';
  END IF;

  -- A categoria precisa existir para ESTE usuario (ou ser global de sistema);
  -- antes o cliente inventava qualquer string e poluia o proprio classificador.
  IF NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = v_category
      AND (c.user_id = v_user_id OR c.is_system = TRUE)
  ) THEN
    RAISE EXCEPTION 'Categoria nao pertence ao usuario' USING ERRCODE = '42501';
  END IF;

  v_subcat := NULLIF(
    btrim(regexp_replace(left(COALESCE(p_subcategory, ''), 120), '[[:cntrl:]]', ' ', 'g')),
    ''
  );

  -- Confianca e do servidor: o cliente so sugere, dentro de faixa.
  v_confidence := LEAST(GREATEST(COALESCE(p_confidence, 85.00), 50.00), 95.00);

  INSERT INTO public.user_learned_patterns (
    user_id, description, normalized_description, category, subcategory,
    confidence, usage_count, last_used_at
  ) VALUES (
    v_user_id, v_desc, lower(v_desc), v_category, v_subcat,
    v_confidence, 1, now()
  )
  ON CONFLICT (user_id, normalized_description)
  DO UPDATE SET
    category    = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    usage_count = user_learned_patterns.usage_count + 1,
    last_used_at = now(),
    confidence  = LEAST(
      user_learned_patterns.confidence + (user_learned_patterns.usage_count * 0.5),
      98.00
    );
END;
$fn$;

-- ============================================================================
-- 5. record_merchant_usage — contador global escrito pelo cliente
-- ============================================================================
-- Recebia um uuid arbitrario e incrementava o contador de qualquer merchant,
-- sem autenticacao. `usage_count` e o ranking que alimenta get_top_merchants:
-- era possivel empurrar um merchant escolhido para o topo do dicionario de
-- todos os tenants.

CREATE OR REPLACE FUNCTION public.record_merchant_usage(p_merchant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user_id uuid := public.orbi_require_auth();
  v_rl      jsonb;
BEGIN
  IF p_merchant_id IS NULL THEN
    RETURN;
  END IF;

  -- Rate limit por usuario: 600 incrementos/hora cobre uma importacao de
  -- extrato grande e barra o laco de envenenamento de ranking.
  BEGIN
    v_rl := public.consume_rate_limit(v_user_id, 'merchant-usage', 600, 3600);
  EXCEPTION WHEN OTHERS THEN
    v_rl := NULL;  -- contador indisponivel nao derruba a classificacao
  END;

  IF v_rl IS NOT NULL AND COALESCE((v_rl->>'allowed')::boolean, TRUE) = FALSE THEN
    RETURN;  -- silencioso: e telemetria, nao pode quebrar a classificacao
  END IF;

  UPDATE public.merchants_dictionary
  SET usage_count = COALESCE(usage_count, 0) + 1,
      updated_at  = NOW()
  WHERE id = p_merchant_id;
END;
$fn$;

-- ============================================================================
-- 6. PRIVILEGIOS — so os wrappers ficam expostos
-- ============================================================================

REVOKE ALL ON FUNCTION public.search_merchant(text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_merchant_compound_words(text, text, real) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_banking_pattern(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_by_keywords(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_top_merchants(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_user_learned_pattern(text, text, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_merchant_usage(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.search_merchant(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_merchant_compound_words(text, text, real) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_banking_pattern(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_by_keywords(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_merchants(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_learned_pattern(text, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_merchant_usage(uuid) TO authenticated;

-- Fecha a porta padrao do Postgres para funcoes futuras.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ============================================================================
--  RECARREGA O SCHEMA CACHE DO POSTGREST
-- ============================================================================
-- Sem isso as RPCs recriadas podem responder 404 por alguns minutos.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
--  RELATORIO DE VERIFICACAO  (resultado da execucao)
-- ============================================================================
-- Toda linha deve terminar em "OK". Qualquer "FALHOU" indica que aquele item
-- nao foi aplicado - nesse caso nao considere o hardening concluido.

WITH checks AS (
  SELECT 1 AS ord, 'FORCE ROW LEVEL SECURITY em todas as tabelas de public' AS item,
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity)::text AS valor,
         NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                     WHERE n.nspname = 'public' AND c.relkind = 'r'
                       AND NOT c.relforcerowsecurity) AS ok

  UNION ALL SELECT 2, 'Tabelas de public SEM RLS (deve ser 0)',
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity)::text,
         NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                     WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity)

  UNION ALL SELECT 3, 'CHECK constraints orbi_* criadas',
         (SELECT count(*) FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND con.contype = 'c' AND con.conname LIKE 'orbi=_%' ESCAPE '=')::text,
         (SELECT count(*) FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND con.contype = 'c' AND con.conname LIKE 'orbi=_%' ESCAPE '=') >= 30

  UNION ALL SELECT 4, 'user_usage sem INSERT/UPDATE/DELETE para authenticated',
         COALESCE((SELECT string_agg(DISTINCT privilege_type, ',')
                   FROM information_schema.role_table_grants
                   WHERE table_schema = 'public' AND table_name = 'user_usage'
                     AND grantee = 'authenticated'), '(nenhum)'),
         to_regclass('public.user_usage') IS NULL
         OR NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                        WHERE table_schema = 'public' AND table_name = 'user_usage'
                          AND grantee = 'authenticated'
                          AND privilege_type IN ('INSERT','UPDATE','DELETE'))

  UNION ALL SELECT 5, 'Trigger que congela user_profiles (asaas_customer_id/email)',
         (SELECT count(*)::text FROM pg_trigger
          WHERE tgrelid = 'public.user_profiles'::regclass
            AND tgname = 'guard_user_profiles_writes'),
         EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = 'public.user_profiles'::regclass
                   AND tgname = 'guard_user_profiles_writes')

  UNION ALL SELECT 6, 'RPCs de busca isoladas atras de wrapper (_impl)',
         (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname LIKE '%=_impl' ESCAPE '='),
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname LIKE '%=_impl' ESCAPE '=') = 5

  UNION ALL SELECT 7, 'Nenhuma _impl executavel por authenticated/anon/PUBLIC',
         'revogado',
         NOT EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname LIKE '%=_impl' ESCAPE '='
             AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
               OR has_function_privilege('anon', p.oid, 'EXECUTE')))

  UNION ALL SELECT 8, 'Toda funcao SECURITY DEFINER com search_path fixo',
         (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.prosecdef
            AND (p.proconfig IS NULL OR NOT EXISTS (
                  SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))),
         NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public' AND p.prosecdef
                       AND (p.proconfig IS NULL OR NOT EXISTS (
                             SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')))

  UNION ALL SELECT 9, 'Higienizador de padrao LIKE responde ("%" -> vazio)',
         '[' || public.orbi_sanitize_search_text('%a%b%c') || ']',
         public.orbi_sanitize_search_text('%') = ''
           AND public.orbi_sanitize_search_text('compra ifood') = 'compra ifood'

  UNION ALL SELECT 10, 'user_learned_patterns com GRANT (classificador volta a gravar)',
         CASE WHEN to_regclass('public.user_learned_patterns') IS NULL THEN 'N/A (tabela ausente)'
              ELSE COALESCE((SELECT string_agg(DISTINCT privilege_type, ',')
                             FROM information_schema.role_table_grants
                             WHERE table_schema = 'public' AND table_name = 'user_learned_patterns'
                               AND grantee = 'authenticated'), '(nenhum)') END,
         to_regclass('public.user_learned_patterns') IS NULL
         OR EXISTS (SELECT 1 FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'user_learned_patterns'
                      AND grantee = 'authenticated' AND privilege_type = 'INSERT')
)
SELECT
  CASE WHEN ok THEN 'OK' ELSE 'FALHOU' END AS status,
  item,
  valor
FROM checks
ORDER BY ord;
