-- Migration: Auto-create initial categories for new users
-- This migration creates a function that automatically inserts initial categories when a new user is created

BEGIN;

-- Create function to insert initial categories for a user
CREATE OR REPLACE FUNCTION public.create_initial_categories_for_user(user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Check if user already has categories
  IF EXISTS (SELECT 1 FROM public.categories WHERE categories.user_id = create_initial_categories_for_user.user_id) THEN
    RETURN; -- User already has categories
  END IF;

  -- Insert expense categories (Gastos)
  INSERT INTO public.categories (user_id, name, category_type, icon, created_at) VALUES
  -- Alimentação
  (user_id, 'Alimentação', 'expense', 'fa-utensils', NOW()),
  -- Bem Estar / Beleza
  (user_id, 'Bem Estar / Beleza', 'expense', 'fa-spa', NOW()),
  -- Casa
  (user_id, 'Casa', 'expense', 'fa-home', NOW()),
  -- Diarista / Prestadores Serv.
  (user_id, 'Diarista / Prestadores Serv.', 'expense', 'fa-user-tie', NOW()),
  -- Despesas Pessoais
  (user_id, 'Despesas Pessoais', 'expense', 'fa-user', NOW()),
  -- Empréstimos / Financiamentos
  (user_id, 'Empréstimos / Financiamentos', 'expense', 'fa-credit-card', NOW()),
  -- Férias / Viagens
  (user_id, 'Férias / Viagens', 'expense', 'fa-plane', NOW()),
  -- Filhos / Dependentes
  (user_id, 'Filhos / Dependentes', 'expense', 'fa-child', NOW()),
  -- Investimentos (pelo menos 20% da receita)
  (user_id, 'Investimentos (pelo menos 20% da receita)', 'expense', 'fa-chart-line', NOW()),
  -- Gastos com PJ / Profissionais Autônomos
  (user_id, 'Gastos com PJ / Profissionais Autônomos', 'expense', 'fa-briefcase', NOW()),
  -- Lazer
  (user_id, 'Lazer', 'expense', 'fa-gamepad', NOW()),
  -- Outros
  (user_id, 'Outros', 'expense', 'fa-ellipsis-h', NOW()),
  -- Pet
  (user_id, 'Pet', 'expense', 'fa-paw', NOW()),
  -- Presentes / Compras
  (user_id, 'Presentes / Compras', 'expense', 'fa-gift', NOW()),
  -- Refeição
  (user_id, 'Refeição', 'expense', 'fa-utensils', NOW()),
  -- Roupas e acessórios
  (user_id, 'Roupas e acessórios', 'expense', 'fa-tshirt', NOW()),
  -- Proteção Pessoal / Saúde / Farmácia
  (user_id, 'Proteção Pessoal / Saúde / Farmácia', 'expense', 'fa-heartbeat', NOW()),
  -- Tarifas Bancárias / Juros / Impostos / Taxas
  (user_id, 'Tarifas Bancárias / Juros / Impostos / Taxas', 'expense', 'fa-file-invoice-dollar', NOW()),
  -- Telefone / Apps
  (user_id, 'Telefone / Apps', 'expense', 'fa-mobile-alt', NOW()),
  -- Transporte
  (user_id, 'Transporte', 'expense', 'fa-car', NOW());

  -- Insert income categories (Ganhos)
  INSERT INTO public.categories (user_id, name, category_type, icon, created_at) VALUES
  -- Salário / 13° Salário / Férias
  (user_id, 'Salário / 13° Salário / Férias', 'income', 'fa-briefcase', NOW()),
  -- Pró Labore
  (user_id, 'Pró Labore', 'income', 'fa-handshake', NOW()),
  -- Participação de Lucros / Comissões
  (user_id, 'Participação de Lucros / Comissões', 'income', 'fa-percentage', NOW()),
  -- Renda de Investimentos
  (user_id, 'Renda de Investimentos', 'income', 'fa-chart-line', NOW()),
  -- Outras Receitas (Aluguéis, extras, reembolso etc.)
  (user_id, 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'income', 'fa-plus-circle', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_initial_categories_for_user(UUID) TO authenticated;

COMMIT;
