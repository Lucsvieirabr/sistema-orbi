-- Migration: Seed comprehensive merchant keywords and aliases
-- Extensive collection of merchants with detailed keyword matching
-- Uses ON CONFLICT to safely handle duplicates

BEGIN;

-- ============================================================================
-- ALIMENTAÇÃO - FAST FOOD E RESTAURANTES
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

-- Fast Food
('mcdonalds', 'McDonald''s', 'Refeição', 'Fast Food', 'merchant',
 ARRAY['mcdonalds', 'mc', 'mcd'], ARRAY['fastfood', 'lanche', 'bigmac', 'mclanche'],
 0.95, 95, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('burger king', 'Burger King', 'Refeição', 'Fast Food', 'merchant',
 ARRAY['burgerking', 'bk'], ARRAY['fastfood', 'lanche', 'whopper'],
 0.95, 95, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('subway', 'Subway', 'Refeição', 'Fast Food', 'merchant',
 ARRAY['subway'], ARRAY['fastfood', 'lanche', 'sanduiche'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('habibs', 'Habib''s', 'Refeição', 'Fast Food', 'merchant',
 ARRAY['habibs'], ARRAY['esfiha', 'kibe', 'fastfood', 'arabe'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('bobs', 'Bob''s', 'Refeição', 'Fast Food', 'merchant',
 ARRAY['bobs'], ARRAY['fastfood', 'milkshake', 'lanche'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('giraffas', 'Giraffas', 'Refeição', 'Fast Food', 'merchant',
 ARRAY['giraffas'], ARRAY['fastfood', 'prato', 'grelhado'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('spoleto', 'Spoleto', 'Refeição', 'Restaurante', 'merchant',
 ARRAY['spoleto'], ARRAY['massa', 'pasta', 'italiano'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('kfc', 'KFC', 'Refeição', 'Fast Food', 'merchant',
 ARRAY['kfc'], ARRAY['frango', 'frito', 'kentuckyfriedchicken', 'fastfood'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('popeyes', 'Popeyes', 'Refeição', 'Fast Food', 'merchant',
 ARRAY['popeyes'], ARRAY['frango', 'frito', 'fastfood'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true}'),

-- Restaurantes
('outback steakhouse', 'Outback Steakhouse', 'Refeição', 'Restaurante', 'merchant',
 ARRAY['outback'], ARRAY['steakhouse', 'restaurante', 'costela', 'cebola'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('madero', 'Madero', 'Refeição', 'Restaurante', 'merchant',
 ARRAY['madero'], ARRAY['restaurante', 'hamburguer', 'container'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('coco bambu', 'Coco Bambu', 'Refeição', 'Restaurante', 'merchant',
 ARRAY['cocobambu'], ARRAY['frutosdomar', 'restaurante', 'camarao'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('fogo de chao', 'Fogo de Chão', 'Refeição', 'Restaurante', 'merchant',
 ARRAY['fogodechao'], ARRAY['churrascaria', 'carne', 'rodizio'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('paris 6', 'Paris 6', 'Refeição', 'Restaurante', 'merchant',
 ARRAY['paris6'], ARRAY['restaurante', 'bistro', 'frances', 'grandgateau'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('applebees', 'Applebee''s', 'Refeição', 'Restaurante', 'merchant',
 ARRAY['applebees'], ARRAY['restaurante', 'americano'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('graal', 'Graal', 'Refeição', 'Restaurante', 'merchant',
 ARRAY['graal'], ARRAY['restaurante', 'estrada', 'rodovia', 'parada'],
 0.85, 85, 0, 'imported', '{"sector": "food_service"}'),

-- Pizzarias
('pizza hut', 'Pizza Hut', 'Refeição', 'Pizzaria', 'merchant',
 ARRAY['pizzahut'], ARRAY['pizza', 'pizzaria', 'fastfood'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('dominos pizza', 'Domino''s Pizza', 'Refeição', 'Pizzaria', 'merchant',
 ARRAY['dominos'], ARRAY['pizza', 'pizzaria'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true}'),

-- Sorveterias
('chiquinho sorvetes', 'Chiquinho Sorvetes', 'Refeição', 'Sorveteria', 'merchant',
 ARRAY['chiquinho'], ARRAY['sorvete', 'sorveteria', 'casquinha'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('bacio di latte', 'Bacio di Latte', 'Refeição', 'Sorveteria', 'merchant',
 ARRAY['baciodilatte'], ARRAY['gelato', 'sorvete', 'italiano'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true}'),

-- ============================================================================
-- ALIMENTAÇÃO - CAFETERIAS E DOCERIAS
-- ============================================================================

('starbucks', 'Starbucks', 'Alimentação', 'Cafeteria', 'merchant',
 ARRAY['starbucks'], ARRAY['cafe', 'cafeteria', 'frapuccino'],
 0.95, 95, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('franscafe', 'Fran''s Café', 'Alimentação', 'Cafeteria', 'merchant',
 ARRAY['franscafe', 'frans'], ARRAY['cafe', 'cafeteria'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('rei do mate', 'Rei do Mate', 'Alimentação', 'Cafeteria', 'merchant',
 ARRAY['reidomate'], ARRAY['mate', 'paodequeijo', 'cafe'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('mais1 cafe', 'Mais1 Café', 'Alimentação', 'Cafeteria', 'merchant',
 ARRAY['mais1cafe', 'maisum'], ARRAY['cafe', 'togo', 'cafeteria'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('casa bauducco', 'Casa Bauducco', 'Alimentação', 'Cafeteria', 'merchant',
 ARRAY['casabauducco', 'bauducco'], ARRAY['panettone', 'cafe'],
 0.88, 88, 0, 'imported', '{"sector": "food_service"}'),

('cacau show', 'Cacau Show', 'Alimentação', 'Chocolateria', 'merchant',
 ARRAY['cacaushow', 'cacau'], ARRAY['chocolate', 'chocolates', 'trufa', 'presente'],
 0.92, 92, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

('kopenhagen', 'Kopenhagen', 'Alimentação', 'Chocolateria', 'merchant',
 ARRAY['kopenhagen'], ARRAY['chocolate', 'linguadegato', 'nhabenta'],
 0.92, 92, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

('brasil cacau', 'Brasil Cacau', 'Alimentação', 'Chocolateria', 'merchant',
 ARRAY['brasilcacau'], ARRAY['chocolate', 'trufa'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

('amor aos pedacos', 'Amor aos Pedaços', 'Alimentação', 'Confeitaria', 'merchant',
 ARRAY['amorpedacos'], ARRAY['bolo', 'doce', 'confeitaria'],
 0.88, 88, 0, 'imported', '{"sector": "food_service"}'),

('sodie doces', 'Sodiê Doces', 'Alimentação', 'Confeitaria', 'merchant',
 ARRAY['sodie'], ARRAY['doces', 'bolo', 'confeitaria'],
 0.90, 90, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('ofner', 'Ofner', 'Alimentação', 'Confeitaria', 'merchant',
 ARRAY['ofner'], ARRAY['confeitaria', 'doce', 'salgado'],
 0.88, 88, 0, 'imported', '{"sector": "food_service"}'),

-- ============================================================================
-- ALIMENTAÇÃO - DELIVERY
-- ============================================================================

('ifood', 'iFood', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['ifood'], ARRAY['delivery', 'restaurante', 'comida', 'entrega', 'mercado'],
 1.00, 100, 0, 'imported', '{"sector": "food_delivery", "app": true}'),

('rappi', 'Rappi', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['rappi'], ARRAY['delivery', 'restaurante', 'comida', 'entrega', 'mercado', 'farmacia'],
 0.95, 95, 0, 'imported', '{"sector": "food_delivery", "app": true}'),

('ze delivery', 'Zé Delivery', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['zedelivery', 'ze'], ARRAY['delivery', 'bebidas', 'cerveja', 'ambev'],
 0.92, 92, 0, 'imported', '{"sector": "food_delivery", "app": true}'),

('daki', 'Daki', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['daki'], ARRAY['delivery', 'mercado', 'rapido', 'entrega'],
 0.90, 90, 0, 'imported', '{"sector": "food_delivery", "app": true}'),

-- ============================================================================
-- ALIMENTAÇÃO - SUPERMERCADOS
-- ============================================================================

('hortifruti', 'Hortifruti', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['hortifruti', 'naturaldaterra'], ARRAY['frutas', 'verduras'],
 0.92, 92, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

('swift', 'Swift', 'Alimentação', 'Açougue', 'merchant',
 ARRAY['swift'], ARRAY['carnes', 'acougue', 'congelados'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail"}'),

-- ============================================================================
-- TRANSPORTE - APPS
-- ============================================================================

('uber', 'Uber', 'Transporte', 'Transporte por Aplicativo', 'merchant',
 ARRAY['uber', 'uberx'], ARRAY['viagem', 'transporte', 'app', 'corrida'],
 1.00, 100, 0, 'imported', '{"sector": "ride_sharing", "app": true}'),

('uber moto', 'Uber Moto', 'Transporte', 'Transporte por Aplicativo', 'merchant',
 ARRAY['uber moto', 'ubermoto'], ARRAY['moto', 'viagem', 'transporte', 'app'],
 0.95, 95, 0, 'imported', '{"sector": "ride_sharing", "app": true}'),

('99', '99', 'Transporte', 'Transporte por Aplicativo', 'merchant',
 ARRAY['99', '99pop'], ARRAY['viagem', 'transporte', 'app', 'corrida'],
 0.95, 95, 0, 'imported', '{"sector": "ride_sharing", "app": true}'),

('99 moto', '99 Moto', 'Transporte', 'Transporte por Aplicativo', 'merchant',
 ARRAY['99 moto', '99moto'], ARRAY['moto', 'viagem', 'transporte', 'app'],
 0.92, 92, 0, 'imported', '{"sector": "ride_sharing", "app": true}'),

-- ============================================================================
-- TRANSPORTE - COMPANHIAS AÉREAS NACIONAIS
-- ============================================================================

('azul linhas aereas', 'Azul Linhas Aéreas', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['azul', 'voeazul'], ARRAY['viagem', 'aereo', 'aviao', 'passagem'],
 0.95, 95, 0, 'imported', '{"sector": "airline", "type": "domestic"}'),

('gol linhas aereas', 'Gol Linhas Aéreas', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['gol', 'voegol'], ARRAY['viagem', 'aereo', 'aviao', 'passagem'],
 0.95, 95, 0, 'imported', '{"sector": "airline", "type": "domestic"}'),

('latam airlines', 'LATAM Airlines', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['latam', 'tam'], ARRAY['viagem', 'aereo', 'aviao', 'passagem'],
 0.95, 95, 0, 'imported', '{"sector": "airline", "type": "domestic"}'),

('voepass linhas aereas', 'VoePass Linhas Aéreas', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['voepass', 'passaredo'], ARRAY['viagem', 'aereo', 'aviao'],
 0.90, 90, 0, 'imported', '{"sector": "airline", "type": "domestic"}'),

-- ============================================================================
-- TRANSPORTE - COMPANHIAS AÉREAS INTERNACIONAIS
-- ============================================================================

('american airlines', 'American Airlines', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['american', 'aa'], ARRAY['viagem', 'aereo', 'internacional'],
 0.92, 92, 0, 'imported', '{"sector": "airline", "type": "international"}'),

('delta air lines', 'Delta Air Lines', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['delta'], ARRAY['viagem', 'aereo', 'internacional'],
 0.92, 92, 0, 'imported', '{"sector": "airline", "type": "international"}'),

('united airlines', 'United Airlines', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['united'], ARRAY['viagem', 'aereo', 'internacional'],
 0.92, 92, 0, 'imported', '{"sector": "airline", "type": "international"}'),

('tap air portugal', 'TAP Air Portugal', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['tap'], ARRAY['portugal', 'viagem', 'aereo', 'internacional'],
 0.92, 92, 0, 'imported', '{"sector": "airline", "type": "international"}'),

('air france', 'Air France', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['airfrance'], ARRAY['franca', 'viagem', 'aereo', 'internacional'],
 0.92, 92, 0, 'imported', '{"sector": "airline", "type": "international"}'),

('klm', 'KLM', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['klm'], ARRAY['holanda', 'viagem', 'aereo', 'internacional'],
 0.92, 92, 0, 'imported', '{"sector": "airline", "type": "international"}'),

('lufthansa', 'Lufthansa', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['lufthansa'], ARRAY['alemanha', 'viagem', 'aereo', 'internacional'],
 0.92, 92, 0, 'imported', '{"sector": "airline", "type": "international"}'),

('british airways', 'British Airways', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['british'], ARRAY['inglaterra', 'viagem', 'aereo', 'internacional'],
 0.92, 92, 0, 'imported', '{"sector": "airline", "type": "international"}'),

('emirates', 'Emirates', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['emirates'], ARRAY['dubai', 'viagem', 'aereo', 'internacional'],
 0.92, 92, 0, 'imported', '{"sector": "airline", "type": "international"}'),

('qatar airways', 'Qatar Airways', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['qatar'], ARRAY['viagem', 'aereo', 'internacional'],
 0.92, 92, 0, 'imported', '{"sector": "airline", "type": "international"}'),

('copa airlines', 'Copa Airlines', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['copa'], ARRAY['panama', 'viagem', 'aereo', 'internacional'],
 0.90, 90, 0, 'imported', '{"sector": "airline", "type": "international"}'),

('aerolineas argentinas', 'Aerolineas Argentinas', 'Transporte', 'Passagem Aérea', 'merchant',
 ARRAY['aerolineas'], ARRAY['argentina', 'viagem', 'aereo', 'internacional'],
 0.90, 90, 0, 'imported', '{"sector": "airline", "type": "international"}'),

-- ============================================================================
-- TRANSPORTE - COMBUSTÍVEL E PEDÁGIO
-- ============================================================================

('ipiranga', 'Ipiranga', 'Transporte', 'Combustível', 'merchant',
 ARRAY['ipiranga', 'abasteceai'], ARRAY['posto', 'gasolina', 'combustivel', 'etanol'],
 0.95, 95, 0, 'imported', '{"sector": "fuel"}'),

('shell', 'Shell', 'Transporte', 'Combustível', 'merchant',
 ARRAY['shell', 'shellbox'], ARRAY['posto', 'gasolina', 'combustivel', 'etanol'],
 0.95, 95, 0, 'imported', '{"sector": "fuel"}'),

('petrobras', 'Petrobras', 'Transporte', 'Combustível', 'merchant',
 ARRAY['petrobras', 'br', 'premmia'], ARRAY['posto', 'gasolina', 'combustivel'],
 0.95, 95, 0, 'imported', '{"sector": "fuel"}'),

('ale combustiveis', 'Ale Combustíveis', 'Transporte', 'Combustível', 'merchant',
 ARRAY['ale'], ARRAY['posto', 'gasolina', 'combustivel'],
 0.90, 90, 0, 'imported', '{"sector": "fuel"}'),

('vibra energia', 'Vibra Energia', 'Transporte', 'Combustível', 'merchant',
 ARRAY['vibra'], ARRAY['posto', 'gasolina', 'br'],
 0.90, 90, 0, 'imported', '{"sector": "fuel"}'),

('sem parar', 'Sem Parar', 'Transporte', 'Pedágio', 'merchant',
 ARRAY['semparar'], ARRAY['pedagio', 'estacionamento', 'tag', 'automatico'],
 0.95, 95, 0, 'imported', '{"sector": "toll"}'),

('conectcar', 'ConectCar', 'Transporte', 'Pedágio', 'merchant',
 ARRAY['conectcar'], ARRAY['pedagio', 'estacionamento', 'tag', 'automatico'],
 0.95, 95, 0, 'imported', '{"sector": "toll"}'),

('veloe', 'Veloe', 'Transporte', 'Pedágio', 'merchant',
 ARRAY['veloe'], ARRAY['pedagio', 'estacionamento', 'tag', 'automatico'],
 0.92, 92, 0, 'imported', '{"sector": "toll"}'),

('taggy', 'Taggy', 'Transporte', 'Pedágio', 'merchant',
 ARRAY['taggy'], ARRAY['pedagio', 'estacionamento', 'tag', 'automatico'],
 0.90, 90, 0, 'imported', '{"sector": "toll"}'),

-- ============================================================================
-- TRANSPORTE - ÔNIBUS E ALUGUEL DE CARROS
-- ============================================================================

('buser', 'Buser', 'Transporte', 'Ônibus', 'merchant',
 ARRAY['buser'], ARRAY['onibus', 'viagem', 'passagem'],
 0.92, 92, 0, 'imported', '{"sector": "bus"}'),

('clickbus', 'ClickBus', 'Transporte', 'Ônibus', 'merchant',
 ARRAY['clickbus'], ARRAY['onibus', 'viagem', 'rodoviaria', 'passagem'],
 0.92, 92, 0, 'imported', '{"sector": "bus"}'),

('wemobi', 'Wemobi', 'Transporte', 'Ônibus', 'merchant',
 ARRAY['wemobi'], ARRAY['onibus', 'viagem', 'passagem'],
 0.90, 90, 0, 'imported', '{"sector": "bus"}'),

('localiza', 'Localiza', 'Transporte', 'Aluguel de Veículo', 'merchant',
 ARRAY['localiza'], ARRAY['aluguel', 'carro', 'rentacar'],
 0.95, 95, 0, 'imported', '{"sector": "car_rental"}'),

('movida', 'Movida', 'Transporte', 'Aluguel de Veículo', 'merchant',
 ARRAY['movida'], ARRAY['aluguel', 'carro', 'rentacar'],
 0.95, 95, 0, 'imported', '{"sector": "car_rental"}'),

('unidas', 'Unidas', 'Transporte', 'Aluguel de Veículo', 'merchant',
 ARRAY['unidas'], ARRAY['aluguel', 'carro', 'rentacar'],
 0.92, 92, 0, 'imported', '{"sector": "car_rental"}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- CONTINUAÇÃO EM PRÓXIMO INSERT (evitar INSERT muito grande)
-- ============================================================================

COMMIT;

