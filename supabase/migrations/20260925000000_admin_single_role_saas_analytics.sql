-- =============================================================================
-- Admin: papel único, analytics de SaaS e painel de auditoria (LGPD)
-- -----------------------------------------------------------------------------
-- 1. Um só papel: `admin`. Some `super_admin` (e o is_super_admin() que travava
--    a tela de administradores com P0001).
-- 2. Nada de exclusão pelo painel: admin não apaga conta, assinatura, plano nem
--    administrador. Pode desativar, bloquear temporariamente e dar suporte.
-- 3. RPCs de leitura passam a escolher a assinatura VIGENTE do usuário
--    (ativa > pendente > encerrada, depois a mais recente) — antes vinha a mais
--    recente, que muitas vezes era uma cancelada.
-- 4. admin_dashboard_metrics(): MRR, churn, pagantes, ativos, por plano.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Papel único
-- ---------------------------------------------------------------------------
UPDATE public.admin_users SET role = 'admin' WHERE role IS DISTINCT FROM 'admin';

ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS valid_admin_role;
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users ALTER COLUMN role SET DEFAULT 'admin';
ALTER TABLE public.admin_users
  ADD CONSTRAINT valid_admin_role CHECK (role = 'admin');

DROP POLICY IF EXISTS "Super admins podem criar admins"     ON public.admin_users;
DROP POLICY IF EXISTS "Super admins podem atualizar admins" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins podem deletar admins"   ON public.admin_users;
DROP POLICY IF EXISTS "Admins veem administradores"         ON public.admin_users;

-- Leitura para qualquer admin ativo. Escrita só pelas RPCs (SECURITY DEFINER).
CREATE POLICY "Admins veem administradores" ON public.admin_users
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Funções que dependiam da hierarquia.
DROP FUNCTION IF EXISTS public.admin_delete_admin(uuid);
DROP FUNCTION IF EXISTS public.admin_cancel_subscription(uuid);
DROP FUNCTION IF EXISTS public.admin_list_admins();
DROP FUNCTION IF EXISTS public.admin_list_users();
DROP FUNCTION IF EXISTS public.admin_list_subscriptions();
DROP FUNCTION IF EXISTS public.admin_get_user_details(uuid);
DROP FUNCTION IF EXISTS public.is_super_admin();

-- ---------------------------------------------------------------------------
-- 2. Integridade: plano nunca leva assinaturas junto
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_id_fkey;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE RESTRICT;

DROP POLICY IF EXISTS "Admins podem deletar planos de assinatura" ON public.subscription_plans;

-- ---------------------------------------------------------------------------
-- 3. Helpers internos (não expostos ao cliente)
-- ---------------------------------------------------------------------------

-- Assinatura vigente de cada usuário.
CREATE OR REPLACE FUNCTION public.orbi_admin_current_subscriptions()
RETURNS TABLE (
  user_id uuid,
  subscription_id uuid,
  plan_id uuid,
  status text,
  billing_cycle text,
  current_period_end timestamptz,
  next_due_date date,
  cancel_at_period_end boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (us.user_id)
    us.user_id, us.id, us.plan_id, us.status, us.billing_cycle,
    us.current_period_end, us.next_due_date, COALESCE(us.cancel_at_period_end, false)
  FROM public.user_subscriptions us
  ORDER BY us.user_id,
    CASE WHEN us.status IN ('active', 'trial', 'past_due') THEN 0
         WHEN us.status = 'pending' THEN 1
         ELSE 2 END,
    us.created_at DESC;
$$;

-- Quem estava pagando num instante (reconstrução aproximada pelo histórico).
CREATE OR REPLACE FUNCTION public.orbi_admin_paying_at(p_at timestamptz)
RETURNS TABLE (user_id uuid, plan_id uuid, mrr numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (us.user_id)
    us.user_id,
    us.plan_id,
    ROUND(CASE WHEN us.billing_cycle = 'yearly'
               THEN COALESCE(sp.price_yearly, 0) / 12
               ELSE COALESCE(sp.price_monthly, 0) END, 2)
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.created_at <= p_at
    AND GREATEST(COALESCE(sp.price_monthly, 0), COALESCE(sp.price_yearly, 0)) > 0
    AND (us.current_period_end IS NULL OR us.current_period_end > p_at)
    AND (
      us.status IN ('active', 'past_due')
      OR (us.status IN ('canceled', 'expired')
          AND us.updated_at > p_at
          AND us.last_payment_at IS NOT NULL)
    )
  ORDER BY us.user_id, us.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.orbi_admin_current_subscriptions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orbi_admin_paying_at(timestamptz) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Administradores
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT au.user_id, COALESCE(up.email, u.email)::text, up.full_name,
         COALESCE(au.is_active, false), au.created_at, u.last_sign_in_at
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.user_id
  LEFT JOIN public.user_profiles up ON up.user_id = au.user_id
  ORDER BY au.is_active DESC, au.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_admin(p_user_id uuid, p_is_active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  IF NOT p_is_active AND p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode desativar o próprio acesso' USING ERRCODE = 'P0001';
  END IF;

  IF NOT p_is_active AND (
    SELECT count(*) FROM public.admin_users WHERE is_active AND user_id <> p_user_id
  ) = 0 THEN
    RAISE EXCEPTION 'O painel precisa de pelo menos um administrador ativo' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.admin_users
     SET is_active = p_is_active, updated_at = now()
   WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Administrador não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (auth.uid(), CASE WHEN p_is_active THEN 'admin_activate' ELSE 'admin_deactivate' END,
          'admin_user', p_user_id, jsonb_build_object('is_active', p_is_active));
END;
$$;

-- Promove conta existente ou cria uma nova. Sempre `admin`.
CREATE OR REPLACE FUNCTION public.admin_create_admin_user(p_email text, p_password text, p_full_name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_name    text := btrim(coalesce(p_full_name, ''));
  v_user_id uuid;
  v_created boolean := false;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = '22023';
  END IF;
  IF length(v_name) < 1 OR NOT public.orbi_is_safe_text(v_name, 120) THEN
    RAISE EXCEPTION 'Nome inválido' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  IF v_user_id IS NULL THEN
    IF p_password IS NULL OR length(p_password) < 12 OR length(p_password) > 72
       OR p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' THEN
      RAISE EXCEPTION 'Senha deve ter de 12 a 72 caracteres, com letras e números' USING ERRCODE = '22023';
    END IF;

    v_user_id := gen_random_uuid();
    v_created := true;

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_email, crypt(p_password, gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name), false, '', '', '', ''
    );

    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (v_user_id::text, v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
            'email', now(), now(), now());
  END IF;

  -- O trigger on_auth_user_created já criou o perfil; só completa.
  INSERT INTO public.user_profiles (user_id, email, full_name, onboarding_completed)
  VALUES (v_user_id, v_email, v_name, true)
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = COALESCE(NULLIF(public.user_profiles.full_name, ''), EXCLUDED.full_name);

  INSERT INTO public.admin_users (user_id, role, is_active)
  VALUES (v_user_id, 'admin', true)
  ON CONFLICT (user_id) DO UPDATE SET is_active = true, role = 'admin', updated_at = now();

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (auth.uid(), CASE WHEN v_created THEN 'admin_create' ELSE 'admin_promote' END,
          'admin_user', v_user_id, jsonb_build_object('email', v_email));

  RETURN jsonb_build_object('user_id', v_user_id, 'created', v_created);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Usuários
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  blocked_until timestamptz,
  is_admin boolean,
  plan_name text,
  plan_slug text,
  subscription_status text,
  billing_cycle text,
  period_end timestamptz,
  cancel_at_period_end boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    up.user_id,
    COALESCE(up.email, u.email)::text,
    up.full_name,
    up.created_at,
    u.last_sign_in_at,
    CASE WHEN u.banned_until > now() THEN u.banned_until END,
    EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = up.user_id AND a.is_active),
    sp.name,
    sp.slug,
    cs.status,
    cs.billing_cycle,
    COALESCE(cs.current_period_end, cs.next_due_date::timestamptz),
    cs.cancel_at_period_end
  FROM public.user_profiles up
  JOIN auth.users u ON u.id = up.user_id
  LEFT JOIN public.orbi_admin_current_subscriptions() cs ON cs.user_id = up.user_id
  LEFT JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  ORDER BY up.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'user_id',         up.user_id,
    'email',           COALESCE(up.email, u.email),
    'full_name',       up.full_name,
    'created_at',      up.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'blocked_until',   CASE WHEN u.banned_until > now() THEN u.banned_until END,
    'is_admin',        EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = up.user_id AND a.is_active),
    'subscription', (
      SELECT jsonb_build_object(
        'plan_name', sp.name, 'plan_slug', sp.slug, 'status', cs.status,
        'billing_cycle', cs.billing_cycle,
        'period_end', COALESCE(cs.current_period_end, cs.next_due_date::timestamptz),
        'cancel_at_period_end', cs.cancel_at_period_end)
      FROM public.orbi_admin_current_subscriptions() cs
      JOIN public.subscription_plans sp ON sp.id = cs.plan_id
      WHERE cs.user_id = up.user_id
    ),
    'usage', jsonb_build_object(
      'accounts',      (SELECT count(*) FROM public.accounts a WHERE a.user_id = up.user_id),
      'transactions',  (SELECT count(*) FROM public.transactions t WHERE t.user_id = up.user_id),
      'last_activity', (SELECT max(t.created_at) FROM public.transactions t WHERE t.user_id = up.user_id)
    ),
    'payments', COALESCE((
      SELECT jsonb_agg(p ORDER BY p.created_at DESC)
      FROM (
        SELECT ph.amount, ph.status, ph.payment_method, ph.due_date, ph.paid_at, ph.created_at
        FROM public.payment_history ph
        WHERE ph.user_id = up.user_id
        ORDER BY ph.created_at DESC
        LIMIT 12
      ) p
    ), '[]'::jsonb),
    'audit', COALESCE((
      SELECT jsonb_agg(l ORDER BY l.created_at DESC)
      FROM (
        SELECT al.action, al.created_at, al.new_data
        FROM public.audit_logs al
        WHERE al.entity_id = up.user_id
        ORDER BY al.created_at DESC
        LIMIT 10
      ) l
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.user_profiles up
  JOIN auth.users u ON u.id = up.user_id
  WHERE up.user_id = p_user_id;

  RETURN v_result;
END;
$$;

-- Bloqueio temporário (suporte / suspeita de abuso). Nunca exclui dados.
CREATE OR REPLACE FUNCTION public.admin_set_user_block(p_user_id uuid, p_until timestamptz, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_reason text := NULLIF(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode bloquear a própria conta' USING ERRCODE = 'P0001';
  END IF;

  IF p_until IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = p_user_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Desative o acesso de administrador antes de bloquear' USING ERRCODE = 'P0001';
  END IF;

  IF p_until IS NOT NULL AND (p_until <= now() OR p_until > now() + interval '366 days') THEN
    RAISE EXCEPTION 'Prazo de bloqueio inválido' USING ERRCODE = '22023';
  END IF;

  IF v_reason IS NOT NULL AND NOT public.orbi_is_safe_text(v_reason, 200) THEN
    RAISE EXCEPTION 'Motivo inválido' USING ERRCODE = '22023';
  END IF;

  UPDATE auth.users SET banned_until = p_until, updated_at = now() WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Derruba as sessões abertas: o bloqueio vale já, não no próximo refresh.
  IF p_until IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (auth.uid(), CASE WHEN p_until IS NULL THEN 'user_unblock' ELSE 'user_block' END,
          'user', p_user_id, jsonb_build_object('until', p_until, 'reason', v_reason));
END;
$$;

-- Troca de plano pelo suporte: agora deixa rastro.
CREATE OR REPLACE FUNCTION public.admin_activate_plan_for_user(p_user_id uuid, p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = p_plan_id AND is_active) THEN
    RAISE EXCEPTION 'Plano inexistente ou inativo' USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_subscriptions
     SET status = 'canceled', updated_at = now()
   WHERE user_id = p_user_id AND status <> 'canceled';

  INSERT INTO public.user_subscriptions (user_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
  VALUES (p_user_id, p_plan_id, 'active', 'monthly', now(), now() + interval '30 days');

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (auth.uid(), 'plan_activate', 'user', p_user_id, jsonb_build_object('plan_id', p_plan_id));
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Assinaturas (visão de auditoria, somente leitura)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_subscriptions()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  plan_name text,
  plan_slug text,
  status text,
  billing_cycle text,
  amount numeric,
  current_period_start timestamptz,
  period_end timestamptz,
  cancel_at_period_end boolean,
  last_payment_at timestamptz,
  is_current boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    us.id, us.user_id, up.email, up.full_name, sp.name, sp.slug, us.status, us.billing_cycle,
    CASE WHEN us.billing_cycle = 'yearly' THEN sp.price_yearly ELSE sp.price_monthly END,
    us.current_period_start,
    COALESCE(us.current_period_end, us.next_due_date::timestamptz),
    COALESCE(us.cancel_at_period_end, false),
    us.last_payment_at,
    (cs.subscription_id IS NOT NULL),
    us.created_at,
    us.updated_at
  FROM public.user_subscriptions us
  LEFT JOIN public.orbi_admin_current_subscriptions() cs ON cs.subscription_id = us.id
  LEFT JOIN public.user_profiles up ON up.user_id = us.user_id
  LEFT JOIN public.subscription_plans sp ON sp.id = us.plan_id
  ORDER BY us.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Dashboard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_now  timestamptz := now();
  v_prev timestamptz := now() - interval '30 days';
  v_prev2 timestamptz := now() - interval '60 days';
  v_paying_now  int;
  v_paying_prev int;
  v_mrr_now  numeric;
  v_mrr_prev numeric;
  v_churned  int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT count(*), COALESCE(sum(mrr), 0) INTO v_paying_now,  v_mrr_now  FROM public.orbi_admin_paying_at(v_now);
  SELECT count(*), COALESCE(sum(mrr), 0) INTO v_paying_prev, v_mrr_prev FROM public.orbi_admin_paying_at(v_prev);

  SELECT count(*) INTO v_churned
  FROM public.orbi_admin_paying_at(v_prev) p
  WHERE NOT EXISTS (SELECT 1 FROM public.orbi_admin_paying_at(v_now) n WHERE n.user_id = p.user_id);

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'mrr',          jsonb_build_object('now', v_mrr_now, 'prev', v_mrr_prev),
    'paying',       jsonb_build_object('now', v_paying_now, 'prev', v_paying_prev),
    'churn',        jsonb_build_object(
                      'churned', v_churned,
                      'base', v_paying_prev,
                      'rate', CASE WHEN v_paying_prev > 0 THEN round(v_churned::numeric / v_paying_prev, 4) ELSE 0 END),
    'users', jsonb_build_object(
      'now',      (SELECT count(*) FROM public.user_profiles),
      'prev',     (SELECT count(*) FROM public.user_profiles WHERE created_at <= v_prev),
      'new_30d',  (SELECT count(*) FROM public.user_profiles WHERE created_at > v_prev),
      'new_prev', (SELECT count(*) FROM public.user_profiles WHERE created_at > v_prev2 AND created_at <= v_prev)
    ),
    'active', jsonb_build_object(
      'now',  (SELECT count(DISTINCT t.user_id) FROM public.transactions t WHERE t.created_at > v_prev),
      'prev', (SELECT count(DISTINCT t.user_id) FROM public.transactions t WHERE t.created_at > v_prev2 AND t.created_at <= v_prev)
    ),
    'status', COALESCE((
      SELECT jsonb_object_agg(s.status, s.n)
      FROM (SELECT cs.status, count(*) AS n FROM public.orbi_admin_current_subscriptions() cs GROUP BY cs.status) s
    ), '{}'::jsonb),
    'at_risk', (
      SELECT count(*) FROM public.orbi_admin_current_subscriptions() cs
      WHERE cs.status = 'past_due' OR (cs.status = 'active' AND cs.cancel_at_period_end)
    ),
    'blocked', (SELECT count(*) FROM auth.users WHERE banned_until > v_now),
    'plans', COALESCE((
      SELECT jsonb_agg(x ORDER BY x.users DESC, x.name)
      FROM (
        SELECT COALESCE(sp.slug, 'none') AS slug,
               COALESCE(sp.name, 'Sem plano') AS name,
               count(*)::int AS users,
               COALESCE(sum(pn.mrr), 0) AS mrr
        FROM public.user_profiles up
        LEFT JOIN public.orbi_admin_current_subscriptions() cs
               ON cs.user_id = up.user_id
              AND cs.status IN ('active', 'trial', 'past_due')
              AND (cs.current_period_end IS NULL OR cs.current_period_end > v_now)
        LEFT JOIN public.subscription_plans sp ON sp.id = cs.plan_id
        LEFT JOIN public.orbi_admin_paying_at(v_now) pn ON pn.user_id = up.user_id
        GROUP BY 1, 2
      ) x
    ), '[]'::jsonb),
    'signups', (
      SELECT jsonb_agg(jsonb_build_object('week', w.week, 'count', (
               SELECT count(*) FROM public.user_profiles up
               WHERE up.created_at >= w.week AND up.created_at < w.week + interval '7 days'))
             ORDER BY w.week)
      FROM generate_series(date_trunc('week', v_now) - interval '11 weeks', date_trunc('week', v_now), interval '1 week') AS w(week)
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_list_admins()                              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_toggle_admin(uuid, boolean)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_admin_user(text, text, text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users()                               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_user_details(uuid)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_user_block(uuid, timestamptz, text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_activate_plan_for_user(uuid, uuid)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_subscriptions()                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_dashboard_metrics()                        FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_list_admins()                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_admin(uuid, boolean)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_admin_user(text, text, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users()                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_details(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_block(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_plan_for_user(uuid, uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics()                     TO authenticated;
