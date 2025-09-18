-- Inicia uma transação para garantir que todas as operações sejam atômicas
BEGIN;

-- 1. Tabelas Principais
-- Tabela para gerenciar contas financeiras
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  type text NOT NULL, -- 'Corrente', 'Poupanca', 'Dinheiro'
  initial_balance numeric NOT NULL DEFAULT 0,
  color text, -- Código hexadecimal para a cor
  created_at timestamptz DEFAULT now()
);

-- Tabela para gerenciar categorias de transações
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tabela para gerenciar membros da família (opcional)
CREATE TABLE family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tabela para gerenciar cartões de crédito
CREATE TABLE credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  brand text, -- 'Visa', 'Mastercard'
  "limit" numeric NOT NULL,
  statement_date integer NOT NULL, -- Dia de fechamento da fatura (1-31)
  due_date integer NOT NULL, -- Dia de vencimento da fatura (1-31)
  connected_account_id uuid, -- Conta que paga a fatura
  created_at timestamptz DEFAULT now()
);

-- Tabela para gerenciar transações financeiras
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  description text NOT NULL,
  value numeric NOT NULL,
  date date NOT NULL,
  type text NOT NULL, -- 'expense', 'income', 'transfer'
  payment_method text, -- 'debit', 'credit'
  installments integer, -- Número de parcelas
  installment_number integer, -- Parcela atual
  is_fixed boolean NOT NULL DEFAULT FALSE,
  account_id uuid,
  credit_card_id uuid,
  category_id uuid,
  family_member_id uuid,
  created_at timestamptz DEFAULT now()
);

-- 2. Chaves Estrangeiras
-- Adiciona chaves estrangeiras para a tabela de transações
ALTER TABLE transactions
  ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  ADD CONSTRAINT transactions_credit_card_id_fkey FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id) ON DELETE SET NULL,
  ADD CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  ADD CONSTRAINT transactions_family_member_id_fkey FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE SET NULL;

-- Adiciona chave estrangeira para a tabela de cartões de crédito
ALTER TABLE credit_cards
  ADD CONSTRAINT credit_cards_account_id_fkey FOREIGN KEY (connected_account_id) REFERENCES accounts(id) ON DELETE SET NULL;


-- 3. Políticas de Row-Level Security (RLS)
-- Garante que um usuário só possa acessar os próprios dados

-- Ativa RLS para todas as tabelas
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para a tabela 'accounts'
CREATE POLICY "Users can manage their own accounts."
  ON accounts FOR ALL USING (auth.uid() = user_id);

-- Políticas para a tabela 'categories'
CREATE POLICY "Users can manage their own categories."
  ON categories FOR ALL USING (auth.uid() = user_id);

-- Políticas para a tabela 'family_members'
CREATE POLICY "Users can manage their own family members."
  ON family_members FOR ALL USING (auth.uid() = user_id);

-- Políticas para a tabela 'credit_cards'
CREATE POLICY "Users can manage their own credit cards."
  ON credit_cards FOR ALL USING (auth.uid() = user_id);

-- Políticas para a tabela 'transactions'
CREATE POLICY "Users can manage their own transactions."
  ON transactions FOR ALL USING (auth.uid() = user_id);

-- Finaliza a transação
COMMIT;
