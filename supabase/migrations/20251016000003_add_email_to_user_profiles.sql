-- ============================================================================
-- Adicionar email ao user_profiles e criar função para listar usuários
-- ============================================================================

-- Adicionar coluna email em user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Índice para email
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- ============================================================================
-- Sincronizar emails existentes via função (sem trigger em auth.users)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_profile_emails()
RETURNS void
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.user_profiles up
  SET email = au.email
  FROM auth.users au
  WHERE up.user_id = au.id
    AND (up.email IS NULL OR up.email != au.email);
END;
$$;

-- Executar sincronização inicial
SELECT public.update_profile_emails();

-- ============================================================================
-- Função para listar todos os usuários (para admin)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  onboarding_completed boolean,
  plan_name text,
  plan_slug text,
  subscription_status text,
  current_period_end timestamptz,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se quem está chamando é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar usuários';
  END IF;

  RETURN QUERY
  SELECT 
    up.user_id,
    up.email,
    up.full_name,
    up.onboarding_completed,
    sp.name as plan_name,
    sp.slug as plan_slug,
    us.status as subscription_status,
    us.current_period_end,
    up.created_at
  FROM public.user_profiles up
  LEFT JOIN public.user_subscriptions us ON us.user_id = up.user_id
  LEFT JOIN public.subscription_plans sp ON sp.id = us.plan_id
  ORDER BY up.created_at DESC;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Comentários
COMMENT ON FUNCTION public.admin_list_users() IS 'Lista todos os usuários do sistema (apenas para admins)';
COMMENT ON COLUMN public.user_profiles.email IS 'Email do usuário (sincronizado do auth.users)';

