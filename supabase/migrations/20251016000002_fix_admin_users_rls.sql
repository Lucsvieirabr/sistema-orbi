-- ============================================================================
-- FIX: Recursão infinita nas políticas RLS de admin_users
-- ============================================================================

-- Remover políticas antigas que causam recursão
DROP POLICY IF EXISTS "Apenas admins podem ver outros admins" ON public.admin_users;
DROP POLICY IF EXISTS "Apenas super_admins podem gerenciar admins" ON public.admin_users;

-- ============================================================================
-- NOVA ABORDAGEM: Permitir que usuários vejam apenas seu próprio registro
-- ============================================================================

-- Política 1: Usuários podem ver seu próprio registro de admin
CREATE POLICY "Usuários podem ver seu próprio registro admin"
  ON public.admin_users
  FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- CRIAR FUNÇÃO AUXILIAR PARA VERIFICAR SE É SUPER ADMIN (evita recursão)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
SECURITY DEFINER  -- Bypass RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Política 2: Apenas super_admins podem inserir novos admins
CREATE POLICY "Super admins podem criar admins"
  ON public.admin_users
  FOR INSERT
  WITH CHECK (public.is_super_admin());

-- Política 3: Apenas super_admins podem atualizar admins
CREATE POLICY "Super admins podem atualizar admins"
  ON public.admin_users
  FOR UPDATE
  USING (public.is_super_admin());

-- Política 4: Apenas super_admins podem deletar admins
CREATE POLICY "Super admins podem deletar admins"
  ON public.admin_users
  FOR DELETE
  USING (public.is_super_admin());

-- ============================================================================
-- ATUALIZAR FUNÇÃO is_admin() para usar SECURITY DEFINER (bypass RLS)
-- ============================================================================

-- Recriar função is_admin com SECURITY DEFINER
DROP FUNCTION IF EXISTS public.is_admin();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
SECURITY DEFINER  -- Isso faz a função rodar com permissões do owner (bypassa RLS)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = true
  );
END;
$$;

-- ============================================================================
-- CRIAR FUNÇÃO PARA OBTER DADOS DO ADMIN (usado pelo hook)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_user()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role text,
  permissions jsonb,
  is_active boolean
)
SECURITY DEFINER  -- Bypass RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.user_id,
    au.role,
    au.permissions,
    au.is_active
  FROM public.admin_users au
  WHERE au.user_id = auth.uid()
    AND au.is_active = true
  LIMIT 1;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Garantir que authenticated pode executar as funções
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user() TO authenticated;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION public.is_admin() IS 'Verifica se o usuário atual é admin (SECURITY DEFINER para evitar recursão RLS)';
COMMENT ON FUNCTION public.get_admin_user() IS 'Retorna dados do admin atual (SECURITY DEFINER para uso em hooks)';
COMMENT ON POLICY "Usuários podem ver seu próprio registro admin" ON public.admin_users IS 'Permite que usuários vejam apenas seu próprio registro de admin, evitando recursão';

