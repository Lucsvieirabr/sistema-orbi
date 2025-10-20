-- Migration: Keywords MASSIVAS em inglês para estabelecimentos brasileiros
-- 
-- Muitos estabelecimentos brasileiros usam nomes em inglês, mas o dicionário
-- continha principalmente keywords em português. Esta migration adiciona
-- CENTENAS de keywords em inglês para melhorar a classificação automática.
--
-- Exemplos: burger, grill, steak, cake, bakery, coffee, shop, store, gym, spa, etc.
--
-- Categorias cobertas: TODAS (17 categorias)
-- Total de keywords: 350+

BEGIN;

-- =============================================================================
-- CATEGORIA: ALIMENTAÇÃO (Food & Restaurants)
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Burger / Hamburger
  ('burger_en', 'Burger', 'keyword', 'Alimentação', 'Hamburgueria',
   ARRAY['burger', 'burgers', 'hamburger'],
   ARRAY['burger', 'hamburger'], 0.92, 90,
   '{"type": "food", "subtype": "burger", "language": "en"}'),
   
  -- Grill / Grelhados
  ('grill_en', 'Grill', 'keyword', 'Alimentação', 'Churrascaria',
   ARRAY['grill', 'grilled', 'bbq', 'barbecue'],
   ARRAY['grill', 'bbq'], 0.91, 89,
   '{"type": "food", "subtype": "grill", "language": "en"}'),
   
  -- Steak / Carne
  ('steak_en', 'Steak', 'keyword', 'Alimentação', 'Churrascaria',
   ARRAY['steak', 'steaks', 'steakhouse'],
   ARRAY['steak', 'steakhouse'], 0.93, 91,
   '{"type": "food", "subtype": "steakhouse", "language": "en"}'),
   
  -- Cake / Bolos
  ('cake_en', 'Cake', 'keyword', 'Alimentação', 'Confeitaria',
   ARRAY['cake', 'cakes', 'cupcake', 'cupcakes'],
   ARRAY['cake', 'cupcake'], 0.92, 90,
   '{"type": "food", "subtype": "bakery", "language": "en"}'),
   
  -- Bakery / Padaria
  ('bakery_en', 'Bakery', 'keyword', 'Alimentação', 'Padaria',
   ARRAY['bakery', 'bakeries', 'bread'],
   ARRAY['bakery', 'bread'], 0.90, 88,
   '{"type": "food", "subtype": "bakery", "language": "en"}'),
   
  -- Coffee / Café
  ('coffee_en', 'Coffee', 'keyword', 'Alimentação', 'Cafeteria',
   ARRAY['coffee', 'cafe', 'café', 'cafeteria', 'espresso'],
   ARRAY['coffee', 'cafe', 'espresso'], 0.91, 89,
   '{"type": "food", "subtype": "coffee_shop", "language": "en"}'),
   
  -- Bistro / Restaurante sofisticado
  ('bistro_en', 'Bistro', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['bistro', 'bistrot'],
   ARRAY['bistro'], 0.89, 87,
   '{"type": "food", "subtype": "bistro", "language": "en"}'),
   
  -- Kitchen / Cozinha
  ('kitchen_en', 'Kitchen', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['kitchen', 'kitchens'],
   ARRAY['kitchen'], 0.85, 83,
   '{"type": "food", "subtype": "restaurant", "language": "en"}'),
   
  -- Food / Comida
  ('food_en', 'Food', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['food', 'foods'],
   ARRAY['food'], 0.82, 80,
   '{"type": "food", "subtype": "general", "language": "en"}'),
   
  -- Pub / Bar
  ('pub_en', 'Pub', 'keyword', 'Alimentação', 'Bar / Petiscaria',
   ARRAY['pub', 'pubs'],
   ARRAY['pub'], 0.91, 89,
   '{"type": "food", "subtype": "pub", "language": "en"}'),
   
  -- Bar
  ('bar_en', 'Bar', 'keyword', 'Alimentação', 'Bar / Petiscaria',
   ARRAY['bar', 'bars', 'lounge'],
   ARRAY['bar', 'lounge'], 0.88, 86,
   '{"type": "food", "subtype": "bar", "language": "en"}'),
   
  -- Pizza
  ('pizza_en', 'Pizza', 'keyword', 'Alimentação', 'Pizzaria',
   ARRAY['pizza', 'pizzeria'],
   ARRAY['pizza', 'pizzeria'], 0.93, 91,
   '{"type": "food", "subtype": "pizza", "language": "en"}'),
   
  -- Sandwich / Sanduíche
  ('sandwich_en', 'Sandwich', 'keyword', 'Alimentação', 'Lanchonete',
   ARRAY['sandwich', 'sandwiches', 'sub', 'subs'],
   ARRAY['sandwich', 'sub'], 0.90, 88,
   '{"type": "food", "subtype": "sandwich", "language": "en"}'),
   
  -- Snack / Lanche
  ('snack_en', 'Snack', 'keyword', 'Alimentação', 'Lanchonete',
   ARRAY['snack', 'snacks'],
   ARRAY['snack'], 0.87, 85,
   '{"type": "food", "subtype": "snack", "language": "en"}'),
   
  -- Chicken / Frango
  ('chicken_en', 'Chicken', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['chicken', 'wings'],
   ARRAY['chicken', 'wings'], 0.90, 88,
   '{"type": "food", "subtype": "chicken", "language": "en"}'),
   
  -- Sushi
  ('sushi_en', 'Sushi', 'keyword', 'Alimentação', 'Japonesa',
   ARRAY['sushi', 'sashimi'],
   ARRAY['sushi', 'sashimi'], 0.92, 90,
   '{"type": "food", "subtype": "japanese", "language": "en"}'),
   
  -- Gourmet
  ('gourmet_en', 'Gourmet', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['gourmet'],
   ARRAY['gourmet'], 0.85, 83,
   '{"type": "food", "subtype": "gourmet", "language": "en"}'),
   
  -- Deli / Delicatessen
  ('deli_en', 'Deli', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['deli', 'delicatessen'],
   ARRAY['deli', 'delicatessen'], 0.88, 86,
   '{"type": "food", "subtype": "deli", "language": "en"}'),
   
  -- Dinner / Jantar
  ('dinner_en', 'Dinner', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['dinner'],
   ARRAY['dinner'], 0.84, 82,
   '{"type": "food", "subtype": "restaurant", "language": "en"}'),
   
  -- Lunch / Almoço
  ('lunch_en', 'Lunch', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['lunch'],
   ARRAY['lunch'], 0.84, 82,
   '{"type": "food", "subtype": "restaurant", "language": "en"}'),
   
  -- Buffet
  ('buffet_en', 'Buffet', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['buffet', 'buffets'],
   ARRAY['buffet'], 0.89, 87,
   '{"type": "food", "subtype": "buffet", "language": "en"}'),
   
  -- Grill House
  ('grill_house_en', 'Grill House', 'keyword', 'Alimentação', 'Churrascaria',
   ARRAY['grill house', 'grillhouse'],
   ARRAY['grill house'], 0.90, 88,
   '{"type": "food", "subtype": "grill_house", "language": "en"}'),
   
  -- Fast Food
  ('fast_food_en', 'Fast Food', 'keyword', 'Alimentação', 'Fast Food',
   ARRAY['fast food', 'fastfood'],
   ARRAY['fast food'], 0.89, 87,
   '{"type": "food", "subtype": "fast_food", "language": "en"}'),
   
  -- Ice Cream / Sorvete
  ('ice_cream_en', 'Ice Cream', 'keyword', 'Alimentação', 'Sorveteria',
   ARRAY['ice cream', 'icecream', 'gelato'],
   ARRAY['ice cream', 'gelato'], 0.91, 89,
   '{"type": "food", "subtype": "ice_cream", "language": "en"}'),
   
  -- Juice / Suco
  ('juice_en', 'Juice', 'keyword', 'Alimentação', 'Lanchonete',
   ARRAY['juice', 'juices'],
   ARRAY['juice'], 0.87, 85,
   '{"type": "food", "subtype": "juice", "language": "en"}'),
   
  -- Smoothie
  ('smoothie_en', 'Smoothie', 'keyword', 'Alimentação', 'Lanchonete',
   ARRAY['smoothie', 'smoothies'],
   ARRAY['smoothie'], 0.88, 86,
   '{"type": "food", "subtype": "smoothie", "language": "en"}'),
   
  -- Meat / Carne
  ('meat_en', 'Meat', 'keyword', 'Alimentação', 'Churrascaria',
   ARRAY['meat', 'meats'],
   ARRAY['meat'], 0.86, 84,
   '{"type": "food", "subtype": "meat", "language": "en"}'),
   
  -- Fresh / Fresco
  ('fresh_en', 'Fresh', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['fresh'],
   ARRAY['fresh'], 0.80, 78,
   '{"type": "food", "subtype": "fresh", "language": "en"}'),
   
  -- Healthy / Saudável
  ('healthy_en', 'Healthy', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['healthy', 'health'],
   ARRAY['healthy', 'health'], 0.83, 81,
   '{"type": "food", "subtype": "healthy", "language": "en"}'),
   
  -- Organic / Orgânico
  ('organic_en', 'Organic', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['organic'],
   ARRAY['organic'], 0.84, 82,
   '{"type": "food", "subtype": "organic", "language": "en"}'),
   
  -- Vegan / Vegano
  ('vegan_en', 'Vegan', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['vegan'],
   ARRAY['vegan'], 0.89, 87,
   '{"type": "food", "subtype": "vegan", "language": "en"}'),
   
  -- Salad / Salada
  ('salad_en', 'Salad', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['salad', 'salads'],
   ARRAY['salad'], 0.87, 85,
   '{"type": "food", "subtype": "salad", "language": "en"}'),
   
  -- Wrap
  ('wrap_en', 'Wrap', 'keyword', 'Alimentação', 'Lanchonete',
   ARRAY['wrap', 'wraps'],
   ARRAY['wrap'], 0.88, 86,
   '{"type": "food", "subtype": "wrap", "language": "en"}'),
   
  -- Poke / Poke Bowl
  ('poke_en', 'Poke', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['poke', 'poke bowl'],
   ARRAY['poke'], 0.91, 89,
   '{"type": "food", "subtype": "poke", "language": "en"}'),
   
  -- Bowl
  ('bowl_en', 'Bowl', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['bowl', 'bowls'],
   ARRAY['bowl'], 0.85, 83,
   '{"type": "food", "subtype": "bowl", "language": "en"}'),
   
  -- Street Food
  ('street_food_en', 'Street Food', 'keyword', 'Alimentação', 'Lanchonete',
   ARRAY['street food', 'streetfood'],
   ARRAY['street food'], 0.87, 85,
   '{"type": "food", "subtype": "street_food", "language": "en"}'),
   
  -- Donuts / Rosquinhas
  ('donuts_en', 'Donuts', 'keyword', 'Alimentação', 'Confeitaria',
   ARRAY['donuts', 'donut', 'doughnut'],
   ARRAY['donuts', 'donut'], 0.91, 89,
   '{"type": "food", "subtype": "donuts", "language": "en"}'),
   
  -- Cookies / Biscoitos
  ('cookies_en', 'Cookies', 'keyword', 'Alimentação', 'Confeitaria',
   ARRAY['cookies', 'cookie'],
   ARRAY['cookies', 'cookie'], 0.88, 86,
   '{"type": "food", "subtype": "cookies", "language": "en"}'),
   
  -- Brownies
  ('brownies_en', 'Brownies', 'keyword', 'Alimentação', 'Confeitaria',
   ARRAY['brownies', 'brownie'],
   ARRAY['brownies', 'brownie'], 0.89, 87,
   '{"type": "food", "subtype": "brownies", "language": "en"}'),
   
  -- Pie / Torta
  ('pie_en', 'Pie', 'keyword', 'Alimentação', 'Confeitaria',
   ARRAY['pie', 'pies'],
   ARRAY['pie'], 0.87, 85,
   '{"type": "food", "subtype": "pie", "language": "en"}'),
   
  -- Cheesecake
  ('cheesecake_en', 'Cheesecake', 'keyword', 'Alimentação', 'Confeitaria',
   ARRAY['cheesecake', 'cheesecakes'],
   ARRAY['cheesecake'], 0.90, 88,
   '{"type": "food", "subtype": "cheesecake", "language": "en"}'),
   
  -- Wine / Vinho
  ('wine_en', 'Wine', 'keyword', 'Alimentação', 'Bar / Petiscaria',
   ARRAY['wine', 'wines', 'winery'],
   ARRAY['wine', 'winery'], 0.88, 86,
   '{"type": "food", "subtype": "wine", "language": "en"}'),
   
  -- Brewery / Cervejaria
  ('brewery_en', 'Brewery', 'keyword', 'Alimentação', 'Bar / Petiscaria',
   ARRAY['brewery', 'breweries', 'brew'],
   ARRAY['brewery', 'brew'], 0.91, 89,
   '{"type": "food", "subtype": "brewery", "language": "en"}'),
   
  -- Brunch
  ('brunch_en', 'Brunch', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['brunch'],
   ARRAY['brunch'], 0.89, 87,
   '{"type": "food", "subtype": "brunch", "language": "en"}'),
   
  -- Restaurant / Restaurante
  ('restaurant_en', 'Restaurant', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['restaurant', 'restaurants'],
   ARRAY['restaurant'], 0.87, 85,
   '{"type": "food", "subtype": "restaurant", "language": "en"}'),
   
  -- Eatery / Restaurante
  ('eatery_en', 'Eatery', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['eatery', 'eateries'],
   ARRAY['eatery'], 0.86, 84,
   '{"type": "food", "subtype": "eatery", "language": "en"}'),
   
  -- Dining / Restaurante
  ('dining_en', 'Dining', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['dining', 'dine'],
   ARRAY['dining', 'dine'], 0.84, 82,
   '{"type": "food", "subtype": "dining", "language": "en"}'),
   
  -- Chef / Chef
  ('chef_en', 'Chef', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['chef', 'chefs'],
   ARRAY['chef'], 0.85, 83,
   '{"type": "food", "subtype": "chef", "language": "en"}'),
   
  -- Taco / Taco
  ('taco_en', 'Taco', 'keyword', 'Alimentação', 'Mexicana',
   ARRAY['taco', 'tacos'],
   ARRAY['taco'], 0.91, 89,
   '{"type": "food", "subtype": "mexican", "language": "en"}'),
   
  -- Burrito
  ('burrito_en', 'Burrito', 'keyword', 'Alimentação', 'Mexicana',
   ARRAY['burrito', 'burritos'],
   ARRAY['burrito'], 0.90, 88,
   '{"type": "food", "subtype": "mexican", "language": "en"}'),
   
  -- Pasta / Massa
  ('pasta_en', 'Pasta', 'keyword', 'Alimentação', 'Italiana',
   ARRAY['pasta', 'pastas'],
   ARRAY['pasta'], 0.89, 87,
   '{"type": "food", "subtype": "italian", "language": "en"}'),
   
  -- Trattoria / Tratoria
  ('trattoria_en', 'Trattoria', 'keyword', 'Alimentação', 'Italiana',
   ARRAY['trattoria', 'tratoria'],
   ARRAY['trattoria'], 0.91, 89,
   '{"type": "food", "subtype": "italian", "language": "en"}'),
   
  -- Seafood / Frutos do Mar
  ('seafood_en', 'Seafood', 'keyword', 'Alimentação', 'Frutos do Mar',
   ARRAY['seafood', 'fish'],
   ARRAY['seafood', 'fish'], 0.90, 88,
   '{"type": "food", "subtype": "seafood", "language": "en"}'),
   
  -- Rotisserie / Rotisseria
  ('rotisserie_en', 'Rotisserie', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['rotisserie'],
   ARRAY['rotisserie'], 0.88, 86,
   '{"type": "food", "subtype": "rotisserie", "language": "en"}'),
   
  -- Fried / Frito
  ('fried_en', 'Fried', 'keyword', 'Alimentação', 'Lanchonete',
   ARRAY['fried'],
   ARRAY['fried'], 0.84, 82,
   '{"type": "food", "subtype": "fried", "language": "en"}'),
   
  -- Grill & Bar
  ('grill_bar_en', 'Grill & Bar', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['grill bar', 'grill and bar'],
   ARRAY['grill bar'], 0.88, 86,
   '{"type": "food", "subtype": "grill_bar", "language": "en"}'),
   
  -- Tapas
  ('tapas_en', 'Tapas', 'keyword', 'Alimentação', 'Bar / Petiscaria',
   ARRAY['tapas'],
   ARRAY['tapas'], 0.89, 87,
   '{"type": "food", "subtype": "tapas", "language": "en"}'),
   
  -- Appetizer / Aperitivo
  ('appetizer_en', 'Appetizer', 'keyword', 'Alimentação', 'Bar / Petiscaria',
   ARRAY['appetizer', 'appetizers'],
   ARRAY['appetizer'], 0.85, 83,
   '{"type": "food", "subtype": "appetizer", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: BEM ESTAR / BELEZA (Beauty & Wellness)
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Spa
  ('spa_en', 'Spa', 'keyword', 'Bem Estar / Beleza', 'Spa',
   ARRAY['spa', 'spas'],
   ARRAY['spa'], 0.93, 91,
   '{"type": "beauty", "subtype": "spa", "language": "en"}'),
   
  -- Salon / Salão
  ('salon_en', 'Salon', 'keyword', 'Bem Estar / Beleza', 'Salão de Beleza',
   ARRAY['salon', 'salons', 'hair salon'],
   ARRAY['salon'], 0.91, 89,
   '{"type": "beauty", "subtype": "salon", "language": "en"}'),
   
  -- Beauty / Beleza
  ('beauty_en', 'Beauty', 'keyword', 'Bem Estar / Beleza', 'Estética',
   ARRAY['beauty'],
   ARRAY['beauty'], 0.87, 85,
   '{"type": "beauty", "subtype": "beauty", "language": "en"}'),
   
  -- Nails / Unhas
  ('nails_en', 'Nails', 'keyword', 'Bem Estar / Beleza', 'Manicure / Pedicure',
   ARRAY['nails', 'nail'],
   ARRAY['nails', 'nail'], 0.91, 89,
   '{"type": "beauty", "subtype": "nails", "language": "en"}'),
   
  -- Hair / Cabelo
  ('hair_en', 'Hair', 'keyword', 'Bem Estar / Beleza', 'Salão de Beleza',
   ARRAY['hair'],
   ARRAY['hair'], 0.88, 86,
   '{"type": "beauty", "subtype": "hair", "language": "en"}'),
   
  -- Barber / Barbeiro
  ('barber_en', 'Barber', 'keyword', 'Bem Estar / Beleza', 'Barbearia',
   ARRAY['barber', 'barbershop', 'barber shop'],
   ARRAY['barber', 'barbershop'], 0.93, 91,
   '{"type": "beauty", "subtype": "barber", "language": "en"}'),
   
  -- Skin / Pele
  ('skin_en', 'Skin', 'keyword', 'Bem Estar / Beleza', 'Estética',
   ARRAY['skin', 'skincare'],
   ARRAY['skin', 'skincare'], 0.86, 84,
   '{"type": "beauty", "subtype": "skincare", "language": "en"}'),
   
  -- Massage / Massagem
  ('massage_en', 'Massage', 'keyword', 'Bem Estar / Beleza', 'Massagem',
   ARRAY['massage', 'massages'],
   ARRAY['massage'], 0.91, 89,
   '{"type": "beauty", "subtype": "massage", "language": "en"}'),
   
  -- Studio Beleza
  ('studio_beauty_en', 'Studio', 'keyword', 'Bem Estar / Beleza', 'Estética',
   ARRAY['studio'],
   ARRAY['studio'], 0.82, 80,
   '{"type": "beauty", "subtype": "studio", "language": "en"}'),
   
  -- Makeup / Maquiagem
  ('makeup_en', 'Makeup', 'keyword', 'Bem Estar / Beleza', 'Maquiagem',
   ARRAY['makeup', 'make up'],
   ARRAY['makeup'], 0.89, 87,
   '{"type": "beauty", "subtype": "makeup", "language": "en"}'),
   
  -- Wellness / Bem-estar
  ('wellness_en', 'Wellness', 'keyword', 'Bem Estar / Beleza', 'Spa',
   ARRAY['wellness'],
   ARRAY['wellness'], 0.87, 85,
   '{"type": "beauty", "subtype": "wellness", "language": "en"}'),
   
  -- Aesthetics / Estética
  ('aesthetics_en', 'Aesthetics', 'keyword', 'Bem Estar / Beleza', 'Estética',
   ARRAY['aesthetics', 'aesthetic'],
   ARRAY['aesthetics', 'aesthetic'], 0.88, 86,
   '{"type": "beauty", "subtype": "aesthetics", "language": "en"}'),
   
  -- Cosmetics / Cosméticos
  ('cosmetics_en', 'Cosmetics', 'keyword', 'Bem Estar / Beleza', 'Cosméticos',
   ARRAY['cosmetics', 'cosmetic'],
   ARRAY['cosmetics', 'cosmetic'], 0.87, 85,
   '{"type": "beauty", "subtype": "cosmetics", "language": "en"}'),
   
  -- Perfume / Perfume
  ('perfume_en', 'Perfume', 'keyword', 'Bem Estar / Beleza', 'Cosméticos',
   ARRAY['perfume', 'perfumes', 'fragrance'],
   ARRAY['perfume', 'fragrance'], 0.88, 86,
   '{"type": "beauty", "subtype": "perfume", "language": "en"}'),
   
  -- Style / Estilo
  ('style_beauty_en', 'Style', 'keyword', 'Bem Estar / Beleza', 'Salão de Beleza',
   ARRAY['style', 'styling'],
   ARRAY['style', 'styling'], 0.84, 82,
   '{"type": "beauty", "subtype": "style", "language": "en"}'),
   
  -- Laser
  ('laser_en', 'Laser', 'keyword', 'Bem Estar / Beleza', 'Depilação',
   ARRAY['laser'],
   ARRAY['laser'], 0.90, 88,
   '{"type": "beauty", "subtype": "laser", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: TRANSPORTE (Transportation)
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Parking / Estacionamento
  ('parking_en', 'Parking', 'keyword', 'Transporte', 'Estacionamento',
   ARRAY['parking', 'park'],
   ARRAY['parking', 'park'], 0.91, 89,
   '{"type": "transport", "subtype": "parking", "language": "en"}'),
   
  -- Gas Station / Posto
  ('gas_station_en', 'Gas Station', 'keyword', 'Transporte', 'Combustível',
   ARRAY['gas station', 'gasstation', 'gas'],
   ARRAY['gas station', 'gas'], 0.90, 88,
   '{"type": "transport", "subtype": "gas_station", "language": "en"}'),
   
  -- Fuel / Combustível
  ('fuel_en', 'Fuel', 'keyword', 'Transporte', 'Combustível',
   ARRAY['fuel', 'fueling'],
   ARRAY['fuel'], 0.89, 87,
   '{"type": "transport", "subtype": "fuel", "language": "en"}'),
   
  -- Car Wash / Lavagem
  ('car_wash_en', 'Car Wash', 'keyword', 'Transporte', 'Lavagem de Veículo',
   ARRAY['car wash', 'carwash'],
   ARRAY['car wash'], 0.92, 90,
   '{"type": "transport", "subtype": "car_wash", "language": "en"}'),
   
  -- Auto / Automóvel
  ('auto_en', 'Auto', 'keyword', 'Transporte', 'Manutenção Veicular',
   ARRAY['auto'],
   ARRAY['auto'], 0.84, 82,
   '{"type": "transport", "subtype": "auto", "language": "en"}'),
   
  -- Auto Center
  ('auto_center_en', 'Auto Center', 'keyword', 'Transporte', 'Manutenção Veicular',
   ARRAY['auto center', 'autocenter'],
   ARRAY['auto center'], 0.90, 88,
   '{"type": "transport", "subtype": "auto_center", "language": "en"}'),
   
  -- Car Service / Serviço Automotivo
  ('car_service_en', 'Car Service', 'keyword', 'Transporte', 'Manutenção Veicular',
   ARRAY['car service', 'carservice'],
   ARRAY['car service'], 0.89, 87,
   '{"type": "transport", "subtype": "car_service", "language": "en"}'),
   
  -- Tire / Pneu
  ('tire_en', 'Tire', 'keyword', 'Transporte', 'Manutenção Veicular',
   ARRAY['tire', 'tires'],
   ARRAY['tire', 'tires'], 0.88, 86,
   '{"type": "transport", "subtype": "tire", "language": "en"}'),
   
  -- Garage / Garagem
  ('garage_en', 'Garage', 'keyword', 'Transporte', 'Estacionamento',
   ARRAY['garage', 'garages'],
   ARRAY['garage'], 0.87, 85,
   '{"type": "transport", "subtype": "garage", "language": "en"}'),
   
  -- Drive / Motorista
  ('drive_en', 'Drive', 'keyword', 'Transporte', 'Transporte Privado',
   ARRAY['drive', 'driver'],
   ARRAY['drive', 'driver'], 0.80, 78,
   '{"type": "transport", "subtype": "drive", "language": "en"}'),
   
  -- Ride / Corrida
  ('ride_en', 'Ride', 'keyword', 'Transporte', 'Transporte por Aplicativo',
   ARRAY['ride', 'rides'],
   ARRAY['ride'], 0.85, 83,
   '{"type": "transport", "subtype": "ride", "language": "en"}'),
   
  -- Trip / Viagem/Corrida
  ('trip_en', 'Trip', 'keyword', 'Transporte', 'Transporte por Aplicativo',
   ARRAY['trip', 'trips'],
   ARRAY['trip'], 0.83, 81,
   '{"type": "transport", "subtype": "trip", "language": "en"}'),
   
  -- Car / Carro
  ('car_en', 'Car', 'keyword', 'Transporte', 'Veículos',
   ARRAY['car', 'cars'],
   ARRAY['car'], 0.82, 80,
   '{"type": "transport", "subtype": "car", "language": "en"}'),
   
  -- Moto / Motocicleta
  ('moto_en', 'Moto', 'keyword', 'Transporte', 'Motocicleta',
   ARRAY['moto', 'motorcycle', 'bike'],
   ARRAY['moto', 'motorcycle', 'bike'], 0.87, 85,
   '{"type": "transport", "subtype": "motorcycle", "language": "en"}'),
   
  -- Bus / Ônibus
  ('bus_en', 'Bus', 'keyword', 'Transporte', 'Transporte Público',
   ARRAY['bus', 'buses'],
   ARRAY['bus'], 0.91, 89,
   '{"type": "transport", "subtype": "bus", "language": "en"}'),
   
  -- Subway / Metrô
  ('subway_en', 'Subway', 'keyword', 'Transporte', 'Transporte Público',
   ARRAY['subway', 'metro'],
   ARRAY['subway', 'metro'], 0.92, 90,
   '{"type": "transport", "subtype": "subway", "language": "en"}'),
   
  -- Toll / Pedágio
  ('toll_en', 'Toll', 'keyword', 'Transporte', 'Pedágio',
   ARRAY['toll', 'tolls'],
   ARRAY['toll'], 0.93, 91,
   '{"type": "transport", "subtype": "toll", "language": "en"}'),
   
  -- Rental / Aluguel
  ('rental_en', 'Rental', 'keyword', 'Transporte', 'Aluguel de Veículo',
   ARRAY['rental', 'rentals', 'rent'],
   ARRAY['rental', 'rent'], 0.88, 86,
   '{"type": "transport", "subtype": "rental", "language": "en"}'),
   
  -- Cab / Táxi
  ('cab_en', 'Cab', 'keyword', 'Transporte', 'Táxi',
   ARRAY['cab', 'cabs'],
   ARRAY['cab'], 0.90, 88,
   '{"type": "transport", "subtype": "cab", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: EDUCAÇÃO (Education)
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- School / Escola
  ('school_en', 'School', 'keyword', 'Educação', 'Escola',
   ARRAY['school', 'schools'],
   ARRAY['school'], 0.91, 89,
   '{"type": "education", "subtype": "school", "language": "en"}'),
   
  -- College / Faculdade
  ('college_en', 'College', 'keyword', 'Educação', 'Faculdade',
   ARRAY['college', 'colleges'],
   ARRAY['college'], 0.92, 90,
   '{"type": "education", "subtype": "college", "language": "en"}'),
   
  -- Course / Curso
  ('course_en', 'Course', 'keyword', 'Educação', 'Cursos',
   ARRAY['course', 'courses'],
   ARRAY['course'], 0.88, 86,
   '{"type": "education", "subtype": "course", "language": "en"}'),
   
  -- Academy / Academia (educacional)
  ('academy_en', 'Academy', 'keyword', 'Educação', 'Cursos',
   ARRAY['academy', 'academies'],
   ARRAY['academy'], 0.87, 85,
   '{"type": "education", "subtype": "academy", "language": "en"}'),
   
  -- Learning / Aprendizado
  ('learning_en', 'Learning', 'keyword', 'Educação', 'Cursos',
   ARRAY['learning', 'learn'],
   ARRAY['learning', 'learn'], 0.84, 82,
   '{"type": "education", "subtype": "learning", "language": "en"}'),
   
  -- Training / Treinamento
  ('training_en', 'Training', 'keyword', 'Educação', 'Cursos',
   ARRAY['training', 'train'],
   ARRAY['training', 'train'], 0.85, 83,
   '{"type": "education", "subtype": "training", "language": "en"}'),
   
  -- English / Inglês
  ('english_en', 'English', 'keyword', 'Educação', 'Idiomas',
   ARRAY['english'],
   ARRAY['english'], 0.90, 88,
   '{"type": "education", "subtype": "language", "language": "en"}'),
   
  -- Language / Idioma
  ('language_en', 'Language', 'keyword', 'Educação', 'Idiomas',
   ARRAY['language', 'languages'],
   ARRAY['language'], 0.87, 85,
   '{"type": "education", "subtype": "language", "language": "en"}'),
   
  -- University / Universidade
  ('university_en', 'University', 'keyword', 'Educação', 'Universidade',
   ARRAY['university', 'universities'],
   ARRAY['university'], 0.92, 90,
   '{"type": "education", "subtype": "university", "language": "en"}'),
   
  -- Institute / Instituto
  ('institute_en', 'Institute', 'keyword', 'Educação', 'Cursos',
   ARRAY['institute', 'institutes'],
   ARRAY['institute'], 0.88, 86,
   '{"type": "education", "subtype": "institute", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: LAZER / ENTRETENIMENTO (Entertainment & Leisure)
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Gym / Academia
  ('gym_en', 'Gym', 'keyword', 'Lazer', 'Academia',
   ARRAY['gym', 'gyms'],
   ARRAY['gym'], 0.93, 91,
   '{"type": "entertainment", "subtype": "gym", "language": "en"}'),
   
  -- Fitness / Fitness
  ('fitness_en', 'Fitness', 'keyword', 'Lazer', 'Academia',
   ARRAY['fitness'],
   ARRAY['fitness'], 0.91, 89,
   '{"type": "entertainment", "subtype": "fitness", "language": "en"}'),
   
  -- Crossfit
  ('crossfit_en', 'Crossfit', 'keyword', 'Lazer', 'Academia',
   ARRAY['crossfit', 'cross fit'],
   ARRAY['crossfit'], 0.93, 91,
   '{"type": "entertainment", "subtype": "crossfit", "language": "en"}'),
   
  -- Yoga
  ('yoga_en', 'Yoga', 'keyword', 'Lazer', 'Yoga',
   ARRAY['yoga'],
   ARRAY['yoga'], 0.92, 90,
   '{"type": "entertainment", "subtype": "yoga", "language": "en"}'),
   
  -- Pilates
  ('pilates_en', 'Pilates', 'keyword', 'Lazer', 'Pilates',
   ARRAY['pilates'],
   ARRAY['pilates'], 0.93, 91,
   '{"type": "entertainment", "subtype": "pilates", "language": "en"}'),
   
  -- Studio Fitness
  ('studio_fitness_en', 'Studio', 'keyword', 'Lazer', 'Academia',
   ARRAY['studio'],
   ARRAY['studio'], 0.82, 80,
   '{"type": "entertainment", "subtype": "studio", "language": "en"}'),
   
  -- Training Center
  ('training_center_en', 'Training Center', 'keyword', 'Lazer', 'Academia',
   ARRAY['training center', 'trainingcenter'],
   ARRAY['training center'], 0.88, 86,
   '{"type": "entertainment", "subtype": "training_center", "language": "en"}'),
   
  -- Club / Clube
  ('club_en', 'Club', 'keyword', 'Lazer', 'Clubes',
   ARRAY['club', 'clubs'],
   ARRAY['club'], 0.85, 83,
   '{"type": "entertainment", "subtype": "club", "language": "en"}'),
   
  -- Sports / Esportes
  ('sports_en', 'Sports', 'keyword', 'Lazer', 'Esportes',
   ARRAY['sports', 'sport'],
   ARRAY['sports', 'sport'], 0.86, 84,
   '{"type": "entertainment", "subtype": "sports", "language": "en"}'),
   
  -- Games / Jogos
  ('games_en', 'Games', 'keyword', 'Lazer', 'Jogos',
   ARRAY['games', 'game', 'gaming'],
   ARRAY['games', 'game', 'gaming'], 0.87, 85,
   '{"type": "entertainment", "subtype": "games", "language": "en"}'),
   
  -- Play / Diversão
  ('play_en', 'Play', 'keyword', 'Lazer', 'Entretenimento',
   ARRAY['play'],
   ARRAY['play'], 0.78, 76,
   '{"type": "entertainment", "subtype": "play", "language": "en"}'),
   
  -- Fun / Diversão
  ('fun_en', 'Fun', 'keyword', 'Lazer', 'Entretenimento',
   ARRAY['fun'],
   ARRAY['fun'], 0.77, 75,
   '{"type": "entertainment", "subtype": "fun", "language": "en"}'),
   
  -- Park / Parque
  ('park_en', 'Park', 'keyword', 'Lazer', 'Parques',
   ARRAY['park', 'parks'],
   ARRAY['park'], 0.84, 82,
   '{"type": "entertainment", "subtype": "park", "language": "en"}'),
   
  -- Cinema
  ('cinema_en', 'Cinema', 'keyword', 'Lazer', 'Cinema',
   ARRAY['cinema', 'cinemas', 'movie'],
   ARRAY['cinema', 'movie'], 0.92, 90,
   '{"type": "entertainment", "subtype": "cinema", "language": "en"}'),
   
  -- Theater / Teatro
  ('theater_en', 'Theater', 'keyword', 'Lazer', 'Teatro',
   ARRAY['theater', 'theatre'],
   ARRAY['theater', 'theatre'], 0.90, 88,
   '{"type": "entertainment", "subtype": "theater", "language": "en"}'),
   
  -- Bowling / Boliche
  ('bowling_en', 'Bowling', 'keyword', 'Lazer', 'Boliche',
   ARRAY['bowling'],
   ARRAY['bowling'], 0.92, 90,
   '{"type": "entertainment", "subtype": "bowling", "language": "en"}'),
   
  -- Arena
  ('arena_en', 'Arena', 'keyword', 'Lazer', 'Entretenimento',
   ARRAY['arena', 'arenas'],
   ARRAY['arena'], 0.88, 86,
   '{"type": "entertainment", "subtype": "arena", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: COMPRAS / SHOPPING
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Shop / Loja
  ('shop_en', 'Shop', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['shop', 'shops'],
   ARRAY['shop'], 0.86, 84,
   '{"type": "shopping", "subtype": "shop", "language": "en"}'),
   
  -- Store / Loja
  ('store_en', 'Store', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['store', 'stores'],
   ARRAY['store'], 0.87, 85,
   '{"type": "shopping", "subtype": "store", "language": "en"}'),
   
  -- Market / Mercado
  ('market_en', 'Market', 'keyword', 'Alimentação', 'Supermercado',
   ARRAY['market', 'markets', 'supermarket'],
   ARRAY['market', 'supermarket'], 0.89, 87,
   '{"type": "shopping", "subtype": "market", "language": "en"}'),
   
  -- Mall / Shopping
  ('mall_en', 'Mall', 'keyword', 'Presentes / Compras', 'Shopping',
   ARRAY['mall', 'malls', 'shopping mall'],
   ARRAY['mall', 'shopping mall'], 0.91, 89,
   '{"type": "shopping", "subtype": "mall", "language": "en"}'),
   
  -- Fashion / Moda
  ('fashion_en', 'Fashion', 'keyword', 'Roupas e acessórios', 'Moda',
   ARRAY['fashion'],
   ARRAY['fashion'], 0.87, 85,
   '{"type": "shopping", "subtype": "fashion", "language": "en"}'),
   
  -- Boutique / Butique
  ('boutique_en', 'Boutique', 'keyword', 'Roupas e acessórios', 'Boutique',
   ARRAY['boutique', 'boutiques'],
   ARRAY['boutique'], 0.89, 87,
   '{"type": "shopping", "subtype": "boutique", "language": "en"}'),
   
  -- Express / Expresso
  ('express_en', 'Express', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['express'],
   ARRAY['express'], 0.80, 78,
   '{"type": "shopping", "subtype": "express", "language": "en"}'),
   
  -- Mini Market
  ('mini_market_en', 'Mini Market', 'keyword', 'Alimentação', 'Conveniência',
   ARRAY['mini market', 'minimarket'],
   ARRAY['mini market'], 0.88, 86,
   '{"type": "shopping", "subtype": "convenience", "language": "en"}'),
   
  -- Mega / Mega Loja
  ('mega_en', 'Mega', 'keyword', 'Alimentação', 'Hipermercado',
   ARRAY['mega'],
   ARRAY['mega'], 0.82, 80,
   '{"type": "shopping", "subtype": "mega", "language": "en"}'),
   
  -- Plus / Mais
  ('plus_en', 'Plus', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['plus'],
   ARRAY['plus'], 0.75, 73,
   '{"type": "shopping", "subtype": "plus", "language": "en"}'),
   
  -- Outlet
  ('outlet_en', 'Outlet', 'keyword', 'Roupas e acessórios', 'Outlet',
   ARRAY['outlet', 'outlets'],
   ARRAY['outlet'], 0.90, 88,
   '{"type": "shopping", "subtype": "outlet", "language": "en"}'),
   
  -- Factory / Fábrica
  ('factory_en', 'Factory', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['factory'],
   ARRAY['factory'], 0.84, 82,
   '{"type": "shopping", "subtype": "factory", "language": "en"}'),
   
  -- Trade / Comércio
  ('trade_en', 'Trade', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['trade'],
   ARRAY['trade'], 0.81, 79,
   '{"type": "shopping", "subtype": "trade", "language": "en"}'),
   
  -- Department Store
  ('department_store_en', 'Department Store', 'keyword', 'Presentes / Compras', 'Loja de Departamento',
   ARRAY['department store', 'departmentstore'],
   ARRAY['department store'], 0.90, 88,
   '{"type": "shopping", "subtype": "department", "language": "en"}'),
   
  -- Bazaar / Bazar
  ('bazaar_en', 'Bazaar', 'keyword', 'Presentes / Compras', 'Bazar',
   ARRAY['bazaar', 'bazar'],
   ARRAY['bazaar', 'bazar'], 0.86, 84,
   '{"type": "shopping", "subtype": "bazaar", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: SAÚDE (Health)
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Health / Saúde
  ('health_en', 'Health', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Clínica',
   ARRAY['health'],
   ARRAY['health'], 0.88, 86,
   '{"type": "health", "subtype": "health", "language": "en"}'),
   
  -- Medical / Médico
  ('medical_en', 'Medical', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Clínica',
   ARRAY['medical'],
   ARRAY['medical'], 0.90, 88,
   '{"type": "health", "subtype": "medical", "language": "en"}'),
   
  -- Clinic / Clínica
  ('clinic_en', 'Clinic', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Clínica',
   ARRAY['clinic', 'clinics'],
   ARRAY['clinic'], 0.92, 90,
   '{"type": "health", "subtype": "clinic", "language": "en"}'),
   
  -- Hospital
  ('hospital_en', 'Hospital', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Hospital',
   ARRAY['hospital', 'hospitals'],
   ARRAY['hospital'], 0.94, 92,
   '{"type": "health", "subtype": "hospital", "language": "en"}'),
   
  -- Dental / Dentista
  ('dental_en', 'Dental', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Odontologia',
   ARRAY['dental', 'dentist'],
   ARRAY['dental', 'dentist'], 0.91, 89,
   '{"type": "health", "subtype": "dental", "language": "en"}'),
   
  -- Pharmacy / Farmácia
  ('pharmacy_en', 'Pharmacy', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia',
   ARRAY['pharmacy', 'pharmacies'],
   ARRAY['pharmacy'], 0.93, 91,
   '{"type": "health", "subtype": "pharmacy", "language": "en"}'),
   
  -- Lab / Laboratório
  ('lab_en', 'Lab', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório',
   ARRAY['lab', 'labs', 'laboratory'],
   ARRAY['lab', 'laboratory'], 0.90, 88,
   '{"type": "health", "subtype": "lab", "language": "en"}'),
   
  -- Care / Cuidado
  ('care_en', 'Care', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Clínica',
   ARRAY['care'],
   ARRAY['care'], 0.84, 82,
   '{"type": "health", "subtype": "care", "language": "en"}'),
   
  -- Doctor / Médico
  ('doctor_en', 'Doctor', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Consultório',
   ARRAY['doctor', 'dr'],
   ARRAY['doctor'], 0.89, 87,
   '{"type": "health", "subtype": "doctor", "language": "en"}'),
   
  -- Therapy / Terapia
  ('therapy_en', 'Therapy', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Terapia',
   ARRAY['therapy', 'therapies'],
   ARRAY['therapy'], 0.88, 86,
   '{"type": "health", "subtype": "therapy", "language": "en"}'),
   
  -- Physio / Fisioterapia
  ('physio_en', 'Physio', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Fisioterapia',
   ARRAY['physio', 'physiotherapy'],
   ARRAY['physio', 'physiotherapy'], 0.90, 88,
   '{"type": "health", "subtype": "physio", "language": "en"}'),
   
  -- Emergency / Emergência
  ('emergency_en', 'Emergency', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Emergência',
   ARRAY['emergency'],
   ARRAY['emergency'], 0.92, 90,
   '{"type": "health", "subtype": "emergency", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: PET
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Pet / Animal de estimação
  ('pet_en', 'Pet', 'keyword', 'Pet', 'Pet Shop',
   ARRAY['pet', 'pets'],
   ARRAY['pet'], 0.91, 89,
   '{"type": "pet", "subtype": "pet", "language": "en"}'),
   
  -- Pet Shop
  ('pet_shop_en', 'Pet Shop', 'keyword', 'Pet', 'Pet Shop',
   ARRAY['pet shop', 'petshop'],
   ARRAY['pet shop'], 0.93, 91,
   '{"type": "pet", "subtype": "pet_shop", "language": "en"}'),
   
  -- Dog / Cachorro
  ('dog_en', 'Dog', 'keyword', 'Pet', 'Pet Shop',
   ARRAY['dog', 'dogs'],
   ARRAY['dog'], 0.88, 86,
   '{"type": "pet", "subtype": "dog", "language": "en"}'),
   
  -- Cat / Gato
  ('cat_en', 'Cat', 'keyword', 'Pet', 'Pet Shop',
   ARRAY['cat', 'cats'],
   ARRAY['cat'], 0.88, 86,
   '{"type": "pet", "subtype": "cat", "language": "en"}'),
   
  -- Vet / Veterinário
  ('vet_en', 'Vet', 'keyword', 'Pet', 'Veterinária',
   ARRAY['vet', 'veterinary'],
   ARRAY['vet', 'veterinary'], 0.92, 90,
   '{"type": "pet", "subtype": "vet", "language": "en"}'),
   
  -- Animal
  ('animal_en', 'Animal', 'keyword', 'Pet', 'Pet Shop',
   ARRAY['animal', 'animals'],
   ARRAY['animal'], 0.85, 83,
   '{"type": "pet", "subtype": "animal", "language": "en"}'),
   
  -- Grooming / Banho e Tosa
  ('grooming_en', 'Grooming', 'keyword', 'Pet', 'Banho e Tosa',
   ARRAY['grooming'],
   ARRAY['grooming'], 0.91, 89,
   '{"type": "pet", "subtype": "grooming", "language": "en"}'),
   
  -- Puppy / Filhote
  ('puppy_en', 'Puppy', 'keyword', 'Pet', 'Pet Shop',
   ARRAY['puppy', 'puppies'],
   ARRAY['puppy'], 0.87, 85,
   '{"type": "pet", "subtype": "puppy", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: CASA / HOME
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Home / Casa
  ('home_en', 'Home', 'keyword', 'Casa', 'Decoração',
   ARRAY['home'],
   ARRAY['home'], 0.85, 83,
   '{"type": "home", "subtype": "home", "language": "en"}'),
   
  -- House / Casa
  ('house_en', 'House', 'keyword', 'Casa', 'Manutenção',
   ARRAY['house'],
   ARRAY['house'], 0.84, 82,
   '{"type": "home", "subtype": "house", "language": "en"}'),
   
  -- Decor / Decoração
  ('decor_en', 'Decor', 'keyword', 'Casa', 'Decoração',
   ARRAY['decor', 'decoration'],
   ARRAY['decor', 'decoration'], 0.88, 86,
   '{"type": "home", "subtype": "decor", "language": "en"}'),
   
  -- Furniture / Móveis
  ('furniture_en', 'Furniture', 'keyword', 'Casa', 'Móveis',
   ARRAY['furniture'],
   ARRAY['furniture'], 0.91, 89,
   '{"type": "home", "subtype": "furniture", "language": "en"}'),
   
  -- Garden / Jardim
  ('garden_en', 'Garden', 'keyword', 'Casa', 'Jardinagem',
   ARRAY['garden', 'gardens'],
   ARRAY['garden'], 0.89, 87,
   '{"type": "home", "subtype": "garden", "language": "en"}'),
   
  -- Hardware / Ferragens
  ('hardware_en', 'Hardware', 'keyword', 'Casa', 'Ferragens',
   ARRAY['hardware'],
   ARRAY['hardware'], 0.87, 85,
   '{"type": "home", "subtype": "hardware", "language": "en"}'),
   
  -- Build / Construção
  ('build_en', 'Build', 'keyword', 'Casa', 'Construção',
   ARRAY['build', 'building'],
   ARRAY['build', 'building'], 0.84, 82,
   '{"type": "home", "subtype": "build", "language": "en"}'),
   
  -- Clean / Limpeza
  ('clean_en', 'Clean', 'keyword', 'Casa', 'Limpeza',
   ARRAY['clean', 'cleaning'],
   ARRAY['clean', 'cleaning'], 0.86, 84,
   '{"type": "home", "subtype": "clean", "language": "en"}'),
   
  -- Kitchen Home
  ('kitchen_home_en', 'Kitchen', 'keyword', 'Casa', 'Cozinha',
   ARRAY['kitchen'],
   ARRAY['kitchen'], 0.83, 81,
   '{"type": "home", "subtype": "kitchen", "language": "en"}'),
   
  -- Bed / Cama
  ('bed_en', 'Bed', 'keyword', 'Casa', 'Móveis',
   ARRAY['bed', 'beds'],
   ARRAY['bed'], 0.86, 84,
   '{"type": "home", "subtype": "bed", "language": "en"}'),
   
  -- Bath / Banho
  ('bath_en', 'Bath', 'keyword', 'Casa', 'Banheiro',
   ARRAY['bath', 'bathroom'],
   ARRAY['bath', 'bathroom'], 0.84, 82,
   '{"type": "home", "subtype": "bath", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: SERVIÇOS / TECNOLOGIA (Services & Technology)
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Tech / Tecnologia
  ('tech_en', 'Tech', 'keyword', 'Presentes / Compras', 'Eletrônicos',
   ARRAY['tech', 'technology'],
   ARRAY['tech', 'technology'], 0.88, 86,
   '{"type": "tech", "subtype": "tech", "language": "en"}'),
   
  -- Digital / Digital
  ('digital_en', 'Digital', 'keyword', 'Assinaturas', 'Digital',
   ARRAY['digital'],
   ARRAY['digital'], 0.85, 83,
   '{"type": "tech", "subtype": "digital", "language": "en"}'),
   
  -- Computer / Computador
  ('computer_en', 'Computer', 'keyword', 'Presentes / Compras', 'Eletrônicos',
   ARRAY['computer', 'computers'],
   ARRAY['computer'], 0.90, 88,
   '{"type": "tech", "subtype": "computer", "language": "en"}'),
   
  -- Phone / Telefone
  ('phone_en', 'Phone', 'keyword', 'Presentes / Compras', 'Eletrônicos',
   ARRAY['phone', 'phones'],
   ARRAY['phone'], 0.87, 85,
   '{"type": "tech", "subtype": "phone", "language": "en"}'),
   
  -- Mobile / Móvel
  ('mobile_en', 'Mobile', 'keyword', 'Presentes / Compras', 'Eletrônicos',
   ARRAY['mobile'],
   ARRAY['mobile'], 0.86, 84,
   '{"type": "tech", "subtype": "mobile", "language": "en"}'),
   
  -- Service / Serviço
  ('service_en', 'Service', 'keyword', 'Diarista / Prestadores Serv.', 'Serviços',
   ARRAY['service', 'services'],
   ARRAY['service'], 0.78, 76,
   '{"type": "service", "subtype": "service", "language": "en"}'),
   
  -- Center / Centro
  ('center_en', 'Center', 'keyword', 'Diarista / Prestadores Serv.', 'Serviços',
   ARRAY['center', 'centre'],
   ARRAY['center', 'centre'], 0.77, 75,
   '{"type": "service", "subtype": "center", "language": "en"}'),
   
  -- Smart / Inteligente
  ('smart_en', 'Smart', 'keyword', 'Presentes / Compras', 'Eletrônicos',
   ARRAY['smart'],
   ARRAY['smart'], 0.83, 81,
   '{"type": "tech", "subtype": "smart", "language": "en"}'),
   
  -- Print / Impressão
  ('print_en', 'Print', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Impressão',
   ARRAY['print', 'printing'],
   ARRAY['print', 'printing'], 0.88, 86,
   '{"type": "service", "subtype": "print", "language": "en"}'),
   
  -- Copy / Cópia
  ('copy_en', 'Copy', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Material de Escritório',
   ARRAY['copy', 'copies'],
   ARRAY['copy'], 0.85, 83,
   '{"type": "service", "subtype": "copy", "language": "en"}'),
   
  -- Photo / Foto
  ('photo_en', 'Photo', 'keyword', 'Lazer', 'Fotografia',
   ARRAY['photo', 'photos', 'photography'],
   ARRAY['photo', 'photography'], 0.89, 87,
   '{"type": "service", "subtype": "photo", "language": "en"}'),
   
  -- Video / Vídeo
  ('video_en', 'Video', 'keyword', 'Lazer', 'Vídeo',
   ARRAY['video', 'videos'],
   ARRAY['video'], 0.87, 85,
   '{"type": "service", "subtype": "video", "language": "en"}'),
   
  -- Web
  ('web_en', 'Web', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Serviços',
   ARRAY['web'],
   ARRAY['web'], 0.84, 82,
   '{"type": "tech", "subtype": "web", "language": "en"}'),
   
  -- Software
  ('software_en', 'Software', 'keyword', 'Assinaturas', 'Software / SaaS',
   ARRAY['software'],
   ARRAY['software'], 0.88, 86,
   '{"type": "tech", "subtype": "software", "language": "en"}'),
   
  -- Cloud
  ('cloud_en', 'Cloud', 'keyword', 'Assinaturas', 'Armazenamento Cloud',
   ARRAY['cloud'],
   ARRAY['cloud'], 0.89, 87,
   '{"type": "tech", "subtype": "cloud", "language": "en"}'),
   
  -- App / Aplicativo
  ('app_en', 'App', 'keyword', 'Assinaturas', 'Software / SaaS',
   ARRAY['app', 'apps'],
   ARRAY['app'], 0.85, 83,
   '{"type": "tech", "subtype": "app", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: VESTUÁRIO / FASHION (Clothing)
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Wear / Vestuário
  ('wear_en', 'Wear', 'keyword', 'Roupas e acessórios', 'Vestuário',
   ARRAY['wear'],
   ARRAY['wear'], 0.83, 81,
   '{"type": "fashion", "subtype": "wear", "language": "en"}'),
   
  -- Style / Estilo
  ('style_fashion_en', 'Style', 'keyword', 'Roupas e acessórios', 'Moda',
   ARRAY['style', 'styles'],
   ARRAY['style'], 0.82, 80,
   '{"type": "fashion", "subtype": "style", "language": "en"}'),
   
  -- Clothes / Roupas
  ('clothes_en', 'Clothes', 'keyword', 'Roupas e acessórios', 'Vestuário',
   ARRAY['clothes', 'clothing'],
   ARRAY['clothes', 'clothing'], 0.88, 86,
   '{"type": "fashion", "subtype": "clothes", "language": "en"}'),
   
  -- Jeans
  ('jeans_en', 'Jeans', 'keyword', 'Roupas e acessórios', 'Vestuário',
   ARRAY['jeans'],
   ARRAY['jeans'], 0.89, 87,
   '{"type": "fashion", "subtype": "jeans", "language": "en"}'),
   
  -- Shoes / Sapatos
  ('shoes_en', 'Shoes', 'keyword', 'Roupas e acessórios', 'Calçados',
   ARRAY['shoes', 'shoe'],
   ARRAY['shoes', 'shoe'], 0.91, 89,
   '{"type": "fashion", "subtype": "shoes", "language": "en"}'),
   
  -- Sneakers / Tênis
  ('sneakers_en', 'Sneakers', 'keyword', 'Roupas e acessórios', 'Calçados',
   ARRAY['sneakers', 'sneaker'],
   ARRAY['sneakers', 'sneaker'], 0.91, 89,
   '{"type": "fashion", "subtype": "sneakers", "language": "en"}'),
   
  -- Sport Fashion
  ('sport_fashion_en', 'Sport', 'keyword', 'Roupas e acessórios', 'Vestuário Esportivo',
   ARRAY['sport'],
   ARRAY['sport'], 0.84, 82,
   '{"type": "fashion", "subtype": "sport", "language": "en"}'),
   
  -- Kids / Infantil
  ('kids_en', 'Kids', 'keyword', 'Filhos / Dependentes', 'Infantil',
   ARRAY['kids', 'kid'],
   ARRAY['kids', 'kid'], 0.88, 86,
   '{"type": "fashion", "subtype": "kids", "language": "en"}'),
   
  -- Baby / Bebê
  ('baby_en', 'Baby', 'keyword', 'Filhos / Dependentes', 'Bebê',
   ARRAY['baby', 'babies'],
   ARRAY['baby'], 0.90, 88,
   '{"type": "fashion", "subtype": "baby", "language": "en"}'),
   
  -- Men / Masculino
  ('men_en', 'Men', 'keyword', 'Roupas e acessórios', 'Vestuário',
   ARRAY['men', 'mens'],
   ARRAY['men'], 0.85, 83,
   '{"type": "fashion", "subtype": "men", "language": "en"}'),
   
  -- Women / Feminino
  ('women_en', 'Women', 'keyword', 'Roupas e acessórios', 'Vestuário',
   ARRAY['women', 'womens'],
   ARRAY['women'], 0.85, 83,
   '{"type": "fashion", "subtype": "women", "language": "en"}'),
   
  -- Bags / Bolsas
  ('bags_en', 'Bags', 'keyword', 'Roupas e acessórios', 'Acessórios',
   ARRAY['bags', 'bag'],
   ARRAY['bags', 'bag'], 0.87, 85,
   '{"type": "fashion", "subtype": "bags", "language": "en"}'),
   
  -- Watch / Relógio
  ('watch_en', 'Watch', 'keyword', 'Roupas e acessórios', 'Relógios',
   ARRAY['watch', 'watches'],
   ARRAY['watch'], 0.89, 87,
   '{"type": "fashion", "subtype": "watch", "language": "en"}'),
   
  -- Accessories / Acessórios
  ('accessories_en', 'Accessories', 'keyword', 'Roupas e acessórios', 'Acessórios',
   ARRAY['accessories', 'accessory'],
   ARRAY['accessories', 'accessory'], 0.87, 85,
   '{"type": "fashion", "subtype": "accessories", "language": "en"}'),
   
  -- Jewelry / Joias
  ('jewelry_en', 'Jewelry', 'keyword', 'Roupas e acessórios', 'Joias',
   ARRAY['jewelry', 'jewellery'],
   ARRAY['jewelry', 'jewellery'], 0.90, 88,
   '{"type": "fashion", "subtype": "jewelry", "language": "en"}'),
   
  -- Glasses / Óculos
  ('glasses_en', 'Glasses', 'keyword', 'Roupas e acessórios', 'Óticas',
   ARRAY['glasses'],
   ARRAY['glasses'], 0.89, 87,
   '{"type": "fashion", "subtype": "glasses", "language": "en"}'),
   
  -- Optical / Ótica
  ('optical_en', 'Optical', 'keyword', 'Roupas e acessórios', 'Óticas',
   ARRAY['optical'],
   ARRAY['optical'], 0.90, 88,
   '{"type": "fashion", "subtype": "optical", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- CATEGORIA: VIAGENS (Travel)
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Travel / Viagem
  ('travel_en', 'Travel', 'keyword', 'Férias / Viagens', 'Viagens',
   ARRAY['travel', 'travels'],
   ARRAY['travel'], 0.89, 87,
   '{"type": "travel", "subtype": "travel", "language": "en"}'),
   
  -- Hotel
  ('hotel_en', 'Hotel', 'keyword', 'Férias / Viagens', 'Hotel',
   ARRAY['hotel', 'hotels'],
   ARRAY['hotel'], 0.93, 91,
   '{"type": "travel", "subtype": "hotel", "language": "en"}'),
   
  -- Resort
  ('resort_en', 'Resort', 'keyword', 'Férias / Viagens', 'Resort',
   ARRAY['resort', 'resorts'],
   ARRAY['resort'], 0.93, 91,
   '{"type": "travel", "subtype": "resort", "language": "en"}'),
   
  -- Inn / Pousada
  ('inn_en', 'Inn', 'keyword', 'Férias / Viagens', 'Hotel',
   ARRAY['inn', 'inns'],
   ARRAY['inn'], 0.90, 88,
   '{"type": "travel", "subtype": "inn", "language": "en"}'),
   
  -- Flight / Voo
  ('flight_en', 'Flight', 'keyword', 'Férias / Viagens', 'Passagem Aérea',
   ARRAY['flight', 'flights'],
   ARRAY['flight'], 0.92, 90,
   '{"type": "travel", "subtype": "flight", "language": "en"}'),
   
  -- Airline / Companhia Aérea
  ('airline_en', 'Airline', 'keyword', 'Férias / Viagens', 'Passagem Aérea',
   ARRAY['airline', 'airlines'],
   ARRAY['airline'], 0.92, 90,
   '{"type": "travel", "subtype": "airline", "language": "en"}'),
   
  -- Ticket / Passagem
  ('ticket_en', 'Ticket', 'keyword', 'Férias / Viagens', 'Passagens',
   ARRAY['ticket', 'tickets'],
   ARRAY['ticket'], 0.87, 85,
   '{"type": "travel", "subtype": "ticket", "language": "en"}'),
   
  -- Hostel / Hostel
  ('hostel_en', 'Hostel', 'keyword', 'Férias / Viagens', 'Hotel',
   ARRAY['hostel', 'hostels'],
   ARRAY['hostel'], 0.91, 89,
   '{"type": "travel", "subtype": "hostel", "language": "en"}'),
   
  -- Tour / Tour
  ('tour_en', 'Tour', 'keyword', 'Férias / Viagens', 'Turismo',
   ARRAY['tour', 'tours'],
   ARRAY['tour'], 0.88, 86,
   '{"type": "travel", "subtype": "tour", "language": "en"}'),
   
  -- Agency / Agência
  ('agency_en', 'Agency', 'keyword', 'Férias / Viagens', 'Agência de Viagens',
   ARRAY['agency', 'agencies'],
   ARRAY['agency'], 0.87, 85,
   '{"type": "travel", "subtype": "agency", "language": "en"}'),
   
  -- Luggage / Bagagem
  ('luggage_en', 'Luggage', 'keyword', 'Férias / Viagens', 'Bagagem',
   ARRAY['luggage'],
   ARRAY['luggage'], 0.89, 87,
   '{"type": "travel", "subtype": "luggage", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- KEYWORDS GENÉRICAS E SUFIXOS COMUNS (Generic & Common Suffixes)
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key, entity_name, entry_type, category, subcategory,
  aliases, keywords, confidence_modifier, priority, metadata
) VALUES
  -- Premium / Premium
  ('premium_en', 'Premium', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['premium'],
   ARRAY['premium'], 0.75, 73,
   '{"type": "generic", "subtype": "premium", "language": "en"}'),
   
  -- Deluxe / Luxo
  ('deluxe_en', 'Deluxe', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['deluxe'],
   ARRAY['deluxe'], 0.76, 74,
   '{"type": "generic", "subtype": "deluxe", "language": "en"}'),
   
  -- King / Rei (tamanho/premium)
  ('king_en', 'King', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['king'],
   ARRAY['king'], 0.78, 76,
   '{"type": "generic", "subtype": "king", "language": "en"}'),
   
  -- Queen / Rainha
  ('queen_en', 'Queen', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['queen'],
   ARRAY['queen'], 0.77, 75,
   '{"type": "generic", "subtype": "queen", "language": "en"}'),
   
  -- Best / Melhor
  ('best_en', 'Best', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['best'],
   ARRAY['best'], 0.74, 72,
   '{"type": "generic", "subtype": "best", "language": "en"}'),
   
  -- Top
  ('top_en', 'Top', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['top'],
   ARRAY['top'], 0.72, 70,
   '{"type": "generic", "subtype": "top", "language": "en"}'),
   
  -- Master / Mestre
  ('master_en', 'Master', 'keyword', 'Diarista / Prestadores Serv.', 'Serviços',
   ARRAY['master'],
   ARRAY['master'], 0.76, 74,
   '{"type": "generic", "subtype": "master", "language": "en"}'),
   
  -- Pro / Profissional
  ('pro_en', 'Pro', 'keyword', 'Diarista / Prestadores Serv.', 'Serviços',
   ARRAY['pro'],
   ARRAY['pro'], 0.74, 72,
   '{"type": "generic", "subtype": "pro", "language": "en"}'),
   
  -- Gold / Ouro
  ('gold_en', 'Gold', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['gold'],
   ARRAY['gold'], 0.76, 74,
   '{"type": "generic", "subtype": "gold", "language": "en"}'),
   
  -- Silver / Prata
  ('silver_en', 'Silver', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['silver'],
   ARRAY['silver'], 0.75, 73,
   '{"type": "generic", "subtype": "silver", "language": "en"}'),
   
  -- Star / Estrela
  ('star_en', 'Star', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['star', 'stars'],
   ARRAY['star'], 0.76, 74,
   '{"type": "generic", "subtype": "star", "language": "en"}'),
   
  -- Point / Ponto
  ('point_en', 'Point', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['point'],
   ARRAY['point'], 0.73, 71,
   '{"type": "generic", "subtype": "point", "language": "en"}'),
   
  -- World / Mundo
  ('world_en', 'World', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['world'],
   ARRAY['world'], 0.75, 73,
   '{"type": "generic", "subtype": "world", "language": "en"}'),
   
  -- House of / Casa de
  ('house_of_en', 'House of', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['house of'],
   ARRAY['house of'], 0.82, 80,
   '{"type": "generic", "subtype": "house_of", "language": "en"}'),
   
  -- Place / Lugar
  ('place_en', 'Place', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['place'],
   ARRAY['place'], 0.79, 77,
   '{"type": "generic", "subtype": "place", "language": "en"}'),
   
  -- Corner / Canto/Esquina
  ('corner_en', 'Corner', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['corner'],
   ARRAY['corner'], 0.81, 79,
   '{"type": "generic", "subtype": "corner", "language": "en"}'),
   
  -- Station / Estação
  ('station_en', 'Station', 'keyword', 'Alimentação', 'Restaurante',
   ARRAY['station'],
   ARRAY['station'], 0.80, 78,
   '{"type": "generic", "subtype": "station", "language": "en"}'),
   
  -- Zone / Zona
  ('zone_en', 'Zone', 'keyword', 'Lazer', 'Entretenimento',
   ARRAY['zone'],
   ARRAY['zone'], 0.78, 76,
   '{"type": "generic", "subtype": "zone", "language": "en"}'),
   
  -- Land / Terra
  ('land_en', 'Land', 'keyword', 'Lazer', 'Entretenimento',
   ARRAY['land'],
   ARRAY['land'], 0.77, 75,
   '{"type": "generic", "subtype": "land", "language": "en"}'),
   
  -- Factory Shop
  ('factory_shop_en', 'Factory Shop', 'keyword', 'Roupas e acessórios', 'Outlet',
   ARRAY['factory shop'],
   ARRAY['factory shop'], 0.86, 84,
   '{"type": "generic", "subtype": "factory_shop", "language": "en"}'),
   
  -- Concept Store
  ('concept_store_en', 'Concept Store', 'keyword', 'Presentes / Compras', 'Loja',
   ARRAY['concept store'],
   ARRAY['concept store'], 0.85, 83,
   '{"type": "generic", "subtype": "concept_store", "language": "en"}'),
   
  -- Lounge
  ('lounge_en', 'Lounge', 'keyword', 'Alimentação', 'Bar / Petiscaria',
   ARRAY['lounge'],
   ARRAY['lounge'], 0.88, 86,
   '{"type": "generic", "subtype": "lounge", "language": "en"}'),
   
  -- Delivery
  ('delivery_en', 'Delivery', 'keyword', 'Alimentação', 'Delivery',
   ARRAY['delivery'],
   ARRAY['delivery'], 0.88, 86,
   '{"type": "generic", "subtype": "delivery", "language": "en"}'),
   
  -- Online
  ('online_en', 'Online', 'keyword', 'Presentes / Compras', 'E-commerce',
   ARRAY['online'],
   ARRAY['online'], 0.80, 78,
   '{"type": "generic", "subtype": "online", "language": "en"}'),
   
  -- Group / Grupo
  ('group_en', 'Group', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Serviços',
   ARRAY['group'],
   ARRAY['group'], 0.75, 73,
   '{"type": "generic", "subtype": "group", "language": "en"}'),
   
  -- Company / Empresa
  ('company_en', 'Company', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Serviços',
   ARRAY['company'],
   ARRAY['company'], 0.76, 74,
   '{"type": "generic", "subtype": "company", "language": "en"}'),
   
  -- Enterprise / Empresa
  ('enterprise_en', 'Enterprise', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Serviços',
   ARRAY['enterprise'],
   ARRAY['enterprise'], 0.77, 75,
   '{"type": "generic", "subtype": "enterprise", "language": "en"}'),
   
  -- Solutions / Soluções
  ('solutions_en', 'Solutions', 'keyword', 'Gastos com PJ / Profissionais Autônomos', 'Consultoria',
   ARRAY['solutions'],
   ARRAY['solutions'], 0.80, 78,
   '{"type": "generic", "subtype": "solutions", "language": "en"}'),
   
  -- Lab Services
  ('lab_services_en', 'Lab', 'keyword', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório',
   ARRAY['lab'],
   ARRAY['lab'], 0.89, 87,
   '{"type": "generic", "subtype": "lab", "language": "en"}')
ON CONFLICT (merchant_key) DO NOTHING;

COMMIT;

-- =============================================================================
-- REINDEX PARA MELHOR PERFORMANCE (FORA DA TRANSAÇÃO)
-- =============================================================================

REINDEX INDEX idx_merchants_aliases;
REINDEX INDEX idx_merchants_keywords;

-- =============================================================================
-- ESTATÍSTICAS
-- =============================================================================

DO $$
DECLARE
  v_total_keywords integer;
  v_english_keywords integer;
BEGIN
  SELECT COUNT(*) INTO v_total_keywords
  FROM merchants_dictionary
  WHERE entry_type = 'keyword';
  
  SELECT COUNT(*) INTO v_english_keywords
  FROM merchants_dictionary
  WHERE entry_type = 'keyword' AND metadata::jsonb->>'language' = 'en';
  
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Migration completa!';
  RAISE NOTICE 'Total de keywords no sistema: %', v_total_keywords;
  RAISE NOTICE 'Keywords em inglês adicionadas: %', v_english_keywords;
  RAISE NOTICE '=============================================================';
END $$;
