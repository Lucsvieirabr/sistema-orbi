-- ============================================================================
-- Função para listar todos os usuários (para painel admin)
-- ============================================================================

-- Remover função existente se houver (pode ter assinatura diferente)
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  full_name text,
  onboarding_completed boolean,
  plan_name text,
  plan_slug text,
  subscription_status text,
  current_period_end timestamptz
)
SECURITY DEFINER  -- Bypass RLS para permitir admin ver todos os usuários
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se usuário é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar usuários';
  END IF;

  -- Retornar lista de usuários com informações de assinatura
  RETURN QUERY
  SELECT 
    up.user_id,
    up.email,
    up.created_at,
    up.full_name,
    up.onboarding_completed,
    p.name as plan_name,
    p.slug as plan_slug,
    us.status as subscription_status,
    us.current_period_end
  FROM public.user_profiles up
  LEFT JOIN public.user_subscriptions us ON up.user_id = us.user_id
  LEFT JOIN public.subscription_plans p ON us.plan_id = p.id
  ORDER BY up.created_at DESC;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION public.admin_list_users() IS 'Lista todos os usuários do sistema com informações de assinatura (apenas para admins)';

