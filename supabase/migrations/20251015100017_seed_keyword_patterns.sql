-- Migration: Seed keyword patterns for transaction classification
-- Populates the merchants dictionary with keyword patterns for better matching
-- Focused on banking operations, utilities, services, and common transaction descriptions

BEGIN;

-- ============================================================================
-- KEYWORDS - OPERAÇÕES BANCÁRIAS (DEPÓSITOS E SAQUES)
-- ============================================================================

INSERT INTO public.merchants_dictionary (
  merchant_key,
  entity_name,
  category,
  subcategory,
  entry_type,
  keywords,
  confidence_modifier,
  priority,
  usage_count,
  source_type,
  metadata
) VALUES

-- Depósitos
('dep dinheiro caixa ag', 'Depósito em Dinheiro Agência', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Depósitos', 'keyword',
 ARRAY['dep dinheiro', 'deposito dinheiro', 'dep ag', 'caixa ag'], 0.85, 75, 0, 'imported', '{"pattern_type": "banking", "operation": "deposit"}'),

('dep cheque caixa ag', 'Depósito em Cheque Agência', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Depósitos', 'keyword',
 ARRAY['dep cheque', 'deposito cheque', 'cheque ag'], 0.85, 75, 0, 'imported', '{"pattern_type": "banking", "operation": "deposit"}'),

('dep disponivel caixa ag', 'Depósito Disponível Agência', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Depósitos', 'keyword',
 ARRAY['dep disponivel', 'deposito disponivel'], 0.85, 75, 0, 'imported', '{"pattern_type": "banking", "operation": "deposit"}'),

('dep dinheiro atm', 'Depósito em Dinheiro ATM', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Depósitos', 'keyword',
 ARRAY['dep atm', 'deposito atm', 'atm dinheiro'], 0.85, 75, 0, 'imported', '{"pattern_type": "banking", "operation": "deposit"}'),

('dep cheque atm', 'Depósito em Cheque ATM', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Depósitos', 'keyword',
 ARRAY['dep cheque atm', 'deposito cheque atm'], 0.85, 75, 0, 'imported', '{"pattern_type": "banking", "operation": "deposit"}'),

('pix saque', 'PIX Saque', 'Outros', 'Saques', 'keyword',
 ARRAY['pix saque'], 0.90, 85, 0, 'imported', '{"pattern_type": "banking", "operation": "withdrawal"}'),

('pix troco', 'PIX Troco', 'Outros', 'Saques', 'keyword',
 ARRAY['pix troco'], 0.90, 85, 0, 'imported', '{"pattern_type": "banking", "operation": "withdrawal"}'),

-- Saques
('saque din cartao ag', 'Saque Dinheiro Cartão Agência', 'Outros', 'Saques', 'keyword',
 ARRAY['saque cartao', 'saque ag', 'saque dinheiro ag'], 0.90, 85, 0, 'imported', '{"pattern_type": "banking", "operation": "withdrawal"}'),

('saque dinheiro atm', 'Saque Dinheiro ATM', 'Outros', 'Saques', 'keyword',
 ARRAY['saque atm', 'saque dinheiro atm'], 0.90, 85, 0, 'imported', '{"pattern_type": "banking", "operation": "withdrawal"}'),

('saque banco 24h', 'Saque Banco 24H', 'Outros', 'Saques', 'keyword',
 ARRAY['saque 24h', 'banco 24h', 'saque banco24h'], 0.90, 85, 0, 'imported', '{"pattern_type": "banking", "operation": "withdrawal"}'),

('saque atm rede saquepague', 'Saque ATM Rede Saque e Pague', 'Outros', 'Saques', 'keyword',
 ARRAY['saque pague', 'saquepague', 'rede saquepague'], 0.88, 83, 0, 'imported', '{"pattern_type": "banking", "operation": "withdrawal"}'),

('saque atm rede plus', 'Saque ATM Rede Plus', 'Outros', 'Saques', 'keyword',
 ARRAY['rede plus', 'saque plus'], 0.88, 83, 0, 'imported', '{"pattern_type": "banking", "operation": "withdrawal"}'),

('saque atm rede cirrus', 'Saque ATM Rede Cirrus', 'Outros', 'Saques', 'keyword',
 ARRAY['rede cirrus', 'saque cirrus'], 0.88, 83, 0, 'imported', '{"pattern_type": "banking", "operation": "withdrawal"}'),

('financiamento de fatura', 'Financiamento de Fatura', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros', 'keyword',
 ARRAY['financiamento fatura', 'financ fatura'], 0.92, 90, 0, 'imported', '{"pattern_type": "banking", "operation": "financing"}'),

-- ============================================================================
-- KEYWORDS - INVESTIMENTOS
-- ============================================================================

('dividendos', 'Dividendos', 'Renda de Investimentos', 'Investimentos', 'keyword',
 ARRAY['dividendos', 'dividend'], 0.95, 95, 0, 'imported', '{"pattern_type": "income", "category": "investment"}'),

('juros sobre capital proprio', 'Juros sobre Capital Próprio', 'Renda de Investimentos', 'Investimentos', 'keyword',
 ARRAY['jcp', 'juros capital proprio', 'juros sobre capital'], 0.95, 95, 0, 'imported', '{"pattern_type": "income", "category": "investment"}'),

('rendimentos', 'Rendimentos', 'Renda de Investimentos', 'Investimentos', 'keyword',
 ARRAY['rendimentos', 'rendimento'], 0.90, 88, 0, 'imported', '{"pattern_type": "income", "category": "investment"}'),

('resgate investimento', 'Resgate de Investimento', 'Renda de Investimentos', 'Investimentos', 'keyword',
 ARRAY['resgate'], 0.90, 88, 0, 'imported', '{"pattern_type": "income", "category": "investment"}'),

('aplicacao investimento', 'Aplicação de Investimento', 'Investimentos (pelo menos 20% da receita)', 'Investimentos', 'keyword',
 ARRAY['aplicacao', 'aplicação'], 0.90, 88, 0, 'imported', '{"pattern_type": "expense", "category": "investment"}'),

-- ============================================================================
-- KEYWORDS - IMPOSTOS
-- ============================================================================

('irpj', 'IRPJ', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos', 'keyword',
 ARRAY['irpj', 'imposto de renda pj'], 0.95, 95, 0, 'imported', '{"pattern_type": "tax"}'),

('das', 'DAS', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos', 'keyword',
 ARRAY['das', 'simples nacional'], 0.95, 95, 0, 'imported', '{"pattern_type": "tax"}'),

('iptu', 'IPTU', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos', 'keyword',
 ARRAY['iptu', 'imposto predial'], 0.95, 95, 0, 'imported', '{"pattern_type": "tax"}'),

('ipva', 'IPVA', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos', 'keyword',
 ARRAY['ipva', 'imposto veiculo'], 0.95, 95, 0, 'imported', '{"pattern_type": "tax"}'),

-- ============================================================================
-- KEYWORDS - CONCESSIONÁRIAS DE ENERGIA
-- ============================================================================

('amazonas energia', 'Amazonas Energia', 'Casa', 'Energia Elétrica', 'keyword',
 ARRAY['amazonas energia'], 0.92, 92, 0, 'imported', '{"pattern_type": "utility", "state": "AM", "type": "energy"}'),

('cemig', 'CEMIG', 'Casa', 'Energia Elétrica', 'keyword',
 ARRAY['cemig', 'companhia energetica minas gerais'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "state": "MG", "type": "energy"}'),

('cpfl energia', 'CPFL Energia', 'Casa', 'Energia Elétrica', 'keyword',
 ARRAY['cpfl', 'cpfl paulista', 'cpfl piratininga', 'cpfl santa cruz'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "state": "SP", "type": "energy"}'),

('edp brasil', 'EDP Brasil', 'Casa', 'Energia Elétrica', 'keyword',
 ARRAY['edp', 'edp espirito santo', 'edp sao paulo'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "type": "energy"}'),

('enel brasil', 'Enel Brasil', 'Casa', 'Energia Elétrica', 'keyword',
 ARRAY['enel', 'enel ceara', 'enel rio', 'enel sao paulo'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "type": "energy"}'),

('energisa', 'Energisa', 'Casa', 'Energia Elétrica', 'keyword',
 ARRAY['energisa', 'energisa sul-sudeste'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "type": "energy"}'),

('equatorial energia', 'Equatorial Energia', 'Casa', 'Energia Elétrica', 'keyword',
 ARRAY['equatorial', 'equatorial energia'], 0.92, 92, 0, 'imported', '{"pattern_type": "utility", "type": "energy"}'),

('light sa', 'Light S/A', 'Casa', 'Energia Elétrica', 'keyword',
 ARRAY['light', 'light sa'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "state": "RJ", "type": "energy"}'),

('neoenergia', 'Neoenergia', 'Casa', 'Energia Elétrica', 'keyword',
 ARRAY['neoenergia', 'neoenergia elektro'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "type": "energy"}'),

-- ============================================================================
-- KEYWORDS - CONCESSIONÁRIAS DE GÁS
-- ============================================================================

('comgas', 'Comgás', 'Casa', 'Gás', 'keyword',
 ARRAY['comgas'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "state": "SP", "type": "gas"}'),

('naturgy', 'Naturgy', 'Casa', 'Gás', 'keyword',
 ARRAY['naturgy'], 0.92, 92, 0, 'imported', '{"pattern_type": "utility", "type": "gas"}'),

-- ============================================================================
-- KEYWORDS - CONCESSIONÁRIAS DE ÁGUA E SANEAMENTO
-- ============================================================================

('sabesp', 'SABESP', 'Casa', 'Água e Esgoto', 'keyword',
 ARRAY['sabesp'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "state": "SP", "type": "water"}'),

('cedae', 'CEDAE', 'Casa', 'Água e Esgoto', 'keyword',
 ARRAY['cedae'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "state": "RJ", "type": "water"}'),

('copasa', 'COPASA', 'Casa', 'Água e Esgoto', 'keyword',
 ARRAY['copasa'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "state": "MG", "type": "water"}'),

('sanepar', 'SANEPAR', 'Casa', 'Água e Esgoto', 'keyword',
 ARRAY['sanepar'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "state": "PR", "type": "water"}'),

('corsan', 'CORSAN', 'Casa', 'Água e Esgoto', 'keyword',
 ARRAY['corsan'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "state": "RS", "type": "water"}'),

('casan', 'CASAN', 'Casa', 'Água e Esgoto', 'keyword',
 ARRAY['casan'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "state": "SC", "type": "water"}'),

('caesb', 'CAESB', 'Casa', 'Água e Esgoto', 'keyword',
 ARRAY['caesb'], 0.95, 95, 0, 'imported', '{"pattern_type": "utility", "state": "DF", "type": "water"}'),

('embasa', 'EMBASA', 'Casa', 'Água e Esgoto', 'keyword',
 ARRAY['embasa'], 0.92, 92, 0, 'imported', '{"pattern_type": "utility", "state": "BA", "type": "water"}'),

('cagece', 'CAGECE', 'Casa', 'Água e Esgoto', 'keyword',
 ARRAY['cagece'], 0.92, 92, 0, 'imported', '{"pattern_type": "utility", "state": "CE", "type": "water"}'),

('aegea saneamento', 'Aegea Saneamento', 'Casa', 'Água e Esgoto', 'keyword',
 ARRAY['aegea', 'aegea saneamento'], 0.90, 90, 0, 'imported', '{"pattern_type": "utility", "type": "water"}'),

('igua saneamento', 'Iguá Saneamento', 'Casa', 'Água e Esgoto', 'keyword',
 ARRAY['igua', 'iguá saneamento'], 0.90, 90, 0, 'imported', '{"pattern_type": "utility", "type": "water"}'),

-- ============================================================================
-- KEYWORDS - OPERADORAS DE TELECOMUNICAÇÕES
-- ============================================================================

('vivo telecomunicacoes', 'Vivo', 'Assinaturas', 'Telefonia', 'keyword',
 ARRAY['vivo', 'vivo fibra', 'vivo tv'], 0.95, 95, 0, 'imported', '{"pattern_type": "telecom"}'),

('claro telecomunicacoes', 'Claro', 'Assinaturas', 'Telefonia', 'keyword',
 ARRAY['claro', 'claro tv'], 0.95, 95, 0, 'imported', '{"pattern_type": "telecom"}'),

('oi telecomunicacoes', 'Oi', 'Assinaturas', 'Telefonia', 'keyword',
 ARRAY['oi', 'oi tv'], 0.95, 95, 0, 'imported', '{"pattern_type": "telecom"}'),

('tim telecomunicacoes', 'TIM', 'Assinaturas', 'Telefonia', 'keyword',
 ARRAY['tim'], 0.95, 95, 0, 'imported', '{"pattern_type": "telecom"}'),

('sky telecomunicacoes', 'SKY', 'Assinaturas', 'TV por Assinatura', 'keyword',
 ARRAY['sky'], 0.92, 92, 0, 'imported', '{"pattern_type": "telecom", "type": "tv"}'),

-- ============================================================================
-- KEYWORDS - SAÚDE (HOSPITAIS E LABORATÓRIOS)
-- ============================================================================

('rede dor', 'Rede D''Or', 'Proteção Pessoal / Saúde / Farmácia', 'Hospital', 'keyword',
 ARRAY['rede dor', 'rede d''or'], 0.92, 92, 0, 'imported', '{"pattern_type": "health", "type": "hospital"}'),

('dasa', 'Dasa', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório', 'keyword',
 ARRAY['dasa', 'laboratorio dasa'], 0.92, 92, 0, 'imported', '{"pattern_type": "health", "type": "lab"}'),

('hemograma', 'Hemograma', 'Proteção Pessoal / Saúde / Farmácia', 'Exames', 'keyword',
 ARRAY['hemograma', 'glicemia', 'colesterol', 'triglicerideos', 'ureia', 'creatina', 'tgo', 'ast', 'tgp', 'alt', 'tsh', 't4 livre', 'acido urico', 'exame de urina', 'exame de fezes', 'hemoglobina glicada', 'hba1c', 'bilirrubinas'],
 0.88, 85, 0, 'imported', '{"pattern_type": "health", "type": "lab_exam"}'),

('analgesicos', 'Analgésicos', 'Proteção Pessoal / Saúde / Farmácia', 'Medicamentos', 'keyword',
 ARRAY['analgesicos', 'anti-inflamatorios', 'antitermicos', 'antialergicos', 'relaxantes musculares'],
 0.85, 80, 0, 'imported', '{"pattern_type": "health", "type": "medicine"}'),

-- ============================================================================
-- KEYWORDS - ACADEMIAS
-- ============================================================================

('smartfit', 'SmartFit', 'Bem Estar / Beleza', 'Academia', 'keyword',
 ARRAY['smartfit', 'smart fit'], 0.95, 95, 0, 'imported', '{"pattern_type": "fitness"}'),

('bio ritmo', 'Bio Ritmo', 'Bem Estar / Beleza', 'Academia', 'keyword',
 ARRAY['bio ritmo', 'bioritmo'], 0.92, 92, 0, 'imported', '{"pattern_type": "fitness"}'),

('bodytech', 'BodyTech', 'Bem Estar / Beleza', 'Academia', 'keyword',
 ARRAY['bodytech', 'body tech'], 0.92, 92, 0, 'imported', '{"pattern_type": "fitness"}'),

('bluefit', 'BlueFit', 'Bem Estar / Beleza', 'Academia', 'keyword',
 ARRAY['bluefit', 'blue fit'], 0.90, 90, 0, 'imported', '{"pattern_type": "fitness"}'),

('cia athletica', 'Cia Athletica', 'Bem Estar / Beleza', 'Academia', 'keyword',
 ARRAY['cia athletica', 'companhia athletica'], 0.90, 90, 0, 'imported', '{"pattern_type": "fitness"}'),

-- ============================================================================
-- KEYWORDS - E-COMMERCE E MARKETPLACES
-- ============================================================================

('mercado livre', 'Mercado Livre', 'Presentes / Compras', 'E-commerce', 'keyword',
 ARRAY['mercado livre', 'mercadolivre'], 0.95, 95, 0, 'imported', '{"pattern_type": "ecommerce"}'),

('shopee', 'Shopee', 'Presentes / Compras', 'E-commerce', 'keyword',
 ARRAY['shopee'], 0.95, 95, 0, 'imported', '{"pattern_type": "ecommerce"}'),

('amazon brasil', 'Amazon Brasil', 'Presentes / Compras', 'E-commerce', 'keyword',
 ARRAY['amazon', 'amazon brasil'], 0.95, 95, 0, 'imported', '{"pattern_type": "ecommerce"}'),

('magazine luiza', 'Magazine Luiza', 'Presentes / Compras', 'E-commerce', 'keyword',
 ARRAY['magazine luiza', 'magalu'], 0.95, 95, 0, 'imported', '{"pattern_type": "ecommerce"}'),

('shein', 'Shein', 'Presentes / Compras', 'E-commerce', 'keyword',
 ARRAY['shein'], 0.92, 92, 0, 'imported', '{"pattern_type": "ecommerce", "category": "fashion"}'),

('aliexpress', 'AliExpress', 'Presentes / Compras', 'E-commerce', 'keyword',
 ARRAY['aliexpress', 'ali express'], 0.92, 92, 0, 'imported', '{"pattern_type": "ecommerce"}'),

-- ============================================================================
-- KEYWORDS - PET SHOPS
-- ============================================================================

('cobasi', 'Cobasi', 'Pet', 'Pet Shop', 'keyword',
 ARRAY['cobasi'], 0.92, 92, 0, 'imported', '{"pattern_type": "pet"}'),

('petz', 'Petz', 'Pet', 'Pet Shop', 'keyword',
 ARRAY['petz'], 0.95, 95, 0, 'imported', '{"pattern_type": "pet"}'),

('petlove', 'Petlove', 'Pet', 'Pet Shop', 'keyword',
 ARRAY['petlove'], 0.92, 92, 0, 'imported', '{"pattern_type": "pet"}'),

-- ============================================================================
-- KEYWORDS - LOJAS DE BRINQUEDOS
-- ============================================================================

('ri happy', 'Ri Happy', 'Filhos / Dependentes', 'Brinquedos', 'keyword',
 ARRAY['ri happy', 'rihappy'], 0.90, 90, 0, 'imported', '{"pattern_type": "toys"}'),

('pbkids', 'PBKIDS', 'Filhos / Dependentes', 'Brinquedos', 'keyword',
 ARRAY['pbkids', 'pb kids'], 0.88, 88, 0, 'imported', '{"pattern_type": "toys"}'),

-- ============================================================================
-- KEYWORDS - PRODUTOS DE SUPERMERCADO
-- ============================================================================

('churrasco', 'Churrasco', 'Alimentação', 'Supermercado', 'keyword',
 ARRAY['churrasco', 'carne bovina', 'carne suina', 'frango', 'peixe'],
 0.80, 70, 0, 'imported', '{"pattern_type": "supermarket", "category": "meat"}'),

('bebidas', 'Bebidas', 'Alimentação', 'Supermercado', 'keyword',
 ARRAY['agua', 'refrigerante', 'suco', 'cerveja', 'coca-cola', 'pepsi', 'guarana antarctica', 'fanta', 'brahma', 'heineken', 'skol', 'amstel'],
 0.75, 65, 0, 'imported', '{"pattern_type": "supermarket", "category": "beverages"}'),

('limpeza casa', 'Produtos de Limpeza', 'Casa', 'Limpeza', 'keyword',
 ARRAY['detergente', 'desinfetante', 'sabao em po', 'sabao liquido', 'agua sanitaria', 'alcool', 'limpador multiuso', 'esponja', 'vassoura', 'rodo'],
 0.75, 65, 0, 'imported', '{"pattern_type": "supermarket", "category": "cleaning"}'),

('fraldas', 'Fraldas', 'Filhos / Dependentes', 'Bebês', 'keyword',
 ARRAY['pampers', 'huggies', 'mamypoko', 'babysec', 'turma da monica baby', 'pompom'],
 0.85, 80, 0, 'imported', '{"pattern_type": "supermarket", "category": "baby"}'),

-- ============================================================================
-- KEYWORDS - ELETRODOMÉSTICOS
-- ============================================================================

('eletrodomesticos', 'Eletrodomésticos', 'Casa', 'Eletrodomésticos', 'keyword',
 ARRAY['brastemp', 'electrolux', 'consul', 'samsung', 'lg', 'bosch', 'midea', 'philco', 'mondial', 'britania', 'philips'],
 0.80, 75, 0, 'imported', '{"pattern_type": "appliances"}'),

-- ============================================================================
-- KEYWORDS - STREAMING E ASSINATURAS DIGITAIS
-- ============================================================================

('netflix assinatura', 'Netflix', 'Assinaturas', 'Streaming', 'keyword',
 ARRAY['netflix'], 0.95, 95, 0, 'imported', '{"pattern_type": "streaming"}'),

('prime video assinatura', 'Prime Video', 'Assinaturas', 'Streaming', 'keyword',
 ARRAY['prime video', 'amazon prime'], 0.95, 95, 0, 'imported', '{"pattern_type": "streaming"}'),

('globoplay assinatura', 'Globoplay', 'Assinaturas', 'Streaming', 'keyword',
 ARRAY['globoplay'], 0.92, 92, 0, 'imported', '{"pattern_type": "streaming"}'),

('hbo max assinatura', 'HBO Max', 'Assinaturas', 'Streaming', 'keyword',
 ARRAY['hbo max', 'hbomax'], 0.92, 92, 0, 'imported', '{"pattern_type": "streaming"}'),

('disney plus assinatura', 'Disney Plus', 'Assinaturas', 'Streaming', 'keyword',
 ARRAY['disney plus', 'disney+'], 0.92, 92, 0, 'imported', '{"pattern_type": "streaming"}'),

('spotify assinatura', 'Spotify', 'Assinaturas', 'Streaming', 'keyword',
 ARRAY['spotify'], 0.95, 95, 0, 'imported', '{"pattern_type": "streaming", "type": "music"}'),

-- ============================================================================
-- KEYWORDS - JORNAIS E REVISTAS
-- ============================================================================

('o globo assinatura', 'O Globo', 'Assinaturas', 'Jornal', 'keyword',
 ARRAY['o globo'], 0.92, 92, 0, 'imported', '{"pattern_type": "newspaper"}'),

('folha assinatura', 'Folha de S.Paulo', 'Assinaturas', 'Jornal', 'keyword',
 ARRAY['folha', 'folha de s.paulo'], 0.92, 92, 0, 'imported', '{"pattern_type": "newspaper"}'),

('estadao assinatura', 'O Estado de S. Paulo', 'Assinaturas', 'Jornal', 'keyword',
 ARRAY['estadao', 'o estado de s. paulo'], 0.92, 92, 0, 'imported', '{"pattern_type": "newspaper"}'),

('valor economico assinatura', 'Valor Econômico', 'Assinaturas', 'Jornal', 'keyword',
 ARRAY['valor economico', 'valor'], 0.92, 92, 0, 'imported', '{"pattern_type": "newspaper"}'),

-- ============================================================================
-- KEYWORDS - TRANSPORTE (MANUTENÇÃO VEICULAR)
-- ============================================================================

('manutencao automotiva', 'Manutenção Automotiva', 'Transporte', 'Manutenção de Veículo', 'keyword',
 ARRAY['motor', 'freios', 'transmissao', 'sistema eletrico', 'pneus', 'radiador', 'correia dentada', 'velas', 'oleo', 'lampadas', 'escapamento', 'balanceamento', 'alinhamento', 'funilaria', 'pintura', 'lanternagem'],
 0.80, 75, 0, 'imported', '{"pattern_type": "automotive"}'),

-- ============================================================================
-- KEYWORDS - EDUCAÇÃO
-- ============================================================================

('udemy', 'Udemy', 'Estudos', 'Cursos Online', 'keyword',
 ARRAY['udemy'], 0.92, 92, 0, 'imported', '{"pattern_type": "education", "type": "online"}'),

('coursera', 'Coursera', 'Estudos', 'Cursos Online', 'keyword',
 ARRAY['coursera'], 0.92, 92, 0, 'imported', '{"pattern_type": "education", "type": "online"}'),

('editoras', 'Editoras', 'Estudos', 'Material Didático', 'keyword',
 ARRAY['editora atica', 'editora scipione', 'editora saraiva', 'editora moderna', 'editora positivo', 'editora ftd'],
 0.85, 80, 0, 'imported', '{"pattern_type": "education", "type": "books"}'),

-- ============================================================================
-- KEYWORDS - RESTAURANTES E ALIMENTAÇÃO
-- ============================================================================

('restaurante generico', 'Restaurante', 'Refeição', 'Restaurante', 'keyword',
 ARRAY['restaurante', 'cafeteria', 'bar', 'churrascaria', 'pizzaria', 'rodizio'],
 0.75, 70, 0, 'imported', '{"pattern_type": "food_service"}'),

('comida regional', 'Comida Regional', 'Refeição', 'Restaurante', 'keyword',
 ARRAY['feijoada', 'moqueca', 'acaraje', 'vatapa', 'baiao de dois', 'carne de sol', 'escondidinho', 'tapioca', 'acai', 'pato no tucupi', 'virado paulista', 'tutu mineira', 'churrasco gaucho', 'barreado'],
 0.75, 70, 0, 'imported', '{"pattern_type": "food_service", "type": "regional"}'),

-- ============================================================================
-- KEYWORDS - HOBBIES E LAZER
-- ============================================================================

('hobbies', 'Hobbies', 'Lazer', 'Hobbies', 'keyword',
 ARRAY['pintura', 'meditacao', 'tocar instrumentos', 'cantar', 'jardinagem', 'yoga', 'caminhada', 'voluntariado', 'fotografar', 'ler', 'cozinhar', 'acampar', 'jogar videogame', 'jogos de tabuleiro', 'dancar', 'desenhar'],
 0.70, 65, 0, 'imported', '{"pattern_type": "leisure"}'),

-- ============================================================================
-- KEYWORDS - SERVIÇOS DOMÉSTICOS
-- ============================================================================

('diarista servico', 'Diarista', 'Diarista / Prestadores Serv.', 'Faxina', 'keyword',
 ARRAY['diarista', 'faxina', 'faxineira'], 0.90, 88, 0, 'imported', '{"pattern_type": "service", "type": "cleaning"}'),

('encanador servico', 'Encanador', 'Diarista / Prestadores Serv.', 'Hidráulica', 'keyword',
 ARRAY['encanador', 'caca vazamento', 'desentupir', 'conserto aquecedor'],
 0.88, 85, 0, 'imported', '{"pattern_type": "service", "type": "plumbing"}'),

('eletricista servico', 'Eletricista', 'Diarista / Prestadores Serv.', 'Elétrica', 'keyword',
 ARRAY['eletricista', 'instalacao ar-condicionado', 'manutencao ar-condicionado', 'instalacao chuveiro', 'instalacao interfone'],
 0.88, 85, 0, 'imported', '{"pattern_type": "service", "type": "electrical"}'),

('mudanca servico', 'Mudança', 'Diarista / Prestadores Serv.', 'Mudança', 'keyword',
 ARRAY['mudanca', 'frete', 'carreto'], 0.90, 88, 0, 'imported', '{"pattern_type": "service", "type": "moving"}'),

('pintor servico', 'Pintor', 'Diarista / Prestadores Serv.', 'Pintura', 'keyword',
 ARRAY['pintor', 'pintura'], 0.85, 83, 0, 'imported', '{"pattern_type": "service", "type": "painting"}'),

('montagem moveis', 'Montagem de Móveis', 'Diarista / Prestadores Serv.', 'Montagem', 'keyword',
 ARRAY['montagem de moveis', 'marido de aluguel', 'pequenos reparos'],
 0.85, 83, 0, 'imported', '{"pattern_type": "service", "type": "handyman"}'),

('dedetizacao', 'Dedetização', 'Diarista / Prestadores Serv.', 'Dedetização', 'keyword',
 ARRAY['dedetizacao', 'limpeza caixa d''agua'],
 0.88, 85, 0, 'imported', '{"pattern_type": "service", "type": "pest_control"}'),

('apps servicos', 'Apps de Serviços', 'Diarista / Prestadores Serv.', 'App', 'keyword',
 ARRAY['parafuzo', 'triider'], 0.85, 83, 0, 'imported', '{"pattern_type": "service", "type": "app"}'),

-- ============================================================================
-- KEYWORDS - DESPESAS COM FILHOS
-- ============================================================================

('despesas escolares', 'Despesas Escolares', 'Filhos / Dependentes', 'Educação', 'keyword',
 ARRAY['mensalidade escolar', 'material escolar', 'transporte escolar', 'mesada'],
 0.85, 83, 0, 'imported', '{"pattern_type": "children", "category": "education"}'),

('abono familia', 'Abono de Família', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Benefícios', 'keyword',
 ARRAY['abono de familia', 'bolsa de estudo'],
 0.88, 85, 0, 'imported', '{"pattern_type": "income", "category": "benefits"}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- ATUALIZAR MATERIALIZED VIEW
-- ============================================================================

REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_frequent_merchants;

COMMIT;

