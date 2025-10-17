-- ============================================================================
-- GARANTIR PERMISSÕES COMPLETAS NAS TABELAS SAAS
-- ============================================================================
-- Garantir que o role "authenticated" tem todas as permissões necessárias

-- 1. Garantir USAGE no schema public
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Permissões em subscription_plans (SELECT apenas)
GRANT SELECT ON public.subscription_plans TO authenticated;

-- 3. Permissões em user_subscriptions (SELECT, INSERT, UPDATE)
GRANT SELECT, INSERT, UPDATE ON public.user_subscriptions TO authenticated;

-- 4. Permissões em user_profiles (SELECT, INSERT, UPDATE)
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- 5. Permissões em payment_history (SELECT, INSERT)
GRANT SELECT, INSERT ON public.payment_history TO authenticated;

-- 6. Permissões em user_usage (SELECT, INSERT, UPDATE) - se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_usage') THEN
    GRANT SELECT, INSERT, UPDATE ON public.user_usage TO authenticated;
  END IF;
END $$;

-- Comentário
COMMENT ON SCHEMA public IS 'Schema público com permissões para authenticated users';

