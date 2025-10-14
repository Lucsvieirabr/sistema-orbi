-- Migration: Seed specific merchants from user transaction data
-- Adiciona entidades específicas identificadas nos extratos do usuário
-- Migração de entidades hardcoded para merchants_dictionary (centralização)

BEGIN;

-- ============================================================================
-- MERCHANTS ESPECÍFICOS - Baseados em transações reais do usuário
-- ============================================================================

INSERT INTO public.merchants_dictionary (
  merchant_key,
  entity_name,
  category,
  subcategory,
  entry_type,
  aliases,
  keywords,
  confidence_modifier,
  priority,
  source_type,
  metadata
) VALUES

-- Bancos e Cartões de Crédito
('nubank', 'Nubank', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Cartão de Crédito', 'merchant',
 ARRAY['nubank', 'nu pagamentos', 'nu pag', 'nu pagamentos sa'], 
 ARRAY['cartao', 'credito', 'banco'],
 0.95, 100, 'system', 
 '{"type": "bank", "service": "credit_card"}'),

-- Energia e Utilidades
('celesc', 'CELESC', 'Casa', 'Energia Elétrica', 'utility',
 ARRAY['celesc', 'celesc distribuicao', 'celesc distribuicao sa'], 
 ARRAY['energia', 'luz', 'eletrica'],
 0.95, 100, 'system', 
 '{"type": "utility", "service": "electricity", "state": "SC"}'),

-- Telefonia e Internet
('claro', 'Claro', 'Assinaturas', 'Telefonia', 'merchant',
 ARRAY['claro'], 
 ARRAY['telefone', 'celular', 'movel'],
 0.95, 95, 'system', 
 '{"type": "telecom", "service": "mobile"}'),

('vivo', 'Vivo', 'Assinaturas', 'Telefonia', 'merchant',
 ARRAY['vivo'], 
 ARRAY['telefone', 'celular', 'movel'],
 0.95, 95, 'system', 
 '{"type": "telecom", "service": "mobile"}'),

('tim', 'TIM', 'Assinaturas', 'Telefonia', 'merchant',
 ARRAY['tim'], 
 ARRAY['telefone', 'celular', 'movel'],
 0.95, 95, 'system', 
 '{"type": "telecom", "service": "mobile"}'),

('unifique', 'Unifique', 'Assinaturas', 'Internet', 'merchant',
 ARRAY['unifique', 'unifique telecomunicacoes'], 
 ARRAY['internet', 'banda larga', 'fibra'],
 0.95, 95, 'system', 
 '{"type": "telecom", "service": "internet"}'),

-- Streaming e Entretenimento
('netflix', 'Netflix', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['netflix'], 
 ARRAY['streaming', 'video', 'entretenimento'],
 0.95, 95, 'system', 
 '{"type": "subscription", "service": "streaming_video"}'),

('spotify', 'Spotify', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['spotify'], 
 ARRAY['musica', 'streaming', 'audio'],
 0.95, 95, 'system', 
 '{"type": "subscription", "service": "streaming_audio"}'),

-- Impostos e Taxas
('das_simples_nacional', 'DAS - Simples Nacional', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos', 'banking_pattern',
 ARRAY['das', 'simples nacional', 'das simples nacional'], 
 ARRAY['imposto', 'federal', 'mei', 'simples'],
 0.95, 100, 'system', 
 '{"type": "tax", "scope": "federal", "program": "simples_nacional"}'),

('municipio_navegantes', 'Município de Navegantes', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos Municipais', 'merchant',
 ARRAY['municipio de navegantes', 'prefeitura de navegantes', 'pm de navegantes', 'navegantes'], 
 ARRAY['imposto', 'municipal', 'iptu', 'iss'],
 0.90, 95, 'system', 
 '{"type": "government", "level": "municipal", "city": "Navegantes", "state": "SC"}'),

-- Financiamentos
('aymore', 'Aymore', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Financiamento', 'merchant',
 ARRAY['aymore', 'aymore credito', 'aymore financiamento'], 
 ARRAY['financiamento', 'credito', 'emprestimo'],
 0.95, 95, 'system', 
 '{"type": "finance", "service": "loan"}'),

-- Transporte
('posto_combustivel', 'Posto de Combustível', 'Transporte', 'Combustível', 'keyword',
 ARRAY['posto', 'posto navel'], 
 ARRAY['gasolina', 'etanol', 'diesel', 'combustivel'],
 0.90, 85, 'system', 
 '{"type": "fuel", "service": "gas_station"}'),

('empresa_navegacao_santa_catarina', 'Empresa de Navegação Santa Catarina', 'Transporte', 'Transporte Público', 'merchant',
 ARRAY['empresa de navegacao', 'navegacao santa', 'empresa de navegacao santa'], 
 ARRAY['onibus', 'transporte', 'publico', 'passagem'],
 0.95, 95, 'system', 
 '{"type": "transport", "service": "public_bus", "state": "SC"}'),

-- Alimentação - Fast Food
('kfc', 'KFC', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['kfc', 'kentucky'], 
 ARRAY['fast food', 'restaurante', 'frango'],
 0.95, 95, 'system', 
 '{"type": "food", "category": "fast_food", "chain": true}'),

-- Alimentação - Supermercados (específicos do extrato do usuário)
('komprao', 'Komprão Supermercados', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['komprao', 'komprao supermercados'], 
 ARRAY['supermercado', 'mercado', 'compras'],
 0.90, 90, 'system', 
 '{"type": "food_retail", "category": "supermarket"}'),

('bistek', 'Bistek Supermercado', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['bistek', 'bistek supermercado', 'bistek supermerca'], 
 ARRAY['supermercado', 'mercado', 'compras'],
 0.90, 90, 'system', 
 '{"type": "food_retail", "category": "supermarket"}'),

('brasileirisse', 'Brasileirisse', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['brasileirisse'], 
 ARRAY['supermercado', 'mercado', 'compras'],
 0.90, 90, 'system', 
 '{"type": "food_retail", "category": "supermarket"}'),

-- Alimentação - Padarias
('padaria', 'Padaria', 'Alimentação', 'Padaria', 'keyword',
 ARRAY['padaria', 'panificadora', 'padaria sao domingos', 'panificadora solange'], 
 ARRAY['pao', 'padaria', 'confeitaria'],
 0.95, 90, 'system', 
 '{"type": "food", "category": "bakery"}'),

-- Educação
('uniasselvi', 'Uniasselvi', 'Educação', 'Faculdade', 'merchant',
 ARRAY['uniasselvi'], 
 ARRAY['faculdade', 'universidade', 'ensino superior'],
 0.95, 95, 'system', 
 '{"type": "education", "level": "higher_education"}'),

-- Saúde e Fitness
('cultura_fitness', 'Cultura Fitness', 'Bem Estar / Beleza', 'Academia', 'merchant',
 ARRAY['cultura fitness'], 
 ARRAY['academia', 'fitness', 'musculacao', 'ginastica'],
 0.95, 95, 'system', 
 '{"type": "fitness", "service": "gym"}'),

-- Cobrança
('catarinense_cobrancas', 'Catarinense Cobranças', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Cobrança', 'merchant',
 ARRAY['catarinense cobrancas'], 
 ARRAY['cobranca', 'divida'],
 0.90, 85, 'system', 
 '{"type": "collection", "service": "debt_collection", "state": "SC"}')

-- Tratamento de conflitos (caso já existam)
ON CONFLICT (merchant_key) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  keywords = EXCLUDED.keywords,
  confidence_modifier = EXCLUDED.confidence_modifier,
  priority = EXCLUDED.priority,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- ============================================================================
-- Atualizar timestamp
-- ============================================================================

-- Trigger para atualizar updated_at já deve existir da migration anterior
-- Caso não exista, criar aqui:

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_merchants_dictionary_updated_at'
  ) THEN
    CREATE TRIGGER set_merchants_dictionary_updated_at
      BEFORE UPDATE ON public.merchants_dictionary
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Comentários
-- ============================================================================

COMMENT ON TABLE public.merchants_dictionary IS 
'Dicionário centralizado de merchants, estabelecimentos e padrões bancários. 
Todas as entidades devem ser gerenciadas aqui, evitando código hardcoded.';


