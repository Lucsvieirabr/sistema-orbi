# 🔒 Validação de Limites no Backend

## 📋 Problema Identificado

O sistema atual valida limites **apenas no frontend**, o que permite que usuários tecnicamente habilidosos:
1. Burlem as validações através de ferramentas de desenvolvedor
2. Façam requisições diretas à API ignorando os limites
3. Criem mais recursos do que permitido por seu plano

## ✅ Solução: Validação no Backend com Triggers

### Criar Trigger para Validar Limites

Vamos criar triggers SQL que validam os limites antes de inserir novos registros.

#### 1. Trigger para Contas

```sql
-- Função para verificar limite de contas
CREATE OR REPLACE FUNCTION check_accounts_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_subscription RECORD;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Buscar subscription ativa do usuário
  SELECT 
    s.id,
    sp.limits
  INTO user_subscription
  FROM user_subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = NEW.user_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Se não tem subscription ativa, bloquear
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada';
  END IF;

  -- Pegar limite do plano (se não tiver, usar padrão de 3)
  max_allowed := COALESCE((user_subscription.limits->>'max_contas')::INTEGER, 3);

  -- Se for ilimitado (-1), permitir
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  -- Contar contas atuais do usuário
  SELECT COUNT(*) INTO current_count
  FROM accounts
  WHERE user_id = NEW.user_id;

  -- Verificar se atingiu o limite
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de contas atingido. Seu plano permite % contas. Faça upgrade para criar mais.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS validate_accounts_limit ON accounts;
CREATE TRIGGER validate_accounts_limit
  BEFORE INSERT ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION check_accounts_limit();
```

#### 2. Trigger para Categorias

```sql
-- Função para verificar limite de categorias
CREATE OR REPLACE FUNCTION check_categories_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_subscription RECORD;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Apenas validar se NÃO for categoria de sistema
  IF NEW.is_system = true THEN
    RETURN NEW;
  END IF;

  -- Buscar subscription ativa do usuário
  SELECT 
    s.id,
    sp.limits
  INTO user_subscription
  FROM user_subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = NEW.user_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada';
  END IF;

  -- Pegar limite do plano
  max_allowed := COALESCE((user_subscription.limits->>'max_categorias')::INTEGER, 20);

  -- Se for ilimitado (-1), permitir
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  -- Contar apenas categorias NÃO-SISTEMA do usuário
  SELECT COUNT(*) INTO current_count
  FROM categories
  WHERE user_id = NEW.user_id
    AND is_system = false;

  -- Verificar se atingiu o limite
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de categorias atingido. Seu plano permite % categorias personalizadas. Faça upgrade para criar mais.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS validate_categories_limit ON categories;
CREATE TRIGGER validate_categories_limit
  BEFORE INSERT ON categories
  FOR EACH ROW
  EXECUTE FUNCTION check_categories_limit();
```

#### 3. Trigger para Cartões de Crédito

```sql
-- Função para verificar limite de cartões
CREATE OR REPLACE FUNCTION check_credit_cards_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_subscription RECORD;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Buscar subscription ativa do usuário
  SELECT 
    s.id,
    sp.limits
  INTO user_subscription
  FROM user_subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = NEW.user_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada';
  END IF;

  -- Pegar limite do plano
  max_allowed := COALESCE((user_subscription.limits->>'max_cartoes')::INTEGER, 2);

  -- Se for ilimitado (-1), permitir
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  -- Contar cartões atuais do usuário
  SELECT COUNT(*) INTO current_count
  FROM credit_cards
  WHERE user_id = NEW.user_id;

  -- Verificar se atingiu o limite
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de cartões atingido. Seu plano permite % cartões. Faça upgrade para criar mais.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS validate_credit_cards_limit ON credit_cards;
CREATE TRIGGER validate_credit_cards_limit
  BEFORE INSERT ON credit_cards
  FOR EACH ROW
  EXECUTE FUNCTION check_credit_cards_limit();
```

#### 4. Trigger para Pessoas

```sql
-- Função para verificar limite de pessoas
CREATE OR REPLACE FUNCTION check_people_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_subscription RECORD;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Buscar subscription ativa do usuário
  SELECT 
    s.id,
    sp.limits
  INTO user_subscription
  FROM user_subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = NEW.user_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada';
  END IF;

  -- Pegar limite do plano
  max_allowed := COALESCE((user_subscription.limits->>'max_pessoas')::INTEGER, 10);

  -- Se for ilimitado (-1), permitir
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  -- Contar pessoas atuais do usuário
  SELECT COUNT(*) INTO current_count
  FROM people
  WHERE user_id = NEW.user_id;

  -- Verificar se atingiu o limite
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de pessoas atingido. Seu plano permite % pessoas. Faça upgrade para criar mais.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS validate_people_limit ON people;
CREATE TRIGGER validate_people_limit
  BEFORE INSERT ON people
  FOR EACH ROW
  EXECUTE FUNCTION check_people_limit();
```

#### 5. Trigger para Transações (Limite Mensal)

```sql
-- Função para verificar limite de transações por mês
CREATE OR REPLACE FUNCTION check_transactions_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_subscription RECORD;
  current_count INTEGER;
  max_allowed INTEGER;
  current_month DATE;
BEGIN
  -- Buscar subscription ativa do usuário
  SELECT 
    s.id,
    sp.limits
  INTO user_subscription
  FROM user_subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = NEW.user_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada';
  END IF;

  -- Pegar limite do plano
  max_allowed := COALESCE((user_subscription.limits->>'max_transacoes_mes')::INTEGER, 500);

  -- Se for ilimitado (-1), permitir
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  -- Pegar primeiro dia do mês da transação
  current_month := DATE_TRUNC('month', NEW.date::DATE);

  -- Contar transações do usuário no mesmo mês
  SELECT COUNT(*) INTO current_count
  FROM transactions
  WHERE user_id = NEW.user_id
    AND DATE_TRUNC('month', date::DATE) = current_month;

  -- Verificar se atingiu o limite
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de transações mensais atingido. Seu plano permite % transações por mês. Faça upgrade para criar mais.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS validate_transactions_limit ON transactions;
CREATE TRIGGER validate_transactions_limit
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_transactions_limit();
```

---

## 📝 Como Aplicar os Triggers

### Opção 1: Criar Migration (Recomendado)

Crie um arquivo de migration:

```bash
supabase/migrations/YYYYMMDDHHMMSS_add_limits_validation_triggers.sql
```

Cole todos os triggers acima neste arquivo e execute:

```bash
supabase db push
```

### Opção 2: Executar Manualmente no Supabase

1. Acesse o painel do Supabase
2. Vá em **SQL Editor**
3. Crie uma nova query
4. Cole todos os triggers
5. Execute

---

## 🧪 Como Testar

### Teste 1: Limite de Contas

```sql
-- Configure um usuário com plano que permite 3 contas
-- Tente criar 4 contas

-- Deve funcionar (1ª, 2ª, 3ª conta)
INSERT INTO accounts (user_id, name, type, initial_balance)
VALUES ('user-id-aqui', 'Conta 1', 'Corrente', 0);

-- Deve FALHAR (4ª conta - acima do limite)
INSERT INTO accounts (user_id, name, type, initial_balance)
VALUES ('user-id-aqui', 'Conta 4', 'Corrente', 0);
-- ERRO: Limite de contas atingido. Seu plano permite 3 contas.
```

### Teste 2: Categorias (Apenas Não-Sistema)

```sql
-- Categorias de sistema NÃO contam no limite
INSERT INTO categories (user_id, name, is_system)
VALUES ('user-id-aqui', 'Sistema 1', true);  -- OK (não conta)

-- Categorias de usuário contam
INSERT INTO categories (user_id, name, is_system)
VALUES ('user-id-aqui', 'Minha Categoria 1', false);  -- Conta no limite
```

### Teste 3: Transações Mensais

```sql
-- Tente criar 501 transações no mesmo mês
-- As primeiras 500 devem funcionar
-- A 501ª deve FALHAR
INSERT INTO transactions (user_id, description, value, date, type)
VALUES ('user-id-aqui', 'Transação 501', 100, '2025-01-15', 'expense');
-- ERRO: Limite de transações mensais atingido.
```

---

## ✅ Benefícios da Validação no Backend

1. **Segurança**: Impossível burlar os limites
2. **Consistência**: Validação única em um lugar
3. **Mensagens Claras**: Erros descritivos para o usuário
4. **Performance**: Validação rápida no banco
5. **Auditoria**: Logs automáticos de tentativas de burla

---

## 🎯 Próximos Passos

1. ✅ **Validação frontend implementada** (FeatureGuard, LimitGuard, SelectWithAddButton)
2. ⏳ **Criar migrations com os triggers acima**
3. ⏳ **Testar em ambiente de desenvolvimento**
4. ⏳ **Aplicar em produção**
5. ⏳ **Monitorar logs de erros para identificar tentativas de burla**

---

## 📚 Referências

- [Triggers PostgreSQL](https://www.postgresql.org/docs/current/triggers.html)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)


