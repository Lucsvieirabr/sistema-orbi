-- Migration: Adiciona palavra-chave genérica "tarifa"
-- 
-- Problema identificado: 
-- "Tarifa Pacote de Servios" não estava sendo classificado porque
-- só existiam keywords compostas como "tarifa bancaria" e "tarifa mensal"
-- mas não a palavra "tarifa" sozinha.
--
-- Solução:
-- Adicionar keyword genérica "tarifa" para capturar todos os casos

BEGIN;

-- Adiciona keyword genérica "tarifa"
INSERT INTO merchants_dictionary (
  merchant_key,
  entity_name,
  entry_type,
  category,
  subcategory,
  aliases,
  keywords,
  confidence_modifier,
  priority,
  metadata
)
VALUES
  (
    'tarifa',
    'Tarifa',
    'keyword',
    'Tarifas Bancárias / Juros / Impostos / Taxas',
    'Tarifas Bancárias',
    ARRAY['tarifa', 'tarifas'],
    ARRAY['tarifa', 'tarifas'],
    0.85,
    82,
    jsonb_build_object(
      'type', 'fees',
      'subtype', 'generic_tariff',
      'description', 'Keyword genérica para capturar todas as tarifas'
    )
  ),
  
  (
    'taxa',
    'Taxa',
    'keyword',
    'Tarifas Bancárias / Juros / Impostos / Taxas',
    'Taxas',
    ARRAY['taxa', 'taxas'],
    ARRAY['taxa', 'taxas'],
    0.82,
    78,
    jsonb_build_object(
      'type', 'fees',
      'subtype', 'generic_tax',
      'description', 'Keyword genérica para taxas'
    )
  ),
  
  (
    'servico',
    'Serviço',
    'keyword',
    'Tarifas Bancárias / Juros / Impostos / Taxas',
    'Pacote de Serviços',
    ARRAY['servico', 'serviço', 'servicos', 'serviços', 'pacote'],
    ARRAY['servico', 'servicos', 'pacote'],
    0.70,
    65,
    jsonb_build_object(
      'type', 'fees',
      'subtype', 'service_package',
      'description', 'Pacotes de serviços bancários'
    )
  )
ON CONFLICT (merchant_key) DO UPDATE SET
  confidence_modifier = EXCLUDED.confidence_modifier,
  priority = EXCLUDED.priority,
  aliases = EXCLUDED.aliases,
  keywords = EXCLUDED.keywords,
  metadata = EXCLUDED.metadata,
  updated_at = now();

COMMIT;

-- Comentário
COMMENT ON COLUMN merchants_dictionary.merchant_key IS 
'Chave única do merchant/keyword. Usado para busca e matching. Deve ser normalizado (lowercase, sem acentos).';

