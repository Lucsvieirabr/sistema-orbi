-- ============================================================================
-- CORREÇÃO: PERMISSÕES EM BUG_REPORTS PARA AUTHENTICATED
-- ============================================================================
-- Fix: Usuários autenticados precisam de permissões para criar e ver seus
-- próprios bug reports. O RLS já protege: cada usuário só vê seus próprios reports.

-- ============================================================================
-- 1. GARANTIR PERMISSÕES EM BUG_REPORTS
-- ============================================================================

-- Dar permissões necessárias para usuários autenticados
-- O RLS já protege: cada usuário só pode ver/editar seus próprios bug reports
GRANT SELECT, INSERT, UPDATE ON public.bug_reports TO authenticated;

-- ============================================================================
-- 2. VERIFICAR SE A TABELA EXISTE E TEM RLS HABILITADO
-- ============================================================================

-- Verificar se RLS está habilitado em bug_reports
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'bug_reports'
  ) THEN
    -- Habilitar RLS se não estiver habilitado
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename = 'bug_reports' 
        AND rowsecurity = true
    ) THEN
      ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. VERIFICAR POLÍTICAS RLS BÁSICAS
-- ============================================================================

-- Verificar se existem as políticas básicas para usuários verem seus próprios reports
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'bug_reports'
  ) THEN
    -- Política de SELECT para usuários verem seus próprios reports
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'bug_reports'
        AND policyname = 'Users can view own bug reports'
    ) THEN
      CREATE POLICY "Users can view own bug reports"
        ON public.bug_reports
        FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());
    END IF;

    -- Política de INSERT para usuários criarem seus próprios reports
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'bug_reports'
        AND policyname = 'Users can insert own bug reports'
    ) THEN
      CREATE POLICY "Users can insert own bug reports"
        ON public.bug_reports
        FOR INSERT
        TO authenticated
        WITH CHECK (user_id = auth.uid());
    END IF;

    -- Política de UPDATE para usuários atualizarem seus próprios reports
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'bug_reports'
        AND policyname = 'Users can update own bug reports'
    ) THEN
      CREATE POLICY "Users can update own bug reports"
        ON public.bug_reports
        FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 4. COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE public.bug_reports IS 'Relatórios de bugs enviados pelos usuários';

