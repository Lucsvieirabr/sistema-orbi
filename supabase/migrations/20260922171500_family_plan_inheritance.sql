-- ============================================================================
-- PLANO CASAL — HERANÇA DE PLANO + GATE DE LEITURA + CLAIM SEGURO
-- ============================================================================
-- Achados que este arquivo corrige:
--
--  [A] O convidado vinculado NÃO herdava o plano do dono. `get_my_subscription_status`,
--      `orbi_active_plan_features/limits` (triggers de cota, `orbi_has_feature`,
--      `orbi_require_feature`) e `orbi_quota_snapshot` só olhavam a assinatura
--      do próprio `auth.uid()`. Efeito: parceiro sem assinatura própria caía
--      em `no_plan` → /pricing, e as policies premium (`orbi_has_feature`)
--      escondiam Orçamentos/Metas/Fechamento mesmo com o dono no Casal.
--      Correção: `orbi_effective_plan_owner(uid)` resolve de quem é o plano
--      que vale (dono do grupo, se ele ainda tiver `familia_compartilhada`),
--      e todas as leituras de plano passam por ele.
--
--  [B] `orbi_family_user_ids` continuava liberando a leitura cruzada depois
--      de um downgrade do dono (Casal → Pro/Free). Agora exige que o dono do
--      grupo ainda tenha `familia_compartilhada` no plano vigente.
--
--  [C] `orbi_my_family_group_id` usava `UNION ... LIMIT 1` sem ORDER BY:
--      com mais de um registro (dono de um grupo e membro de outro, ou
--      vínculo duplicado), o grupo devolvido era arbitrário. Agora é
--      determinístico: o registro mais antigo (`created_at ASC`).
--
--  [D] `orbi_claim_family_invites` vinculava pelo e-mail do JWT sem exigir
--      e-mail confirmado: quem cadastrasse o e-mail de outra pessoa (sem
--      conseguir confirmá-lo) herdava leitura do casal e o plano do dono.
--      Agora o vínculo só acontece com `auth.users.email_confirmed_at IS NOT NULL`,
--      usando o e-mail do próprio `auth.users` (não o claim do token).
--      O auto-vínculo do trigger de convite (`check_family_members_limit`)
--      recebe a mesma regra, e vínculos já feitos com e-mail não confirmado
--      são desfeitos (o convite volta a ficar pendente).
--
-- Nenhuma tabela nova. Idempotente (CREATE OR REPLACE).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. HELPERS INTERNOS (sem EXECUTE para o cliente)
-- ============================================================================

-- Plano vigente da PRÓPRIA assinatura do usuário (sem herança).
-- NULL = sem assinatura trial/active válida. Base de todas as leituras abaixo;
-- existe para a resolução de herança não entrar em recursão.
CREATE OR REPLACE FUNCTION public.orbi_own_active_plan(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
           'features', COALESCE(sp.features, '{}'::jsonb),
           'limits',   COALESCE(sp.limits,   '{}'::jsonb)
         )
    FROM public.user_subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
   WHERE s.user_id = p_user_id
     AND s.status IN ('trial', 'active')
     AND NOT (
       COALESCE(s.cancel_at_period_end, false)
       AND s.current_period_end IS NOT NULL
       AND s.current_period_end < NOW()
     )
   ORDER BY s.created_at DESC
   LIMIT 1;
$$;

-- true se o dono tem `familia_compartilhada` no PRÓPRIO plano vigente.
CREATE OR REPLACE FUNCTION public.orbi_owner_shares_family(p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    public.orbi_own_active_plan(p_owner_id) -> 'features' ->> 'familia_compartilhada',
    'false'
  ) = 'true';
$$;

-- Grupo do usuário (dono ou membro vinculado). Determinístico: o mais antigo.
CREATE OR REPLACE FUNCTION public.orbi_family_group_of(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.gid
    FROM (
      SELECT fg.id AS gid, fg.created_at
        FROM public.family_groups fg
       WHERE fg.owner_id = p_user_id
      UNION ALL
      SELECT m.family_group_id, m.created_at
        FROM public.family_group_members m
       WHERE m.user_id = p_user_id
    ) s
   WHERE p_user_id IS NOT NULL
   ORDER BY s.created_at ASC, s.gid ASC
   LIMIT 1;
$$;

-- ============================================================================
-- 2. [A] DONO EFETIVO DO PLANO
-- ============================================================================
-- Membro vinculado + dono com `familia_compartilhada` ativa → id do dono.
-- Qualquer outro caso (sem grupo, é o próprio dono, dono em downgrade) → uid.
CREATE OR REPLACE FUNCTION public.orbi_effective_plan_owner(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT fg.owner_id
        FROM public.family_groups fg
       WHERE fg.id = public.orbi_family_group_of(p_user_id)
         AND fg.owner_id <> p_user_id
         AND EXISTS (
               SELECT 1
                 FROM public.family_group_members m
                WHERE m.family_group_id = fg.id
                  AND m.user_id = p_user_id
             )
         AND public.orbi_owner_shares_family(fg.owner_id)
    ),
    p_user_id
  );
$$;

COMMENT ON FUNCTION public.orbi_effective_plan_owner(uuid) IS
  'INTERNA: id cujo plano vale para o usuário. Membro vinculado do Plano Casal herda o plano do dono enquanto o dono tiver familia_compartilhada; senão, o próprio uid.';

-- ============================================================================
-- 3. [A] PLANO VIGENTE (triggers de cota, orbi_has_feature, orbi_require_feature)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.orbi_active_plan_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.orbi_own_active_plan(public.orbi_effective_plan_owner(p_user_id)) -> 'limits';
$$;

CREATE OR REPLACE FUNCTION public.orbi_active_plan_features(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.orbi_own_active_plan(public.orbi_effective_plan_owner(p_user_id)) -> 'features';
$$;

-- ============================================================================
-- 4. [A] RPC AUTORITATIVA DE STATUS
-- ============================================================================
-- Herdado: consulta a assinatura do dono. Se o acesso herdado não estiver
-- liberado (dono atrasado/expirado), cai para a assinatura do próprio
-- usuário — o parceiro não é mandado para /billing de uma cobrança que não é
-- dele. Dados de cobrança do dono (ids, vencimento, motivo de bloqueio)
-- nunca saem para o parceiro.
CREATE OR REPLACE FUNCTION public.get_my_subscription_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_plan_user   uuid;
  v_inherited   boolean;
  v_found       boolean;
  v_sub         record;
  v_effective   text;
  v_now         timestamptz := NOW();
  v_grace       timestamptz;
  v_default_gap interval := INTERVAL '5 days';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('access', 'unauthenticated', 'status', NULL, 'has_subscription', false);
  END IF;

  v_plan_user := public.orbi_effective_plan_owner(v_user_id);
  v_inherited := v_plan_user IS DISTINCT FROM v_user_id;

  <<resolve>>
  LOOP
    SELECT us.*, sp.slug AS plan_slug, sp.name AS plan_name,
           sp.features, sp.limits, sp.price_monthly, sp.price_yearly
      INTO v_sub
      FROM public.user_subscriptions us
      JOIN public.subscription_plans sp ON sp.id = us.plan_id
     WHERE us.user_id = v_plan_user
       AND us.status <> 'canceled'
       AND NOT (
         COALESCE(us.cancel_at_period_end, false)
         AND us.status IN ('active', 'trial')
         AND us.current_period_end IS NOT NULL
         AND us.current_period_end < v_now
       )
     ORDER BY
       CASE us.status
         WHEN 'active'   THEN 1
         WHEN 'trial'    THEN 2
         WHEN 'past_due' THEN 3
         WHEN 'pending'  THEN 4
         ELSE 5
       END,
       us.created_at DESC
     LIMIT 1;

    v_found := FOUND;
    v_effective := NULL;

    IF v_found THEN
      v_effective := v_sub.status;
      v_grace := COALESCE(v_sub.grace_period_end, v_sub.current_period_end + v_default_gap);

      IF v_effective IN ('active', 'trial')
         AND v_sub.current_period_end IS NOT NULL
         AND v_sub.current_period_end < v_now
      THEN
        v_effective := CASE WHEN v_grace >= v_now THEN 'past_due_grace' ELSE 'expired' END;
      END IF;

      IF v_effective = 'past_due'
         AND v_sub.grace_period_end IS NOT NULL
         AND v_sub.grace_period_end >= v_now
      THEN
        v_effective := 'past_due_grace';
      END IF;
    END IF;

    EXIT resolve WHEN NOT v_inherited
                   OR (v_found AND v_effective IN ('active', 'trial', 'past_due_grace'));

    -- Herança sem acesso liberado: reavalia com a assinatura própria.
    v_plan_user := v_user_id;
    v_inherited := false;
  END LOOP;

  IF NOT v_found THEN
    RETURN jsonb_build_object('access', 'no_plan', 'status', NULL, 'has_subscription', false, 'inherited', false);
  END IF;

  RETURN jsonb_build_object(
    'access', CASE
      WHEN v_effective IN ('active', 'trial', 'past_due_grace') THEN 'allowed'
      WHEN v_effective IN ('past_due', 'expired') THEN 'blocked'
      WHEN v_effective = 'pending' THEN 'pending_payment'
      ELSE 'no_plan'
    END,
    'has_subscription', true,
    'inherited', v_inherited,
    'subscription_id', CASE WHEN v_inherited THEN NULL ELSE v_sub.id END,
    'status', v_effective,
    'raw_status', v_sub.status,
    'plan_id', v_sub.plan_id,
    'plan_slug', v_sub.plan_slug,
    'plan_name', v_sub.plan_name,
    'billing_cycle', v_sub.billing_cycle,
    'features', COALESCE(v_sub.features, '{}'::jsonb),
    'limits', COALESCE(v_sub.limits, '{}'::jsonb),
    'current_period_end', v_sub.current_period_end,
    'grace_period_end', CASE WHEN v_inherited THEN NULL ELSE v_sub.grace_period_end END,
    'next_due_date', CASE WHEN v_inherited THEN NULL ELSE v_sub.next_due_date END,
    'trial_end', v_sub.trial_end,
    'blocked_reason', CASE WHEN v_inherited THEN NULL ELSE v_sub.blocked_reason END,
    'cancel_at_period_end', COALESCE(v_sub.cancel_at_period_end, false)
  );
END;
$$;

COMMENT ON FUNCTION public.get_my_subscription_status() IS
  'Fonte da verdade do status de assinatura. Membro do Plano Casal herda o plano do dono (inherited=true, sem dados de cobrança do dono). Carência de 5 dias; cancelamento agendado encerra em current_period_end (no_plan).';

-- ============================================================================
-- 5. [A] SNAPSHOT DE COTA (UX) — mesmo plano efetivo dos triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.orbi_quota_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user       uuid := auth.uid();
  v_plan_user  uuid;
  v_plan       record;
  v_month      date := DATE_TRUNC('month', NOW())::date;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  v_plan_user := public.orbi_effective_plan_owner(v_user);

  SELECT sp.slug, sp.name, sp.limits, sp.features, s.status
    INTO v_plan
    FROM public.user_subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
   WHERE s.user_id = v_plan_user
     AND s.status IN ('trial', 'active')
     AND NOT (
       COALESCE(s.cancel_at_period_end, false)
       AND s.current_period_end IS NOT NULL
       AND s.current_period_end < NOW()
     )
   ORDER BY s.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_subscription', false);
  END IF;

  -- Uso é SEMPRE do próprio usuário: a cota herdada vale por pessoa,
  -- exatamente como os triggers BEFORE INSERT contam.
  RETURN jsonb_build_object(
    'has_subscription', true,
    'inherited', v_plan_user IS DISTINCT FROM v_user,
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

-- ============================================================================
-- 6. [C] GRUPO DO USUÁRIO — determinístico
-- ============================================================================
CREATE OR REPLACE FUNCTION public.orbi_my_family_group_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.gid
    FROM (
      SELECT fg.id AS gid, fg.created_at
        FROM public.family_groups fg
       WHERE fg.owner_id = auth.uid()
      UNION ALL
      SELECT m.family_group_id, m.created_at
        FROM public.family_group_members m
       WHERE m.user_id = auth.uid()
    ) s
   ORDER BY s.created_at ASC, s.gid ASC
   LIMIT 1;
$$;

-- ============================================================================
-- 7. [B] LEITURA COMPARTILHADA — só com o dono ainda no Casal
-- ============================================================================
CREATE OR REPLACE FUNCTION public.orbi_family_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH grp AS (
    SELECT fg.id, fg.owner_id
      FROM public.family_groups fg
     WHERE fg.id = public.orbi_my_family_group_id()
       AND public.orbi_owner_shares_family(fg.owner_id)
  )
  SELECT COALESCE(
    (
      SELECT array_agg(DISTINCT t.uid)
        FROM (
          SELECT g.owner_id AS uid FROM grp g
          UNION
          SELECT m.user_id
            FROM public.family_group_members m
            JOIN grp g ON g.id = m.family_group_id
           WHERE m.user_id IS NOT NULL
          UNION
          SELECT auth.uid()
        ) t
       WHERE t.uid IS NOT NULL
    ),
    ARRAY[auth.uid()]
  );
$$;

-- ============================================================================
-- 8. [D] CLAIM DE CONVITE — só com e-mail confirmado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.orbi_claim_family_invites()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  -- E-mail e confirmação vêm de auth.users, não do claim do JWT.
  SELECT lower(btrim(u.email)), u.email_confirmed_at
    INTO v_email, v_confirmed
    FROM auth.users u
   WHERE u.id = v_uid;

  IF v_email IS NULL OR v_email = '' OR v_confirmed IS NULL THEN
    RETURN;
  END IF;

  -- Já vinculado a algum grupo: não acumula vínculos.
  IF EXISTS (SELECT 1 FROM public.family_group_members x WHERE x.user_id = v_uid) THEN
    RETURN;
  END IF;

  UPDATE public.family_group_members m
     SET user_id = v_uid
   WHERE m.id = (
     SELECT m2.id
       FROM public.family_group_members m2
       JOIN public.family_groups fg ON fg.id = m2.family_group_id
      WHERE m2.user_id IS NULL
        AND lower(btrim(m2.email)) = v_email
        AND fg.owner_id <> v_uid
      ORDER BY m2.created_at ASC, m2.id ASC
      LIMIT 1
   );
END;
$$;

-- Trigger de convite: mesma regra de e-mail confirmado no auto-vínculo.
-- Resto idêntico à versão vigente (20260910120001).
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

  -- Plano PRÓPRIO do dono: um membro herdado não abre grupo com o plano alheio.
  v_features := public.orbi_own_active_plan(v_owner_id) -> 'features';
  v_limits   := public.orbi_own_active_plan(v_owner_id) -> 'limits';

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

  -- Vínculo imediato só para conta com e-mail confirmado e ainda sem grupo.
  -- O cliente nunca define user_id: o convite nasce pendente.
  NEW.user_id := NULL;
  SELECT u.id INTO NEW.user_id
    FROM auth.users u
   WHERE lower(u.email) = NEW.email
     AND u.email_confirmed_at IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.family_group_members x WHERE x.user_id = u.id)
   LIMIT 1;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 9. [D] REMEDIAÇÃO — vínculos feitos com e-mail não confirmado
-- ============================================================================
UPDATE public.family_group_members m
   SET user_id = NULL
  FROM auth.users u
 WHERE u.id = m.user_id
   AND u.email_confirmed_at IS NULL;

-- ============================================================================
-- 10. AUTORIA NO MODO CASAL — diretório mínimo do grupo
-- ============================================================================
-- O extrato do modo Casal precisa dizer QUEM lançou cada linha. `user_profiles`
-- não é legível entre parceiros (e não deve ser: tem e-mail e ids de gateway).
-- Esta RPC devolve só o primeiro nome de quem já está em orbi_family_user_ids()
-- — mesmo gate de leitura compartilhada (downgrade do dono = só o próprio).
CREATE OR REPLACE FUNCTION public.orbi_family_directory()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id', ids.uid,
        'is_self', ids.uid = auth.uid(),
        'name', NULLIF(
                  left(
                    split_part(
                      btrim(COALESCE(
                        NULLIF(btrim(p.full_name), ''),
                        NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                        ''
                      )),
                      ' ', 1
                    ),
                    40
                  ),
                  ''
                )
      )
      ORDER BY (ids.uid = auth.uid()) DESC, ids.uid
    ),
    '[]'::jsonb
  )
  FROM unnest(public.orbi_family_user_ids()) AS ids(uid)
  LEFT JOIN LATERAL (
    SELECT up.full_name
      FROM public.user_profiles up
     WHERE up.user_id = ids.uid
     LIMIT 1
  ) p ON true
  LEFT JOIN auth.users u ON u.id = ids.uid
  WHERE auth.uid() IS NOT NULL
    AND ids.uid IS NOT NULL;
$$;

COMMENT ON FUNCTION public.orbi_family_directory() IS
  'Plano Casal: [{user_id, is_self, name}] do grupo visível (orbi_family_user_ids). Só o primeiro nome — usado no selo de autoria das transações.';

-- ============================================================================
-- 11. GRANTS
-- ============================================================================
-- Internas (aceitam uid arbitrário = IDOR se expostas): só rodam dentro de
-- outras funções SECURITY DEFINER / policies avaliadas como owner.
REVOKE EXECUTE ON FUNCTION public.orbi_own_active_plan(uuid)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_owner_shares_family(uuid)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_family_group_of(uuid)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_effective_plan_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_active_plan_features(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_active_plan_limits(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_family_members_limit()    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.orbi_own_active_plan(uuid)      TO service_role;
GRANT EXECUTE ON FUNCTION public.orbi_owner_shares_family(uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.orbi_family_group_of(uuid)      TO service_role;
GRANT EXECUTE ON FUNCTION public.orbi_effective_plan_owner(uuid) TO service_role;

-- Públicas para o usuário logado (dependem de auth.uid(), sem parâmetro de identidade).
REVOKE EXECUTE ON FUNCTION public.get_my_subscription_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.orbi_quota_snapshot()        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.orbi_my_family_group_id()    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.orbi_family_user_ids()       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.orbi_claim_family_invites()  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.orbi_family_directory()      FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_subscription_status() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orbi_quota_snapshot()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_my_family_group_id()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_family_user_ids()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_claim_family_invites()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_family_directory()      TO authenticated;

COMMENT ON FUNCTION public.orbi_family_user_ids() IS
  'user_ids do grupo (dono + membros vinculados) enquanto o dono tiver familia_compartilhada; senão só o próprio usuário.';
COMMENT ON FUNCTION public.orbi_claim_family_invites() IS
  'Vincula o convite pendente mais antigo ao usuário atual. Exige e-mail confirmado em auth.users; 1 grupo por pessoa.';

COMMIT;

NOTIFY pgrst, 'reload schema';
