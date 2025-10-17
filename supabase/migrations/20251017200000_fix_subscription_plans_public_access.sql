-- ============================================================================
-- CORRIGIR ACESSO PÚBLICO AOS PLANOS DE ASSINATURA
-- ============================================================================
-- Fix: A política original não estava permitindo acesso anônimo (público)
-- Agora: Usuários anônimos e autenticados podem ver planos ativos

-- Remover política antiga que estava incorreta
DROP POLICY IF EXISTS "Planos ativos são visíveis para todos" ON public.subscription_plans;

-- Criar nova política que permite acesso anônimo (público) aos planos ativos
CREATE POLICY "Planos ativos são públicos"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

-- Comentário
COMMENT ON POLICY "Planos ativos são públicos" ON public.subscription_plans IS 
  'Permite que qualquer pessoa (autenticada ou não) veja planos ativos. Admins podem ver todos os planos através de outra política.';

-- Nota: A política "Admins podem ver todos os planos" continua ativa,
-- permitindo que admins vejam planos inativos também.
-- As políticas são combinadas com OR, então:
-- - Usuários anônimos/autenticados: veem planos ativos
-- - Admins: veem todos os planos (ativos + inativos)

