-- ============================================================================
-- FUNÇÕES PARA GERENCIAMENTO DE ADMIN
-- ============================================================================

-- ============================================================================
-- 1. LISTAR TODOS OS ADMINISTRADORES
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_list_admins();

CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  permissions jsonb,
  is_active boolean,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se usuário é super admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas super admins podem listar administradores';
  END IF;

  -- Retornar lista de administradores
  RETURN QUERY
  SELECT 
    au.id,
    au.user_id,
    up.email,
    up.full_name,
    au.role,
    au.permissions,
    au.is_active,
    au.created_at
  FROM public.admin_users au
  LEFT JOIN public.user_profiles up ON au.user_id = up.user_id
  ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;

-- ============================================================================
-- 2. DELETAR ADMINISTRADOR
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_delete_admin(uuid);

CREATE OR REPLACE FUNCTION public.admin_delete_admin(p_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se usuário é super admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas super admins podem deletar administradores';
  END IF;

  -- Deletar admin
  DELETE FROM public.admin_users WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_admin(uuid) TO authenticated;

-- ============================================================================
-- 3. ATIVAR/DESATIVAR ADMINISTRADOR
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_toggle_admin(uuid, boolean);

CREATE OR REPLACE FUNCTION public.admin_toggle_admin(p_user_id uuid, p_is_active boolean)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se usuário é super admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas super admins podem atualizar administradores';
  END IF;

  -- Atualizar status do admin
  UPDATE public.admin_users 
  SET is_active = p_is_active,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_admin(uuid, boolean) TO authenticated;

-- ============================================================================
-- FUNÇÕES PARA GERENCIAMENTO DE ASSINATURAS
-- ============================================================================

-- ============================================================================
-- 4. LISTAR TODAS AS ASSINATURAS (COM DETALHES DO USUÁRIO)
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_list_subscriptions();

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
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se usuário é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar assinaturas';
  END IF;

  -- Retornar lista de assinaturas
  RETURN QUERY
  SELECT 
    us.id,
    us.user_id,
    up.email,
    up.full_name,
    sp.name as plan_name,
    sp.slug as plan_slug,
    us.status,
    us.billing_cycle,
    us.current_period_start,
    us.current_period_end,
    us.created_at
  FROM public.user_subscriptions us
  INNER JOIN public.user_profiles up ON us.user_id = up.user_id
  LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id
  ORDER BY us.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions() TO authenticated;

-- ============================================================================
-- 5. CANCELAR ASSINATURA (ADMIN)
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_cancel_subscription(uuid);

CREATE OR REPLACE FUNCTION public.admin_cancel_subscription(p_subscription_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se usuário é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem cancelar assinaturas';
  END IF;

  -- Cancelar assinatura
  UPDATE public.user_subscriptions 
  SET status = 'canceled',
      updated_at = NOW()
  WHERE id = p_subscription_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_cancel_subscription(uuid) TO authenticated;

-- ============================================================================
-- 6. ATIVAR PLANO PARA USUÁRIO (ADMIN)
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_activate_plan_for_user(uuid, uuid);

CREATE OR REPLACE FUNCTION public.admin_activate_plan_for_user(p_user_id uuid, p_plan_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  -- Verificar se usuário é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem ativar planos';
  END IF;

  -- Cancelar assinaturas anteriores (se houver)
  UPDATE public.user_subscriptions 
  SET status = 'canceled'
  WHERE user_id = p_user_id AND status != 'canceled';

  -- Criar nova assinatura ativa
  INSERT INTO public.user_subscriptions (
    user_id,
    plan_id,
    status,
    billing_cycle,
    current_period_start,
    current_period_end
  ) VALUES (
    p_user_id,
    p_plan_id,
    'active',
    'monthly',
    NOW(),
    NOW() + INTERVAL '30 days'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_activate_plan_for_user(uuid, uuid) TO authenticated;

-- ============================================================================
-- 7. OBTER DETALHES DO USUÁRIO (ADMIN)
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_get_user_details(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_user_details(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  onboarding_completed boolean,
  created_at timestamptz,
  updated_at timestamptz,
  plan_name text,
  plan_slug text,
  subscription_status text,
  current_period_end timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se usuário é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem ver detalhes de usuários';
  END IF;

  -- Retornar detalhes do usuário
  RETURN QUERY
  SELECT 
    up.id,
    up.user_id,
    up.email,
    up.full_name,
    up.avatar_url,
    up.onboarding_completed,
    up.created_at,
    up.updated_at,
    sp.name as plan_name,
    sp.slug as plan_slug,
    us.status as subscription_status,
    us.current_period_end
  FROM public.user_profiles up
  LEFT JOIN public.user_subscriptions us ON up.user_id = us.user_id
  LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE up.user_id = p_user_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_user_details(uuid) TO authenticated;

-- ============================================================================
-- 8. CRIAR NOVO USUÁRIO (ADMIN)
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text);

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_full_name text,
  p_password text
)
RETURNS TABLE (
  user_id uuid,
  email text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Verificar se usuário é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem criar usuários';
  END IF;

  -- Criar usuário no auth
  v_user_id := (
    SELECT id FROM auth.users WHERE email = p_email
  );

  -- Se usuário não existe, não podemos criar (auth precisa ser feito via endpoint separado)
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % ainda não foi criado no auth', p_email;
  END IF;

  -- Criar/atualizar perfil do usuário
  INSERT INTO public.user_profiles (user_id, email, full_name)
  VALUES (v_user_id, p_email, p_full_name)
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = p_full_name;

  RETURN QUERY
  SELECT v_user_id, p_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text) TO authenticated;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION public.admin_list_admins() IS 'Lista todos os administradores do sistema (apenas super admins)';
COMMENT ON FUNCTION public.admin_delete_admin(uuid) IS 'Remove um administrador do sistema (apenas super admins)';
COMMENT ON FUNCTION public.admin_toggle_admin(uuid, boolean) IS 'Ativa ou desativa um administrador (apenas super admins)';
COMMENT ON FUNCTION public.admin_list_subscriptions() IS 'Lista todas as assinaturas dos usuários (apenas admins)';
COMMENT ON FUNCTION public.admin_cancel_subscription(uuid) IS 'Cancela uma assinatura de usuário (apenas admins)';
COMMENT ON FUNCTION public.admin_activate_plan_for_user(uuid, uuid) IS 'Ativa um plano para um usuário (apenas admins)';
COMMENT ON FUNCTION public.admin_get_user_details(uuid) IS 'Obtém detalhes completos de um usuário (apenas admins)';
COMMENT ON FUNCTION public.admin_create_user(text, text, text) IS 'Cria um novo usuário no sistema (apenas admins)';
