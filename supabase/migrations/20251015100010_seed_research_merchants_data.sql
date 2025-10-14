-- Migration: Seed research merchants data
-- Populates the merchants dictionary with data from extensive research
-- Includes supermarkets, retail, logistics, pharmacies, restaurants, health, education, banks, and banking patterns

BEGIN;

-- ============================================================================
-- SUPERMERCADOS E ATACAREJOS
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
  usage_count,
  source_type,
  metadata
) VALUES

('grupo carrefour brasil', 'Grupo Carrefour Brasil', 'Alimentação', 'Hipermercado', 'merchant',
 ARRAY['carrefour', 'grupo carrefour', 'carrefour brasil'], ARRAY['supermercado', 'hipermercado', 'varejo alimentar', 'atacadao'],
 0.95, 100, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

('assai atacadista', 'Assaí Atacadista', 'Alimentação', 'Hipermercado', 'merchant',
 ARRAY['assai', 'assaí', 'assai atacadista'], ARRAY['atacarejo', 'supermercado', 'atacado', 'varejo'],
 0.95, 100, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

('grupo mateus', 'Grupo Mateus', 'Alimentação', 'Atacarejo', 'merchant',
 ARRAY['mateus', 'supermercado mateus', 'grupo mateus'], ARRAY['supermercado', 'atacarejo', 'varejo', 'maranhao'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "region": "nordeste"}'),

('supermercados bh', 'Supermercados BH', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['bh', 'supermercado bh', 'supermercados bh'], ARRAY['supermercado', 'varejo', 'minas gerais', 'mg'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "MG"}'),

('grupo pao de acucar', 'Grupo Pão de Açúcar', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['gpa', 'pão de açúcar', 'pao de acucar', 'extra', 'compre bem'], ARRAY['supermercado'],
 0.95, 95, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

('irmaos muffato', 'Irmãos Muffato', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['muffato', 'irmãos muffato', 'irmaos muffato'], ARRAY['supermercado', 'varejo', 'parana', 'pr'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "PR"}'),

('grupo pereira', 'Grupo Pereira', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['pereira', 'comper', 'fort atacadista', 'grupo pereira'], ARRAY['supermercado'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

('mart minas dom atacadista', 'Mart Minas & Dom Atacadista', 'Alimentação', 'Atacarejo', 'merchant',
 ARRAY['mart minas', 'dom atacadista', 'mart minas dom'], ARRAY['atacarejo', 'mg'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "MG"}'),

('cencosud', 'Cencosud', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['gbarbosa', 'mercantil rodrigues', 'bretas', 'prezunic', 'cencosud'], ARRAY['supermercado'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

('koch hipermercado', 'Koch Hipermercado', 'Alimentação', 'Hipermercado', 'merchant',
 ARRAY['koch', 'koch hipermercado'], ARRAY['supermercado', 'santa catarina', 'sc'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "SC"}'),

('companhia zaffari', 'Companhia Zaffari', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['zaffari', 'bourbon shopping', 'companhia zaffari'], ARRAY['supermercado', 'rio grande do sul', 'rs'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "RS"}'),

('tenda atacado', 'Tenda Atacado', 'Alimentação', 'Atacarejo', 'merchant',
 ARRAY['tenda', 'tenda atacado'], ARRAY['atacado', 'varejo', 'supermercado'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

('savegnago', 'Savegnago', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['savegnago'], ARRAY['supermercado', 'sao paulo', 'sp'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "SP"}'),

('sonda supermercados', 'Sonda Supermercados', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['sonda', 'sonda supermercados'], ARRAY['supermercado', 'sao paulo', 'sp'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "SP"}'),

('novo atacarejo', 'Novo Atacarejo', 'Alimentação', 'Atacarejo', 'merchant',
 ARRAY['novo', 'novo atacarejo'], ARRAY['atacarejo', 'pernambuco', 'pe'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "PE"}'),

('supermercado angeloni', 'Supermercado Angeloni', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['angeloni', 'supermercado angeloni'], ARRAY['supermercado', 'santa catarina', 'sc'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "SC"}'),

('supermercado imperatriz', 'Supermercado Imperatriz', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['imperatriz', 'supermercado imperatriz'], ARRAY['supermercado', 'santa catarina', 'sc'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "SC"}'),

('rede de supermercados schmit', 'Rede de Supermercados Schmit', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['schmit', 'supermercado schmit', 'rede schmit'], ARRAY['supermercado', 'itajai', 'sc'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "SC"}'),

-- ============================================================================
-- VAREJO DE MODA E VESTUÁRIO
-- ============================================================================

('lojas renner', 'Lojas Renner', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['renner', 'lojas renner', 'lren3'], ARRAY['varejo', 'moda', 'vestuario', 'departamento'],
 0.95, 95, 0, 'imported', '{"sector": "fashion_retail", "chain": true, "stock": "LREN3"}'),

('riachuelo', 'Riachuelo', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['riachuelo', 'guararapes'], ARRAY['moda', 'departamento'],
 0.95, 95, 0, 'imported', '{"sector": "fashion_retail", "chain": true}'),

('c&a modas', 'C&A Modas', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['c&a', 'cea', 'ceab3'], ARRAY['moda', 'vestuario', 'departamento'],
 0.95, 95, 0, 'imported', '{"sector": "fashion_retail", "chain": true, "stock": "CEAB3"}'),

('marisa', 'Marisa', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['marisa', 'lojas marisa'], ARRAY['moda', 'varejo', 'departamento'],
 0.90, 90, 0, 'imported', '{"sector": "fashion_retail", "chain": true}'),

('americanas', 'Americanas', 'Presentes / Compras', 'Varejo', 'merchant',
 ARRAY['americanas', 'lojas americanas', 'b2w'], ARRAY['varejo', 'e-commerce', 'marketplace'],
 0.95, 95, 0, 'imported', '{"sector": "retail", "chain": true, "ecommerce": true}'),

('bibijus loja', 'Bibijus Loja', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['bibijus'], ARRAY['moda feminina', 'boutique', 'itajai'],
 0.85, 80, 0, 'imported', '{"sector": "fashion_retail", "type": "boutique", "location": "Itajaí"}'),

('boutique encanto da ro', 'Boutique Encanto da Rô', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['encanto da rô', 'encanto da ro'], ARRAY['moda feminina', 'boutique', 'itajai'],
 0.85, 80, 0, 'imported', '{"sector": "fashion_retail", "type": "boutique", "location": "Itajaí"}'),

-- ============================================================================
-- LOGÍSTICA E TRANSPORTADORAS
-- ============================================================================

('jadlog', 'Jadlog', 'Outros', 'Logística', 'merchant',
 ARRAY['jadlog', 'jad log'], ARRAY['logistica', 'transporte', 'encomenda', 'entrega expressa', 'frete'],
 0.90, 90, 0, 'imported', '{"sector": "logistics"}'),

('dhl express brasil', 'DHL Express Brasil', 'Outros', 'Logística', 'merchant',
 ARRAY['dhl', 'dhl express'], ARRAY['logistica', 'entrega internacional', 'frete expresso'],
 0.92, 92, 0, 'imported', '{"sector": "logistics", "international": true}'),

('fedex brasil', 'Fedex Brasil', 'Outros', 'Logística', 'merchant',
 ARRAY['fedex', 'federal express'], ARRAY['logistica', 'entrega expressa'],
 0.92, 92, 0, 'imported', '{"sector": "logistics", "international": true}'),

('tnt', 'TNT', 'Outros', 'Logística', 'merchant',
 ARRAY['tnt', 'tnt express'], ARRAY['logistica', 'transporte', 'encomenda'],
 0.90, 90, 0, 'imported', '{"sector": "logistics"}'),

('total express', 'Total Express', 'Outros', 'Logística', 'merchant',
 ARRAY['total express', 'totalexpress'], ARRAY['logistica', 'e-commerce', 'entrega', 'frete'],
 0.90, 90, 0, 'imported', '{"sector": "logistics"}'),

('luft logistics', 'Luft Logistics', 'Outros', 'Logística', 'merchant',
 ARRAY['luft', 'luft logistics'], ARRAY['logistica', 'armazenagem', 'agronegocio', 'saude'],
 0.88, 88, 0, 'imported', '{"sector": "logistics"}'),

('asap log', 'ASAP Log', 'Outros', 'Logística', 'merchant',
 ARRAY['asap', 'asap log'], ARRAY['logistica', 'entrega rapida', 'e-commerce'],
 0.88, 88, 0, 'imported', '{"sector": "logistics"}'),

('loggi', 'Loggi', 'Outros', 'Logística', 'merchant',
 ARRAY['loggi'], ARRAY['motoboy', 'entrega', 'logistica', 'last mile'],
 0.90, 90, 0, 'imported', '{"sector": "logistics", "last_mile": true}'),

('correios', 'Correios', 'Outros', 'Logística', 'merchant',
 ARRAY['correios', 'ect', 'empresa brasileira de correios e telegrafos', 'sedex', 'pac'], ARRAY[''],
 0.95, 95, 0, 'imported', '{"sector": "logistics", "government": true}'),

('gollog', 'Gollog', 'Outros', 'Logística', 'merchant',
 ARRAY['gollog', 'gol log'], ARRAY['gol', 'logistica', 'carga aerea', 'transporte aereo'],
 0.88, 88, 0, 'imported', '{"sector": "logistics", "air": true}'),

('braspress', 'Braspress', 'Outros', 'Logística', 'merchant',
 ARRAY['braspress'], ARRAY['logistica', 'transporte', 'carga fracionada'],
 0.90, 90, 0, 'imported', '{"sector": "logistics"}'),

('rte rodonaves', 'RTE Rodonaves', 'Outros', 'Logística', 'merchant',
 ARRAY['rodonaves', 'rte', 'rte rodonaves'], ARRAY['transportadora', 'logistica', 'frete'],
 0.88, 88, 0, 'imported', '{"sector": "logistics"}'),

-- ============================================================================
-- FARMÁCIAS E DROGARIAS
-- ============================================================================

('raia drogasil', 'Raia Drogasil', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['rd', 'raia', 'drogasil', 'droga raia', 'raia drogasil'], ARRAY['farmacia', 'drogaria', 'remedios'],
 0.95, 95, 0, 'imported', '{"sector": "pharmacy", "chain": true}'),

('drogaria sao paulo e pacheco', 'Drogaria São Paulo e Pacheco', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['dpsp', 'drogaria sao paulo', 'drogarias pacheco', 'drogaria pacheco'], ARRAY['farmacia'],
 0.92, 92, 0, 'imported', '{"sector": "pharmacy", "chain": true}'),

('pague menos', 'Pague Menos', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['pague menos', 'clinic farma'], ARRAY['farmacia', 'drogaria'],
 0.92, 92, 0, 'imported', '{"sector": "pharmacy", "chain": true}'),

('drogaria araujo', 'Drogaria Araújo', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['araujo', 'drogaria araujo'], ARRAY['farmacia', 'drogaria', 'minas gerais', 'mg'],
 0.90, 90, 0, 'imported', '{"sector": "pharmacy", "chain": true, "state": "MG"}'),

('drogarias nissei', 'Drogarias Nissei', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['nissei', 'drogaria nissei', 'drogarias nissei'], ARRAY['farmacia', 'drogaria', 'parana', 'pr'],
 0.90, 90, 0, 'imported', '{"sector": "pharmacy", "chain": true, "state": "PR"}'),

-- ============================================================================
-- RESTAURANTES E FAST FOOD
-- ============================================================================

('mcdonalds', 'McDonald''s', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['mcdonalds', 'mc donalds', 'arcos dourados'], ARRAY['fast food', 'restaurante', 'lanchonete'],
 0.95, 95, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('burger king', 'Burger King', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['bk', 'burger king'], ARRAY['fast food', 'restaurante', 'lanchonete'],
 0.95, 95, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('bobs', 'Bob''s', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['bobs', 'bob''s'], ARRAY['fast food', 'restaurante', 'lanchonete'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('habibs', 'Habib''s', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['habibs', 'habib''s'], ARRAY['fast food', 'esfiha', 'comida arabe'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('giraffas', 'Giraffas', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['giraffas'], ARRAY['fast food', 'restaurante', 'lanches'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('kfc', 'KFC', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['kfc', 'kentucky fried chicken'], ARRAY['frango frito', 'fast food'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('subway', 'Subway', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['subway'], ARRAY['sanduiche', 'fast food', 'restaurante'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('pizza hut', 'Pizza Hut', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['pizza hut', 'pizzahut'], ARRAY['pizzaria', 'fast food'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('outback steakhouse', 'Outback Steakhouse', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['outback'], ARRAY['restaurante', 'steakhouse', 'casual dining'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true, "type": "casual_dining"}'),

('coco bambu', 'Coco Bambu', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['coco bambu', 'cocobambu'], ARRAY['restaurante', 'frutos do mar', 'casual dining'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true, "type": "casual_dining"}'),

('china in box', 'China in Box', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['china in box', 'chinainbox'], ARRAY['delivery', 'comida chinesa', 'fast food'],
 0.90, 90, 0, 'imported', '{"sector": "food_delivery", "chain": true}'),

('spoleto', 'Spoleto', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['spoleto'], ARRAY['restaurante', 'massa', 'comida italiana'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('bistro dal molin', 'Bistrô Dal Molin', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['dal molin', 'bistro dal molin'], ARRAY['restaurante', 'bistro', 'itajai'],
 0.88, 85, 0, 'imported', '{"sector": "food_service", "location": "Itajaí"}'),

-- ============================================================================
-- PLANOS DE SAÚDE
-- ============================================================================

('hapvida notredame intermedica', 'Hapvida NotreDame Intermédica', 'Proteção Pessoal / Saúde / Farmácia', 'Plano de Saúde', 'merchant',
 ARRAY['hapvida', 'notredame', 'intermedica', 'gndi', 'hapvida notredame'], ARRAY['plano de saude', 'convenio medico'],
 0.95, 95, 0, 'imported', '{"sector": "health_insurance"}'),

('bradesco saude', 'Bradesco Saúde', 'Proteção Pessoal / Saúde / Farmácia', 'Plano de Saúde', 'merchant',
 ARRAY['bradesco saude', 'bradesco seguros'], ARRAY['plano de saude', 'convenio medico'],
 0.95, 95, 0, 'imported', '{"sector": "health_insurance"}'),

('amil assistencia medica', 'Amil Assistência Médica', 'Proteção Pessoal / Saúde / Farmácia', 'Plano de Saúde', 'merchant',
 ARRAY['amil', 'amil assistencia'], ARRAY['plano de saude', 'convenio medico'],
 0.95, 95, 0, 'imported', '{"sector": "health_insurance"}'),

('sulamerica saude', 'SulAmérica Saúde', 'Proteção Pessoal / Saúde / Farmácia', 'Plano de Saúde', 'merchant',
 ARRAY['sulamerica', 'sul america', 'sulamerica saude'], ARRAY['plano de saude', 'convenio medico'],
 0.95, 95, 0, 'imported', '{"sector": "health_insurance"}'),

('unimed', 'Unimed', 'Proteção Pessoal / Saúde / Farmácia', 'Plano de Saúde', 'merchant',
 ARRAY['unimed'], ARRAY['plano de saude', 'cooperativa medica', 'convenio'],
 0.95, 95, 0, 'imported', '{"sector": "health_insurance", "cooperative": true}'),

('porto seguro saude', 'Porto Seguro Saúde', 'Proteção Pessoal / Saúde / Farmácia', 'Plano de Saúde', 'merchant',
 ARRAY['porto seguro', 'porto seguro saude'], ARRAY['plano de saude', 'convenio medico'],
 0.92, 92, 0, 'imported', '{"sector": "health_insurance"}'),

('prevent senior', 'Prevent Senior', 'Proteção Pessoal / Saúde / Farmácia', 'Plano de Saúde', 'merchant',
 ARRAY['prevent senior', 'prevent'], ARRAY['plano de saude', 'idosos'],
 0.92, 92, 0, 'imported', '{"sector": "health_insurance", "specialty": "elderly"}'),

-- ============================================================================
-- SERVIÇOS DE MANUTENÇÃO E REPAROS
-- ============================================================================

('manutencao eletrica', 'Manutenção Elétrica', 'Casa', 'Manutenção', 'keyword',
 ARRAY['eletricista', 'manutencao eletrica'], ARRAY['eletricista', 'reparo eletrico', 'instalacao eletrica'],
 0.85, 75, 0, 'imported', '{"pattern_type": "service", "category": "home"}'),

('servicos hidraulicos', 'Serviços Hidráulicos', 'Casa', 'Manutenção', 'keyword',
 ARRAY['encanador', 'servicos hidraulicos', 'hidraulica'], ARRAY['encanador', 'bombeiro hidraulico', 'vazamento', 'desentupimento'],
 0.85, 75, 0, 'imported', '{"pattern_type": "service", "category": "home"}'),

('pintura predial', 'Pintura Predial', 'Casa', 'Manutenção', 'keyword',
 ARRAY['pintor', 'pintura'], ARRAY['pintor', 'pintura de fachada', 'servico de pintura'],
 0.80, 70, 0, 'imported', '{"pattern_type": "service", "category": "home"}'),

-- ============================================================================
-- UNIVERSIDADES E INSTITUIÇÕES DE ENSINO
-- ============================================================================

('universidade de sao paulo', 'Universidade de São Paulo', 'Estudos', 'Universidade', 'merchant',
 ARRAY['usp', 'universidade sao paulo'], ARRAY['universidade publica', 'ensino superior', 'faculdade'],
 0.95, 95, 0, 'imported', '{"sector": "education", "type": "public_university"}'),

('universidade de campinas', 'Universidade de Campinas', 'Estudos', 'Universidade', 'merchant',
 ARRAY['unicamp', 'universidade campinas'], ARRAY['universidade publica', 'ensino superior', 'faculdade'],
 0.95, 95, 0, 'imported', '{"sector": "education", "type": "public_university"}'),

('universidade estadual paulista', 'Universidade Estadual Paulista', 'Estudos', 'Universidade', 'merchant',
 ARRAY['unesp', 'universidade paulista'], ARRAY['universidade publica', 'ensino superior', 'faculdade'],
 0.95, 95, 0, 'imported', '{"sector": "education", "type": "public_university"}'),

('universidade federal do rio de janeiro', 'Universidade Federal do Rio de Janeiro', 'Estudos', 'Universidade', 'merchant',
 ARRAY['ufrj', 'federal rio'], ARRAY['universidade publica', 'ensino superior', 'faculdade'],
 0.95, 95, 0, 'imported', '{"sector": "education", "type": "public_university"}'),

('universidade federal de minas gerais', 'Universidade Federal de Minas Gerais', 'Estudos', 'Universidade', 'merchant',
 ARRAY['ufmg', 'federal minas'], ARRAY['universidade publica', 'ensino superior', 'faculdade'],
 0.95, 95, 0, 'imported', '{"sector": "education", "type": "public_university"}'),

('universidade federal do rio grande do sul', 'Universidade Federal do Rio Grande do Sul', 'Estudos', 'Universidade', 'merchant',
 ARRAY['ufrgs', 'federal rio grande'], ARRAY['universidade publica', 'ensino superior', 'faculdade'],
 0.95, 95, 0, 'imported', '{"sector": "education", "type": "public_university"}'),

('cogna educacao', 'Cogna Educação', 'Estudos', 'Universidade', 'merchant',
 ARRAY['cogna', 'kroton', 'grupo cogna'], ARRAY['grupo educacional', 'ensino superior privado'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "private_university", "group": true}'),

('yduqs', 'YDUQS', 'Estudos', 'Universidade', 'merchant',
 ARRAY['yduqs', 'estacio', 'ibmec', 'grupo yduqs'], ARRAY['grupo educacional', 'faculdade particular'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "private_university", "group": true}'),

('grupo ser educacional', 'Grupo Ser Educacional', 'Estudos', 'Universidade', 'merchant',
 ARRAY['ser educacional', 'uninassau', 'grupo ser'], ARRAY['grupo educacional'],
 0.90, 90, 0, 'imported', '{"sector": "education", "type": "private_university", "group": true}'),

('anima educacao', 'Ânima Educação', 'Estudos', 'Universidade', 'merchant',
 ARRAY['anima', 'grupo anima', 'anima educacao'], ARRAY['grupo educacional', 'faculdade particular'],
 0.90, 90, 0, 'imported', '{"sector": "education", "type": "private_university", "group": true}'),

('universidade estacio de sa', 'Universidade Estácio de Sá', 'Estudos', 'Universidade', 'merchant',
 ARRAY['estacio', 'estacio de sa', 'universidade estacio'], ARRAY['faculdade', 'universidade particular', 'ead'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "private_university", "ead": true}'),

('ibmec', 'Ibmec', 'Estudos', 'Universidade', 'merchant',
 ARRAY['ibmec'], ARRAY['faculdade', 'negocios', 'economia', 'direito'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "private_university"}'),

('pontificia universidade catolica', 'Pontifícia Universidade Católica', 'Estudos', 'Universidade', 'merchant',
 ARRAY['puc', 'pontificia', 'universidade catolica'], ARRAY['universidade particular', 'catolica', 'faculdade'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "private_university"}'),

('fundacao getulio vargas', 'Fundação Getúlio Vargas', 'Estudos', 'Universidade', 'merchant',
 ARRAY['fgv', 'getulio vargas', 'fundacao getulio'], ARRAY['faculdade', 'administracao', 'economia', 'direito'],
 0.95, 95, 0, 'imported', '{"sector": "education", "type": "private_university"}'),

('universidade anhembi morumbi', 'Universidade Anhembi Morumbi', 'Estudos', 'Universidade', 'merchant',
 ARRAY['anhembi morumbi', 'anhembi', 'universidade anhembi'], ARRAY['universidade particular', 'faculdade'],
 0.90, 90, 0, 'imported', '{"sector": "education", "type": "private_university"}'),

('universidade paulista', 'Universidade Paulista', 'Estudos', 'Universidade', 'merchant',
 ARRAY['unip', 'universidade paulista'], ARRAY['universidade particular', 'faculdade', 'ead'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "private_university", "ead": true}'),

('universidade cruzeiro do sul', 'Universidade Cruzeiro do Sul', 'Estudos', 'Universidade', 'merchant',
 ARRAY['unicsul', 'cruzeiro do sul', 'universidade cruzeiro'], ARRAY['faculdade particular', 'ead'],
 0.90, 90, 0, 'imported', '{"sector": "education", "type": "private_university", "ead": true}'),

('centro universitario fmu', 'Centro Universitário FMU', 'Estudos', 'Universidade', 'merchant',
 ARRAY['fmu', 'centro universitario fmu'], ARRAY['faculdade particular', 'centro universitario'],
 0.88, 88, 0, 'imported', '{"sector": "education", "type": "private_university"}'),

('uniasselvi', 'UNIASSELVI', 'Estudos', 'Universidade', 'merchant',
 ARRAY['uniasselvi', 'asselvi'], ARRAY['centro universitario', 'ead', 'faculdade'],
 0.90, 90, 0, 'imported', '{"sector": "education", "type": "private_university", "ead": true}'),

('unicesumar', 'UNICESUMAR', 'Estudos', 'Universidade', 'merchant',
 ARRAY['unicesumar', 'cesumar'], ARRAY['universidade', 'ead', 'faculdade particular'],
 0.90, 90, 0, 'imported', '{"sector": "education", "type": "private_university", "ead": true}'),

-- ============================================================================
-- BANCOS E INSTITUIÇÕES FINANCEIRAS
-- ============================================================================

('itau unibanco', 'Itaú Unibanco', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['itau', 'itaú', 'unibanco', 'itau unibanco'], ARRAY['banco', 'agencia bancaria', 'servicos financeiros'],
 0.95, 95, 0, 'imported', '{"sector": "banking", "type": "traditional"}'),

('banco do brasil', 'Banco do Brasil', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['bb', 'banco brasil'], ARRAY['banco', 'agencia bancaria', 'estatal'],
 0.95, 95, 0, 'imported', '{"sector": "banking", "type": "traditional", "government": true}'),

('bradesco', 'Bradesco', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['bradesco'], ARRAY['banco', 'agencia bancaria', 'servicos financeiros'],
 0.95, 95, 0, 'imported', '{"sector": "banking", "type": "traditional"}'),

('caixa economica federal', 'Caixa Econômica Federal', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['caixa', 'cef', 'caixa economica'], ARRAY['banco', 'loterias', 'habitacao', 'estatal'],
 0.95, 95, 0, 'imported', '{"sector": "banking", "type": "traditional", "government": true}'),

('santander brasil', 'Santander Brasil', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['santander'], ARRAY['banco', 'agencia bancaria', 'servicos financeiros'],
 0.95, 95, 0, 'imported', '{"sector": "banking", "type": "traditional"}'),

('btg pactual', 'BTG Pactual', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['btg', 'btg pactual'], ARRAY['banco de investimento', 'investimentos', 'wealth management'],
 0.95, 95, 0, 'imported', '{"sector": "banking", "type": "investment"}'),

('banco safra', 'Banco Safra', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['safra'], ARRAY['banco', 'private banking', 'investimentos'],
 0.92, 92, 0, 'imported', '{"sector": "banking", "type": "traditional"}'),

('sicredi', 'Sicredi', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['sicredi'], ARRAY['cooperativa de credito', 'banco cooperativo'],
 0.92, 92, 0, 'imported', '{"sector": "banking", "type": "cooperative"}'),

('nubank', 'Nubank', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['nu', 'nubank', 'roxinho'], ARRAY['banco digital', 'fintech', 'conta digital'],
 0.95, 95, 0, 'imported', '{"sector": "banking", "type": "digital"}'),

('banco inter', 'Banco Inter', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['inter', 'banco inter'], ARRAY['banco digital', 'fintech', 'conta digital'],
 0.95, 95, 0, 'imported', '{"sector": "banking", "type": "digital"}'),

('c6 bank', 'C6 Bank', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['c6', 'c6 bank'], ARRAY['banco digital', 'fintech', 'conta digital'],
 0.95, 95, 0, 'imported', '{"sector": "banking", "type": "digital"}'),

('neon', 'Neon', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['neon'], ARRAY['banco digital', 'fintech', 'conta digital'],
 0.92, 92, 0, 'imported', '{"sector": "banking", "type": "digital"}'),

('agibank', 'Agibank', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['agibank'], ARRAY['banco digital', 'fintech', 'credito'],
 0.90, 90, 0, 'imported', '{"sector": "banking", "type": "digital"}'),

('banco pan', 'Banco PAN', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['pan', 'banco pan'], ARRAY['banco digital', 'financiamento', 'credito'],
 0.92, 92, 0, 'imported', '{"sector": "banking", "type": "digital"}'),

('picpay', 'PicPay', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['picpay', 'pic pay'], ARRAY['carteira digital', 'pagamento', 'fintech'],
 0.95, 95, 0, 'imported', '{"sector": "banking", "type": "digital_wallet"}'),

('pagbank', 'PagBank', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['pagbank', 'pagseguro', 'pag seguro'], ARRAY['conta digital', 'maquininha de cartao', 'fintech'],
 0.95, 95, 0, 'imported', '{"sector": "banking", "type": "digital"}'),

('iti', 'Iti', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['iti', 'iti itau'], ARRAY['carteira digital', 'itau', 'pagamento', 'fintech'],
 0.92, 92, 0, 'imported', '{"sector": "banking", "type": "digital_wallet"}'),

('sofisa direto', 'Sofisa Direto', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['sofisa', 'sofisa direto'], ARRAY['banco digital', 'investimentos', 'cdb'],
 0.90, 90, 0, 'imported', '{"sector": "banking", "type": "digital"}'),

('99pay', '99Pay', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['99pay', '99 pay'], ARRAY['carteira digital', 'pagamento', 'transporte'],
 0.90, 90, 0, 'imported', '{"sector": "banking", "type": "digital_wallet"}'),

('asaas', 'Asaas', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['asaas'], ARRAY['fintech', 'conta digital pj', 'gestao de cobrancas'],
 0.88, 88, 0, 'imported', '{"sector": "banking", "type": "digital"}'),

('accredito-scd', 'ACCREDITO-SCD', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['accredito', 'accredito scd'], ARRAY['sociedade de credito direto', 'fintech', 'credito'],
 0.85, 85, 0, 'imported', '{"sector": "banking", "type": "scd"}'),

('ailos', 'AILOS', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['ailos', 'viacredi', 'credifoz'], ARRAY['sistema de cooperativas de credito'],
 0.88, 88, 0, 'imported', '{"sector": "banking", "type": "cooperative"}'),

('banco bmg', 'Banco Bmg', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['bmg', 'banco bmg'], ARRAY['banco', 'credito consignado'],
 0.90, 90, 0, 'imported', '{"sector": "banking", "type": "traditional"}'),

('banco genial', 'Banco Genial', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'merchant',
 ARRAY['genial', 'banco genial'], ARRAY['investimentos', 'corretora', 'banco digital'],
 0.88, 88, 0, 'imported', '{"sector": "banking", "type": "digital"}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- PADRÕES BANCÁRIOS - Transações de Extrato
-- ============================================================================

INSERT INTO public.merchants_dictionary (
  merchant_key,
  entity_name,
  category,
  subcategory,
  entry_type,
  confidence_modifier,
  priority,
  context,
  usage_count,
  source_type,
  metadata
) VALUES

('ted', 'TED', 'Outros', 'Transferências', 'banking_pattern',
 0.95, 95, 'transferencia', 0, 'imported', '{"pattern_type": "banking", "description": "Transferência Eletrônica Disponível"}'),

('doc', 'DOC', 'Outros', 'Transferências', 'banking_pattern',
 0.95, 95, 'transferencia', 0, 'imported', '{"pattern_type": "banking", "description": "Documento de Ordem de Crédito"}'),

('pix', 'PIX', 'Outros', 'Transferências', 'banking_pattern',
 1.00, 100, 'transferencia', 0, 'imported', '{"pattern_type": "banking", "description": "Transferência instantânea"}'),

('tev', 'TEV', 'Outros', 'Transferências', 'banking_pattern',
 0.95, 95, 'transferencia', 0, 'imported', '{"pattern_type": "banking", "description": "Transferência Eletrônica de Valores"}'),

('iof', 'IOF', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos', 'banking_pattern',
 0.95, 95, 'tributo', 0, 'imported', '{"pattern_type": "banking", "description": "Imposto sobre Operações Financeiras"}'),

('tarifa mensal', 'Tarifa Mensal', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'banking_pattern',
 0.90, 90, 'tarifa', 0, 'imported', '{"pattern_type": "banking", "description": "Pacote de serviços bancários"}'),

('encargos', 'Encargos', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros', 'banking_pattern',
 0.90, 90, 'encargo', 0, 'imported', '{"pattern_type": "banking", "description": "Juros, multa, taxas"}'),

('encargo limite de credito', 'Encargo Limite de Crédito', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros', 'banking_pattern',
 0.92, 92, 'encargo', 0, 'imported', '{"pattern_type": "banking", "description": "Juros cheque especial"}'),

('estorno', 'Estorno', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Estornos', 'banking_pattern',
 0.95, 95, 'estorno', 0, 'imported', '{"pattern_type": "banking", "description": "Devolução, reembolso, compra cancelada"}'),

('lancamentos futuros', 'Lançamentos Futuros', 'Outros', 'Débitos Automáticos', 'banking_pattern',
 0.85, 85, 'agendamento', 0, 'imported', '{"pattern_type": "banking", "description": "Agendamento, débito automático"}'),

('debito automatico', 'Débito Automático', 'Outros', 'Débitos Automáticos', 'banking_pattern',
 0.90, 90, 'debito_automatico', 0, 'imported', '{"pattern_type": "banking", "description": "Pagamento automático"}'),

('resgate previdencia', 'Resgate Previdência', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Investimentos', 'banking_pattern',
 0.92, 92, 'previdencia', 0, 'imported', '{"pattern_type": "banking", "description": "Resgate previdência privada"}'),

('aporte previdencia', 'Aporte Previdência', 'Investimentos (pelo menos 20% da receita)', 'Previdência', 'banking_pattern',
 0.92, 92, 'previdencia', 0, 'imported', '{"pattern_type": "banking", "description": "Contribuição previdência privada"}'),

('pagamento de cobranca', 'Pagamento de Cobrança', 'Outros', 'Pagamentos', 'banking_pattern',
 0.88, 88, 'pagamento', 0, 'imported', '{"pattern_type": "banking", "description": "Pagamento de boleto"}'),

('saque', 'Saque', 'Outros', 'Saques', 'banking_pattern',
 0.95, 95, 'saque', 0, 'imported', '{"pattern_type": "banking", "description": "Retirada em dinheiro"}'),

('deposito', 'Depósito', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Depósitos', 'banking_pattern',
 0.95, 95, 'deposito', 0, 'imported', '{"pattern_type": "banking", "description": "Depósito em dinheiro ou cheque"}'),

('contestacao de compra', 'Contestação de Compra', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Estornos', 'banking_pattern',
 0.90, 90, 'contestacao', 0, 'imported', '{"pattern_type": "banking", "description": "Compra não reconhecida, fraude"}'),

('juros de rotativo', 'Juros de Rotativo', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros', 'banking_pattern',
 0.92, 92, 'juros', 0, 'imported', '{"pattern_type": "banking", "description": "Juros do cartão de crédito"}'),

('ccf', 'CCF', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Multas', 'banking_pattern',
 0.88, 88, 'multa', 0, 'imported', '{"pattern_type": "banking", "description": "Cadastro de Emitentes de Cheques Sem Fundos"}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- ATUALIZAR MATERIALIZED VIEW
-- ============================================================================

REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_frequent_merchants;

COMMIT;

