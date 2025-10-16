-- ============================================================================
-- Corrigir constraint de billing_cycle para aceitar 'yearly'
-- ============================================================================

-- Remover constraint antiga
ALTER TABLE public.user_subscriptions 
DROP CONSTRAINT IF EXISTS valid_billing_cycle;

-- Adicionar nova constraint com 'yearly' ao invés de 'annual'
ALTER TABLE public.user_subscriptions 
ADD CONSTRAINT valid_billing_cycle CHECK (billing_cycle IN ('monthly', 'yearly'));

-- Comentário
COMMENT ON CONSTRAINT valid_billing_cycle ON public.user_subscriptions IS 'Valida ciclo de cobrança: mensal ou anual (yearly)';

