-- ============================================================================
-- Auto-criar user_profiles quando novo usuário se registra
-- ============================================================================

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Criar perfil para novo usuário
  INSERT INTO public.user_profiles (user_id, email, onboarding_completed)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email;
  
  RETURN NEW;
END;
$$;

-- Trigger para executar quando novo usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger para atualizar email quando mudado em auth.users
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_new_user();

-- Comentários
COMMENT ON FUNCTION public.handle_new_user() IS 'Cria/atualiza perfil de usuário automaticamente quando registrado no auth';

