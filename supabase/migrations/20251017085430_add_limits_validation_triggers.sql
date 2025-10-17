-- ============================================================================
-- VALIDAÇÃO DE LIMITES NO BACKEND USANDO TRIGGERS
-- ============================================================================
-- Esta migration implementa validação de limites por plano de assinatura
-- usando triggers SQL, prevenindo que usuários burlem as limitações pelo frontend.
-- ============================================================================

-- ============================================================================
-- 1. TRIGGER PARA VALIDAR LIMITE DE CONTAS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_accounts_limit()
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
  FROM public.user_subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = NEW.user_id
    AND s.status IN ('trial', 'active')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Se não tem subscription ativa, bloquear
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada para criar contas';
  END IF;

  -- Pegar limite do plano (se não tiver, usar padrão de 3)
  max_allowed := COALESCE((user_subscription.limits->>'max_contas')::INTEGER, 3);

  -- Se for ilimitado (-1), permitir
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  -- Contar contas atuais do usuário
  SELECT COUNT(*) INTO current_count
  FROM public.accounts
  WHERE user_id = NEW.user_id;

  -- Verificar se atingiu o limite
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de contas atingido. Seu plano permite % contas. Faça upgrade para criar mais.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS validate_accounts_limit ON public.accounts;
CREATE TRIGGER validate_accounts_limit
  BEFORE INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_accounts_limit();

-- ============================================================================
-- 2. TRIGGER PARA VALIDAR LIMITE DE CATEGORIAS (Apenas Não-Sistema)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_categories_limit()
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
  FROM public.user_subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = NEW.user_id
    AND s.status IN ('trial', 'active')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada para criar categorias';
  END IF;

  -- Pegar limite do plano
  max_allowed := COALESCE((user_subscription.limits->>'max_categorias')::INTEGER, 20);

  -- Se for ilimitado (-1), permitir
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  -- Contar apenas categorias NÃO-SISTEMA do usuário
  SELECT COUNT(*) INTO current_count
  FROM public.categories
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
DROP TRIGGER IF EXISTS validate_categories_limit ON public.categories;
CREATE TRIGGER validate_categories_limit
  BEFORE INSERT ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.check_categories_limit();

-- ============================================================================
-- 3. TRIGGER PARA VALIDAR LIMITE DE CARTÕES DE CRÉDITO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_credit_cards_limit()
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
  FROM public.user_subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = NEW.user_id
    AND s.status IN ('trial', 'active')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada para criar cartões de crédito';
  END IF;

  -- Pegar limite do plano
  max_allowed := COALESCE((user_subscription.limits->>'max_cartoes')::INTEGER, 2);

  -- Se for ilimitado (-1), permitir
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  -- Contar cartões atuais do usuário
  SELECT COUNT(*) INTO current_count
  FROM public.credit_cards
  WHERE user_id = NEW.user_id;

  -- Verificar se atingiu o limite
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de cartões atingido. Seu plano permite % cartões. Faça upgrade para criar mais.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS validate_credit_cards_limit ON public.credit_cards;
CREATE TRIGGER validate_credit_cards_limit
  BEFORE INSERT ON public.credit_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.check_credit_cards_limit();

-- ============================================================================
-- 4. TRIGGER PARA VALIDAR LIMITE DE PESSOAS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_people_limit()
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
  FROM public.user_subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = NEW.user_id
    AND s.status IN ('trial', 'active')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada para criar pessoas';
  END IF;

  -- Pegar limite do plano
  max_allowed := COALESCE((user_subscription.limits->>'max_pessoas')::INTEGER, 10);

  -- Se for ilimitado (-1), permitir
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  -- Contar pessoas atuais do usuário
  SELECT COUNT(*) INTO current_count
  FROM public.people
  WHERE user_id = NEW.user_id;

  -- Verificar se atingiu o limite
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de pessoas atingido. Seu plano permite % pessoas. Faça upgrade para criar mais.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS validate_people_limit ON public.people;
CREATE TRIGGER validate_people_limit
  BEFORE INSERT ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.check_people_limit();

-- ============================================================================
-- 5. TRIGGER PARA VALIDAR LIMITE DE TRANSAÇÕES (Limite Mensal)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_transactions_limit()
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
  FROM public.user_subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = NEW.user_id
    AND s.status IN ('trial', 'active')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma assinatura ativa encontrada para criar transações';
  END IF;

  -- Pegar limite do plano
  max_allowed := COALESCE((user_subscription.limits->>'max_transacoes_mes')::INTEGER, 500);

  -- Se for ilimitado (-1), permitir
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  -- Pegar primeiro dia do mês da transação
  current_month := DATE_TRUNC('month', NEW.date::DATE)::DATE;

  -- Contar transações do usuário no mesmo mês
  SELECT COUNT(*) INTO current_count
  FROM public.transactions
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
DROP TRIGGER IF EXISTS validate_transactions_limit ON public.transactions;
CREATE TRIGGER validate_transactions_limit
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_transactions_limit();

-- ============================================================================
-- GRANTS - Permitir que functions sejam executadas por usuários autenticados
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.check_accounts_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_categories_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_credit_cards_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_people_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_transactions_limit() TO authenticated;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION public.check_accounts_limit() IS 'Valida limite de contas antes de inserção baseado no plano do usuário';
COMMENT ON FUNCTION public.check_categories_limit() IS 'Valida limite de categorias personalizadas antes de inserção';
COMMENT ON FUNCTION public.check_credit_cards_limit() IS 'Valida limite de cartões de crédito antes de inserção';
COMMENT ON FUNCTION public.check_people_limit() IS 'Valida limite de pessoas antes de inserção';
COMMENT ON FUNCTION public.check_transactions_limit() IS 'Valida limite de transações mensais antes de inserção';
