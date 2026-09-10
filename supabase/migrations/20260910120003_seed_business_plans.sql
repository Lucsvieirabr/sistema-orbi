-- ============================================================================
-- SEED CANÔNICO DOS PLANOS DE NEGÓCIO — Free / Pro / Casal
-- ----------------------------------------------------------------------------
-- Substitui 20251016000008_seed_default_subscription_plans.sql como fonte de
-- verdade dos planos. Duas diferenças importantes em relação àquele arquivo:
--
--  1. NÃO usa DELETE. `user_subscriptions.plan_id` é
--     `REFERENCES subscription_plans(id) ON DELETE CASCADE` — reexecutar o seed
--     antigo apagava as assinaturas de TODOS os clientes daquele plano junto
--     com o plano. Aqui é UPSERT por slug: o `id` do plano nunca muda.
--  2. Colunas de cobrança (asaas_plan_id, URLs de pagamento, trial_days) NÃO
--     são sobrescritas — são operadas fora do versionamento.
--
-- Chaves de limite: -1 = ilimitado. Devem casar 1:1 com as keys lidas pelos
-- triggers de cota (20260910000001) e por src/lib/features/orbi-features.ts.
-- Feature `ia_deteccao_logos` foi removida junto com o sistema de logos.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- FREE (slug histórico `basic` — preservado para não órfãos nas assinaturas)
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription_plans (
  name, slug, description, price_monthly, price_yearly,
  is_active, is_featured, display_order, features, limits
) VALUES (
  'Free',
  'basic',
  'Gestão financeira essencial: lançamento manual, extrato mensal e saldo das contas.',
  0.00, 0.00, true, false, 0,
  '{
    "dashboard": false,
    "dashboard_assinaturas": false,
    "extrato": true,
    "contas": true,
    "categorias": true,
    "cartoes": true,
    "pessoas": true,
    "ia_classificador": false,
    "familia_compartilhada": false,
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
    "ia_classificacao_automatica": false
  }'::jsonb,
  '{
    "max_contas": 1,
    "max_cartoes": 1,
    "max_transacoes_mes": 100,
    "max_pessoas": 2,
    "max_categorias": 10,
    "max_membros_familia": 0,
    "retencao_dados_meses": 6
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  is_active     = EXCLUDED.is_active,
  is_featured   = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order,
  features      = EXCLUDED.features,
  limits        = EXCLUDED.limits,
  updated_at    = NOW();

-- ---------------------------------------------------------------------------
-- PRO
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription_plans (
  name, slug, description, price_monthly, price_yearly,
  is_active, is_featured, display_order, features, limits
) VALUES (
  'Pro',
  'pro',
  'Automatização completa: importação de extrato, IA classificadora e uso ilimitado.',
  10.99, 109.99, true, true, 1,
  '{
    "dashboard": true,
    "dashboard_assinaturas": true,
    "extrato": true,
    "contas": true,
    "categorias": true,
    "cartoes": true,
    "pessoas": true,
    "ia_classificador": true,
    "familia_compartilhada": false,
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
    "ia_classificacao_automatica": true
  }'::jsonb,
  '{
    "max_contas": -1,
    "max_cartoes": -1,
    "max_transacoes_mes": -1,
    "max_pessoas": -1,
    "max_categorias": -1,
    "max_membros_familia": 0,
    "retencao_dados_meses": -1
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  is_active     = EXCLUDED.is_active,
  is_featured   = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order,
  features      = EXCLUDED.features,
  limits        = EXCLUDED.limits,
  updated_at    = NOW();

-- ---------------------------------------------------------------------------
-- CASAL — Pro + compartilhamento de leitura com 1 parceiro (2 acessos)
-- `max_membros_familia` = 1 convidado; o dono é o 2º acesso.
-- É a chave lida por check_family_members_limit (20260910000001).
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription_plans (
  name, slug, description, price_monthly, price_yearly,
  is_active, is_featured, display_order, features, limits
) VALUES (
  'Casal',
  'casal',
  'Tudo do Pro e mais um acesso: você e seu parceiro enxergam as mesmas finanças, com uma única assinatura.',
  16.99, 169.99, true, false, 2,
  '{
    "dashboard": true,
    "dashboard_assinaturas": true,
    "extrato": true,
    "contas": true,
    "categorias": true,
    "cartoes": true,
    "pessoas": true,
    "ia_classificador": true,
    "familia_compartilhada": true,
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
    "ia_classificacao_automatica": true
  }'::jsonb,
  '{
    "max_contas": -1,
    "max_cartoes": -1,
    "max_transacoes_mes": -1,
    "max_pessoas": -1,
    "max_categorias": -1,
    "max_membros_familia": 1,
    "retencao_dados_meses": -1
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  is_active     = EXCLUDED.is_active,
  is_featured   = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order,
  features      = EXCLUDED.features,
  limits        = EXCLUDED.limits,
  updated_at    = NOW();

-- ---------------------------------------------------------------------------
-- Higiene: a feature de logos não existe mais em plano nenhum.
-- ---------------------------------------------------------------------------
UPDATE public.subscription_plans
   SET features = features - 'ia_deteccao_logos', updated_at = NOW()
 WHERE features ? 'ia_deteccao_logos';

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.subscription_plans
   WHERE slug IN ('basic', 'pro', 'casal') AND is_active;

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Seed de planos incompleto: % de 3 planos ativos', v_count;
  END IF;
END
$verify$;

COMMIT;
