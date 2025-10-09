-- Seed: Initial categories for new users

BEGIN;

-- Clear existing categories for fresh start (only if needed)
-- DELETE FROM public.categories WHERE user_id IS NOT NULL;

-- Insert expense categories (Gastos)
INSERT INTO public.categories (user_id, name, category_type, icon, created_at) VALUES
-- Alimentação
('00000000-0000-0000-0000-000000000000', 'Alimentação', 'expense', 'utensils', NOW()),
--Assinaturas
('00000000-0000-0000-0000-000000000000', 'Assinaturas', 'expense', 'subscription', NOW()),
-- Bem Estar / Beleza
('00000000-0000-0000-0000-000000000000', 'Bem Estar / Beleza', 'expense', 'sparkles', NOW()),
-- Casa
('00000000-0000-0000-0000-000000000000', 'Casa', 'expense', 'home', NOW()),
-- Diarista / Prestadores Serv.
('00000000-0000-0000-0000-000000000000', 'Diarista / Prestadores Serv.', 'expense', 'wrench', NOW()),
-- Despesas Pessoais
('00000000-0000-0000-0000-000000000000', 'Despesas Pessoais', 'expense', 'user', NOW()),
-- Empréstimos / Financiamentos
('00000000-0000-0000-0000-000000000000', 'Empréstimos / Financiamentos', 'expense', 'credit-card', NOW()),
-- Férias / Viagens
('00000000-0000-0000-0000-000000000000', 'Férias / Viagens', 'expense', 'plane', NOW()),
-- Filhos / Dependentes
('00000000-0000-0000-0000-000000000000', 'Filhos / Dependentes', 'expense', 'baby', NOW()),
-- Investimentos (pelo menos 20% da receita)
('00000000-0000-0000-0000-000000000000', 'Investimentos (pelo menos 20% da receita)', 'expense', 'chart-line', NOW()),
-- Gastos com PJ / Profissionais Autônomos
('00000000-0000-0000-0000-000000000000', 'Gastos com PJ / Profissionais Autônomos', 'expense', 'briefcase', NOW()),
-- Lazer
('00000000-0000-0000-0000-000000000000', 'Lazer', 'expense', 'gamepad', NOW()),
-- Outros
('00000000-0000-0000-0000-000000000000', 'Outros', 'expense', 'more-horizontal', NOW()),
-- Pet
('00000000-0000-0000-0000-000000000000', 'Pet', 'expense', 'dog', NOW()),
-- Presentes / Compras
('00000000-0000-0000-0000-000000000000', 'Presentes / Compras', 'expense', 'gift', NOW()),
-- Refeição
('00000000-0000-0000-0000-000000000000', 'Refeição', 'expense', 'coffee', NOW()),
-- Roupas e acessórios
('00000000-0000-0000-0000-000000000000', 'Roupas e acessórios', 'expense', 'shirt', NOW()),
-- Proteção Pessoal / Saúde / Farmácia
('00000000-0000-0000-0000-000000000000', 'Proteção Pessoal / Saúde / Farmácia', 'expense', 'heart', NOW()),
-- Tarifas Bancárias / Juros / Impostos / Taxas
('00000000-0000-0000-0000-000000000000', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'expense', 'receipt', NOW()),
-- Telefone / Apps
('00000000-0000-0000-0000-000000000000', 'Telefone / Apps', 'expense', 'smartphone', NOW()),
-- Transporte
('00000000-0000-0000-0000-000000000000', 'Transporte', 'expense', 'car', NOW());

-- Insert income categories (Ganhos)
INSERT INTO public.categories (user_id, name, category_type, icon, created_at) VALUES
-- Salário / 13° Salário / Férias
('00000000-0000-0000-0000-000000000000', 'Salário / 13° Salário / Férias', 'income', 'briefcase', NOW()),
-- Pró Labore
('00000000-0000-0000-0000-000000000000', 'Pró Labore', 'income', 'handshake', NOW()),
-- Participação de Lucros / Comissões
('00000000-0000-0000-0000-000000000000', 'Participação de Lucros / Comissões', 'income', 'percent', NOW()),
-- Renda de Investimentos
('00000000-0000-0000-0000-000000000000', 'Renda de Investimentos', 'income', 'chart-line', NOW()),
-- Outras Receitas (Aluguéis, extras, reembolso etc.)
('00000000-0000-0000-0000-000000000000', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'income', 'plus-circle', NOW());

COMMIT;
