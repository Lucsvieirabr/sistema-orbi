-- ============================================================================
-- ESTRUTURA SAAS COMPLETA
-- ============================================================================

-- ============================================================================
-- 0. TABELA: user_profiles (perfis dos usuários)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  onboarding_completed boolean DEFAULT false,
  preferences jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas: Usuários veem apenas seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seu próprio perfil"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 1. TABELA: subscription_plans (planos de assinatura)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  trial_days integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  display_order integer DEFAULT 0,
  features jsonb DEFAULT '{}'::jsonb,
  limits jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  asaas_plan_id text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON public.subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_order ON public.subscription_plans(display_order);

-- RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Políticas: Qualquer um pode ver planos ativos
CREATE POLICY "Planos ativos são visíveis para todos"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true OR auth.role() = 'authenticated');

-- ============================================================================
-- 2. TABELA: user_subscriptions (assinaturas dos usuários)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'trial',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  current_period_start timestamptz NOT NULL DEFAULT NOW(),
  current_period_end timestamptz NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  cancel_at_period_end boolean DEFAULT false,
  trial_start timestamptz,
  trial_end timestamptz,
  asaas_customer_id text,
  asaas_subscription_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'expired')),
  CONSTRAINT valid_billing_cycle CHECK (billing_cycle IN ('monthly', 'annual'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON public.user_subscriptions(plan_id);

-- RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas: Usuários veem apenas sua assinatura
CREATE POLICY "Usuários veem suas próprias assinaturas"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias assinaturas"
  ON public.user_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. TABELA: payment_history (histórico de pagamentos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  asaas_payment_id text,
  asaas_invoice_url text,
  due_date timestamptz,
  paid_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  CONSTRAINT valid_payment_status CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded', 'canceled'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payment_history_user ON public.payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription ON public.payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON public.payment_history(status);

-- RLS
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Políticas: Usuários veem apenas seus pagamentos
CREATE POLICY "Usuários veem seu próprio histórico de pagamentos"
  ON public.payment_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. TABELA: user_usage (métricas de uso)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric text NOT NULL,
  count integer DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE(user_id, metric, period_start)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_usage_user ON public.user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_metric ON public.user_usage(metric);
CREATE INDEX IF NOT EXISTS idx_user_usage_period ON public.user_usage(period_start, period_end);

-- RLS
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- Políticas: Usuários veem apenas seu próprio uso
CREATE POLICY "Usuários veem suas próprias métricas de uso"
  ON public.user_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas métricas de uso"
  ON public.user_usage
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. TABELA: admin_users (administradores do sistema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  permissions jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT valid_admin_role CHECK (role IN ('admin', 'super_admin'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_admin_users_user ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(is_active);

-- RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Políticas definidas em migration separada (20251016000002)

-- ============================================================================
-- 6. TABELA: audit_logs (logs de auditoria)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas: Apenas admins podem ver logs
CREATE POLICY "Apenas admins podem ver logs de auditoria"
  ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============================================================================
-- FUNÇÕES AUXILIARES
-- ============================================================================

-- Função: Verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = true
  );
$$;

-- Função: Obter plano do usuário
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  plan_id uuid,
  plan_slug text,
  plan_name text,
  status text,
  features jsonb,
  limits jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  RETURN QUERY
  SELECT 
    p.id as plan_id,
    p.slug as plan_slug,
    p.name as plan_name,
    us.status,
    p.features,
    p.limits
  FROM public.user_subscriptions us
  INNER JOIN public.subscription_plans p ON us.plan_id = p.id
  WHERE us.user_id = v_user_id
    AND us.status IN ('trial', 'active')
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$;

-- Função: Verificar se usuário tem feature
CREATE OR REPLACE FUNCTION public.user_has_feature(feature_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_features jsonb;
BEGIN
  SELECT features INTO v_plan_features
  FROM public.get_user_plan();
  
  IF v_plan_features IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_plan_features ? feature_name;
END;
$$;

-- Função: Verificar limite de uso
CREATE OR REPLACE FUNCTION public.check_usage_limit(limit_name text, current_value integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_limits jsonb;
  v_limit_value integer;
BEGIN
  SELECT limits INTO v_plan_limits
  FROM public.get_user_plan();
  
  IF v_plan_limits IS NULL THEN
    RETURN false;
  END IF;
  
  v_limit_value := (v_plan_limits->>limit_name)::integer;
  
  -- -1 significa ilimitado
  IF v_limit_value = -1 THEN
    RETURN true;
  END IF;
  
  RETURN current_value < v_limit_value;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_user_usage_updated_at
  BEFORE UPDATE ON public.user_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_feature(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_usage_limit(text, integer) TO authenticated;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE public.user_profiles IS 'Perfis estendidos dos usuários';
COMMENT ON TABLE public.subscription_plans IS 'Planos de assinatura disponíveis no sistema';
COMMENT ON TABLE public.user_subscriptions IS 'Assinaturas dos usuários';
COMMENT ON TABLE public.payment_history IS 'Histórico de pagamentos';
COMMENT ON TABLE public.user_usage IS 'Métricas de uso dos usuários';
COMMENT ON TABLE public.admin_users IS 'Administradores do sistema';
COMMENT ON TABLE public.audit_logs IS 'Logs de auditoria do sistema';

COMMENT ON FUNCTION public.is_admin() IS 'Verifica se o usuário atual é administrador';
COMMENT ON FUNCTION public.get_user_plan(uuid) IS 'Retorna o plano ativo do usuário';
COMMENT ON FUNCTION public.user_has_feature(text) IS 'Verifica se o usuário tem acesso a uma feature específica';
COMMENT ON FUNCTION public.check_usage_limit(text, integer) IS 'Verifica se o usuário está dentro do limite de uso';

