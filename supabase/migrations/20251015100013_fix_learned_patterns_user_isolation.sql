-- Migration: Fix learned patterns to handle user-specific categories
-- 
-- PROBLEMA:
-- - global_learned_patterns permite categorias customizadas de usuários
-- - Isso causa erros quando outros usuários não têm essas categorias
-- 
-- SOLUÇÃO:
-- 1. Criar tabela user_learned_patterns para padrões específicos do usuário
-- 2. Restringir global_learned_patterns apenas a categorias padrão
-- 3. Atualizar funções para buscar em ambas (prioridade: user > global)

BEGIN;

-- =============================================================================
-- PARTE 1: CRIAR TABELA DE PADRÕES POR USUÁRIO
-- =============================================================================

-- Tabela para padrões aprendidos específicos de cada usuário
CREATE TABLE IF NOT EXISTS public.user_learned_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  description text NOT NULL,
  normalized_description text NOT NULL,
  category text NOT NULL, -- Pode ser categoria customizada do usuário
  subcategory text,
  confidence numeric(5,2) NOT NULL DEFAULT 85.00,
  usage_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  first_learned_at timestamptz DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  source_type text NOT NULL DEFAULT 'user_correction',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),

  -- Constraint: unique por usuário e descrição
  UNIQUE(user_id, normalized_description)
);

-- Índices para performance
CREATE INDEX idx_user_learned_patterns_user_id ON public.user_learned_patterns(user_id);
CREATE INDEX idx_user_learned_patterns_normalized_desc ON public.user_learned_patterns(normalized_description);
CREATE INDEX idx_user_learned_patterns_user_desc ON public.user_learned_patterns(user_id, normalized_description);
CREATE INDEX idx_user_learned_patterns_active ON public.user_learned_patterns(is_active) WHERE is_active = true;
CREATE INDEX idx_user_learned_patterns_user_active ON public.user_learned_patterns(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_learned_patterns_confidence ON public.user_learned_patterns(confidence DESC) WHERE is_active = true;

-- Row Level Security
ALTER TABLE public.user_learned_patterns ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários só veem seus próprios padrões
CREATE POLICY "Users can view their own learned patterns"
  ON public.user_learned_patterns FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Usuários podem inserir/atualizar/deletar seus próprios padrões
CREATE POLICY "Users can manage their own learned patterns"
  ON public.user_learned_patterns FOR ALL
  USING (auth.uid() = user_id);

-- =============================================================================
-- PARTE 2: CRIAR LISTA DE CATEGORIAS PADRÃO (GLOBAL)
-- =============================================================================

-- Tabela com categorias padrão do sistema (usadas no global_learned_patterns)
CREATE TABLE IF NOT EXISTS public.standard_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL, -- 'income' ou 'expense'
  description text,
  display_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed com categorias padrão
INSERT INTO public.standard_categories (name, type, display_order) VALUES
  -- Receitas
  ('Outras Receitas (Aluguéis, extras, reembolso etc.)', 'income', 1),
  ('Salário / 13° Salário / Férias', 'income', 2),
  ('Pró Labore', 'income', 3),
  ('Participação de Lucros / Comissões', 'income', 4),
  ('Renda de Investimentos', 'income', 5),
  
  -- Despesas
  ('Alimentação', 'expense', 10),
  ('Transporte', 'expense', 11),
  ('Casa', 'expense', 12),
  ('Assinaturas', 'expense', 13),
  ('Proteção Pessoal / Saúde / Farmácia', 'expense', 14),
  ('Bem Estar / Beleza', 'expense', 15),
  ('Roupas e acessórios', 'expense', 16),
  ('Lazer', 'expense', 17),
  ('Pet', 'expense', 18),
  ('Presentes / Compras', 'expense', 19),
  ('Despesas Pessoais', 'expense', 20),
  ('Tarifas Bancárias / Juros / Impostos / Taxas', 'expense', 21),
  ('Diarista / Prestadores Serv.', 'expense', 22),
  ('Empréstimos / Financiamentos', 'expense', 23),
  ('Férias / Viagens', 'expense', 24),
  ('Filhos / Dependentes', 'expense', 25),
  ('Investimentos (pelo menos 20% da receita)', 'expense', 26),
  ('Gastos com PJ / Profissionais Autônomos', 'expense', 27),
  ('Outros', 'expense', 99)
ON CONFLICT (name) DO NOTHING;

-- Índices
CREATE INDEX idx_standard_categories_type ON public.standard_categories(type);
CREATE INDEX idx_standard_categories_active ON public.standard_categories(is_active) WHERE is_active = true;

-- RLS: Todos podem ler, só service_role pode modificar
ALTER TABLE public.standard_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view standard categories"
  ON public.standard_categories FOR SELECT
  USING (true);

CREATE POLICY "Only service role can modify standard categories"
  ON public.standard_categories FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- PARTE 3: FUNÇÃO PARA VALIDAR SE CATEGORIA É PADRÃO
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_standard_category(p_category text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.standard_categories
    WHERE name = p_category AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_standard_category(text) TO authenticated;

-- =============================================================================
-- PARTE 4: ATUALIZAR FUNÇÃO DE UPDATE PARA SEPARAR USER/GLOBAL
-- =============================================================================

-- Nova função: Atualiza padrão do USUÁRIO (categorias customizadas OK)
CREATE OR REPLACE FUNCTION public.update_user_learned_pattern(
  p_description text,
  p_category text,
  p_subcategory text DEFAULT NULL,
  p_confidence numeric DEFAULT 85.00
) RETURNS void AS $$
DECLARE
  v_normalized_desc text;
  v_user_id uuid;
BEGIN
  -- Pega ID do usuário autenticado
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Normaliza descrição
  v_normalized_desc := lower(trim(p_description));

  -- Insert ou update
  INSERT INTO public.user_learned_patterns (
    user_id,
    description,
    normalized_description,
    category,
    subcategory,
    confidence,
    usage_count,
    last_used_at
  ) VALUES (
    v_user_id,
    p_description,
    v_normalized_desc,
    p_category,
    p_subcategory,
    p_confidence,
    1,
    now()
  )
  ON CONFLICT (user_id, normalized_description)
  DO UPDATE SET
    category = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    usage_count = user_learned_patterns.usage_count + 1,
    last_used_at = now(),
    confidence = LEAST(
      user_learned_patterns.confidence + (user_learned_patterns.usage_count * 0.5),
      98.00
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_user_learned_pattern(text, text, text, numeric) TO authenticated;

-- =============================================================================
-- PARTE 5: FUNÇÃO ATUALIZADA PARA GLOBAL (VALIDA CATEGORIA PADRÃO)
-- =============================================================================

-- Atualiza função global para VALIDAR categoria padrão
CREATE OR REPLACE FUNCTION public.update_global_learned_pattern(
  p_description text,
  p_category text,
  p_subcategory text DEFAULT NULL,
  p_confidence numeric DEFAULT 85.00,
  p_user_vote boolean DEFAULT false
) RETURNS void AS $$
DECLARE
  v_normalized_desc text;
  v_existing_record record;
  v_is_standard boolean;
BEGIN
  -- VALIDAÇÃO: Só aceita categorias padrão
  v_is_standard := public.is_standard_category(p_category);
  
  IF NOT v_is_standard THEN
    -- Se não é categoria padrão, salva em user_learned_patterns ao invés de global
    PERFORM public.update_user_learned_pattern(
      p_description,
      p_category,
      p_subcategory,
      p_confidence
    );
    RETURN; -- Sai da função
  END IF;

  -- Se chegou aqui, é categoria padrão - procede com lógica global original
  v_normalized_desc := lower(trim(p_description));

  SELECT * INTO v_existing_record
  FROM public.global_learned_patterns
  WHERE normalized_description = v_normalized_desc
    AND is_active = true;

  IF v_existing_record.id IS NOT NULL THEN
    -- Update existing
    UPDATE public.global_learned_patterns
    SET
      usage_count = usage_count + 1,
      user_votes = user_votes + (CASE WHEN p_user_vote THEN 1 ELSE 0 END),
      last_used_at = now(),
      confidence = LEAST(
        confidence + (usage_count * 0.1) + (user_votes * 2.0),
        95.00
      )
    WHERE id = v_existing_record.id;
  ELSE
    -- Insert new
    INSERT INTO public.global_learned_patterns (
      description,
      normalized_description,
      category,
      subcategory,
      confidence,
      usage_count,
      user_votes,
      metadata
    ) VALUES (
      p_description,
      v_normalized_desc,
      p_category,
      p_subcategory,
      p_confidence,
      1,
      (CASE WHEN p_user_vote THEN 1 ELSE 0 END),
      jsonb_build_object('source', 'auto_learned_standard')
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões (já existiam, mas garantindo)
GRANT EXECUTE ON FUNCTION public.update_global_learned_pattern(text, text, text, numeric, boolean) TO authenticated;

-- =============================================================================
-- PARTE 6: FUNÇÃO HÍBRIDA PARA BUSCAR PADRÕES (USER + GLOBAL)
-- =============================================================================

-- Função que busca PRIMEIRO nos padrões do usuário, depois nos globais
CREATE OR REPLACE FUNCTION public.get_learned_pattern_for_user(
  p_description text,
  p_min_confidence numeric DEFAULT 70.00
) RETURNS TABLE (
  description text,
  category text,
  subcategory text,
  confidence numeric,
  source text, -- 'user' ou 'global'
  usage_count integer
) AS $$
DECLARE
  v_normalized_desc text;
  v_user_id uuid;
BEGIN
  v_normalized_desc := lower(trim(p_description));
  v_user_id := auth.uid();

  -- PRIORIDADE 1: Padrões do usuário
  IF v_user_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      ulp.description,
      ulp.category,
      ulp.subcategory,
      ulp.confidence,
      'user'::text as source,
      ulp.usage_count
    FROM public.user_learned_patterns ulp
    WHERE ulp.user_id = v_user_id
      AND ulp.normalized_description = v_normalized_desc
      AND ulp.is_active = true
      AND ulp.confidence >= p_min_confidence
    LIMIT 1;

    -- Se encontrou padrão do usuário, retorna
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- PRIORIDADE 2: Padrões globais (se não encontrou no usuário)
  RETURN QUERY
  SELECT
    glp.description,
    glp.category,
    glp.subcategory,
    glp.confidence,
    'global'::text as source,
    glp.usage_count
  FROM public.global_learned_patterns glp
  WHERE glp.normalized_description = v_normalized_desc
    AND glp.is_active = true
    AND glp.confidence >= p_min_confidence
  ORDER BY glp.confidence DESC, glp.user_votes DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_learned_pattern_for_user(text, numeric) TO authenticated;

-- =============================================================================
-- PARTE 7: FUNÇÃO BATCH PARA MÚLTIPLAS DESCRIÇÕES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_learned_patterns_batch(
  p_descriptions text[],
  p_min_confidence numeric DEFAULT 70.00
) RETURNS TABLE (
  description text,
  category text,
  subcategory text,
  confidence numeric,
  source text,
  usage_count integer
) AS $$
DECLARE
  v_desc text;
BEGIN
  FOREACH v_desc IN ARRAY p_descriptions
  LOOP
    RETURN QUERY
    SELECT * FROM public.get_learned_pattern_for_user(v_desc, p_min_confidence);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_learned_patterns_batch(text[], numeric) TO authenticated;

-- =============================================================================
-- PARTE 8: MIGRAR DADOS EXISTENTES (LIMPAR CATEGORIAS INVÁLIDAS)
-- =============================================================================

-- Marca como inativo padrões com categorias não-padrão em global_learned_patterns
UPDATE public.global_learned_patterns
SET 
  is_active = false,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'),
    '{deactivated_reason}',
    '"non_standard_category"'::jsonb
  )
WHERE NOT public.is_standard_category(category)
  AND is_active = true;

-- Log de quantos foram desativados
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.global_learned_patterns
  WHERE metadata->>'deactivated_reason' = 'non_standard_category';
  
  RAISE NOTICE 'Desativados % padrões com categorias não-padrão', v_count;
END $$;

-- =============================================================================
-- PARTE 9: COMENTÁRIOS E DOCUMENTAÇÃO
-- =============================================================================

COMMENT ON TABLE public.user_learned_patterns IS 
'Padrões aprendidos específicos de cada usuário. Permite categorias customizadas.';

COMMENT ON TABLE public.standard_categories IS 
'Lista de categorias padrão do sistema. Usadas em global_learned_patterns para compartilhamento entre usuários.';

COMMENT ON FUNCTION public.update_user_learned_pattern(text, text, text, numeric) IS 
'Atualiza padrão aprendido do usuário. Aceita qualquer categoria (inclusive customizadas).';

COMMENT ON FUNCTION public.update_global_learned_pattern(text, text, text, numeric, boolean) IS 
'Atualiza padrão global. Valida se categoria é padrão. Se não for, redireciona para user_learned_patterns.';

COMMENT ON FUNCTION public.get_learned_pattern_for_user(text, numeric) IS 
'Busca padrão aprendido com prioridade: 1) usuário, 2) global. Retorna o primeiro match.';

COMMIT;

