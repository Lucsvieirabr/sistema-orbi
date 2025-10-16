-- ============================================================================
-- Permitir que usuários criem suas próprias assinaturas (planos gratuitos)
-- ============================================================================

-- Adicionar política de INSERT para user_subscriptions
CREATE POLICY "Usuários podem criar suas próprias assinaturas"
  ON public.user_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comentário
COMMENT ON POLICY "Usuários podem criar suas próprias assinaturas" ON public.user_subscriptions IS 
  'Permite que usuários criem assinaturas para si mesmos (necessário para planos gratuitos)';

