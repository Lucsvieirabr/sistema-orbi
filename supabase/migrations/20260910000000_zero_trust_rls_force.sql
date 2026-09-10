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

BEGIN;

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
-- 8. SEARCH_PATH FIXO EM TODA FUNCAO SECURITY DEFINER DE `public`
-- ============================================================================
-- Uma funcao SECURITY DEFINER roda com os privilegios do DONO. Sem
-- `SET search_path`, quem chama controla como os nomes nao qualificados sao
-- resolvidos: basta criar um objeto homonimo num schema que apareca antes de
-- `public` no search_path da sessao para a funcao privilegiada executar codigo
-- do atacante (search_path hijacking, CWE-426).
--
-- Este bloco tambem existe em 20260909000000_security_rpc_tenant_isolation.sql,
-- e repetido aqui de proposito: bancos que ainda nao aplicaram aquela migration
-- ficariam sem a protecao, e o script precisa ser autossuficiente.
--
-- Robustez: funcoes que pertencem a uma EXTENSAO sao puladas (nao sao nossas,
-- e ALTER nelas quebra o `pg_dump`/upgrade da extensao), e uma falha de ALTER
-- numa funcao isolada (ex.: pertence a outro owner) vira NOTICE em vez de
-- abortar o script inteiro.

DO $secdef$
DECLARE
  fn        RECORD;
  v_fixed   int := 0;
  v_skipped text[] := ARRAY[]::text[];
BEGIN
  FOR fn IN
    SELECT p.oid,
           n.nspname AS schema_name,
           p.proname AS fn_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = TRUE
      -- ainda sem search_path fixado
      AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
          ))
      -- nao mexer em funcao que pertence a uma extensao
      AND NOT EXISTS (
            SELECT 1 FROM pg_depend d
            WHERE d.objid = p.oid
              AND d.classid = 'pg_proc'::regclass
              AND d.deptype = 'e'
          )
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
        fn.schema_name, fn.fn_name, fn.args
      );
      v_fixed := v_fixed + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Ex.: funcao de outro owner. Registrar e seguir.
      v_skipped := v_skipped || format('%s(%s): %s', fn.fn_name, fn.args, SQLERRM);
    END;
  END LOOP;

  RAISE NOTICE 'search_path fixado em % funcao(oes) SECURITY DEFINER', v_fixed;

  IF array_length(v_skipped, 1) > 0 THEN
    RAISE WARNING 'NAO foi possivel fixar search_path em: %', array_to_string(v_skipped, ' | ');
  END IF;
END;
$secdef$;

-- ============================================================================
-- 9. FECHAMENTO DE SUPERFÍCIE PARA `anon`
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

COMMIT;
