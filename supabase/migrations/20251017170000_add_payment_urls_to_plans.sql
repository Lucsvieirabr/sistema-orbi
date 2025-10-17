-- ============================================================================
-- ADICIONAR URLs DE PAGAMENTO AOS PLANOS
-- ============================================================================
-- Adiciona campos opcionais para URLs de pagamento mensal e anual

-- Adicionar colunas de URL de pagamento
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS monthly_payment_url text,
ADD COLUMN IF NOT EXISTS annual_payment_url text;

-- Comentários nas colunas
COMMENT ON COLUMN public.subscription_plans.monthly_payment_url IS 'URL para pagamento do plano mensal (opcional)';
COMMENT ON COLUMN public.subscription_plans.annual_payment_url IS 'URL para pagamento do plano anual (opcional)';

-- Atualizar plano Pro com as URLs de pagamento
UPDATE public.subscription_plans
SET 
  monthly_payment_url = 'https://www.asaas.com/c/b6lnd8t48oct93o4',
  annual_payment_url = 'https://www.asaas.com/c/n5wfqxxxytwlhkms'
WHERE slug = 'pro';

