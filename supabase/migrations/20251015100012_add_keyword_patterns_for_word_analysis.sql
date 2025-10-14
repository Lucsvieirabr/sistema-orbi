-- Migration: Adiciona palavras-chave para análise palavra-por-palavra
-- 
-- Esta migration adiciona keywords específicas que ajudam na classificação quando
-- descrições compostas são analisadas palavra por palavra.
-- 
-- Exemplos de uso:
-- - "CATARINENSE COBRANCAS" -> palavra "COBRANCAS" -> Taxas
-- - "Empresa De Navegacao Santa" -> palavra "NAVEGACAO" -> Transporte
-- - "DiskAguaEGas" -> após separar camelCase -> "Disk Agua E Gas" -> "Agua" -> Casa

-- =============================================================================
-- PALAVRAS-CHAVE DE TRANSPORTE E NAVEGAÇÃO
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key,
  entity_name,
  entry_type,
  category,
  subcategory,
  aliases,
  confidence_modifier,
  priority,
  metadata
)
VALUES
  -- Navegação / Transporte marítimo
  (
    'navegacao',
    'Navegação',
    'keyword',
    'Transporte',
    'Transporte Marítimo / Balsas',
    ARRAY['navegacao', 'navegação', 'maritima', 'marítima', 'balsa', 'ferry', 'ferryboat'],
    0.80,
    75,
    jsonb_build_object('type', 'transport', 'subtype', 'maritime')
  ),
  
  -- Barco / Embarcação
  (
    'barco',
    'Barco',
    'keyword',
    'Transporte',
    'Transporte Marítimo / Balsas',
    ARRAY['barco', 'embarcacao', 'embarcação', 'lancha'],
    0.75,
    70,
    jsonb_build_object('type', 'transport', 'subtype', 'maritime')
  ),

  -- Rodoviária
  (
    'rodoviaria',
    'Rodoviária',
    'keyword',
    'Transporte',
    'Transporte Rodoviário',
    ARRAY['rodoviaria', 'rodoviária', 'onibus', 'ônibus'],
    0.85,
    80,
    jsonb_build_object('type', 'transport', 'subtype', 'road')
  )
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- PALAVRAS-CHAVE DE TAXAS E COBRANÇAS
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key,
  entity_name,
  entry_type,
  category,
  subcategory,
  aliases,
  confidence_modifier,
  priority,
  metadata
)
VALUES
  -- Cobranças genéricas
  (
    'cobrancas',
    'Cobranças',
    'keyword',
    'Tarifas Bancárias / Juros / Impostos / Taxas',
    'Cobranças',
    ARRAY['cobrancas', 'cobranças', 'cobranca', 'cobrança'],
    0.82,
    78,
    jsonb_build_object('type', 'fees', 'subtype', 'billing')
  ),
  
  -- Títulos / Boletos
  (
    'titulo',
    'Título',
    'keyword',
    'Tarifas Bancárias / Juros / Impostos / Taxas',
    'Boletos / Títulos',
    ARRAY['titulo', 'título', 'titulos', 'títulos', 'boleto', 'boletos'],
    0.80,
    75,
    jsonb_build_object('type', 'fees', 'subtype', 'billing_document')
  ),
  
  -- Encargos
  (
    'encargo',
    'Encargo',
    'keyword',
    'Tarifas Bancárias / Juros / Impostos / Taxas',
    'Encargos',
    ARRAY['encargo', 'encargos'],
    0.83,
    79,
    jsonb_build_object('type', 'fees', 'subtype', 'charges')
  )
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- PALAVRAS-CHAVE DE UTILIDADES (ÁGUA, GÁS, LUZ)
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key,
  entity_name,
  entry_type,
  category,
  subcategory,
  aliases,
  confidence_modifier,
  priority,
  metadata
)
VALUES
  -- Água
  (
    'agua',
    'Água',
    'keyword',
    'Casa',
    'Conta de Água',
    ARRAY['agua', 'água', 'hidro', 'saneamento', 'casan', 'sabesp', 'cedae'],
    0.88,
    85,
    jsonb_build_object('type', 'utilities', 'subtype', 'water')
  ),
  
  -- Gás
  (
    'gas',
    'Gás',
    'keyword',
    'Casa',
    'Conta de Gás',
    ARRAY['gas', 'gás', 'glp', 'gnv', 'comgas', 'ultragaz', 'liquigas'],
    0.87,
    84,
    jsonb_build_object('type', 'utilities', 'subtype', 'gas')
  ),
  
  -- Luz / Energia
  (
    'energia',
    'Energia',
    'keyword',
    'Casa',
    'Conta de Luz',
    ARRAY['energia', 'eletrica', 'elétrica', 'luz', 'celesc', 'cemig', 'copel', 'eletropaulo'],
    0.90,
    88,
    jsonb_build_object('type', 'utilities', 'subtype', 'electricity')
  ),
  
  -- Telefone
  (
    'telefone',
    'Telefone',
    'keyword',
    'Casa',
    'Conta de Telefone',
    ARRAY['telefone', 'telecom', 'tel', 'fone'],
    0.83,
    80,
    jsonb_build_object('type', 'utilities', 'subtype', 'phone')
  )
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- PALAVRAS-CHAVE DE SERVIÇOS FINANCEIROS
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key,
  entity_name,
  entry_type,
  category,
  subcategory,
  aliases,
  confidence_modifier,
  priority,
  metadata
)
VALUES
  -- Seguros
  (
    'seguro',
    'Seguro',
    'keyword',
    'Outros',
    'Seguros',
    ARRAY['seguro', 'seguros', 'seguradora'],
    0.82,
    77,
    jsonb_build_object('type', 'financial', 'subtype', 'insurance')
  ),
  
  -- Consórcio
  (
    'consorcio',
    'Consórcio',
    'keyword',
    'Outros',
    'Consórcio',
    ARRAY['consorcio', 'consórcio'],
    0.80,
    75,
    jsonb_build_object('type', 'financial', 'subtype', 'consortium')
  ),
  
  -- Cartório
  (
    'cartorio',
    'Cartório',
    'keyword',
    'Outros',
    'Cartório / Documentos',
    ARRAY['cartorio', 'cartório', 'tabeliao', 'tabelião'],
    0.85,
    82,
    jsonb_build_object('type', 'services', 'subtype', 'notary')
  )
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- PALAVRAS-CHAVE DE MANUTENÇÃO E REPAROS
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key,
  entity_name,
  entry_type,
  category,
  subcategory,
  aliases,
  confidence_modifier,
  priority,
  metadata
)
VALUES
  -- Manutenção
  (
    'manutencao',
    'Manutenção',
    'keyword',
    'Casa',
    'Manutenção / Reparos',
    ARRAY['manutencao', 'manutenção', 'reparo', 'reparos', 'conserto', 'consertos'],
    0.78,
    73,
    jsonb_build_object('type', 'services', 'subtype', 'maintenance')
  ),
  
  -- Instalação
  (
    'instalacao',
    'Instalação',
    'keyword',
    'Casa',
    'Instalação / Reforma',
    ARRAY['instalacao', 'instalação', 'reforma', 'reformas'],
    0.76,
    72,
    jsonb_build_object('type', 'services', 'subtype', 'installation')
  )
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- PALAVRAS-CHAVE DE EDUCAÇÃO
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key,
  entity_name,
  entry_type,
  category,
  subcategory,
  aliases,
  confidence_modifier,
  priority,
  metadata
)
VALUES
  -- Escola
  (
    'escola',
    'Escola',
    'keyword',
    'Filhos / Dependentes',
    'Escola / Mensalidade',
    ARRAY['escola', 'colegio', 'colégio', 'ensino', 'educacao', 'educação'],
    0.87,
    84,
    jsonb_build_object('type', 'education', 'subtype', 'school')
  ),
  
  -- Curso
  (
    'curso',
    'Curso',
    'keyword',
    'Outros',
    'Cursos / Capacitação',
    ARRAY['curso', 'cursos', 'treinamento', 'capacitacao', 'capacitação'],
    0.75,
    70,
    jsonb_build_object('type', 'education', 'subtype', 'course')
  ),
  
  -- Material escolar
  (
    'material',
    'Material Escolar',
    'keyword',
    'Filhos / Dependentes',
    'Material Escolar',
    ARRAY['material', 'escolar', 'livros', 'apostilas'],
    0.70,
    65,
    jsonb_build_object('type', 'education', 'subtype', 'supplies')
  )
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- PALAVRAS-CHAVE DE SAÚDE COMPLEMENTARES
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key,
  entity_name,
  entry_type,
  category,
  subcategory,
  aliases,
  confidence_modifier,
  priority,
  metadata
)
VALUES
  -- Clínica
  (
    'clinica',
    'Clínica',
    'keyword',
    'Proteção Pessoal / Saúde / Farmácia',
    'Clínica / Consultas',
    ARRAY['clinica', 'clínica', 'consulta', 'consultas'],
    0.85,
    82,
    jsonb_build_object('type', 'health', 'subtype', 'clinic')
  ),
  
  -- Laboratório
  (
    'laboratorio',
    'Laboratório',
    'keyword',
    'Proteção Pessoal / Saúde / Farmácia',
    'Laboratório / Exames',
    ARRAY['laboratorio', 'laboratório', 'exame', 'exames', 'analises', 'análises'],
    0.86,
    83,
    jsonb_build_object('type', 'health', 'subtype', 'lab')
  ),
  
  -- Hospital
  (
    'hospital',
    'Hospital',
    'keyword',
    'Proteção Pessoal / Saúde / Farmácia',
    'Hospital',
    ARRAY['hospital', 'hospitalar', 'pronto', 'socorro', 'emergencia', 'emergência'],
    0.88,
    85,
    jsonb_build_object('type', 'health', 'subtype', 'hospital')
  )
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- ATUALIZAÇÃO: Adiciona índices para melhor performance nas buscas
-- =============================================================================

-- Índice GIN para busca em aliases
CREATE INDEX IF NOT EXISTS idx_merchants_aliases_gin 
ON merchants_dictionary USING GIN (aliases);

-- Índice para busca por tipo de entrada (keyword)
CREATE INDEX IF NOT EXISTS idx_merchants_entry_type 
ON merchants_dictionary (entry_type);

-- Índice composto para buscas filtradas por tipo
CREATE INDEX IF NOT EXISTS idx_merchants_entry_category 
ON merchants_dictionary (entry_type, category);

-- =============================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =============================================================================

COMMENT ON TABLE merchants_dictionary IS 
'Dicionário de merchants e keywords para classificação automática de transações. Suporta análise palavra-por-palavra para descrições compostas.';

COMMENT ON COLUMN merchants_dictionary.entry_type IS 
'Tipo de entrada: merchant (estabelecimento específico), banking_pattern (padrão bancário), keyword (palavra-chave genérica)';

COMMENT ON COLUMN merchants_dictionary.aliases IS 
'Array de variações/aliases da palavra-chave ou merchant. Usado para matching fuzzy.';

COMMENT ON COLUMN merchants_dictionary.confidence_modifier IS 
'Modificador de confiança (0.0 a 1.0). Quanto maior, mais confiável é a classificação.';

COMMENT ON COLUMN merchants_dictionary.priority IS 
'Prioridade da regra (0-100). Regras com maior prioridade são preferidas quando há múltiplos matches.';

