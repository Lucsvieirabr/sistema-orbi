-- Dados iniciais para desenvolvimento local
-- Este arquivo será executado automaticamente quando o banco for resetado

-- Inserir categorias padrão
INSERT INTO categories (id, user_id, name) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Alimentação'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Transporte'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Utilidades'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Lazer'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Saúde'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Educação'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Trabalho'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Investimentos'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Outros');

-- Inserir contas padrão
INSERT INTO accounts (id, user_id, name, type, initial_balance, color) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Conta Corrente Principal', 'Corrente', 5000.00, '#3B82F6'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Poupança', 'Poupanca', 10000.00, '#10B981'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Dinheiro', 'Dinheiro', 500.00, '#F59E0B');

-- Inserir membros da família padrão
INSERT INTO family_members (id, user_id, name) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Eu'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Cônjuge'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Filho(a)');

-- Inserir cartões de crédito padrão
INSERT INTO credit_cards (id, user_id, name, brand, "limit", statement_date, due_date) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Cartão Principal', 'Visa', 5000.00, 15, 20),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Cartão Secundário', 'Mastercard', 3000.00, 10, 15);

-- Inserir transações de exemplo
INSERT INTO transactions (id, user_id, description, value, date, type, payment_method, account_id, category_id) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Salário', 5000.00, '2024-01-15', 'income', 'debit', 
   (SELECT id FROM accounts WHERE name = 'Conta Corrente Principal' LIMIT 1),
   (SELECT id FROM categories WHERE name = 'Trabalho' LIMIT 1)),
  
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Supermercado', -350.00, '2024-01-14', 'expense', 'debit',
   (SELECT id FROM accounts WHERE name = 'Conta Corrente Principal' LIMIT 1),
   (SELECT id FROM categories WHERE name = 'Alimentação' LIMIT 1)),
  
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Freelance', 800.00, '2024-01-13', 'income', 'debit',
   (SELECT id FROM accounts WHERE name = 'Conta Corrente Principal' LIMIT 1),
   (SELECT id FROM categories WHERE name = 'Trabalho' LIMIT 1)),
  
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Conta de Luz', -120.00, '2024-01-12', 'expense', 'debit',
   (SELECT id FROM accounts WHERE name = 'Conta Corrente Principal' LIMIT 1),
   (SELECT id FROM categories WHERE name = 'Utilidades' LIMIT 1)),
  
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Gasolina', -200.00, '2024-01-11', 'expense', 'debit',
   (SELECT id FROM accounts WHERE name = 'Conta Corrente Principal' LIMIT 1),
   (SELECT id FROM categories WHERE name = 'Transporte' LIMIT 1));
