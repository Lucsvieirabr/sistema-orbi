-- Create admin user automatically
-- This migration creates a default admin user for development/testing purposes

BEGIN;

-- Create admin user in auth.users table
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'Admin@sistemaOrbi.com',
  crypt('OrbiAdmin2024!@#Secure', gen_salt('bf')),
  NOW(),
  NULL,
  NULL,
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Admin Sistema Orbi", "role": "admin"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Create corresponding profile in public.profiles (if the table exists)
-- This will be handled by the RLS policies and triggers

COMMIT;
