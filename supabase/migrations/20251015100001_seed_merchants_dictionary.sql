-- Migration: Seed initial data for merchants_dictionary table
-- Populates the merchants dictionary with essential merchants, banking patterns, and keywords
-- for automatic transaction categorization

BEGIN;

-- ============================================================================
-- MERCHANTS ESSENCIAIS - Estabelecimentos específicos
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

-- Alimentação - Supermercados e mercados
('assai atacadista', 'Assaí Atacadista', 'Alimentação', 'Hipermercado', 'merchant',
 ARRAY['assai', 'assaí', 'assai atacadista'], ARRAY['supermercado', 'atacado', 'mercado'],
 0.95, 100, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('carrefour', 'Carrefour', 'Alimentação', 'Hipermercado', 'merchant',
 ARRAY['carrefour', 'carfour', 'carrefur'], ARRAY['supermercado', 'hipermercado', 'mercado'],
 0.95, 100, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('extra supermercado', 'Extra', 'Alimentação', 'Hipermercado', 'merchant',
 ARRAY['extra', 'extra supermercado'], ARRAY['supermercado', 'hipermercado'],
 0.90, 95, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('pao de acucar', 'Pão de Açúcar', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['pão de açúcar', 'pao de acucar'], ARRAY['supermercado', 'mercado'],
 0.90, 95, 0, 'system', '{"sector": "food_retail", "chain": true}'),

-- Alimentação - Delivery
('ifood', 'iFood', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['ifood', 'i food', 'ifood delivery'], ARRAY['delivery', 'comida', 'restaurante'],
 1.00, 100, 0, 'system', '{"sector": "food_delivery", "app": true}'),

('rappi', 'Rappi', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['rappi', 'rappi delivery'], ARRAY['delivery', 'comida'],
 0.95, 95, 0, 'system', '{"sector": "food_delivery", "app": true}'),

-- Transporte - Aplicativos
('uber', 'Uber', 'Transporte', 'Transporte por Aplicativo', 'merchant',
 ARRAY['uber', 'uber trip', 'uber viagem'], ARRAY['transporte', 'corrida', 'taxi'],
 1.00, 100, 0, 'system', '{"sector": "ride_sharing", "app": true}'),

('99 taxi', '99', 'Transporte', 'Transporte por Aplicativo', 'merchant',
 ARRAY['99', '99 taxi', '99taxi'], ARRAY['transporte', 'corrida', 'taxi'],
 0.95, 95, 0, 'system', '{"sector": "ride_sharing", "app": true}'),

-- Serviços de Streaming
('netflix', 'Netflix', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['netflix', 'netflix brasil'], ARRAY['streaming', 'filme', 'serie'],
 1.00, 100, 0, 'system', '{"sector": "streaming", "subscription": true}'),

('spotify', 'Spotify', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['spotify', 'spotify premium'], ARRAY['streaming', 'musica', 'audio'],
 1.00, 100, 0, 'system', '{"sector": "streaming", "subscription": true}'),

('amazon prime', 'Amazon Prime', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['amazon prime', 'prime video'], ARRAY['streaming', 'filme', 'serie'],
 0.95, 95, 0, 'system', '{"sector": "streaming", "subscription": true}'),

-- Telefonia e Internet
('claro', 'Claro', 'Assinaturas', 'Telefonia', 'merchant',
 ARRAY['claro', 'claro brasil'], ARRAY['telefonia', 'celular', 'internet'],
 0.95, 95, 0, 'system', '{"sector": "telecom", "utility": true}'),

('vivo', 'Vivo', 'Assinaturas', 'Telefonia', 'merchant',
 ARRAY['vivo', 'telefonica vivo'], ARRAY['telefonia', 'celular', 'internet'],
 0.95, 95, 0, 'system', '{"sector": "telecom", "utility": true}'),

('tim', 'TIM', 'Assinaturas', 'Telefonia', 'merchant',
 ARRAY['tim', 'tim brasil'], ARRAY['telefonia', 'celular', 'internet'],
 0.95, 95, 0, 'system', '{"sector": "telecom", "utility": true}'),

-- Saúde e Farmácias
('drogasil', 'Drogasil', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['drogasil', 'raia drogasil'], ARRAY['farmacia', 'remedio', 'saude'],
 0.95, 95, 0, 'system', '{"sector": "pharmacy", "chain": true}'),

('pague menos', 'Pague Menos', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['pague menos', 'farmacia pague menos'], ARRAY['farmacia', 'remedio'],
 0.90, 90, 0, 'system', '{"sector": "pharmacy", "chain": true}'),

-- Postos de Combustível
('petrobras', 'Petrobras', 'Transporte', 'Combustível', 'merchant',
 ARRAY['petrobras', 'posto petrobras'], ARRAY['gasolina', 'combustivel', 'posto'],
 0.95, 95, 0, 'system', '{"sector": "fuel", "chain": true}'),

('ipiranga', 'Ipiranga', 'Transporte', 'Combustível', 'merchant',
 ARRAY['ipiranga', 'posto ipiranga'], ARRAY['gasolina', 'combustivel', 'posto'],
 0.95, 95, 0, 'system', '{"sector": "fuel", "chain": true}'),

('shell', 'Shell', 'Transporte', 'Combustível', 'merchant',
 ARRAY['shell', 'posto shell'], ARRAY['gasolina', 'combustivel', 'posto'],
 0.95, 95, 0, 'system', '{"sector": "fuel", "chain": true}'),

-- Academias e Fitness
('smart fit', 'Smart Fit', 'Bem Estar / Beleza', 'Academia', 'merchant',
 ARRAY['smart fit', 'smartfit'], ARRAY['academia', 'fitness', 'exercicio'],
 0.95, 95, 0, 'system', '{"sector": "fitness", "chain": true}'),

('bluefit', 'Bluefit', 'Bem Estar / Beleza', 'Academia', 'merchant',
 ARRAY['bluefit', 'blue fit'], ARRAY['academia', 'fitness'],
 0.90, 90, 0, 'system', '{"sector": "fitness", "chain": true}'),

-- Bancos e Transferências
('pix', 'PIX', 'Outros', 'Transferências', 'merchant',
 ARRAY['pix', 'transferencia pix'], ARRAY['transferencia', 'pix'],
 1.00, 100, 0, 'system', '{"sector": "banking", "transfer": true}'),

('ted', 'TED', 'Outros', 'Transferências', 'merchant',
 ARRAY['ted', 'transferencia ted'], ARRAY['transferencia', 'bancaria'],
 0.90, 90, 0, 'system', '{"sector": "banking", "transfer": true}'),

('doc', 'DOC', 'Outros', 'Transferências', 'merchant',
 ARRAY['doc', 'transferencia doc'], ARRAY['transferencia', 'bancaria'],
 0.90, 90, 0, 'system', '{"sector": "banking", "transfer": true}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- PADRÕES BANCÁRIOS - Contextos específicos de bancos
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

-- Padrões de pagamento
('pagamento efetuado', 'Pagamento Efetuado', 'Outros', 'Pagamentos', 'banking_pattern',
 0.85, 85, 'pagamento_efetuado', 0, 'system', '{"pattern_type": "banking"}'),

('pix enviado', 'PIX Enviado', 'Outros', 'Transferências', 'banking_pattern',
 1.00, 100, 'pix_enviado', 0, 'system', '{"pattern_type": "banking"}'),

('pix recebido', 'PIX Recebido', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'PIX Recebido', 'banking_pattern',
 1.00, 100, 'pix_recebido', 0, 'system', '{"pattern_type": "banking"}'),

('transferencia enviada', 'Transferência Enviada', 'Outros', 'Transferências', 'banking_pattern',
 0.90, 90, 'transferencia_enviada', 0, 'system', '{"pattern_type": "banking"}'),

('transferencia recebida', 'Transferência Recebida', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Transferências', 'banking_pattern',
 0.90, 90, 'transferencia_recebida', 0, 'system', '{"pattern_type": "banking"}'),

-- Tarifas e taxas bancárias
('tarifa bancaria', 'Tarifa Bancária', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'banking_pattern',
 0.95, 95, 'tarifa', 0, 'system', '{"pattern_type": "banking"}'),

('juros cobrados', 'Juros Cobrados', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros', 'banking_pattern',
 0.90, 90, 'juros', 0, 'system', '{"pattern_type": "banking"}'),

('multa cobrada', 'Multa Cobrada', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Multas', 'banking_pattern',
 0.90, 90, 'multa', 0, 'system', '{"pattern_type": "banking"}'),

-- Débitos automáticos
('debito automatico', 'Débito Automático', 'Outros', 'Débitos Automáticos', 'banking_pattern',
 0.85, 85, 'debito_automatico', 0, 'system', '{"pattern_type": "banking"}'),

-- Concessionárias (estado específico)
('conta de luz', 'Conta de Luz', 'Casa', 'Energia Elétrica', 'utility',
 0.90, 90, NULL, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["SP", "RJ", "MG", "RS", "PR"]}'),

('conta de agua', 'Conta de Água', 'Casa', 'Água e Esgoto', 'utility',
 0.90, 90, NULL, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["SP", "RJ", "MG", "RS", "PR"]}'),

('conta de gas', 'Conta de Gás', 'Casa', 'Gás', 'utility',
 0.90, 90, NULL, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["SP", "RJ", "MG", "RS", "PR"]}'),

('enesantigas', 'Enel (São Paulo)', 'Casa', 'Energia Elétrica', 'utility',
 0.95, 95, NULL, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["SP"]}'),

('sabesp', 'SABESP', 'Casa', 'Água e Esgoto', 'utility',
 0.95, 95, NULL, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["SP"]}'),

('comgas', 'Comgás', 'Casa', 'Gás', 'utility',
 0.95, 95, NULL, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["SP"]}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- PALAVRAS-CHAVE GENÉRICAS - Para categorização geral
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

-- Alimentação
('supermercado generico', 'Supermercado', 'Alimentação', 'Supermercado', 'keyword',
 ARRAY['supermercado', 'mercado', 'compra mercado', 'compras mercado'],
 0.80, 70, 0, 'system', '{"pattern_type": "generic", "category": "food"}'),

('restaurante generico', 'Restaurante', 'Alimentação', 'Restaurante', 'keyword',
 ARRAY['restaurante', 'lanchonete', 'comida', 'refeicao', 'almoco', 'jantar'],
 0.75, 65, 0, 'system', '{"pattern_type": "generic", "category": "food"}'),

('fast food generico', 'Fast Food', 'Alimentação', 'Fast Food', 'keyword',
 ARRAY['fast food', 'lanche rapido', 'hamburguer', 'pizza', 'sanduiche'],
 0.75, 65, 0, 'system', '{"pattern_type": "generic", "category": "food"}'),

-- Transporte
('combustivel generico', 'Combustível', 'Transporte', 'Combustível', 'keyword',
 ARRAY['gasolina', 'etanol', 'diesel', 'combustivel', 'posto', 'posto gasolina'],
 0.85, 75, 0, 'system', '{"pattern_type": "generic", "category": "transport"}'),

('transporte app generico', 'Transporte por App', 'Transporte', 'Transporte por Aplicativo', 'keyword',
 ARRAY['uber', '99', 'taxi', 'corrida', 'transporte app'],
 0.80, 70, 0, 'system', '{"pattern_type": "generic", "category": "transport"}'),

-- Saúde
('farmacia generico', 'Farmácia', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'keyword',
 ARRAY['farmacia', 'remedio', 'medicamento', 'saude', 'drogaria'],
 0.85, 75, 0, 'system', '{"pattern_type": "generic", "category": "health"}'),

('dentista generico', 'Dentista', 'Proteção Pessoal / Saúde / Farmácia', 'Odontologia', 'keyword',
 ARRAY['dentista', 'consulta dentista', 'tratamento dental', 'ortodontia'],
 0.80, 70, 0, 'system', '{"pattern_type": "generic", "category": "health"}'),

('medico generico', 'Médico', 'Proteção Pessoal / Saúde / Farmácia', 'Consulta Médica', 'keyword',
 ARRAY['medico', 'consulta medica', 'clinica', 'hospital'],
 0.75, 65, 0, 'system', '{"pattern_type": "generic", "category": "health"}'),

-- Educação
('curso generico', 'Curso', 'Educação', 'Curso', 'keyword',
 ARRAY['curso', 'cursos', 'ensino', 'aprendizado', 'treinamento'],
 0.75, 65, 0, 'system', '{"pattern_type": "generic", "category": "education"}'),

('livraria generico', 'Livraria', 'Educação', 'Livros', 'keyword',
 ARRAY['livraria', 'livros', 'material escolar', 'papelaria'],
 0.70, 60, 0, 'system', '{"pattern_type": "generic", "category": "education"}'),

-- Lazer
('cinema generico', 'Cinema', 'Lazer', 'Cinema', 'keyword',
 ARRAY['cinema', 'filme', 'sessao cinema', 'ingresso cinema'],
 0.80, 70, 0, 'system', '{"pattern_type": "generic", "category": "entertainment"}'),

('teatro generico', 'Teatro', 'Lazer', 'Teatro', 'keyword',
 ARRAY['teatro', 'peca teatral', 'espetaculo', 'show'],
 0.75, 65, 0, 'system', '{"pattern_type": "generic", "category": "entertainment"}'),

-- Serviços domésticos
('diarista generico', 'Diarista', 'Diarista / Prestadores Serv.', 'Faxina', 'keyword',
 ARRAY['diarista', 'faxineira', 'empregada', 'limpeza', 'faxina'],
 0.80, 70, 0, 'system', '{"pattern_type": "generic", "category": "services"}'),

('pedreiro generico', 'Pedreiro', 'Casa', 'Manutenção', 'keyword',
 ARRAY['pedreiro', 'construcao', 'reforma', 'manutencao', 'obra'],
 0.75, 65, 0, 'system', '{"pattern_type": "generic", "category": "home"}'),

-- Pet
('pet shop generico', 'Pet Shop', 'Pet', 'Pet Shop', 'keyword',
 ARRAY['pet shop', 'petshop', 'animais', 'cao', 'gato', 'veterinario'],
 0.85, 75, 0, 'system', '{"pattern_type": "generic", "category": "pet"}'),

-- Roupas e acessórios
('roupas generico', 'Roupas', 'Roupas e acessórios', 'Vestuário', 'keyword',
 ARRAY['roupas', 'roupa', 'vestuario', 'moda', 'loja roupas'],
 0.75, 65, 0, 'system', '{"pattern_type": "generic", "category": "clothing"}'),

-- Beleza
('beleza generico', 'Beleza', 'Bem Estar / Beleza', 'Cabelo', 'keyword',
 ARRAY['beleza', 'cabelereiro', 'salao beleza', 'corte cabelo', 'manicure'],
 0.80, 70, 0, 'system', '{"pattern_type": "generic", "category": "beauty"}'),

-- Investimentos
('investimento generico', 'Investimento', 'Renda de Investimentos', 'Investimentos', 'keyword',
 ARRAY['investimento', 'aplicacao', 'renda fixa', 'renda variavel', 'poupanca'],
 0.85, 75, 0, 'system', '{"pattern_type": "generic", "category": "investment"}'),

-- Salário
('salario generico', 'Salário', 'Salário / 13° Salário / Férias', 'Salário', 'keyword',
 ARRAY['salario', 'pagamento salario', 'remuneracao', 'vencimento'],
 0.90, 80, 0, 'system', '{"pattern_type": "generic", "category": "income"}'),

-- Pró-labore
('pro labore generico', 'Pró-labore', 'Pró Labore', 'Pró-labore', 'keyword',
 ARRAY['pro labore', 'prolabore', 'retirada pj', 'distribuicao lucro'],
 0.85, 75, 0, 'system', '{"pattern_type": "generic", "category": "income"}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- ATUALIZAR MATERIALIZED VIEW
-- ============================================================================

REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_frequent_merchants;

COMMIT;

