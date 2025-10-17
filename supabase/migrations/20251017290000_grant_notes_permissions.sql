-- ============================================================================
-- CORREÇÃO: PERMISSÕES EM NOTES PARA AUTHENTICATED
-- ============================================================================
-- Fix: Usuários autenticados precisam de permissões para criar e ver suas
-- próprias notas. O RLS já protege: cada usuário só vê suas próprias notas.

-- ============================================================================
-- 1. GARANTIR PERMISSÕES EM NOTES
-- ============================================================================

-- Dar permissões necessárias para usuários autenticados
-- O RLS já protege: cada usuário só pode ver/editar suas próprias notas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;

-- ============================================================================
-- 2. VERIFICAR SE A TABELA EXISTE E TEM RLS HABILITADO
-- ============================================================================

-- Verificar se RLS está habilitado em notes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'notes'
  ) THEN
    -- Habilitar RLS se não estiver habilitado
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename = 'notes' 
        AND rowsecurity = true
    ) THEN
      ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. VERIFICAR POLÍTICAS RLS BÁSICAS
-- ============================================================================

-- Verificar se existem as políticas básicas para usuários verem suas próprias notas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'notes'
  ) THEN
    -- Política de SELECT para usuários verem suas próprias notas
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'notes'
        AND policyname = 'Users can view own notes'
    ) THEN
      CREATE POLICY "Users can view own notes"
        ON public.notes
        FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());
    END IF;

    -- Política de INSERT para usuários criarem suas próprias notas
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'notes'
        AND policyname = 'Users can insert own notes'
    ) THEN
      CREATE POLICY "Users can insert own notes"
        ON public.notes
        FOR INSERT
        TO authenticated
        WITH CHECK (user_id = auth.uid());
    END IF;

    -- Política de UPDATE para usuários atualizarem suas próprias notas
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'notes'
        AND policyname = 'Users can update own notes'
    ) THEN
      CREATE POLICY "Users can update own notes"
        ON public.notes
        FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;

    -- Política de DELETE para usuários deletarem suas próprias notas
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'notes'
        AND policyname = 'Users can delete own notes'
    ) THEN
      CREATE POLICY "Users can delete own notes"
        ON public.notes
        FOR DELETE
        TO authenticated
        USING (user_id = auth.uid());
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 4. COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE public.notes IS 'Notas e lembretes criados pelos usuários';

