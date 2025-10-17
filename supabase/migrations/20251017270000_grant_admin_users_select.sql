-- ============================================================================
-- CORREÇÃO: PERMISSÃO DE SELECT EM ADMIN_USERS PARA AUTHENTICATED
-- ============================================================================
-- Fix: As políticas RLS de outras tabelas (subscription_plans, bug_reports, etc.)
-- verificam se o usuário é admin consultando a tabela admin_users.
-- Por isso, todos os usuários autenticados precisam ter permissão de SELECT,
-- mas o RLS da tabela admin_users garante que cada um só vê seu próprio registro.

-- ============================================================================
-- 1. GARANTIR PERMISSÃO DE SELECT EM ADMIN_USERS
-- ============================================================================

-- Dar permissão de SELECT para usuários autenticados
-- O RLS já protege: cada usuário só pode ver seu próprio registro
GRANT SELECT ON public.admin_users TO authenticated;

-- ============================================================================
-- 2. VERIFICAR E AJUSTAR POLÍTICAS RLS DE SUBSCRIPTION_PLANS
-- ============================================================================

-- A tabela subscription_plans tem políticas que verificam admin_users
-- Vamos garantir que a política pública funciona corretamente

-- Dropar políticas existentes se houver conflito
DROP POLICY IF EXISTS "Planos ativos são visíveis publicamente" ON public.subscription_plans;
DROP POLICY IF EXISTS "Planos ativos são públicos" ON public.subscription_plans;
DROP POLICY IF EXISTS "Public and authenticated can view active plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Admins can view all plans" ON public.subscription_plans;

-- Criar política que permite acesso público E authenticated
CREATE POLICY "Public and authenticated can view active plans"
  ON public.subscription_plans
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Política para admins verem todos os planos (ativos e inativos)
CREATE POLICY "Admins can view all plans"
  ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============================================================================
-- 3. COMENTÁRIOS
-- ============================================================================

COMMENT ON POLICY "Public and authenticated can view active plans" ON public.subscription_plans IS 
  'Permite que usuários anônimos e autenticados vejam apenas planos ativos';

COMMENT ON POLICY "Admins can view all plans" ON public.subscription_plans IS 
  'Permite que administradores vejam todos os planos (ativos e inativos)';

-- ============================================================================
-- 4. VERIFICAÇÃO FINAL
-- ============================================================================

-- Verificar se o RLS está habilitado em admin_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'admin_users' 
      AND rowsecurity = true
  ) THEN
    ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Verificar se existe a política básica de admin_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'admin_users'
      AND policyname = 'Usuários podem ver seu próprio registro admin'
  ) THEN
    -- Criar política básica se não existir
    CREATE POLICY "Usuários podem ver seu próprio registro admin"
      ON public.admin_users
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

