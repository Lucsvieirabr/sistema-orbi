-- Migration: Create merchants dictionary table for intelligent transaction categorization
-- This table stores all merchants, establishments, and patterns for automatic categorization
-- Part of the AI learning system migration from hardcoded BankDictionary.ts

BEGIN;

-- Habilitar extensão pg_trgm para busca fuzzy
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- TABLE: merchants_dictionary
-- Stores all merchant data, banking patterns, and categorization rules
-- ============================================================================
CREATE TABLE public.merchants_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  merchant_key text NOT NULL UNIQUE, -- Key para busca: 'assai atacadista'
  entity_name text NOT NULL, -- Nome formatado: 'Assaí Atacadista'
  
  -- Categorização
  category text NOT NULL, -- Categoria principal
  subcategory text, -- Subcategoria (opcional)
  
  -- Tipo de entrada
  entry_type text NOT NULL DEFAULT 'merchant', -- 'merchant', 'banking_pattern', 'keyword'
  
  -- Matching e busca
  aliases text[] DEFAULT '{}', -- Variações do nome: ['assai', 'assaí']
  keywords text[] DEFAULT '{}', -- Palavras-chave para matching
  regex_patterns text[] DEFAULT '{}', -- Padrões regex (como strings)
  
  -- Scoring e priorização
  confidence_modifier numeric(3,2) NOT NULL DEFAULT 0.90, -- 0.00 a 1.00
  priority integer NOT NULL DEFAULT 50, -- 0 a 100, quanto maior mais prioridade
  
  -- Contexto geográfico
  state_specific boolean DEFAULT false,
  states text[] DEFAULT '{}', -- ['SP', 'RJ', 'MG']
  region text, -- 'sudeste', 'nordeste', etc
  
  -- Contexto de transação
  context text, -- 'pix_enviado', 'transferencia', etc (para banking patterns)
  
  -- Metadata adicional (JSONB para flexibilidade)
  metadata jsonb DEFAULT '{}',
  
  -- Gestão e controle
  is_active boolean DEFAULT true,
  source_type text DEFAULT 'manual', -- 'manual', 'learned', 'imported', 'system'
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  
  -- Auditoria
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT valid_confidence CHECK (confidence_modifier >= 0.00 AND confidence_modifier <= 1.00),
  CONSTRAINT valid_priority CHECK (priority >= 0 AND priority <= 100),
  CONSTRAINT valid_entry_type CHECK (entry_type IN ('merchant', 'banking_pattern', 'keyword', 'utility'))
);

-- ============================================================================
-- INDEXES para performance otimizada
-- ============================================================================

-- Índice principal para busca por chave
CREATE INDEX idx_merchants_merchant_key ON public.merchants_dictionary(merchant_key) WHERE is_active = true;

-- Índice para busca por categoria
CREATE INDEX idx_merchants_category ON public.merchants_dictionary(category) WHERE is_active = true;

-- Índice composto para ordenação por prioridade
CREATE INDEX idx_merchants_priority_confidence ON public.merchants_dictionary(priority DESC, confidence_modifier DESC) WHERE is_active = true;

-- Índice GIN para arrays (aliases e keywords)
CREATE INDEX idx_merchants_aliases ON public.merchants_dictionary USING GIN(aliases) WHERE is_active = true;
CREATE INDEX idx_merchants_keywords ON public.merchants_dictionary USING GIN(keywords) WHERE is_active = true;

-- Índice para busca por tipo de entrada
CREATE INDEX idx_merchants_entry_type ON public.merchants_dictionary(entry_type) WHERE is_active = true;

-- Índice para contexto (banking patterns)
CREATE INDEX idx_merchants_context ON public.merchants_dictionary(context) WHERE context IS NOT NULL AND is_active = true;

-- Índice GIN para metadata JSONB
CREATE INDEX idx_merchants_metadata ON public.merchants_dictionary USING GIN(metadata);

-- Índice para busca por estado (concessionárias)
CREATE INDEX idx_merchants_states ON public.merchants_dictionary USING GIN(states) WHERE state_specific = true AND is_active = true;

-- Índice para uso frequente (cache warming)
CREATE INDEX idx_merchants_usage ON public.merchants_dictionary(usage_count DESC, last_used_at DESC) WHERE is_active = true;

-- Índice text search para busca fuzzy
CREATE INDEX idx_merchants_entity_name_trgm ON public.merchants_dictionary USING gin(entity_name gin_trgm_ops);
CREATE INDEX idx_merchants_merchant_key_trgm ON public.merchants_dictionary USING gin(merchant_key gin_trgm_ops);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.merchants_dictionary ENABLE ROW LEVEL SECURITY;

-- Policy: Todos os usuários autenticados podem ler
CREATE POLICY "Authenticated users can read merchants dictionary"
  ON public.merchants_dictionary FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Apenas service role pode modificar
CREATE POLICY "Service role can manage merchants dictionary"
  ON public.merchants_dictionary FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- FUNCTIONS - Busca e matching de merchants
-- ============================================================================

-- Função para buscar merchant por descrição (fuzzy matching)
CREATE OR REPLACE FUNCTION public.search_merchant(
  p_description text,
  p_user_location text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  entity_name text,
  category text,
  subcategory text,
  confidence_modifier numeric,
  priority integer,
  match_score real
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.merchant_key,
    m.entity_name,
    m.category,
    m.subcategory,
    m.confidence_modifier,
    m.priority,
    GREATEST(
      similarity(lower(p_description), m.merchant_key),
      similarity(lower(p_description), m.entity_name),
      COALESCE(
        (SELECT MAX(similarity(lower(p_description), unnest(m.aliases)))
         FROM unnest(m.aliases)),
        0
      )
    ) as match_score
  FROM public.merchants_dictionary m
  WHERE m.is_active = true
    AND (
      lower(p_description) LIKE '%' || m.merchant_key || '%'
      OR m.merchant_key LIKE '%' || lower(p_description) || '%'
      OR lower(p_description) % m.merchant_key  -- Trigram similarity
      OR EXISTS (
        SELECT 1 FROM unnest(m.aliases) alias
        WHERE lower(p_description) LIKE '%' || alias || '%'
      )
    )
    AND (
      -- Se é específico de estado, verificar localização
      m.state_specific = false
      OR p_user_location IS NULL
      OR p_user_location = ANY(m.states)
    )
  ORDER BY 
    match_score DESC,
    m.priority DESC,
    m.confidence_modifier DESC,
    m.usage_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Função para buscar padrão bancário por contexto
CREATE OR REPLACE FUNCTION public.search_banking_pattern(
  p_description text,
  p_context text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  category text,
  subcategory text,
  confidence_modifier numeric,
  priority integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.merchant_key,
    m.category,
    m.subcategory,
    m.confidence_modifier,
    m.priority
  FROM public.merchants_dictionary m
  WHERE m.is_active = true
    AND m.entry_type = 'banking_pattern'
    AND (
      p_context IS NULL
      OR m.context = p_context
      OR lower(p_description) LIKE '%' || m.merchant_key || '%'
    )
  ORDER BY 
    m.priority DESC,
    m.confidence_modifier DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;

-- Função para buscar por palavras-chave
CREATE OR REPLACE FUNCTION public.search_by_keywords(
  p_description text,
  p_type text DEFAULT 'expense'
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  category text,
  subcategory text,
  confidence_modifier numeric,
  priority integer
) AS $$
DECLARE
  v_tokens text[];
BEGIN
  -- Tokeniza a descrição
  SELECT array_agg(DISTINCT lower(word)) INTO v_tokens
  FROM unnest(string_to_array(p_description, ' ')) word
  WHERE length(word) > 2;

  RETURN QUERY
  SELECT 
    m.id,
    m.merchant_key,
    m.category,
    m.subcategory,
    m.confidence_modifier,
    m.priority
  FROM public.merchants_dictionary m
  WHERE m.is_active = true
    AND m.entry_type = 'keyword'
    AND m.keywords && v_tokens  -- Array overlap operator
  ORDER BY 
    m.priority DESC,
    m.confidence_modifier DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- Função para registrar uso de merchant (incrementa contador)
CREATE OR REPLACE FUNCTION public.record_merchant_usage(
  p_merchant_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE public.merchants_dictionary
  SET 
    usage_count = usage_count + 1,
    last_used_at = now()
  WHERE id = p_merchant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para pré-carregar merchants mais usados (cache warming)
CREATE OR REPLACE FUNCTION public.get_top_merchants(
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  merchant_key text,
  entity_name text,
  category text,
  subcategory text,
  aliases text[],
  confidence_modifier numeric,
  priority integer,
  entry_type text,
  usage_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.merchant_key,
    m.entity_name,
    m.category,
    m.subcategory,
    m.aliases,
    m.confidence_modifier,
    m.priority,
    m.entry_type,
    m.usage_count
  FROM public.merchants_dictionary m
  WHERE m.is_active = true
  ORDER BY 
    m.usage_count DESC,
    m.priority DESC,
    m.confidence_modifier DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.merchants_dictionary TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_merchant(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_banking_pattern(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_by_keywords(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_merchant_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_merchants(integer) TO authenticated;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_merchants_dictionary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_merchants_dictionary_updated_at
  BEFORE UPDATE ON public.merchants_dictionary
  FOR EACH ROW
  EXECUTE FUNCTION public.update_merchants_dictionary_updated_at();

-- ============================================================================
-- MATERIALIZED VIEW - Cache para merchants frequentes
-- ============================================================================

CREATE MATERIALIZED VIEW public.mv_frequent_merchants AS
SELECT 
  id,
  merchant_key,
  entity_name,
  category,
  subcategory,
  aliases,
  confidence_modifier,
  priority,
  entry_type,
  usage_count,
  last_used_at
FROM public.merchants_dictionary
WHERE is_active = true
  AND usage_count > 0
ORDER BY usage_count DESC, priority DESC
LIMIT 500;

-- Índice único na materialized view
CREATE UNIQUE INDEX idx_mv_frequent_merchants_id ON public.mv_frequent_merchants(id);
CREATE INDEX idx_mv_frequent_merchants_key ON public.mv_frequent_merchants(merchant_key);

-- Função para atualizar a materialized view
CREATE OR REPLACE FUNCTION public.refresh_frequent_merchants()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_frequent_merchants;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.refresh_frequent_merchants() TO authenticated;

-- ============================================================================
-- COMMENTS para documentação
-- ============================================================================

COMMENT ON TABLE public.merchants_dictionary IS 'Dicionário inteligente de merchants e padrões para categorização automática de transações. Migrado de BankDictionary.ts para escalabilidade e aprendizado colaborativo.';
COMMENT ON COLUMN public.merchants_dictionary.merchant_key IS 'Chave única normalizada para busca (lowercase, sem acentos)';
COMMENT ON COLUMN public.merchants_dictionary.entity_name IS 'Nome formatado do estabelecimento ou padrão';
COMMENT ON COLUMN public.merchants_dictionary.entry_type IS 'Tipo de entrada: merchant (estabelecimento), banking_pattern (padrão bancário), keyword (palavra-chave), utility (concessionária)';
COMMENT ON COLUMN public.merchants_dictionary.confidence_modifier IS 'Modificador de confiança (0.00 a 1.00) para scoring';
COMMENT ON COLUMN public.merchants_dictionary.priority IS 'Prioridade para resolução de conflitos (0-100, maior = mais prioritário)';
COMMENT ON COLUMN public.merchants_dictionary.usage_count IS 'Número de vezes que este merchant foi usado (para cache warming)';

COMMIT;

