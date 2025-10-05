-- Seed: Initial categories for new users

BEGIN;

-- Clear existing categories for fresh start (only if needed)
-- DELETE FROM public.categories WHERE user_id IS NOT NULL;

-- Insert expense categories (Gastos)
INSERT INTO public.categories (user_id, name, category_type, icon, created_at) VALUES
-- Alimentação
('00000000-0000-0000-0000-000000000000', 'Alimentação', 'expense', 'fa-utensils', NOW()),
-- Bem Estar / Beleza
('00000000-0000-0000-0000-000000000000', 'Bem Estar / Beleza', 'expense', 'fa-spa', NOW()),
-- Casa
('00000000-0000-0000-0000-000000000000', 'Casa', 'expense', 'fa-home', NOW()),
-- Diarista / Prestadores Serv.
('00000000-0000-0000-0000-000000000000', 'Diarista / Prestadores Serv.', 'expense', 'fa-user-tie', NOW()),
-- Despesas Pessoais
('00000000-0000-0000-0000-000000000000', 'Despesas Pessoais', 'expense', 'fa-user', NOW()),
-- Empréstimos / Financiamentos
('00000000-0000-0000-0000-000000000000', 'Empréstimos / Financiamentos', 'expense', 'fa-credit-card', NOW()),
-- Férias / Viagens
('00000000-0000-0000-0000-000000000000', 'Férias / Viagens', 'expense', 'fa-plane', NOW()),
-- Filhos / Dependentes
('00000000-0000-0000-0000-000000000000', 'Filhos / Dependentes', 'expense', 'fa-child', NOW()),
-- Investimentos (pelo menos 20% da receita)
('00000000-0000-0000-0000-000000000000', 'Investimentos (pelo menos 20% da receita)', 'expense', 'fa-chart-line', NOW()),
-- Gastos com PJ / Profissionais Autônomos
('00000000-0000-0000-0000-000000000000', 'Gastos com PJ / Profissionais Autônomos', 'expense', 'fa-briefcase', NOW()),
-- Lazer
('00000000-0000-0000-0000-000000000000', 'Lazer', 'expense', 'fa-gamepad', NOW()),
-- Outros
('00000000-0000-0000-0000-000000000000', 'Outros', 'expense', 'fa-ellipsis-h', NOW()),
-- Pet
('00000000-0000-0000-0000-000000000000', 'Pet', 'expense', 'fa-paw', NOW()),
-- Presentes / Compras
('00000000-0000-0000-0000-000000000000', 'Presentes / Compras', 'expense', 'fa-gift', NOW()),
-- Refeição
('00000000-0000-0000-0000-000000000000', 'Refeição', 'expense', 'fa-utensils', NOW()),
-- Roupas e acessórios
('00000000-0000-0000-0000-000000000000', 'Roupas e acessórios', 'expense', 'fa-tshirt', NOW()),
-- Proteção Pessoal / Saúde / Farmácia
('00000000-0000-0000-0000-000000000000', 'Proteção Pessoal / Saúde / Farmácia', 'expense', 'fa-heartbeat', NOW()),
-- Tarifas Bancárias / Juros / Impostos / Taxas
('00000000-0000-0000-0000-000000000000', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'expense', 'fa-file-invoice-dollar', NOW()),
-- Telefone / Apps
('00000000-0000-0000-0000-000000000000', 'Telefone / Apps', 'expense', 'fa-mobile-alt', NOW()),
-- Transporte
('00000000-0000-0000-0000-000000000000', 'Transporte', 'expense', 'fa-car', NOW());

-- Insert income categories (Ganhos)
INSERT INTO public.categories (user_id, name, category_type, icon, created_at) VALUES
-- Salário / 13° Salário / Férias
('00000000-0000-0000-0000-000000000000', 'Salário / 13° Salário / Férias', 'income', 'fa-briefcase', NOW()),
-- Pró Labore
('00000000-0000-0000-0000-000000000000', 'Pró Labore', 'income', 'fa-handshake', NOW()),
-- Participação de Lucros / Comissões
('00000000-0000-0000-0000-000000000000', 'Participação de Lucros / Comissões', 'income', 'fa-percentage', NOW()),
-- Renda de Investimentos
('00000000-0000-0000-0000-000000000000', 'Renda de Investimentos', 'income', 'fa-chart-line', NOW()),
-- Outras Receitas (Aluguéis, extras, reembolso etc.)
('00000000-0000-0000-0000-000000000000', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'income', 'fa-plus-circle', NOW());

COMMIT;
