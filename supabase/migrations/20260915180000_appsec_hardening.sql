BEGIN;

CREATE OR REPLACE FUNCTION public.peek_rate_limit_key(
  p_identity       TEXT,
  p_bucket         TEXT,
  p_limit          INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now          TIMESTAMPTZ := NOW();
  v_window       INTEGER     := GREATEST(COALESCE(p_window_seconds, 60), 1);
  v_window_start TIMESTAMPTZ;
  v_hits         INTEGER;
BEGIN
  IF p_identity IS NULL OR btrim(p_identity) = '' OR p_bucket IS NULL THEN
    RAISE EXCEPTION 'identity e bucket são obrigatórios' USING ERRCODE = '22004';
  END IF;

  v_window_start := to_timestamp(floor(extract(epoch FROM v_now) / v_window) * v_window);

  SELECT CASE WHEN rlc.window_start < v_window_start THEN 0 ELSE rlc.hits END
    INTO v_hits
    FROM public.rate_limit_counters rlc
   WHERE rlc.identity = left(p_identity, 200)
     AND rlc.bucket = p_bucket;

  v_hits := COALESCE(v_hits, 0);

  RETURN jsonb_build_object(
    'blocked', v_hits >= p_limit,
    'hits', v_hits,
    'limit', p_limit,
    'retry_after_seconds',
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_window_start + make_interval(secs => v_window) - v_now)))::int)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.peek_rate_limit_key(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peek_rate_limit_key(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.peek_rate_limit_key(TEXT, TEXT, INTEGER, INTEGER) IS
  'Lê o contador de (identity, bucket) sem incrementar. Lockout antes de validar segredo. Exclusiva de service_role.';

REVOKE SELECT ON public.subscription_plans FROM anon;
GRANT SELECT (
  id, name, slug, description, price_monthly, price_yearly, features, limits,
  is_active, is_featured, display_order, trial_days
) ON public.subscription_plans TO anon;

CREATE OR REPLACE FUNCTION public.admin_create_admin_user(
  p_email text,
  p_password text,
  p_full_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id   uuid;
  v_email     text := lower(btrim(COALESCE(p_email, '')));
  v_full_name text := btrim(regexp_replace(COALESCE(p_full_name, ''), '[[:cntrl:]]', ' ', 'g'));
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  IF v_email !~ '^[^@[:space:]]{1,64}@[^@[:space:]]{1,190}\.[a-z]{2,24}$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = '22023';
  END IF;

  IF p_password IS NULL
     OR length(p_password) < 12
     OR length(p_password) > 72
     OR p_password !~ '[A-Za-z]'
     OR p_password !~ '[0-9]'
  THEN
    RAISE EXCEPTION 'Senha deve ter entre 12 e 72 caracteres, com letras e números' USING ERRCODE = '22023';
  END IF;

  IF v_full_name = '' OR length(v_full_name) > 120 THEN
    RAISE EXCEPTION 'Nome completo é obrigatório (máximo 120 caracteres)' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Não foi possível criar o administrador com este e-mail' USING ERRCODE = '23505';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', v_full_name),
    false, '', '', '', ''
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.user_profiles (user_id, email, full_name, onboarding_completed)
  VALUES (v_user_id, v_email, v_full_name, true);

  INSERT INTO public.admin_users (user_id, role, permissions, is_active)
  VALUES (v_user_id, 'super_admin', '{}'::jsonb, true);

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data, metadata)
  VALUES (
    auth.uid(), 'create', 'admin_user', v_user_id,
    jsonb_build_object('email', v_email, 'full_name', v_full_name, 'role', 'super_admin'),
    jsonb_build_object('created_by', auth.uid())
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'role', 'super_admin');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_admin_user(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_admin_user(text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
