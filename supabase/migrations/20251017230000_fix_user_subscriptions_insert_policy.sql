-- ============================================================================
-- CORRIGIR POLÍTICA DE INSERT EM USER_SUBSCRIPTIONS
-- ============================================================================
-- Fix: A política existente pode não ter o role "authenticated" especificado
-- Vamos recriar com todas as especificações corretas

-- Dropar política existente se houver
DROP POLICY IF EXISTS "Usuários podem criar suas próprias assinaturas" ON public.user_subscriptions;

-- Recriar política com especificação completa
CREATE POLICY "Usuários podem criar suas próprias assinaturas"
  ON public.user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Comentário
COMMENT ON POLICY "Usuários podem criar suas próprias assinaturas" ON public.user_subscriptions IS 
  'Permite que usuários autenticados criem assinaturas para si mesmos (necessário para planos gratuitos)';

