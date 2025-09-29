-- Seed: Initial categories for new users

BEGIN;

-- Clear existing categories for fresh start (only if needed)
-- DELETE FROM public.categories WHERE user_id IS NOT NULL;

-- Insert expense categories (Gastos)
INSERT INTO public.categories (user_id, name, category_type, icon, created_at) VALUES
-- Moradia
('00000000-0000-0000-0000-000000000000', 'Moradia', 'expense', 'fa-home', NOW()),
-- Alimentação
('00000000-0000-0000-0000-000000000000', 'Alimentação', 'expense', 'fa-utensils', NOW()),
-- Transporte
('00000000-0000-0000-0000-000000000000', 'Transporte', 'expense', 'fa-car', NOW()),
-- Saúde
('00000000-0000-0000-0000-000000000000', 'Saúde', 'expense', 'fa-heartbeat', NOW()),
-- Educação
('00000000-0000-0000-0000-000000000000', 'Educação', 'expense', 'fa-graduation-cap', NOW()),
-- Lazer e Viagem
('00000000-0000-0000-0000-000000000000', 'Lazer e Viagem', 'expense', 'fa-plane', NOW()),
-- Pessoal e Vestuário
('00000000-0000-0000-0000-000000000000', 'Pessoal e Vestuário', 'expense', 'fa-shopping-bag', NOW()),
-- Impostos e Taxas
('00000000-0000-0000-0000-000000000000', 'Impostos e Taxas', 'expense', 'fa-file-invoice-dollar', NOW());

-- Insert income categories (Ganhos)
INSERT INTO public.categories (user_id, name, category_type, icon, created_at) VALUES
-- Salário / Renda Principal
('00000000-0000-0000-0000-000000000000', 'Salário / Renda Principal', 'income', 'fa-briefcase', NOW()),
-- Renda Extra / Freelance
('00000000-0000-0000-0000-000000000000', 'Renda Extra / Freelance', 'income', 'fa-dollar-sign', NOW()),
-- Investimentos
('00000000-0000-0000-0000-000000000000', 'Investimentos', 'income', 'fa-chart-line', NOW()),
-- Presentes e Reembolsos
('00000000-0000-0000-0000-000000000000', 'Presentes e Reembolsos', 'income', 'fa-gift', NOW());

COMMIT;
