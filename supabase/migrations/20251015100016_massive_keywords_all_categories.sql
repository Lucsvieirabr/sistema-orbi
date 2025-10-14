-- Migration: Keywords massivas para todas as categorias do sistema
-- 
-- Esta migration adiciona centenas de keywords genéricas e específicas para
-- maximizar a cobertura de classificação automática em TODAS as categorias.
--
-- Categorias cobertas: 24 categorias padrão do sistema
-- Keywords adicionadas: ~150+

BEGIN;

-- =============================================================================
-- CATEGORIA: TRANSPORTE
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('combustivel', 'Combustível', 'keyword', 'Transporte', 'Combustível',
   ARRAY['combustivel', 'combustível', 'gasolina', 'etanol', 'diesel', 'gnv'],
   ARRAY['combustivel', 'gasolina', 'diesel'], 0.90, 88,
   '{"type": "transport", "subtype": "fuel"}'),
   
  ('posto', 'Posto', 'keyword', 'Transporte', 'Combustível',
   ARRAY['posto', 'postos', 'posto de gasolina'],
   ARRAY['posto'], 0.85, 83,
   '{"type": "transport", "subtype": "gas_station"}'),
   
  ('onibus', 'Ônibus', 'keyword', 'Transporte', 'Transporte Público',
   ARRAY['onibus', 'ônibus', 'bus', 'transporte coletivo'],
   ARRAY['onibus', 'bus'], 0.90, 87,
   '{"type": "transport", "subtype": "bus"}'),
   
  ('metro', 'Metrô', 'keyword', 'Transporte', 'Transporte Público',
   ARRAY['metro', 'metrô', 'metropolitano'],
   ARRAY['metro'], 0.92, 89,
   '{"type": "transport", "subtype": "subway"}'),
   
  ('taxi', 'Táxi', 'keyword', 'Transporte', 'Táxi',
   ARRAY['taxi', 'táxi', 'cab'],
   ARRAY['taxi'], 0.91, 88,
   '{"type": "transport", "subtype": "taxi"}'),
   
  ('estacionamento', 'Estacionamento', 'keyword', 'Transporte', 'Estacionamento',
   ARRAY['estacionamento', 'parking', 'vaga', 'garagem'],
   ARRAY['estacionamento', 'parking'], 0.89, 86,
   '{"type": "transport", "subtype": "parking"}'),
   
  ('pedagio', 'Pedágio', 'keyword', 'Transporte', 'Pedágio',
   ARRAY['pedagio', 'pedágio', 'toll'],
   ARRAY['pedagio'], 0.93, 90,
   '{"type": "transport", "subtype": "toll"}'),
   
  ('oficina', 'Oficina', 'keyword', 'Transporte', 'Manutenção Veicular',
   ARRAY['oficina', 'mecanica', 'mecânica', 'auto center'],
   ARRAY['oficina', 'mecanica'], 0.87, 84,
   '{"type": "transport", "subtype": "car_repair"}'),
   
  ('lavagem', 'Lavagem', 'keyword', 'Transporte', 'Lavagem de Veículo',
   ARRAY['lavagem', 'lava', 'car wash', 'lava rapido', 'lava rápido'],
   ARRAY['lavagem', 'lava'], 0.88, 85,
   '{"type": "transport", "subtype": "car_wash"}'),
   
  ('pneu', 'Pneu', 'keyword', 'Transporte', 'Manutenção Veicular',
   ARRAY['pneu', 'pneus', 'borracharia'],
   ARRAY['pneu', 'borracharia'], 0.89, 86,
   '{"type": "transport", "subtype": "tire"}'),
   
  ('veiculo', 'Veículo', 'keyword', 'Transporte', 'Veículos',
   ARRAY['veiculo', 'veículo', 'carro', 'auto', 'automovel', 'automóvel'],
   ARRAY['veiculo', 'carro', 'auto'], 0.75, 70,
   '{"type": "transport", "subtype": "vehicle"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: BEM ESTAR / BELEZA
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('salao', 'Salão', 'keyword', 'Bem Estar / Beleza', 'Salão de Beleza',
   ARRAY['salao', 'salão', 'cabeleireiro', 'hair'],
   ARRAY['salao', 'cabeleireiro'], 0.90, 87,
   '{"type": "beauty", "subtype": "salon"}'),
   
  ('barbearia', 'Barbearia', 'keyword', 'Bem Estar / Beleza', 'Barbearia',
   ARRAY['barbearia', 'barber', 'barbeiro'],
   ARRAY['barbearia', 'barber'], 0.92, 89,
   '{"type": "beauty", "subtype": "barber"}'),
   
  ('manicure', 'Manicure', 'keyword', 'Bem Estar / Beleza', 'Manicure / Pedicure',
   ARRAY['manicure', 'pedicure', 'unha', 'unhas'],
   ARRAY['manicure', 'pedicure', 'unha'], 0.91, 88,
   '{"type": "beauty", "subtype": "nails"}'),
   
  ('estetica', 'Estética', 'keyword', 'Bem Estar / Beleza', 'Estética',
   ARRAY['estetica', 'estética', 'esteticista'],
   ARRAY['estetica'], 0.89, 86,
   '{"type": "beauty", "subtype": "aesthetics"}'),
   
  ('massagem', 'Massagem', 'keyword', 'Bem Estar / Beleza', 'Massagem / Spa',
   ARRAY['massagem', 'massagens', 'spa', 'massagista'],
   ARRAY['massagem', 'spa'], 0.90, 87,
   '{"type": "beauty", "subtype": "massage"}'),
   
  ('cosmetico', 'Cosmético', 'keyword', 'Bem Estar / Beleza', 'Cosméticos',
   ARRAY['cosmetico', 'cosmético', 'cosmeticos', 'maquiagem', 'perfume'],
   ARRAY['cosmetico', 'maquiagem', 'perfume'], 0.85, 82,
   '{"type": "beauty", "subtype": "cosmetics"}'),
   
  ('depilacao', 'Depilação', 'keyword', 'Bem Estar / Beleza', 'Depilação',
   ARRAY['depilacao', 'depilação', 'laser'],
   ARRAY['depilacao'], 0.91, 88,
   '{"type": "beauty", "subtype": "hair_removal"}'),
   
  ('academia', 'Academia', 'keyword', 'Bem Estar / Beleza', 'Academia',
   ARRAY['academia', 'gym', 'fitness', 'musculacao', 'musculação'],
   ARRAY['academia', 'gym', 'fitness'], 0.92, 89,
   '{"type": "beauty", "subtype": "gym"}'),
   
  ('pilates', 'Pilates', 'keyword', 'Bem Estar / Beleza', 'Pilates / Yoga',
   ARRAY['pilates', 'yoga', 'ioga'],
   ARRAY['pilates', 'yoga'], 0.91, 88,
   '{"type": "beauty", "subtype": "pilates"}'),
   
  ('personal', 'Personal', 'keyword', 'Bem Estar / Beleza', 'Personal Trainer',
   ARRAY['personal', 'trainer', 'treinador'],
   ARRAY['personal', 'trainer'], 0.88, 85,
   '{"type": "beauty", "subtype": "personal_trainer"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: ROUPAS E ACESSÓRIOS
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('roupa', 'Roupa', 'keyword', 'Roupas e acessórios', 'Roupas',
   ARRAY['roupa', 'roupas', 'vestuario', 'vestuário', 'clothing'],
   ARRAY['roupa', 'roupas', 'vestuario'], 0.82, 78,
   '{"type": "clothing", "subtype": "clothes"}'),
   
  ('calcado', 'Calçado', 'keyword', 'Roupas e acessórios', 'Calçados',
   ARRAY['calcado', 'calçado', 'sapato', 'tenis', 'tênis', 'shoe'],
   ARRAY['calcado', 'sapato', 'tenis'], 0.88, 85,
   '{"type": "clothing", "subtype": "shoes"}'),
   
  ('boutique', 'Boutique', 'keyword', 'Roupas e acessórios', 'Boutique',
   ARRAY['boutique', 'butique', 'loja de roupas'],
   ARRAY['boutique'], 0.87, 84,
   '{"type": "clothing", "subtype": "boutique"}'),
   
  ('moda', 'Moda', 'keyword', 'Roupas e acessórios', 'Moda',
   ARRAY['moda', 'fashion', 'tendencia', 'tendência'],
   ARRAY['moda', 'fashion'], 0.80, 75,
   '{"type": "clothing", "subtype": "fashion"}'),
   
  ('acessorio', 'Acessório', 'keyword', 'Roupas e acessórios', 'Acessórios',
   ARRAY['acessorio', 'acessório', 'acessorios', 'bolsa', 'carteira', 'cinto'],
   ARRAY['acessorio', 'bolsa', 'cinto'], 0.84, 80,
   '{"type": "clothing", "subtype": "accessories"}'),
   
  ('joalheria', 'Joalheria', 'keyword', 'Roupas e acessórios', 'Joias',
   ARRAY['joalheria', 'joia', 'joias', 'ouro', 'prata'],
   ARRAY['joalheria', 'joia'], 0.90, 87,
   '{"type": "clothing", "subtype": "jewelry"}'),
   
  ('relogio', 'Relógio', 'keyword', 'Roupas e acessórios', 'Relógios',
   ARRAY['relogio', 'relógio', 'relogios', 'relógios', 'watch'],
   ARRAY['relogio', 'watch'], 0.89, 86,
   '{"type": "clothing", "subtype": "watch"}'),
   
  ('otica', 'Ótica', 'keyword', 'Roupas e acessórios', 'Óticas',
   ARRAY['otica', 'ótica', 'oculos', 'óculos', 'lente'],
   ARRAY['otica', 'oculos'], 0.91, 88,
   '{"type": "clothing", "subtype": "optical"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: LAZER
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('cinema', 'Cinema', 'keyword', 'Lazer', 'Cinema',
   ARRAY['cinema', 'cinemas', 'movie', 'filme'],
   ARRAY['cinema', 'movie'], 0.92, 89,
   '{"type": "leisure", "subtype": "cinema"}'),
   
  ('teatro', 'Teatro', 'keyword', 'Lazer', 'Teatro',
   ARRAY['teatro', 'teatros', 'show', 'espetaculo', 'espetáculo'],
   ARRAY['teatro', 'show'], 0.90, 87,
   '{"type": "leisure", "subtype": "theater"}'),
   
  ('parque', 'Parque', 'keyword', 'Lazer', 'Parques',
   ARRAY['parque', 'parques', 'diversao', 'diversão'],
   ARRAY['parque', 'diversao'], 0.87, 84,
   '{"type": "leisure", "subtype": "park"}'),
   
  ('ingresso', 'Ingresso', 'keyword', 'Lazer', 'Ingressos',
   ARRAY['ingresso', 'ingressos', 'ticket', 'bilhete'],
   ARRAY['ingresso', 'ticket'], 0.85, 82,
   '{"type": "leisure", "subtype": "ticket"}'),
   
  ('evento', 'Evento', 'keyword', 'Lazer', 'Eventos',
   ARRAY['evento', 'eventos', 'festa', 'balada'],
   ARRAY['evento', 'festa'], 0.82, 78,
   '{"type": "leisure", "subtype": "event"}'),
   
  ('clube', 'Clube', 'keyword', 'Lazer', 'Clubes',
   ARRAY['clube', 'clubes', 'recreativo'],
   ARRAY['clube'], 0.86, 83,
   '{"type": "leisure", "subtype": "club"}'),
   
  ('boliche', 'Boliche', 'keyword', 'Lazer', 'Boliche',
   ARRAY['boliche', 'bowling'],
   ARRAY['boliche', 'bowling'], 0.92, 89,
   '{"type": "leisure", "subtype": "bowling"}'),
   
  ('game', 'Game', 'keyword', 'Lazer', 'Games / Jogos',
   ARRAY['game', 'games', 'videogame', 'jogos'],
   ARRAY['game', 'videogame', 'jogos'], 0.84, 80,
   '{"type": "leisure", "subtype": "games"}'),
   
  ('livraria', 'Livraria', 'keyword', 'Lazer', 'Livros',
   ARRAY['livraria', 'livro', 'livros', 'bookstore'],
   ARRAY['livraria', 'livro'], 0.88, 85,
   '{"type": "leisure", "subtype": "bookstore"}'),
   
  ('hobby', 'Hobby', 'keyword', 'Lazer', 'Hobbies',
   ARRAY['hobby', 'hobbies', 'passatempo'],
   ARRAY['hobby', 'passatempo'], 0.80, 75,
   '{"type": "leisure", "subtype": "hobby"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: ASSINATURAS
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('streaming', 'Streaming', 'keyword', 'Assinaturas', 'Streaming',
   ARRAY['streaming', 'stream', 'video', 'vídeo'],
   ARRAY['streaming', 'stream'], 0.89, 86,
   '{"type": "subscription", "subtype": "streaming"}'),
   
  ('musica', 'Música', 'keyword', 'Assinaturas', 'Streaming de Música',
   ARRAY['musica', 'música', 'music', 'audio', 'áudio'],
   ARRAY['musica', 'music'], 0.85, 82,
   '{"type": "subscription", "subtype": "music"}'),
   
  ('cloud', 'Cloud', 'keyword', 'Assinaturas', 'Armazenamento Cloud',
   ARRAY['cloud', 'nuvem', 'storage', 'armazenamento'],
   ARRAY['cloud', 'storage'], 0.87, 84,
   '{"type": "subscription", "subtype": "cloud"}'),
   
  ('software', 'Software', 'keyword', 'Assinaturas', 'Software / SaaS',
   ARRAY['software', 'saas', 'app', 'aplicativo'],
   ARRAY['software', 'saas', 'app'], 0.84, 80,
   '{"type": "subscription", "subtype": "software"}'),
   
  ('jornal', 'Jornal', 'keyword', 'Assinaturas', 'Jornal / Revista',
   ARRAY['jornal', 'revista', 'magazine', 'news'],
   ARRAY['jornal', 'revista'], 0.88, 85,
   '{"type": "subscription", "subtype": "news"}'),
   
  ('clube_assinatura', 'Clube de Assinatura', 'keyword', 'Assinaturas', 'Clube de Assinatura',
   ARRAY['clube de assinatura', 'box', 'assinatura'],
   ARRAY['clube', 'box', 'assinatura'], 0.83, 79,
   '{"type": "subscription", "subtype": "subscription_box"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: PET
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('petshop', 'Pet Shop', 'keyword', 'Pet', 'Pet Shop',
   ARRAY['petshop', 'pet shop', 'pet', 'pets'],
   ARRAY['petshop', 'pet'], 0.91, 88,
   '{"type": "pet", "subtype": "pet_shop"}'),
   
  ('veterinario', 'Veterinário', 'keyword', 'Pet', 'Veterinário',
   ARRAY['veterinario', 'veterinária', 'vet', 'veterinary'],
   ARRAY['veterinario', 'vet'], 0.93, 90,
   '{"type": "pet", "subtype": "veterinary"}'),
   
  ('racao', 'Ração', 'keyword', 'Pet', 'Ração',
   ARRAY['racao', 'ração', 'alimento', 'pet food'],
   ARRAY['racao', 'alimento'], 0.89, 86,
   '{"type": "pet", "subtype": "pet_food"}'),
   
  ('banho_tosa', 'Banho e Tosa', 'keyword', 'Pet', 'Banho e Tosa',
   ARRAY['banho e tosa', 'tosa', 'grooming'],
   ARRAY['tosa', 'grooming'], 0.90, 87,
   '{"type": "pet", "subtype": "grooming"}'),
   
  ('cachorro', 'Cachorro', 'keyword', 'Pet', 'Cachorro',
   ARRAY['cachorro', 'cao', 'cão', 'dog'],
   ARRAY['cachorro', 'cao', 'dog'], 0.85, 82,
   '{"type": "pet", "subtype": "dog"}'),
   
  ('gato', 'Gato', 'keyword', 'Pet', 'Gato',
   ARRAY['gato', 'felino', 'cat'],
   ARRAY['gato', 'cat'], 0.85, 82,
   '{"type": "pet", "subtype": "cat"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: FILHOS / DEPENDENTES
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('brinquedo', 'Brinquedo', 'keyword', 'Filhos / Dependentes', 'Brinquedos',
   ARRAY['brinquedo', 'brinquedos', 'toy', 'toys'],
   ARRAY['brinquedo', 'toy'], 0.89, 86,
   '{"type": "kids", "subtype": "toys"}'),
   
  ('fralda', 'Fralda', 'keyword', 'Filhos / Dependentes', 'Fraldas',
   ARRAY['fralda', 'fraldas', 'diaper'],
   ARRAY['fralda', 'diaper'], 0.93, 90,
   '{"type": "kids", "subtype": "diapers"}'),
   
  ('bebe', 'Bebê', 'keyword', 'Filhos / Dependentes', 'Bebê',
   ARRAY['bebe', 'bebê', 'baby', 'infantil'],
   ARRAY['bebe', 'baby', 'infantil'], 0.87, 84,
   '{"type": "kids", "subtype": "baby"}'),
   
  ('pediatra', 'Pediatra', 'keyword', 'Filhos / Dependentes', 'Pediatra',
   ARRAY['pediatra', 'pediatria'],
   ARRAY['pediatra'], 0.92, 89,
   '{"type": "kids", "subtype": "pediatrician"}'),
   
  ('creche', 'Creche', 'keyword', 'Filhos / Dependentes', 'Creche',
   ARRAY['creche', 'berçário', 'berçario', 'daycare'],
   ARRAY['creche', 'daycare'], 0.91, 88,
   '{"type": "kids", "subtype": "daycare"}'),
   
  ('uniforme', 'Uniforme', 'keyword', 'Filhos / Dependentes', 'Uniforme Escolar',
   ARRAY['uniforme', 'uniformes'],
   ARRAY['uniforme'], 0.86, 83,
   '{"type": "kids", "subtype": "uniform"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: PRESENTES / COMPRAS
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('presente', 'Presente', 'keyword', 'Presentes / Compras', 'Presentes',
   ARRAY['presente', 'presentes', 'gift', 'gifts'],
   ARRAY['presente', 'gift'], 0.84, 80,
   '{"type": "gifts", "subtype": "gift"}'),
   
  ('loja', 'Loja', 'keyword', 'Presentes / Compras', 'Lojas',
   ARRAY['loja', 'lojas', 'store', 'shop'],
   ARRAY['loja', 'store', 'shop'], 0.75, 70,
   '{"type": "gifts", "subtype": "store"}'),
   
  ('compra', 'Compra', 'keyword', 'Presentes / Compras', 'Compras',
   ARRAY['compra', 'compras', 'shopping'],
   ARRAY['compra', 'shopping'], 0.72, 67,
   '{"type": "gifts", "subtype": "shopping"}'),
   
  ('marketplace', 'Marketplace', 'keyword', 'Presentes / Compras', 'Marketplace',
   ARRAY['marketplace', 'ecommerce', 'e-commerce'],
   ARRAY['marketplace', 'ecommerce'], 0.80, 75,
   '{"type": "gifts", "subtype": "marketplace"}'),
   
  ('eletronico', 'Eletrônico', 'keyword', 'Presentes / Compras', 'Eletrônicos',
   ARRAY['eletronico', 'eletrônico', 'eletronicos', 'electronics'],
   ARRAY['eletronico', 'electronics'], 0.85, 82,
   '{"type": "gifts", "subtype": "electronics"}'),
   
  ('celular', 'Celular', 'keyword', 'Presentes / Compras', 'Celular / Smartphone',
   ARRAY['celular', 'smartphone', 'mobile', 'iphone', 'samsung'],
   ARRAY['celular', 'smartphone', 'mobile'], 0.88, 85,
   '{"type": "gifts", "subtype": "mobile"}'),
   
  ('notebook', 'Notebook', 'keyword', 'Presentes / Compras', 'Informática',
   ARRAY['notebook', 'laptop', 'computador', 'pc'],
   ARRAY['notebook', 'laptop', 'computador'], 0.89, 86,
   '{"type": "gifts", "subtype": "computer"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: FÉRIAS / VIAGENS
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('hotel', 'Hotel', 'keyword', 'Férias / Viagens', 'Hotel',
   ARRAY['hotel', 'hoteis', 'hotéis', 'pousada', 'hospedagem'],
   ARRAY['hotel', 'pousada', 'hospedagem'], 0.92, 89,
   '{"type": "travel", "subtype": "hotel"}'),
   
  ('viagem', 'Viagem', 'keyword', 'Férias / Viagens', 'Viagens',
   ARRAY['viagem', 'viagens', 'travel', 'turismo'],
   ARRAY['viagem', 'travel', 'turismo'], 0.85, 82,
   '{"type": "travel", "subtype": "travel"}'),
   
  ('passagem', 'Passagem', 'keyword', 'Férias / Viagens', 'Passagens',
   ARRAY['passagem', 'passagens', 'ticket', 'bilhete'],
   ARRAY['passagem', 'ticket'], 0.88, 85,
   '{"type": "travel", "subtype": "ticket"}'),
   
  ('aereo', 'Aéreo', 'keyword', 'Férias / Viagens', 'Passagem Aérea',
   ARRAY['aereo', 'aéreo', 'aviao', 'avião', 'flight', 'airline'],
   ARRAY['aereo', 'aviao', 'flight'], 0.91, 88,
   '{"type": "travel", "subtype": "flight"}'),
   
  ('agencia', 'Agência', 'keyword', 'Férias / Viagens', 'Agência de Viagens',
   ARRAY['agencia', 'agência', 'agencia de viagens'],
   ARRAY['agencia'], 0.89, 86,
   '{"type": "travel", "subtype": "agency"}'),
   
  ('aluguel_carro', 'Aluguel de Carro', 'keyword', 'Férias / Viagens', 'Aluguel de Carro',
   ARRAY['aluguel de carro', 'locadora', 'rent a car', 'rental'],
   ARRAY['locadora', 'rental'], 0.90, 87,
   '{"type": "travel", "subtype": "car_rental"}'),
   
  ('resort', 'Resort', 'keyword', 'Férias / Viagens', 'Resort',
   ARRAY['resort', 'resorts'],
   ARRAY['resort'], 0.92, 89,
   '{"type": "travel", "subtype": "resort"}'),
   
  ('mala', 'Mala', 'keyword', 'Férias / Viagens', 'Bagagem',
   ARRAY['mala', 'malas', 'bagagem', 'luggage'],
   ARRAY['mala', 'bagagem', 'luggage'], 0.86, 83,
   '{"type": "travel", "subtype": "luggage"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: DESPESAS PESSOAIS
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('documento', 'Documento', 'keyword', 'Despesas Pessoais', 'Documentos',
   ARRAY['documento', 'documentos', 'certidao', 'certidão'],
   ARRAY['documento', 'certidao'], 0.85, 82,
   '{"type": "personal", "subtype": "documents"}'),
   
  ('despachante', 'Despachante', 'keyword', 'Despesas Pessoais', 'Despachante',
   ARRAY['despachante', 'detran'],
   ARRAY['despachante', 'detran'], 0.90, 87,
   '{"type": "personal", "subtype": "dmv"}'),
   
  ('advogado', 'Advogado', 'keyword', 'Despesas Pessoais', 'Advogado',
   ARRAY['advogado', 'advocacia', 'lawyer'],
   ARRAY['advogado', 'advocacia'], 0.91, 88,
   '{"type": "personal", "subtype": "lawyer"}'),
   
  ('contador', 'Contador', 'keyword', 'Despesas Pessoais', 'Contador',
   ARRAY['contador', 'contabilidade', 'accountant'],
   ARRAY['contador', 'contabilidade'], 0.90, 87,
   '{"type": "personal", "subtype": "accountant"}'),
   
  ('sindicato', 'Sindicato', 'keyword', 'Despesas Pessoais', 'Sindicato',
   ARRAY['sindicato', 'sindicatos', 'union'],
   ARRAY['sindicato'], 0.88, 85,
   '{"type": "personal", "subtype": "union"}'),
   
  ('associacao', 'Associação', 'keyword', 'Despesas Pessoais', 'Associação',
   ARRAY['associacao', 'associação', 'association'],
   ARRAY['associacao'], 0.84, 80,
   '{"type": "personal", "subtype": "association"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: DIARISTA / PRESTADORES SERV.
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('diarista', 'Diarista', 'keyword', 'Diarista / Prestadores Serv.', 'Diarista',
   ARRAY['diarista', 'faxineira', 'empregada', 'domestica', 'doméstica'],
   ARRAY['diarista', 'faxineira', 'domestica'], 0.92, 89,
   '{"type": "services", "subtype": "housekeeper"}'),
   
  ('eletricista', 'Eletricista', 'keyword', 'Diarista / Prestadores Serv.', 'Eletricista',
   ARRAY['eletricista', 'eletrico', 'elétrico', 'electrician'],
   ARRAY['eletricista', 'eletrico'], 0.91, 88,
   '{"type": "services", "subtype": "electrician"}'),
   
  ('encanador', 'Encanador', 'keyword', 'Diarista / Prestadores Serv.', 'Encanador',
   ARRAY['encanador', 'hidraulico', 'hidráulico', 'plumber'],
   ARRAY['encanador', 'hidraulico'], 0.91, 88,
   '{"type": "services", "subtype": "plumber"}'),
   
  ('pintor', 'Pintor', 'keyword', 'Diarista / Prestadores Serv.', 'Pintor',
   ARRAY['pintor', 'pintura', 'painter'],
   ARRAY['pintor', 'pintura'], 0.89, 86,
   '{"type": "services", "subtype": "painter"}'),
   
  ('pedreiro', 'Pedreiro', 'keyword', 'Diarista / Prestadores Serv.', 'Pedreiro',
   ARRAY['pedreiro', 'pedreiros', 'construcao', 'construção'],
   ARRAY['pedreiro', 'construcao'], 0.90, 87,
   '{"type": "services", "subtype": "construction"}'),
   
  ('jardineiro', 'Jardineiro', 'keyword', 'Diarista / Prestadores Serv.', 'Jardineiro',
   ARRAY['jardineiro', 'jardinagem', 'gardener'],
   ARRAY['jardineiro', 'jardinagem'], 0.91, 88,
   '{"type": "services", "subtype": "gardener"}'),
   
  ('marceneiro', 'Marceneiro', 'keyword', 'Diarista / Prestadores Serv.', 'Marceneiro',
   ARRAY['marceneiro', 'marcenaria', 'carpenter'],
   ARRAY['marceneiro', 'marcenaria'], 0.90, 87,
   '{"type": "services", "subtype": "carpenter"}'),
   
  ('chaveiro', 'Chaveiro', 'keyword', 'Diarista / Prestadores Serv.', 'Chaveiro',
   ARRAY['chaveiro', 'locksmith'],
   ARRAY['chaveiro', 'locksmith'], 0.92, 89,
   '{"type": "services", "subtype": "locksmith"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: EMPRÉSTIMOS / FINANCIAMENTOS
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('emprestimo', 'Empréstimo', 'keyword', 'Empréstimos / Financiamentos', 'Empréstimo',
   ARRAY['emprestimo', 'empréstimo', 'loan'],
   ARRAY['emprestimo', 'loan'], 0.90, 87,
   '{"type": "financing", "subtype": "loan"}'),
   
  ('financiamento', 'Financiamento', 'keyword', 'Empréstimos / Financiamentos', 'Financiamento',
   ARRAY['financiamento', 'financiado', 'financing'],
   ARRAY['financiamento', 'financiado'], 0.91, 88,
   '{"type": "financing", "subtype": "financing"}'),
   
  ('parcela', 'Parcela', 'keyword', 'Empréstimos / Financiamentos', 'Parcela',
   ARRAY['parcela', 'parcelas', 'prestacao', 'prestação', 'installment'],
   ARRAY['parcela', 'prestacao'], 0.82, 78,
   '{"type": "financing", "subtype": "installment"}'),
   
  ('refinanciamento', 'Refinanciamento', 'keyword', 'Empréstimos / Financiamentos', 'Refinanciamento',
   ARRAY['refinanciamento', 'refinancing'],
   ARRAY['refinanciamento'], 0.92, 89,
   '{"type": "financing", "subtype": "refinancing"}'),
   
  ('consignado', 'Consignado', 'keyword', 'Empréstimos / Financiamentos', 'Consignado',
   ARRAY['consignado', 'desconto em folha'],
   ARRAY['consignado'], 0.93, 90,
   '{"type": "financing", "subtype": "payroll_loan"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: GASTOS COM PJ / PROFISSIONAIS AUTÔNOMOS
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  ('escritorio', 'Escritório', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Escritório',
   ARRAY['escritorio', 'escritório', 'office'],
   ARRAY['escritorio', 'office'], 0.85, 82,
   '{"type": "business", "subtype": "office"}'),
   
  ('fornecedor', 'Fornecedor', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Fornecedor',
   ARRAY['fornecedor', 'fornecedores', 'supplier'],
   ARRAY['fornecedor', 'supplier'], 0.87, 84,
   '{"type": "business", "subtype": "supplier"}'),
   
  ('honorario', 'Honorário', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Honorários',
   ARRAY['honorario', 'honorário', 'honorarios', 'fee'],
   ARRAY['honorario', 'fee'], 0.89, 86,
   '{"type": "business", "subtype": "fees"}'),
   
  ('material_escritorio', 'Material de Escritório', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Material de Escritório',
   ARRAY['papelaria', 'material de escritorio', 'office supplies'],
   ARRAY['papelaria', 'supplies'], 0.86, 83,
   '{"type": "business", "subtype": "office_supplies"}'),
   
  ('impressao', 'Impressão', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Impressão',
   ARRAY['impressao', 'impressão', 'grafica', 'gráfica', 'print'],
   ARRAY['impressao', 'grafica', 'print'], 0.88, 85,
   '{"type": "business", "subtype": "printing"}'),
   
  ('consultoria', 'Consultoria', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Consultoria',
   ARRAY['consultoria', 'consultor', 'consulting'],
   ARRAY['consultoria', 'consultor'], 0.90, 87,
   '{"type": "business", "subtype": "consulting"}')
ON CONFLICT (merchant_key) DO NOTHING;

COMMIT;

-- =============================================================================
-- REINDEX PARA MELHOR PERFORMANCE (FORA DA TRANSAÇÃO)
-- =============================================================================

REINDEX INDEX idx_merchants_aliases_gin;
REINDEX INDEX idx_merchants_keywords;

-- =============================================================================
-- ESTATÍSTICAS
-- =============================================================================

DO $$
DECLARE
  v_total_keywords integer;
BEGIN
  SELECT COUNT(*) INTO v_total_keywords
  FROM merchants_dictionary
  WHERE entry_type = 'keyword';
  
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Migration completa!';
  RAISE NOTICE 'Total de keywords no sistema: %', v_total_keywords;
  RAISE NOTICE '=============================================================';
END $$;

