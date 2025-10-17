-- ============================================================================
-- ADICIONAR STATUS 'PENDING' PARA ASSINATURAS
-- ============================================================================
-- Adiciona o status 'pending' para aguardar confirmação de pagamento

-- Remover constraint antiga
ALTER TABLE public.user_subscriptions 
DROP CONSTRAINT IF EXISTS valid_status;

-- Adicionar nova constraint com 'pending'
ALTER TABLE public.user_subscriptions 
ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'trial', 'active', 'past_due', 'canceled', 'expired'));

-- Comentário
COMMENT ON CONSTRAINT valid_status ON public.user_subscriptions IS 
  'Status válidos: pending (aguardando pagamento), trial (período de teste), active (ativa), past_due (pagamento atrasado), canceled (cancelada), expired (expirada)';

