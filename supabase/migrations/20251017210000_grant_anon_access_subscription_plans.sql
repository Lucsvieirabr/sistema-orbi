-- ============================================================================
-- GARANTIR ACESSO ANÔNIMO (ROLE ANON) À TABELA SUBSCRIPTION_PLANS
-- ============================================================================
-- Fix: O role 'anon' precisa de permissão explícita SELECT na tabela

-- 1. Garantir que o role anon tem SELECT na tabela
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.subscription_plans TO anon;

-- 2. Remover todas as políticas existentes de SELECT para recriar corretamente
DROP POLICY IF EXISTS "Planos ativos são públicos" ON public.subscription_plans;
DROP POLICY IF EXISTS "Planos ativos são visíveis para todos" ON public.subscription_plans;
DROP POLICY IF EXISTS "Admins podem ver todos os planos" ON public.subscription_plans;

-- 3. Criar política para usuários anônimos (anon) e autenticados (authenticated)
-- verem planos ativos
CREATE POLICY "Public can view active plans"
  ON public.subscription_plans
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 4. Criar política separada para admins verem TODOS os planos
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

-- Comentários
COMMENT ON POLICY "Public can view active plans" ON public.subscription_plans IS 
  'Permite que usuários anônimos e autenticados vejam planos ativos na página de pricing';

COMMENT ON POLICY "Admins can view all plans" ON public.subscription_plans IS 
  'Permite que administradores vejam todos os planos (ativos e inativos)';

