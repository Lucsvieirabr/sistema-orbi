-- Migration: Sistema de Categorias Globais
-- Esta migration resolve o problema de categorias duplicadas e cria um sistema eficiente
-- onde categorias iniciais são globais (compartilhadas) e usuários podem criar suas próprias

BEGIN;

-- 1. Remover a política antiga de categorias
DROP POLICY IF EXISTS "Users can manage their own categories." ON categories;

-- 2. Alterar a coluna user_id para permitir NULL (categorias globais)
ALTER TABLE categories ALTER COLUMN user_id DROP NOT NULL;

-- 3. Adicionar coluna para identificar categorias do sistema
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- 4. Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_system ON categories(is_system);

-- 5. Limpar todas as categorias duplicadas dos usuários
-- Manter apenas as categorias personalizadas (aquelas que não fazem parte do conjunto padrão)
DELETE FROM categories WHERE user_id IS NOT NULL;

-- 6. Limpar categorias antigas do seed
DELETE FROM categories WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- 7. Criar categorias globais do sistema (uma vez, compartilhadas por todos)
-- Estas categorias terão user_id = NULL e is_system = TRUE

-- Categorias de Despesas
INSERT INTO public.categories (user_id, name, category_type, icon, is_system, created_at) VALUES
-- Alimentação
(NULL, 'Alimentação', 'expense', 'utensils', TRUE, NOW()),
-- Assinaturas (categoria protegida)
(NULL, 'Assinaturas', 'expense', 'captions', TRUE, NOW()),
-- Bem Estar / Beleza
(NULL, 'Bem Estar / Beleza', 'expense', 'sparkles', TRUE, NOW()),
-- Casa
(NULL, 'Casa', 'expense', 'home', TRUE, NOW()),
-- Diarista / Prestadores Serv.
(NULL, 'Diarista / Prestadores Serv.', 'expense', 'wrench', TRUE, NOW()),
-- Despesas Pessoais
(NULL, 'Despesas Pessoais', 'expense', 'user', TRUE, NOW()),
-- Empréstimos / Financiamentos
(NULL, 'Empréstimos / Financiamentos', 'expense', 'credit-card', TRUE, NOW()),
-- Férias / Viagens
(NULL, 'Férias / Viagens', 'expense', 'plane', TRUE, NOW()),
-- Filhos / Dependentes
(NULL, 'Filhos / Dependentes', 'expense', 'baby', TRUE, NOW()),
-- Investimentos (pelo menos 20% da receita)
(NULL, 'Investimentos (pelo menos 20% da receita)', 'expense', 'chart-line', TRUE, NOW()),
-- Gastos com PJ / Profissionais Autônomos
(NULL, 'Gastos com PJ / Profissionais Autônomos', 'expense', 'briefcase', TRUE, NOW()),
-- Lazer
(NULL, 'Lazer', 'expense', 'gamepad', TRUE, NOW()),
-- Outros
(NULL, 'Outros', 'expense', 'more-horizontal', TRUE, NOW()),
-- Pet
(NULL, 'Pet', 'expense', 'dog', TRUE, NOW()),
-- Presentes / Compras
(NULL, 'Presentes / Compras', 'expense', 'gift', TRUE, NOW()),
-- Refeição
(NULL, 'Refeição', 'expense', 'coffee', TRUE, NOW()),
-- Roupas e acessórios
(NULL, 'Roupas e acessórios', 'expense', 'shirt', TRUE, NOW()),
-- Proteção Pessoal / Saúde / Farmácia
(NULL, 'Proteção Pessoal / Saúde / Farmácia', 'expense', 'heart', TRUE, NOW()),
-- Tarifas Bancárias / Juros / Impostos / Taxas
(NULL, 'Tarifas Bancárias / Juros / Impostos / Taxas', 'expense', 'receipt', TRUE, NOW()),
-- Telefone / Apps
(NULL, 'Telefone / Apps', 'expense', 'smartphone', TRUE, NOW()),
-- Transporte
(NULL, 'Transporte', 'expense', 'car', TRUE, NOW())
ON CONFLICT DO NOTHING;

-- Categorias de Receitas
INSERT INTO public.categories (user_id, name, category_type, icon, is_system, created_at) VALUES
-- Salário / 13° Salário / Férias
(NULL, 'Salário / 13° Salário / Férias', 'income', 'briefcase', TRUE, NOW()),
-- Pró Labore
(NULL, 'Pró Labore', 'income', 'handshake', TRUE, NOW()),
-- Participação de Lucros / Comissões
(NULL, 'Participação de Lucros / Comissões', 'income', 'percent', TRUE, NOW()),
-- Renda de Investimentos
(NULL, 'Renda de Investimentos', 'income', 'chart-line', TRUE, NOW()),
-- Outras Receitas (Aluguéis, extras, reembolso etc.)
(NULL, 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'income', 'plus-circle', TRUE, NOW())
ON CONFLICT DO NOTHING;

-- 8. Criar novas políticas RLS para categorias
-- Usuários podem ver categorias globais (system) E suas próprias categorias
CREATE POLICY "Users can view global and own categories"
  ON categories FOR SELECT
  USING (is_system = TRUE OR auth.uid() = user_id);

-- Usuários podem inserir apenas suas próprias categorias (não podem criar categorias globais)
CREATE POLICY "Users can create own categories"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_system = FALSE);

-- Usuários podem atualizar apenas suas próprias categorias (não podem editar categorias globais)
CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id AND is_system = FALSE)
  WITH CHECK (auth.uid() = user_id AND is_system = FALSE);

-- Usuários podem deletar apenas suas próprias categorias (não podem deletar categorias globais)
CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  USING (auth.uid() = user_id AND is_system = FALSE);

-- 9. Remover a função antiga de auto-criação de categorias
-- Não precisamos mais dela, pois as categorias são globais
DROP FUNCTION IF EXISTS public.create_initial_categories_for_user(UUID);

COMMIT;

