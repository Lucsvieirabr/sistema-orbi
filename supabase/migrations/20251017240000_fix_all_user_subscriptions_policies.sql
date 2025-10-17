-- ============================================================================
-- CORRIGIR TODAS AS POLÍTICAS RLS DE USER_SUBSCRIPTIONS
-- ============================================================================
-- Fix: Garantir que todas as políticas têm role "authenticated" especificado
-- e funcionam corretamente para usuários autenticados

-- Dropar todas as políticas existentes
DROP POLICY IF EXISTS "Usuários veem suas próprias assinaturas" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias assinaturas" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Usuários podem criar suas próprias assinaturas" ON public.user_subscriptions;

-- 1. SELECT: Usuários podem ver suas próprias assinaturas
CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. INSERT: Usuários podem criar suas próprias assinaturas
CREATE POLICY "Users can insert own subscriptions"
  ON public.user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. UPDATE: Usuários podem atualizar suas próprias assinaturas
CREATE POLICY "Users can update own subscriptions"
  ON public.user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Comentários
COMMENT ON POLICY "Users can view own subscriptions" ON public.user_subscriptions IS 
  'Permite que usuários vejam suas próprias assinaturas';

COMMENT ON POLICY "Users can insert own subscriptions" ON public.user_subscriptions IS 
  'Permite que usuários criem suas próprias assinaturas (necessário para planos gratuitos)';

COMMENT ON POLICY "Users can update own subscriptions" ON public.user_subscriptions IS 
  'Permite que usuários atualizem suas próprias assinaturas (ex: cancelamento)';

