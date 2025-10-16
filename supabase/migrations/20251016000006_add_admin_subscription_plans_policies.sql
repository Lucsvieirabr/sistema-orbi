-- ============================================================================
-- POLÍTICAS RLS PARA ADMINS GERENCIAREM PLANOS DE ASSINATURA
-- ============================================================================

-- Política: Admins podem inserir novos planos
CREATE POLICY "Admins podem criar planos de assinatura"
  ON public.subscription_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Política: Admins podem atualizar planos
CREATE POLICY "Admins podem atualizar planos de assinatura"
  ON public.subscription_plans
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Política: Admins podem deletar planos
CREATE POLICY "Admins podem deletar planos de assinatura"
  ON public.subscription_plans
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Política: Admins podem ver todos os planos (inclusive inativos)
CREATE POLICY "Admins podem ver todos os planos"
  ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON POLICY "Admins podem criar planos de assinatura" ON public.subscription_plans IS 
  'Permite que administradores criem novos planos de assinatura';

COMMENT ON POLICY "Admins podem atualizar planos de assinatura" ON public.subscription_plans IS 
  'Permite que administradores atualizem planos de assinatura existentes';

COMMENT ON POLICY "Admins podem deletar planos de assinatura" ON public.subscription_plans IS 
  'Permite que administradores deletem planos de assinatura';

COMMENT ON POLICY "Admins podem ver todos os planos" ON public.subscription_plans IS 
  'Permite que administradores vejam todos os planos, inclusive os inativos';

