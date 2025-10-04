-- Create test data for development
-- This migration creates test data for the specific user ID used in the API calls

BEGIN;

-- Insert test user data
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud) VALUES
  ('62aece56-6940-4357-be89-a81aa21e7234', 'test@example.com', 'encrypted_password', NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Insert test account
INSERT INTO accounts (id, user_id, name, type, initial_balance, color) VALUES
  ('c7a10b23-a1ec-4a41-8eb5-8e19ffd4c2fc', '62aece56-6940-4357-be89-a81aa21e7234', 'Conta Teste', 'Corrente', 1000.00, '#3B82F6')
ON CONFLICT (id) DO NOTHING;

-- Insert test category
INSERT INTO categories (id, user_id, name, category_type) VALUES
  ('b700e31c-9a37-4b13-a276-cddc5d92929e', '62aece56-6940-4357-be89-a81aa21e7234', 'Teste', 'expense')
ON CONFLICT (id) DO NOTHING;

COMMIT;
