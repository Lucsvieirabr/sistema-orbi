-- ============================================================================
-- FUNÇÃO PARA CRIAR USUÁRIO ADMIN (COM AUTENTICAÇÃO)
-- ============================================================================

-- Esta função cria um novo usuário no auth.users e adiciona como super_admin
-- Apenas super_admins podem executar esta função

DROP FUNCTION IF EXISTS public.admin_create_admin_user(text, text, text);

CREATE OR REPLACE FUNCTION public.admin_create_admin_user(
  p_email text,
  p_password text,
  p_full_name text
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- Verificar se usuário é super_admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas super administradores podem criar novos admins';
  END IF;

  -- Validações
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email é obrigatório';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter no mínimo 6 caracteres';
  END IF;

  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Nome completo é obrigatório';
  END IF;

  -- Verificar se email já existe
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))
  ) THEN
    RAISE EXCEPTION 'Já existe um usuário com este email';
  END IF;

  -- Criar usuário no auth.users
  -- Nota: Isso requer permissões SECURITY DEFINER e acesso à tabela auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000', -- instance_id padrão
    gen_random_uuid(), -- id do usuário
    'authenticated',
    'authenticated',
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf')), -- Hash da senha
    NOW(), -- email já confirmado
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name),
    false,
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  -- Criar perfil do usuário
  INSERT INTO public.user_profiles (
    user_id,
    email,
    full_name,
    onboarding_completed
  )
  VALUES (
    v_user_id,
    lower(trim(p_email)),
    trim(p_full_name),
    true -- Admin já tem onboarding completo
  );

  -- Adicionar como super_admin na tabela admin_users
  INSERT INTO public.admin_users (
    user_id,
    role,
    permissions,
    is_active
  )
  VALUES (
    v_user_id,
    'super_admin',
    '{}'::jsonb, -- Permissões vazias (super_admin tem todas)
    true
  );

  -- Registrar no audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    new_data,
    metadata
  )
  VALUES (
    auth.uid(), -- Quem criou
    'create',
    'admin_user',
    v_user_id,
    jsonb_build_object(
      'email', p_email,
      'full_name', p_full_name,
      'role', 'super_admin'
    ),
    jsonb_build_object('created_by', auth.uid())
  );

  -- Retornar resultado
  v_result := jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', p_email,
    'full_name', p_full_name,
    'role', 'super_admin'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, fazer rollback automático e retornar erro
    RAISE;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.admin_create_admin_user(text, text, text) TO authenticated;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION public.admin_create_admin_user(text, text, text) IS 
  'Cria um novo usuário admin no sistema (apenas super admins podem executar)';

