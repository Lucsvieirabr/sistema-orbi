-- ============================================================================
-- CORRIGIR ESTRUTURA DO ASAAS
-- ============================================================================
-- Remove URLs de pagamento dos planos (arquitetura incorreta)
-- Adiciona campos corretos para integração com Asaas

-- 1. Remover colunas incorretas de subscription_plans
ALTER TABLE public.subscription_plans
DROP COLUMN IF EXISTS monthly_payment_url,
DROP COLUMN IF EXISTS annual_payment_url;

-- 2. Adicionar asaas_customer_id em user_profiles (se não existir)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS asaas_customer_id text UNIQUE;

-- Índice para buscar por asaas_customer_id
CREATE INDEX IF NOT EXISTS idx_user_profiles_asaas_customer 
ON public.user_profiles(asaas_customer_id);

-- 3. Garantir que user_subscriptions tem os campos necessários
-- (já existem na migration original, mas vamos garantir)
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS asaas_customer_id text,
ADD COLUMN IF NOT EXISTS asaas_subscription_id text;

-- Índice para buscar por asaas_subscription_id
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_asaas_subscription 
ON public.user_subscriptions(asaas_subscription_id);

-- 4. Adicionar campos de URL de pagamento em payment_history
-- (onde realmente deve ficar a URL de pagamento individual)
ALTER TABLE public.payment_history
ADD COLUMN IF NOT EXISTS invoice_url text,
ADD COLUMN IF NOT EXISTS bank_slip_url text,
ADD COLUMN IF NOT EXISTS pix_qr_code text,
ADD COLUMN IF NOT EXISTS pix_copy_paste text;

-- Comentários
COMMENT ON COLUMN public.user_profiles.asaas_customer_id IS 'ID do customer no Asaas';
COMMENT ON COLUMN public.user_subscriptions.asaas_subscription_id IS 'ID da assinatura recorrente no Asaas';
COMMENT ON COLUMN public.payment_history.invoice_url IS 'URL da fatura/invoice do Asaas';
COMMENT ON COLUMN public.payment_history.bank_slip_url IS 'URL do boleto bancário';
COMMENT ON COLUMN public.payment_history.pix_qr_code IS 'QR Code PIX para pagamento';
COMMENT ON COLUMN public.payment_history.pix_copy_paste IS 'Código PIX copia e cola';

-- ============================================================================
-- FUNÇÃO: Criar pagamento no Asaas (será chamada pela Edge Function)
-- ============================================================================

-- Esta é uma função auxiliar que organiza os dados antes de chamar a Edge Function
CREATE OR REPLACE FUNCTION public.initiate_payment(
  p_plan_id uuid,
  p_billing_cycle text DEFAULT 'monthly'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_profile record;
  v_plan record;
  v_amount numeric;
  v_result jsonb;
BEGIN
  -- Verificar se usuário está autenticado
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Buscar dados do usuário
  SELECT * INTO v_user_profile
  FROM public.user_profiles
  WHERE user_id = v_user_id;

  IF v_user_profile IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Buscar dados do plano
  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = p_plan_id AND is_active = true;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Plan not found or inactive';
  END IF;

  -- Determinar valor baseado no ciclo
  IF p_billing_cycle = 'annual' THEN
    v_amount := v_plan.price_yearly;
  ELSE
    v_amount := v_plan.price_monthly;
  END IF;

  -- Retornar dados estruturados para a Edge Function
  v_result := jsonb_build_object(
    'user_id', v_user_id,
    'user_email', v_user_profile.email,
    'user_name', v_user_profile.full_name,
    'asaas_customer_id', v_user_profile.asaas_customer_id,
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'amount', v_amount,
    'billing_cycle', p_billing_cycle
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.initiate_payment(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.initiate_payment(uuid, text) IS 'Prepara dados para criar pagamento no Asaas via Edge Function';

