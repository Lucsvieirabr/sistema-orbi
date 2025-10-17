-- ============================================================================
-- CORREÇÃO COMPLETA DE PERMISSÕES PARA USER_SUBSCRIPTIONS
-- ============================================================================
-- Fix: A tabela user_subscriptions não tinha política de INSERT e
-- faltavam GRANTs para o role authenticated

-- ============================================================================
-- 1. DROPAR POLÍTICAS EXISTENTES E RECRIAR COM TODAS AS OPERAÇÕES
-- ============================================================================

-- Dropar todas as políticas existentes
DROP POLICY IF EXISTS "Usuários veem suas próprias assinaturas" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias assinaturas" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Usuários podem criar suas próprias assinaturas" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.user_subscriptions;

-- Recriar políticas com todas as operações necessárias
CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 2. GARANTIR PERMISSÕES GRANT PARA AUTHENTICATED
-- ============================================================================

-- Garantir USAGE no schema public
GRANT USAGE ON SCHEMA public TO authenticated;

-- Permissões completas em user_subscriptions
GRANT SELECT, INSERT, UPDATE ON public.user_subscriptions TO authenticated;

-- Permissões em subscription_plans (SELECT apenas - para ler os planos)
GRANT SELECT ON public.subscription_plans TO authenticated;

-- Permissões em user_profiles
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Permissões em payment_history
GRANT SELECT, INSERT ON public.payment_history TO authenticated;

-- Permissões em user_usage (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'user_usage'
  ) THEN
    GRANT SELECT, INSERT, UPDATE ON public.user_usage TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- 3. COMENTÁRIOS
-- ============================================================================

COMMENT ON POLICY "Users can view own subscriptions" ON public.user_subscriptions IS 
  'Permite que usuários autenticados vejam suas próprias assinaturas';

COMMENT ON POLICY "Users can insert own subscriptions" ON public.user_subscriptions IS 
  'Permite que usuários autenticados criem suas próprias assinaturas (necessário para planos gratuitos)';

COMMENT ON POLICY "Users can update own subscriptions" ON public.user_subscriptions IS 
  'Permite que usuários autenticados atualizem suas próprias assinaturas (ex: cancelamento)';

-- ============================================================================
-- 4. VERIFICAÇÃO
-- ============================================================================

-- Verificar se RLS está habilitado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'user_subscriptions' 
      AND rowsecurity = true
  ) THEN
    ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

