-- Migration: Seed remaining merchants Part 3
-- Saúde, Lazer, Pets, Impostos e Outros

BEGIN;

-- ============================================================================
-- SAÚDE E FARMÁCIAS (faltantes)
-- ============================================================================

INSERT INTO public.merchants_dictionary (
  merchant_key, entity_name, category, subcategory, entry_type,
  aliases, keywords, confidence_modifier, priority, usage_count, source_type, metadata
) VALUES

-- Farmácias
('drogaria sao paulo', 'Drogaria São Paulo', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['dpsp', 'drogaria sp'], ARRAY['farmacia', 'remedio', 'saude'],
 0.90, 95, 0, 'system', '{"sector": "pharmacy", "chain": true}'),

('pacheco', 'Drogarias Pacheco', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['drogarias pacheco'], ARRAY['farmacia', 'remedio', 'saude'],
 0.85, 90, 0, 'system', '{"sector": "pharmacy", "chain": true}'),

('panvel', 'Panvel', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['farmacias panvel'], ARRAY['farmacia', 'remedio', 'saude'],
 0.85, 90, 0, 'system', '{"sector": "pharmacy", "chain": true}'),

('drogaria araujo', 'Drogaria Araujo', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['araujo'], ARRAY['farmacia', 'remedio', 'saude'],
 0.85, 90, 0, 'system', '{"sector": "pharmacy", "chain": true}'),

('drogarias nissei', 'Drogarias Nissei', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['nissei'], ARRAY['farmacia', 'remedio', 'saude'],
 0.80, 85, 0, 'system', '{"sector": "pharmacy", "chain": true}'),

('farmacias sao joao', 'Farmácias São João', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['sao joao', 'são joão'], ARRAY['farmacia', 'remedio', 'saude'],
 0.80, 85, 0, 'system', '{"sector": "pharmacy", "chain": true}'),

('drogal', 'Drogal', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['drogal farmacias'], ARRAY['farmacia', 'remedio', 'saude'],
 0.75, 80, 0, 'system', '{"sector": "pharmacy", "regional": true}'),

-- Serviços Médicos
('dentista', 'Dentista', 'Proteção Pessoal / Saúde / Farmácia', 'Serviços Médicos', 'keyword',
 ARRAY['consulta dentista', 'dentista dr', 'odontologia', 'clínica dental', 'dr silva'], ARRAY['dentista', 'odontologia', 'dente'],
 0.90, 95, 0, 'system', '{"sector": "health_service", "type": "dental"}'),

-- Hospitais de Referência
('albert einstein', 'Hospital Albert Einstein', 'Proteção Pessoal / Saúde / Farmácia', 'Hospitais/Clínicas', 'merchant',
 ARRAY['einstein', 'hosp albert einstein', 'hospital israelita'], ARRAY['hospital', 'saude', 'clinica'],
 0.95, 100, 0, 'system', '{"sector": "hospital", "premium": true}'),

('sirio libanes', 'Hospital Sírio-Libanês', 'Proteção Pessoal / Saúde / Farmácia', 'Hospitais/Clínicas', 'merchant',
 ARRAY['sirio-libanes', 'sirio libanês', 'hosp sirio'], ARRAY['hospital', 'saude', 'clinica'],
 0.95, 100, 0, 'system', '{"sector": "hospital", "premium": true}'),

-- ============================================================================
-- BEM ESTAR E BELEZA (faltantes)
-- ============================================================================

-- Academias
('academia', 'Academia', 'Bem Estar / Beleza', 'Academia', 'keyword',
 ARRAY['academia fit', 'gym', 'fitness', 'crossfit', 'musculação', 'treino', 'fit life'], ARRAY['academia', 'fitness', 'exercicio'],
 0.90, 95, 0, 'system', '{"sector": "fitness", "type": "generic"}'),

-- Clínicas de Estética
('onodera estetica', 'Onodera Estética', 'Bem Estar / Beleza', 'Clínicas de Estética', 'merchant',
 ARRAY['onodera', 'clinica onodera'], ARRAY['estetica', 'beleza', 'tratamento'],
 0.85, 90, 0, 'system', '{"sector": "beauty", "chain": true}'),

-- ============================================================================
-- LAZER E ENTRETENIMENTO (faltantes)
-- ============================================================================

-- Ingressos e Eventos
('sympla', 'Sympla', 'Lazer', 'Ingressos e Eventos', 'merchant',
 ARRAY['sympla ingressos'], ARRAY['ingresso', 'evento', 'show'],
 0.90, 95, 0, 'system', '{"sector": "events", "app": true}'),

('ticketmaster', 'Ticketmaster', 'Lazer', 'Ingressos e Eventos', 'merchant',
 ARRAY['ticket master'], ARRAY['ingresso', 'evento', 'show'],
 0.85, 90, 0, 'system', '{"sector": "events", "chain": true}'),

('total acesso', 'Total Acesso', 'Lazer', 'Ingressos e Eventos', 'merchant',
 ARRAY['totalacesso'], ARRAY['ingresso', 'evento', 'show'],
 0.80, 85, 0, 'system', '{"sector": "events", "regional": true}'),

('eventim', 'Eventim', 'Lazer', 'Ingressos e Eventos', 'merchant',
 ARRAY['eventim brasil'], ARRAY['ingresso', 'evento', 'show'],
 0.80, 85, 0, 'system', '{"sector": "events", "chain": true}'),

('ingresso.com', 'Ingresso.com', 'Lazer', 'Cinema', 'merchant',
 ARRAY['ingresso', 'ingressocom'], ARRAY['ingresso', 'cinema', 'filme'],
 0.85, 90, 0, 'system', '{"sector": "cinema", "app": true}'),

-- Parques Temáticos
('beach park', 'Beach Park', 'Lazer', 'Parques Temáticos', 'merchant',
 ARRAY['beach park resort', 'beachpark'], ARRAY['parque', 'parque aquatico', 'lazer'],
 0.90, 95, 0, 'system', '{"sector": "theme_park", "regional": true}'),

('thermas laranjais', 'Thermas dos Laranjais', 'Lazer', 'Parques Temáticos', 'merchant',
 ARRAY['thermas', 'laranjais', 'thermas olimpia'], ARRAY['parque', 'parque aquatico', 'lazer'],
 0.85, 90, 0, 'system', '{"sector": "theme_park", "regional": true}'),

-- Cinemas
('moviecom', 'Moviecom Cinemas', 'Lazer', 'Cinema', 'merchant',
 ARRAY['moviecom', 'cinema moviecom'], ARRAY['cinema', 'filme', 'ingresso'],
 0.85, 90, 0, 'system', '{"sector": "cinema", "chain": true}'),

('cinemark', 'Cinemark', 'Lazer', 'Cinema', 'merchant',
 ARRAY['cinemark cinemas'], ARRAY['cinema', 'filme', 'ingresso'],
 0.90, 95, 0, 'system', '{"sector": "cinema", "chain": true}'),

-- Plataformas de Jogos
('psn', 'PlayStation Network', 'Lazer', 'Jogos/Plataformas Digitais', 'merchant',
 ARRAY['playstation network', 'playstation store', 'ps store', 'sony playstation'], ARRAY['jogo', 'game', 'playstation'],
 0.95, 100, 0, 'system', '{"sector": "gaming", "platform": true}'),

('steam', 'Steam', 'Lazer', 'Jogos/Plataformas Digitais', 'merchant',
 ARRAY['steam store', 'valve steam', 'steam games'], ARRAY['jogo', 'game', 'pc'],
 0.95, 100, 0, 'system', '{"sector": "gaming", "platform": true}'),

('xbox live', 'Xbox Live', 'Lazer', 'Jogos/Plataformas Digitais', 'merchant',
 ARRAY['xbox', 'microsoft xbox', 'xbox store', 'xbox game pass'], ARRAY['jogo', 'game', 'xbox'],
 0.95, 100, 0, 'system', '{"sector": "gaming", "platform": true}'),

-- ============================================================================
-- PETS (faltantes)
-- ============================================================================

('cobasi', 'Cobasi', 'Pet', 'Pet Shop', 'merchant',
 ARRAY['cobasi pet'], ARRAY['pet', 'animal', 'veterinario'],
 0.85, 90, 0, 'system', '{"sector": "pet", "chain": true}'),

('petz', 'Petz', 'Pet', 'Pet Shop', 'merchant',
 ARRAY['petz pet shop'], ARRAY['pet', 'animal', 'veterinario'],
 0.85, 90, 0, 'system', '{"sector": "pet", "chain": true}'),

('petlove', 'Petlove', 'Pet', 'Pet Shop', 'merchant',
 ARRAY['pet love'], ARRAY['pet', 'animal', 'veterinario'],
 0.80, 85, 0, 'system', '{"sector": "pet", "chain": true}'),

('petland', 'Petland', 'Pet', 'Pet Shop', 'merchant',
 ARRAY['pet land'], ARRAY['pet', 'animal', 'veterinario'],
 0.75, 80, 0, 'system', '{"sector": "pet", "chain": true}'),

-- ============================================================================
-- GATEWAYS DE PAGAMENTO E SERVIÇOS FINANCEIROS
-- ============================================================================

('pay2all', 'Pay2all', 'Outros', 'Gateway de Pagamento', 'merchant',
 ARRAY['pay2all instituicao', 'pay2all pagamento', 'pay 2 all'], ARRAY['pagamento', 'gateway', 'transferencia'],
 0.80, 85, 0, 'system', '{"sector": "payment_gateway", "service": true}'),

('ebanx', 'EBANX', 'Outros', 'Gateway de Pagamento', 'merchant',
 ARRAY['ebanx pagamentos'], ARRAY['pagamento', 'gateway', 'transferencia'],
 0.80, 85, 0, 'system', '{"sector": "payment_gateway", "service": true}'),

('paypal', 'PayPal', 'Outros', 'Gateway de Pagamento', 'merchant',
 ARRAY['pay pal'], ARRAY['pagamento', 'gateway', 'transferencia'],
 0.90, 95, 0, 'system', '{"sector": "payment_gateway", "service": true}'),

('pagseguro', 'PagSeguro', 'Outros', 'Gateway de Pagamento', 'merchant',
 ARRAY['pagbank', 'pag seguro'], ARRAY['pagamento', 'gateway', 'transferencia'],
 0.90, 95, 0, 'system', '{"sector": "payment_gateway", "service": true}'),

('picpay', 'PicPay', 'Outros', 'Gateway de Pagamento', 'merchant',
 ARRAY['pic pay'], ARRAY['pagamento', 'gateway', 'transferencia'],
 0.90, 95, 0, 'system', '{"sector": "payment_gateway", "app": true}'),

-- ============================================================================
-- IMPOSTOS E RECEITAS
-- ============================================================================

('receita federal', 'Receita Federal', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Imposto Federal', 'merchant',
 ARRAY['receita federal', 'rf', 'imposto de renda', 'darf'], ARRAY['imposto', 'taxa', 'governo'],
 0.98, 100, 0, 'system', '{"sector": "government", "tax": true}'),

('codetime', 'Codetime Ltda', 'Salário / 13° Salário / Férias', 'Salário', 'merchant',
 ARRAY['codetime ltda', 'codetime', 'code time'], ARRAY['salario', 'trabalho', 'empresa'],
 0.95, 100, 0, 'system', '{"sector": "income", "salary": true, "regional": true}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- PADRÕES BANCÁRIOS ADICIONAIS (IOF, Juros, etc.)
-- ============================================================================

INSERT INTO public.merchants_dictionary (
  merchant_key, entity_name, category, subcategory, entry_type,
  confidence_modifier, priority, context, usage_count, source_type, metadata
) VALUES

-- IOF
('iof saq rotativo diario', 'IOF SAQ/Rotativo Diário', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'IOF Nacional (Diário)', 'banking_pattern',
 1.00, 100, 'iof_diario', 0, 'system', '{"pattern_type": "banking", "fee_type": "iof"}'),

('iof saq rotativo adicional', 'IOF SAQ/Rotativo Adicional', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'IOF Nacional (Adicional)', 'banking_pattern',
 1.00, 100, 'iof_adicional', 0, 'system', '{"pattern_type": "banking", "fee_type": "iof"}'),

('iof operacao exterior', 'IOF Operação Exterior', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'IOF Internacional', 'banking_pattern',
 1.00, 100, 'iof_internacional', 0, 'system', '{"pattern_type": "banking", "fee_type": "iof"}'),

('iof de atraso', 'IOF de Atraso', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'IOF Nacional (Atraso)', 'banking_pattern',
 1.00, 100, 'iof_atraso', 0, 'system', '{"pattern_type": "banking", "fee_type": "iof"}'),

('iof', 'IOF', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'IOF', 'banking_pattern',
 0.98, 95, 'iof', 0, 'system', '{"pattern_type": "banking", "fee_type": "iof"}'),

-- Anuidades
('anuidade mastercard', 'Anuidade Mastercard', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Anuidade de Cartão', 'banking_pattern',
 1.00, 100, 'anuidade', 0, 'system', '{"pattern_type": "banking", "fee_type": "anuidade"}'),

('anuidade visa', 'Anuidade Visa', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Anuidade de Cartão', 'banking_pattern',
 1.00, 100, 'anuidade', 0, 'system', '{"pattern_type": "banking", "fee_type": "anuidade"}'),

('anuidade', 'Anuidade', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Anuidade de Cartão', 'banking_pattern',
 0.95, 95, 'anuidade', 0, 'system', '{"pattern_type": "banking", "fee_type": "anuidade"}'),

-- Tarifas de Saque
('saque banco24horas', 'Saque Banco24Horas', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifa de Saque', 'banking_pattern',
 1.00, 100, 'saque', 0, 'system', '{"pattern_type": "banking", "fee_type": "saque"}'),

('saque rede cirrus nacional', 'Saque Rede Cirrus Nacional', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifa de Saque', 'banking_pattern',
 1.00, 100, 'saque', 0, 'system', '{"pattern_type": "banking", "fee_type": "saque"}'),

('saque rede cirrus exterior', 'Saque Rede Cirrus Exterior', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifa de Saque', 'banking_pattern',
 1.00, 100, 'saque_internacional', 0, 'system', '{"pattern_type": "banking", "fee_type": "saque"}'),

('saque', 'Saque', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifa de Saque', 'banking_pattern',
 0.90, 85, 'saque', 0, 'system', '{"pattern_type": "banking", "fee_type": "saque"}'),

-- Multas e Juros
('multa por atraso', 'Multa por Atraso', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Multa por Atraso', 'banking_pattern',
 1.00, 100, 'multa', 0, 'system', '{"pattern_type": "banking", "fee_type": "multa"}'),

('multa de atraso', 'Multa de Atraso', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Multa', 'banking_pattern',
 0.98, 100, 'multa', 0, 'system', '{"pattern_type": "banking", "fee_type": "multa"}'),

('juros de atraso', 'Juros de Atraso', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros de Mora', 'banking_pattern',
 1.00, 100, 'juros', 0, 'system', '{"pattern_type": "banking", "fee_type": "juros"}'),

('juro sobre rotativo', 'Juro sobre Rotativo', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros de Rotativo', 'banking_pattern',
 1.00, 100, 'juros', 0, 'system', '{"pattern_type": "banking", "fee_type": "juros"}'),

('juro de mora', 'Juro de Mora', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros de Mora', 'banking_pattern',
 1.00, 100, 'juros', 0, 'system', '{"pattern_type": "banking", "fee_type": "juros"}'),

('juros de divida encerrada', 'Juros de Dívida Encerrada', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros de Renegociação', 'banking_pattern',
 1.00, 100, 'juros', 0, 'system', '{"pattern_type": "banking", "fee_type": "juros"}'),

('juros', 'Juros', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros', 'banking_pattern',
 0.85, 85, 'juros', 0, 'system', '{"pattern_type": "banking", "fee_type": "juros"}'),

-- Parcelamento e Renegociação
('parcelamento rotativo', 'Parcelamento Rotativo', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Parcelamento de Dívida', 'banking_pattern',
 1.00, 100, 'parcelamento', 0, 'system', '{"pattern_type": "banking", "fee_type": "parcelamento"}'),

('pagamento minimo', 'Pagamento Mínimo', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Financiamento', 'banking_pattern',
 0.90, 95, 'pagamento', 0, 'system', '{"pattern_type": "banking", "fee_type": "financiamento"}'),

('encerramento de divida', 'Encerramento de Dívida', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Renegociação de Dívida', 'banking_pattern',
 1.00, 100, 'renegociacao', 0, 'system', '{"pattern_type": "banking", "fee_type": "renegociacao"}'),

('saldo em atraso', 'Saldo em Atraso', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Débito de Dívida', 'banking_pattern',
 1.00, 100, 'divida', 0, 'system', '{"pattern_type": "banking", "fee_type": "divida"}'),

-- Pagamentos e Liquidação
('pagamento boleto bancario', 'Pagamento Boleto Bancário', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Pagamento de Fatura/Boleto', 'banking_pattern',
 1.00, 100, 'pagamento', 0, 'system', '{"pattern_type": "banking"}'),

('pagamento recebido', 'Pagamento Recebido', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Pagamento de Fatura/Boleto', 'banking_pattern',
 1.00, 100, 'pagamento', 0, 'system', '{"pattern_type": "banking"}'),

('credito de atraso', 'Crédito de Atraso', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Ajuste/Estorno de Encargos', 'banking_pattern',
 1.00, 100, 'ajuste', 0, 'system', '{"pattern_type": "banking"}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- ATUALIZAR MATERIALIZED VIEW
-- ============================================================================

REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_frequent_merchants;

COMMIT;

