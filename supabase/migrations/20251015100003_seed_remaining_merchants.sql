-- Migration: Seed remaining merchants from BankDictionary.ts.old
-- Adds all missing merchants (203 - 30 = ~173 merchants)

BEGIN;

-- ============================================================================
-- ALIMENTAÇÃO - SUPERMERCADOS E ATACADOS (faltantes)
-- ============================================================================

INSERT INTO public.merchants_dictionary (
  merchant_key, entity_name, category, subcategory, entry_type,
  aliases, keywords, confidence_modifier, priority, usage_count, source_type, metadata
) VALUES

-- Atacados (faltantes)
('atacadao', 'Atacadão', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['atacadao', 'atacadão', 'carrefour atacadao'], ARRAY['atacado', 'mercado'],
 0.95, 100, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('tenda atacado', 'Tenda Atacado', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['tenda', 'tenda atacado'], ARRAY['atacado', 'mercado'],
 0.90, 95, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('fort atacadista', 'Fort Atacadista', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['fort', 'atacadista fort', 'fort ataca'], ARRAY['atacado', 'mercado'],
 0.95, 100, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('komprao koch atacadista', 'Komprao Koch Atacadista', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['komprao', 'koch', 'koch atacadista', 'komprao koch', 'atacadista koch'], ARRAY['atacado', 'mercado'],
 0.95, 100, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('atacadao dia a dia', 'Atacadão Dia a Dia', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['diaadia', 'dia a dia'], ARRAY['atacado', 'mercado'],
 0.90, 95, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('novo atacarejo', 'Novo Atacarejo', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['novo atac'], ARRAY['atacado', 'mercado'],
 0.85, 90, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('atakarejo', 'Atakarejo', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['atac', 'ataca'], ARRAY['atacado', 'mercado'],
 0.85, 90, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('mart minas', 'Mart Minas', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['dom atacadista'], ARRAY['atacado', 'mercado'],
 0.90, 95, 0, 'system', '{"sector": "food_retail", "chain": true}'),

-- Supermercados (faltantes)
('comper', 'Comper Supermercados', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['supermercado comper', 'comper supermercado', 'grupo pereira'], ARRAY['supermercado', 'mercado'],
 0.90, 95, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('mateus supermercados', 'Mateus Supermercados', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['mateus', 'grupomateus', 'grupo mateus'], ARRAY['supermercado', 'mercado'],
 0.90, 95, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('supermercados bh', 'Supermercados BH', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['bh supermercado', 'super bh'], ARRAY['supermercado', 'mercado'],
 0.85, 90, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('muffato', 'Super Muffato', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['super muffato', 'supermercado muffato'], ARRAY['supermercado', 'mercado'],
 0.90, 95, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('cencosud', 'Cencosud', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['gbarbosa', 'g barbosa', 'prezunic'], ARRAY['supermercado', 'mercado'],
 0.85, 90, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('zaffari', 'Zaffari', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['cia zaffari', 'companhia zaffari'], ARRAY['supermercado', 'mercado'],
 0.90, 95, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('savegnago', 'Savegnago', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['supermercado savegnago'], ARRAY['supermercado', 'mercado'],
 0.85, 90, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('sonda supermercados', 'Sonda Supermercados', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['sonda'], ARRAY['supermercado', 'mercado'],
 0.85, 90, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('grupo abc', 'Grupo ABC', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['supermercado abc'], ARRAY['supermercado', 'mercado'],
 0.80, 85, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('bahamas supermercado', 'Bahamas Supermercado', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['bahamas', 'super bahamas'], ARRAY['supermercado', 'mercado'],
 0.85, 90, 0, 'system', '{"sector": "food_retail", "chain": true}'),

('giassi', 'Giassi', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['supermercado giassi'], ARRAY['supermercado', 'mercado'],
 0.85, 90, 0, 'system', '{"sector": "food_retail", "chain": true}'),

-- ============================================================================
-- ALIMENTAÇÃO - FAST FOOD E RESTAURANTES (faltantes)
-- ============================================================================

-- Fast-Food
('mcdonalds', 'McDonald''s', 'Alimentação', 'Fast-Food', 'merchant',
 ARRAY['mc donalds', 'mcdonald', 'mc', 'arcos dourados'], ARRAY['fast food', 'lanche', 'hamburguer'],
 0.95, 100, 0, 'system', '{"sector": "food_service", "chain": true}'),

('burger king', 'Burger King', 'Alimentação', 'Fast-Food', 'merchant',
 ARRAY['bk', 'burguer king', 'burguer'], ARRAY['fast food', 'lanche', 'hamburguer'],
 0.95, 100, 0, 'system', '{"sector": "food_service", "chain": true}'),

('habibs', 'Habib''s', 'Alimentação', 'Fast-Food', 'merchant',
 ARRAY['habib', 'habibs'], ARRAY['fast food', 'esfiha', 'arabe'],
 0.90, 95, 0, 'system', '{"sector": "food_service", "chain": true}'),

('subway', 'Subway', 'Alimentação', 'Fast-Food', 'merchant',
 ARRAY['sub'], ARRAY['fast food', 'sanduiche'],
 0.90, 90, 0, 'system', '{"sector": "food_service", "chain": true}'),

('kfc', 'KFC', 'Alimentação', 'Fast-Food', 'merchant',
 ARRAY['kentucky', 'kentucky fried chicken'], ARRAY['fast food', 'frango'],
 0.90, 90, 0, 'system', '{"sector": "food_service", "chain": true}'),

('popeyes', 'Popeyes', 'Alimentação', 'Fast-Food', 'merchant',
 ARRAY['popeye'], ARRAY['fast food', 'frango'],
 0.85, 90, 0, 'system', '{"sector": "food_service", "chain": true}'),

('bobs', 'Bob''s', 'Alimentação', 'Fast-Food', 'merchant',
 ARRAY['bobs'], ARRAY['fast food', 'lanche', 'hamburguer'],
 0.90, 90, 0, 'system', '{"sector": "food_service", "chain": true}'),

('giraffas', 'Giraffas', 'Alimentação', 'Fast-Food', 'merchant',
 ARRAY['girafa'], ARRAY['fast food', 'lanche'],
 0.85, 85, 0, 'system', '{"sector": "food_service", "chain": true}'),

('china in box', 'China in Box', 'Alimentação', 'Fast-Food', 'merchant',
 ARRAY['china box', 'chinainbox'], ARRAY['fast food', 'comida chinesa'],
 0.85, 85, 0, 'system', '{"sector": "food_service", "chain": true}'),

('ragazzo', 'Ragazzo', 'Alimentação', 'Fast-Food', 'merchant',
 ARRAY['ragazzo pizzaria'], ARRAY['fast food', 'pizza'],
 0.80, 80, 0, 'system', '{"sector": "food_service", "chain": true}'),

-- Pizzarias
('pizza hut', 'Pizza Hut', 'Alimentação', 'Pizzaria', 'merchant',
 ARRAY['pizzahut'], ARRAY['pizza', 'pizzaria'],
 0.85, 90, 0, 'system', '{"sector": "food_service", "chain": true}'),

-- Restaurantes
('outback', 'Outback Steakhouse', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['outback steakhouse'], ARRAY['restaurante', 'churrasco'],
 0.90, 95, 0, 'system', '{"sector": "food_service", "chain": true}'),

('coco bambu', 'Coco Bambu', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['cocobambu'], ARRAY['restaurante', 'frutos mar'],
 0.85, 90, 0, 'system', '{"sector": "food_service", "chain": true}'),

('spoleto', 'Spoleto', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['spoleto culinaria'], ARRAY['restaurante', 'massa'],
 0.85, 85, 0, 'system', '{"sector": "food_service", "chain": true}'),

('madero', 'Madero', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['madero container', 'madero steak'], ARRAY['restaurante', 'hamburguer'],
 0.85, 90, 0, 'system', '{"sector": "food_service", "chain": true}'),

('pampeana', 'Pampeana', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['pampeana restaurante', 'rest pampeana'], ARRAY['restaurante', 'churrasco'],
 0.90, 95, 0, 'system', '{"sector": "food_service", "regional": true}'),

('cantina cavallaris', 'Cantina Cavallaris', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['cavallaris', 'cantina'], ARRAY['restaurante', 'italiano'],
 0.90, 95, 0, 'system', '{"sector": "food_service", "regional": true}'),

('dalcoquio', 'Dalcoquio', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['rest dalcoquio'], ARRAY['restaurante'],
 0.85, 90, 0, 'system', '{"sector": "food_service", "regional": true}'),

-- Cafeterias
('starbucks', 'Starbucks', 'Alimentação', 'Cafeteria', 'merchant',
 ARRAY['starbucks coffee'], ARRAY['cafe', 'cafeteria'],
 0.90, 95, 0, 'system', '{"sector": "food_service", "chain": true}'),

('rei do mate', 'Rei do Mate', 'Alimentação', 'Cafeteria', 'merchant',
 ARRAY['reidomate'], ARRAY['cafe', 'mate'],
 0.85, 85, 0, 'system', '{"sector": "food_service", "chain": true}'),

('cappi alley', 'Cappi Alley', 'Alimentação', 'Cafeteria', 'merchant',
 ARRAY['cappialley', 'cappi', 'cafeteria cappi'], ARRAY['cafe', 'cafeteria'],
 0.90, 95, 0, 'system', '{"sector": "food_service", "regional": true}'),

('cafe cultura', 'Cafe Cultura', 'Alimentação', 'Cafeteria', 'merchant',
 ARRAY['café cultura', 'cafeteria cultura'], ARRAY['cafe', 'cafeteria'],
 0.90, 95, 0, 'system', '{"sector": "food_service", "regional": true}'),

-- Docerias
('cake garden', 'Cake Garden', 'Alimentação', 'Doceria', 'merchant',
 ARRAY['confeitaria cake', 'cake'], ARRAY['doceria', 'bolo', 'confeitaria'],
 0.90, 95, 0, 'system', '{"sector": "food_service", "regional": true}'),

('doceria armazem', 'Doceria Armazem', 'Alimentação', 'Doceria', 'merchant',
 ARRAY['doceria armazém', 'armazem doceria'], ARRAY['doceria', 'doce'],
 0.90, 95, 0, 'system', '{"sector": "food_service", "regional": true}'),

-- Delivery (faltantes)
('uber eats', 'Uber Eats', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['ubereats', 'uber comida'], ARRAY['delivery', 'comida'],
 0.90, 95, 0, 'system', '{"sector": "food_delivery", "app": true}'),

('ze delivery', 'Zé Delivery', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['ze delivery', 'zé delivery', 'ze bebidas'], ARRAY['delivery', 'bebida'],
 0.85, 90, 0, 'system', '{"sector": "food_delivery", "app": true}'),

('aiqfome', 'aiqfome', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['aiq fome'], ARRAY['delivery', 'comida'],
 0.80, 85, 0, 'system', '{"sector": "food_delivery", "app": true}'),

-- ============================================================================
-- TRANSPORTE (faltantes)
-- ============================================================================

-- Ride-hailing
('wappa', 'Wappa', 'Transporte', 'Transporte por Aplicativo', 'merchant',
 ARRAY['wappa taxi'], ARRAY['transporte', 'taxi'],
 0.80, 85, 0, 'system', '{"sector": "ride_sharing", "app": true}'),

('tembici', 'Tembici', 'Transporte', 'Aluguel de Bicicleta/Patinete', 'merchant',
 ARRAY['bike itau', 'bike itaú', 'tembici bike'], ARRAY['bicicleta', 'bike'],
 0.85, 90, 0, 'system', '{"sector": "bike_sharing", "app": true}'),

-- Postos (faltantes)
('posto tucha', 'Posto Tucha', 'Transporte', 'Combustível', 'merchant',
 ARRAY['tucha', 'auto posto tucha'], ARRAY['combustivel', 'gasolina', 'posto'],
 0.92, 96, 0, 'system', '{"sector": "fuel", "regional": true}'),

('galo pp', 'GALO PP', 'Transporte', 'Combustível', 'merchant',
 ARRAY['galo', 'posto galo', 'auto posto galo'], ARRAY['combustivel', 'gasolina', 'posto'],
 0.90, 95, 0, 'system', '{"sector": "fuel", "regional": true}'),

-- Pedágio
('sem parar', 'Sem Parar', 'Transporte', 'Pedágio', 'merchant',
 ARRAY['semparar'], ARRAY['pedagio', 'estrada'],
 0.90, 95, 0, 'system', '{"sector": "toll", "service": true}'),

('conectcar', 'ConectCar', 'Transporte', 'Pedágio', 'merchant',
 ARRAY['conecta car'], ARRAY['pedagio', 'estrada'],
 0.90, 95, 0, 'system', '{"sector": "toll", "service": true}'),

('veloe', 'Veloe', 'Transporte', 'Pedágio', 'merchant',
 ARRAY['veloe pedagio'], ARRAY['pedagio', 'estrada'],
 0.85, 90, 0, 'system', '{"sector": "toll", "service": true}'),

('itajaictnrp', 'Itajaí CT NRP', 'Transporte', 'Pedágio', 'merchant',
 ARRAY['itajai ctnrp'], ARRAY['pedagio', 'estrada'],
 0.75, 80, 0, 'system', '{"sector": "toll", "regional": true}'),

-- Transporte Rodoviário
('buser', 'Buser', 'Transporte', 'Transporte Rodoviário', 'merchant',
 ARRAY['buser onibus', 'buser viagens'], ARRAY['onibus', 'viagem'],
 0.90, 95, 0, 'system', '{"sector": "bus", "app": true}'),

('4bus', '4Bus', 'Transporte', 'Transporte Rodoviário', 'merchant',
 ARRAY['4 bus', 'quatro bus'], ARRAY['onibus', 'viagem'],
 0.85, 90, 0, 'system', '{"sector": "bus", "service": true}'),

('clickbus', 'ClickBus', 'Transporte', 'Transporte Rodoviário', 'merchant',
 ARRAY['click bus'], ARRAY['onibus', 'viagem'],
 0.85, 90, 0, 'system', '{"sector": "bus", "service": true}'),

-- Companhias Aéreas
('latam', 'LATAM Airlines', 'Transporte', 'Companhia Aérea', 'merchant',
 ARRAY['latam airlines', 'tam', 'tam linhas aereas'], ARRAY['aviao', 'viagem', 'aereo'],
 0.95, 100, 0, 'system', '{"sector": "airline", "chain": true}'),

('gol', 'Gol Linhas Aéreas', 'Transporte', 'Companhia Aérea', 'merchant',
 ARRAY['gol linhas aereas', 'voegol'], ARRAY['aviao', 'viagem', 'aereo'],
 0.95, 100, 0, 'system', '{"sector": "airline", "chain": true}'),

('azul', 'Azul Linhas Aéreas', 'Transporte', 'Companhia Aérea', 'merchant',
 ARRAY['azul linhas aereas', 'voeazul'], ARRAY['aviao', 'viagem', 'aereo'],
 0.95, 100, 0, 'system', '{"sector": "airline", "chain": true}'),

('voepass', 'Voepass', 'Transporte', 'Companhia Aérea', 'merchant',
 ARRAY['voepass linhas aereas'], ARRAY['aviao', 'viagem', 'aereo'],
 0.85, 90, 0, 'system', '{"sector": "airline", "chain": true}')

ON CONFLICT (merchant_key) DO NOTHING;

COMMIT;

