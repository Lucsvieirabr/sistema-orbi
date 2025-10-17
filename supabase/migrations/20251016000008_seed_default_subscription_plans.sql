-- ============================================================================
-- SEED: PLANOS DE ASSINATURA PADRÃO
-- ============================================================================
-- Insere os planos padrão do sistema: Básico (gratuito) e Pro (pago)
-- ============================================================================

-- Remover planos existentes com os mesmos slugs (se houver)
DELETE FROM public.subscription_plans WHERE slug IN ('basic', 'pro');

-- ============================================================================
-- PLANO BÁSICO (Gratuito)
-- ============================================================================
INSERT INTO public.subscription_plans (
  name,
  slug,
  description,
  price_monthly,
  price_yearly,
  is_active,
  is_featured,
  display_order,
  features,
  limits
) VALUES (
  'Básico',
  'basic',
  'Acesso às funções essenciais de gestão financeira: registo manual de transações, extrato mensal e visão do saldo.',
  0.00,
  0.00,
  true,
  false,
  0,
  '{
    "dashboard": false,
    "extrato": true,
    "contas": true,
    "categorias": true,
    "cartoes": true,
    "pessoas": true,
    "ia_classificador": false,
    "transacoes_criar": true,
    "transacoes_editar": true,
    "transacoes_excluir": true,
    "transacoes_importar_csv": false,
    "contas_criar": true,
    "contas_editar": true,
    "contas_excluir": true,
    "categorias_criar": true,
    "categorias_editar": true,
    "categorias_excluir": true,
    "cartoes_criar": true,
    "cartoes_editar": true,
    "cartoes_excluir": true,
    "cartoes_faturas": true,
    "pessoas_criar": true,
    "pessoas_editar": true,
    "pessoas_excluir": true,
    "ia_classificacao_automatica": false,
    "ia_deteccao_logos": false
  }'::jsonb,
  '{
    "max_contas": 1,
    "max_cartoes": 1,
    "max_transacoes_mes": 100,
    "max_pessoas": 2,
    "max_categorias": 10,
    "retencao_dados_meses": 6
  }'::jsonb
);

-- ============================================================================
-- PLANO PRO (Pago)
-- ============================================================================
INSERT INTO public.subscription_plans (
  name,
  slug,
  description,
  price_monthly,
  price_yearly,
  is_active,
  is_featured,
  display_order,
  features,
  limits,
  monthly_payment_url,
  annual_payment_url
) VALUES (
  'Pro',
  'pro',
  'Desbloqueie a automatização e a inteligência completa do Orbi.',
  10.99,
  109.99,
  true,
  true,
  1,
  '{
    "dashboard": false,
    "extrato": true,
    "contas": true,
    "categorias": true,
    "cartoes": true,
    "pessoas": true,
    "ia_classificador": true,
    "transacoes_criar": true,
    "transacoes_editar": true,
    "transacoes_excluir": true,
    "transacoes_importar_csv": true,
    "contas_criar": true,
    "contas_editar": true,
    "contas_excluir": true,
    "categorias_criar": true,
    "categorias_editar": true,
    "categorias_excluir": true,
    "cartoes_criar": true,
    "cartoes_editar": true,
    "cartoes_excluir": true,
    "cartoes_faturas": true,
    "pessoas_criar": true,
    "pessoas_editar": true,
    "pessoas_excluir": true,
    "ia_classificacao_automatica": true,
    "ia_deteccao_logos": true
  }'::jsonb,
  '{
    "max_contas": -1,
    "max_cartoes": -1,
    "max_transacoes_mes": -1,
    "max_pessoas": -1,
    "max_categorias": -1,
    "retencao_dados_meses": -1
  }'::jsonb,
  'https://www.asaas.com/c/b6lnd8t48oct93o4',
  'https://www.asaas.com/c/n5wfqxxxytwlhkms'
);

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- Confirmar que os planos foram criados
DO $$
DECLARE
  v_basic_count integer;
  v_pro_count integer;
BEGIN
  SELECT COUNT(*) INTO v_basic_count FROM public.subscription_plans WHERE slug = 'basic';
  SELECT COUNT(*) INTO v_pro_count FROM public.subscription_plans WHERE slug = 'pro';
  
  IF v_basic_count = 1 AND v_pro_count = 1 THEN
    RAISE NOTICE 'Planos padrão criados com sucesso: Básico e Pro';
  ELSE
    RAISE EXCEPTION 'Erro ao criar planos padrão';
  END IF;
END $$;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON CONSTRAINT subscription_plans_slug_key ON public.subscription_plans IS 
  'Garante que cada plano tenha um slug único (basic, pro, etc)';

