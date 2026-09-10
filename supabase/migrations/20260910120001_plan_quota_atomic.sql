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

BEGIN;

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

COMMIT;
