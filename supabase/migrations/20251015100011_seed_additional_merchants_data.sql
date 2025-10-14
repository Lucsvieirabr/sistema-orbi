-- Migration: Seed additional merchants data
-- Populates the merchants dictionary with additional research data
-- Includes regional supermarkets, restaurants, subscriptions, e-commerce, gateways, and travel services

BEGIN;

-- ============================================================================
-- SUPERMERCADOS E ATACAREJOS REGIONAIS
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

('lider comercio', 'Líder Comércio', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['lider', 'supermercado lider', 'lider comercio'], ARRAY['supermercado', 'pará', 'pa', 'norte', 'varejo alimentar'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "PA"}'),

('atakarejo', 'Atakarejo', 'Alimentação', 'Atacarejo', 'merchant',
 ARRAY['atakarejo'], ARRAY['atacarejo', 'bahia', 'ba', 'nordeste', 'atacado', 'supermercado'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "BA"}'),

('grupo abc', 'Grupo ABC', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['abc', 'supermercado abc', 'grupo abc'], ARRAY['supermercado', 'minas gerais', 'mg', 'varejo alimentar'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "MG"}'),

('grupo supernosso', 'Grupo Supernosso', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['supernosso', 'super nosso', 'grupo supernosso'], ARRAY['supermercado', 'minas gerais', 'mg', 'hortifruti'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "MG"}'),

('supermercado bahamas', 'Supermercado Bahamas', 'Alimentação', 'Atacarejo', 'merchant',
 ARRAY['bahamas', 'supermercado bahamas'], ARRAY['supermercado', 'minas gerais', 'mg', 'atacarejo'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "MG"}'),

('comercial zaragoza', 'Comercial Zaragoza', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['zaragoza', 'supermercado zaragoza', 'comercial zaragoza'], ARRAY['supermercado', 'sao paulo', 'sp', 'varejo alimentar'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "SP"}'),

('giassi supermercados', 'Giassi Supermercados', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['giassi', 'supermercado giassi'], ARRAY['supermercado', 'santa catarina', 'sc', 'varejo'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "SC"}'),

('roldao atacadista', 'Roldão Atacadista', 'Alimentação', 'Atacarejo', 'merchant',
 ARRAY['roldao', 'roldão', 'roldao atacadista'], ARRAY['atacado', 'supermercado', 'cash & carry', 'atacarejo'],
 0.92, 92, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

('supermercados pague menos', 'Supermercados Pague Menos', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['pague menos supermercado', 'supermercado pague menos'], ARRAY['supermercado', 'sao paulo', 'sp', 'varejo alimentar'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "SP"}'),

('angeloni', 'Angeloni', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['angeloni', 'supermercado angeloni'], ARRAY['supermercado', 'santa catarina', 'sc', 'varejo'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "SC"}'),

('centro oeste comercial de alimentos', 'Centro Oeste Comercial de Alimentos', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['centro oeste', 'supermercado centro oeste'], ARRAY['supermercado', 'distrito federal', 'df', 'brasilia'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "DF"}'),

('supermercado nordestao', 'Supermercado Nordestão', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['nordestao', 'nordestão', 'supermercado nordestao'], ARRAY['supermercado', 'rio grande do norte', 'rn', 'nordeste'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "RN"}'),

('formosa supermercados', 'Formosa Supermercados', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['formosa', 'supermercado formosa'], ARRAY['supermercado', 'pará', 'pa', 'magazine', 'norte'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "PA"}'),

('superatacado nova era', 'Superatacado Nova Era', 'Alimentação', 'Atacarejo', 'merchant',
 ARRAY['nova era', 'superatacado nova era'], ARRAY['superatacado', 'amazonas', 'am', 'norte', 'atacado'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "AM"}'),

('dunorte distribuidora', 'Dunorte Distribuidora', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['dunorte', 'distribuidora dunorte'], ARRAY['distribuidora', 'amazonas', 'am', 'atacado'],
 0.85, 85, 0, 'imported', '{"sector": "food_retail", "type": "distributor", "state": "AM"}'),

('dismelo', 'Dismelo', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['dismelo', 'distribuidora dismelo'], ARRAY['distribuidora', 'pará', 'pa', 'atacado'],
 0.85, 85, 0, 'imported', '{"sector": "food_retail", "type": "distributor", "state": "PA"}'),

('big amigao', 'Big Amigão', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['big amigao', 'big amigão', 'amigao'], ARRAY['supermercado', 'amazonas', 'am', 'norte'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "AM"}'),

('distribuidora coimbra', 'Distribuidora Coimbra', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['coimbra', 'distribuidora coimbra'], ARRAY['distribuidora', 'rondonia', 'ro', 'norte', 'atacado'],
 0.85, 85, 0, 'imported', '{"sector": "food_retail", "type": "distributor", "state": "RO"}'),

('preco baixo meio a meio', 'Preço Baixo Meio a Meio', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['preco baixo', 'meio a meio', 'preço baixo meio a meio'], ARRAY['supermercado', 'pará', 'pa', 'atacado'],
 0.85, 85, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "PA"}'),

('di felicia', 'Di Felicia', 'Alimentação', 'Atacado', 'merchant',
 ARRAY['di felicia', 'distribuidora di felicia'], ARRAY['distribuidora', 'amazonas', 'am', 'atacado'],
 0.85, 85, 0, 'imported', '{"sector": "food_retail", "type": "distributor", "state": "AM"}'),

('quartetto atacado', 'Quartetto Atacado', 'Alimentação', 'Atacarejo', 'merchant',
 ARRAY['quartetto', 'quartetto atacado'], ARRAY['atacado', 'tocantins', 'to', 'norte'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "TO"}'),

('atacadao nosso lar', 'Atacadão Nosso Lar', 'Alimentação', 'Atacarejo', 'merchant',
 ARRAY['nosso lar', 'atacadao nosso lar', 'atacadão nosso lar'], ARRAY['atacadão', 'tocantins', 'to', 'norte'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "TO"}'),

('arco mix', 'Arco Mix', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['arco mix', 'arcomix'], ARRAY['supermercado', 'pernambuco', 'pe', 'nordeste'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "PE"}'),

('peruzzo', 'Peruzzo', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['peruzzo', 'supermercado peruzzo'], ARRAY['supermercado', 'rio grande do sul', 'rs', 'sul'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "RS"}'),

('arasuper', 'Arasuper', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['arasuper', 'supermercado arasuper'], ARRAY['supermercado', 'acre', 'ac', 'norte'],
 0.85, 85, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "AC"}'),

('supermercado sao luiz', 'Supermercado São Luiz', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['sao luiz', 'são luiz', 'supermercado sao luiz'], ARRAY['supermercado', 'ceará', 'ce', 'nordeste'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "CE"}'),

('extrabom', 'Extrabom', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['extrabom', 'supermercado extrabom'], ARRAY['supermercado', 'espirito santo', 'es', 'sudeste'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "ES"}'),

('bonanza', 'Bonanza', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['bonanza', 'supermercado bonanza'], ARRAY['supermercado', 'pernambuco', 'pe', 'nordeste'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "PE"}'),

('palato', 'Palato', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['palato', 'supermercado palato'], ARRAY['supermercado', 'alagoas', 'al', 'nordeste'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "AL"}'),

('supermercado fortaleza', 'Supermercado Fortaleza', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['fortaleza', 'supermercado fortaleza'], ARRAY['supermercado', 'amapá', 'ap', 'norte'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "AP"}'),

('zona sul', 'Zona Sul', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['zona sul', 'supermercado zona sul'], ARRAY['supermercado', 'rio de janeiro', 'rj', 'sudeste'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "state": "RJ"}'),

('coop', 'Coop', 'Alimentação', 'Supermercado', 'merchant',
 ARRAY['coop', 'cooperativa de consumo'], ARRAY['cooperativa', 'supermercado', 'sao paulo', 'sp'],
 0.90, 90, 0, 'imported', '{"sector": "food_retail", "chain": true, "cooperative": true}'),

('tonin', 'Tonin', 'Alimentação', 'Atacarejo', 'merchant',
 ARRAY['tonin', 'tonin atacado'], ARRAY['atacado', 'supermercado', 'sao paulo', 'sp', 'minas gerais', 'mg'],
 0.88, 88, 0, 'imported', '{"sector": "food_retail", "chain": true}'),

-- ============================================================================
-- RESTAURANTES - COMIDA BRASILEIRA E INTERNACIONAL
-- ============================================================================

('divino fogao', 'Divino Fogão', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['divino fogao', 'divino fogão'], ARRAY['comida brasileira', 'buffet', 'restaurante', 'franquia'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "type": "buffet"}'),

('koni store', 'Koni Store', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['koni', 'koni store'], ARRAY['temaki', 'comida japonesa', 'fast food', 'franquia'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "japanese"}'),

('sukiya', 'Sukiya', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['sukiya'], ARRAY['gyudon', 'comida japonesa', 'fast food', 'restaurante'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "japanese"}'),

('taco bell', 'Taco Bell', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['taco bell', 'tacobell'], ARRAY['comida mexicana', 'fast food', 'franquia', 'taco'],
 0.92, 92, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "mexican"}'),

('churras express brasil', 'Churras Express Brasil', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['churras express', 'churrasexpress'], ARRAY['espetinho', 'churrasco', 'franquia', 'fast food'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true}'),

('gendai', 'Gendai', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['gendai', 'gendai sushi'], ARRAY['sushi', 'comida japonesa', 'franquia', 'restaurante'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "japanese"}'),

('max sushi', 'Max Sushi', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['max sushi', 'maxsushi'], ARRAY['comida japonesa', 'franquia', 'restaurante', 'sushi'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "japanese"}'),

('makis place', 'Makis Place', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['makis place', 'makis'], ARRAY['temaki', 'comida japonesa', 'franquia', 'sushi'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "japanese"}'),

('sushi namoto', 'Sushi Namoto', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['namoto', 'sushi namoto'], ARRAY['comida japonesa', 'franquia', 'restaurante', 'sushi'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "japanese"}'),

('lets sushi', 'Let''s Sushi', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['lets sushi', 'let''s sushi'], ARRAY['comida japonesa', 'delivery', 'restaurante', 'sushi'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "japanese"}'),

('keiretsu', 'Keiretsu', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['keiretsu'], ARRAY['comida japonesa', 'rodízio', 'restaurante', 'sushi'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "japanese"}'),

('jin jin', 'Jin Jin', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['jin jin', 'jinjin'], ARRAY['comida asiática', 'buffet', 'franquia', 'restaurante'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "asian"}'),

('japa temaki', 'Japa Temaki', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['japa temaki', 'japatemaki'], ARRAY['temakeria', 'comida japonesa', 'franquia'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "japanese"}'),

('yoi rolls temakis', 'Yoi! Rolls&Temakis', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['yoi', 'yoi rolls', 'yoi temakis'], ARRAY['temaki', 'rolls', 'comida japonesa', 'franquia'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "japanese"}'),

('japate', 'Japatê', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['japate', 'japatê'], ARRAY['comida japonesa', 'franquia', 'restaurante'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "chain": true, "cuisine": "japanese"}'),

('italin house', 'Ital''in House', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['italin house', 'ital''in house'], ARRAY['comida italiana', 'delivery', 'massa', 'franquia'],
 0.88, 88, 0, 'imported', '{"sector": "food_delivery", "chain": true, "cuisine": "italian"}'),

('lo straniero', 'Lo Straniero', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['lo straniero'], ARRAY['pizzaria', 'comida italiana', 'restaurante', 'pizza'],
 0.88, 88, 0, 'imported', '{"sector": "food_service", "cuisine": "italian"}'),

('azdora piadineria', 'Azdora Piadineria', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['azdora', 'piadineria'], ARRAY['piadina', 'comida italiana', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "cuisine": "italian"}'),

('italia no box', 'Itália no Box', 'Alimentação', 'Delivery', 'merchant',
 ARRAY['italia no box', 'itália no box'], ARRAY['comida italiana', 'delivery', 'franquia', 'massa'],
 0.88, 88, 0, 'imported', '{"sector": "food_delivery", "chain": true, "cuisine": "italian"}'),

-- ============================================================================
-- RESTAURANTES VEGANOS E VEGETARIANOS
-- ============================================================================

('oya cozinha vegana', 'Oyá Cozinha Vegana', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['oya', 'oyá', 'oya cozinha vegana'], ARRAY['vegano', 'brasilia', 'df', 'restaurante', 'café'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "location": "Brasília"}'),

('supren verda', 'Supren Verda', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['supren verda'], ARRAY['vegano', 'brasilia', 'df', 'buffet', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "location": "Brasília"}'),

('villa vegana', 'Villa Vegana', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['villa vegana'], ARRAY['vegano', 'lago sul', 'brasilia', 'df', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "location": "Brasília"}'),

('nectare', 'Nectare', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['nectare', 'vasa jaya'], ARRAY['vegano', 'sao paulo', 'sp', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "location": "São Paulo"}'),

('sushimar', 'Sushimar', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['sushimar'], ARRAY['sushi vegano', 'comida japonesa vegana', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "cuisine": "japanese"}'),

('prime dog', 'Prime Dog', 'Alimentação', 'Fast Food', 'merchant',
 ARRAY['prime dog', 'primedog'], ARRAY['hamburguer vegano', 'lanchonete', 'sao paulo', 'sp'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "location": "São Paulo"}'),

('prana', 'Prana', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['prana', 'restaurante prana'], ARRAY['vegetariano', 'rio de janeiro', 'rj', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegetarian", "location": "Rio de Janeiro"}'),

('teva', 'Teva', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['teva', 'teva vegetal'], ARRAY['vegetal', 'vegano', 'rio de janeiro', 'rj', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "location": "Rio de Janeiro"}'),

('vegans 2 go', 'Vegan''s 2 GO', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['vegans 2 go', 'vegan''s 2 go'], ARRAY['franquia vegana', 'minas gerais', 'mg', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "location": "Minas Gerais"}'),

('nascente um gosto de sol', 'Nascente um Gosto de Sol', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['nascente', 'nascente um gosto de sol'], ARRAY['organico', 'vegetariano', 'belo horizonte', 'mg', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegetarian", "location": "Belo Horizonte"}'),

('mesa do sabio', 'Mesa do Sábio', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['mesa do sabio', 'mesa do sábio'], ARRAY['comida oriental', 'vegetariano', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegetarian", "cuisine": "oriental"}'),

('vegalize', 'Vegalize', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['vegalize'], ARRAY['vegano', 'salvador', 'bahia', 'ba', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "location": "Salvador"}'),

('health valley', 'Health Valley', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['health valley'], ARRAY['vegetariano', 'salvador', 'bahia', 'ba', 'empório', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegetarian", "location": "Salvador"}'),

('harmonia da terra', 'Harmonia da Terra', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['harmonia da terra'], ARRAY['vegano', 'balneario camboriu', 'sc', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "location": "Balneário Camboriú"}'),

('corrutela', 'Corrutela', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['corrutela'], ARRAY['cozinha autoral', 'vegetariano', 'sao paulo', 'sp', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegetarian", "location": "São Paulo"}'),

('camelia ododo', 'Camélia Òdòdó', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['camelia', 'camelia ododo', 'camélia òdòdó'], ARRAY['vegano', 'organico', 'sao paulo', 'sp', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "location": "São Paulo"}'),

('rango vegan', 'Rango Vegan', 'Alimentação', 'Restaurante', 'merchant',
 ARRAY['rango vegan'], ARRAY['vegano', 'salvador', 'bahia', 'ba', 'restaurante'],
 0.85, 85, 0, 'imported', '{"sector": "food_service", "type": "vegan", "location": "Salvador"}'),

-- ============================================================================
-- ASSINATURAS - BOX E CLUBES
-- ============================================================================

('glam', 'Glam', 'Assinaturas', 'Box de Beleza', 'merchant',
 ARRAY['glam', 'glambox'], ARRAY['assinatura beleza', 'cosméticos', 'box', 'maquiagem'],
 0.90, 90, 0, 'imported', '{"sector": "subscription", "type": "beauty_box"}'),

('nerd ao cubo', 'Nerd Ao Cubo', 'Assinaturas', 'Box', 'merchant',
 ARRAY['nerd ao cubo', 'nerdaocubo'], ARRAY['assinatura geek', 'colecionáveis', 'box', 'nerd'],
 0.88, 88, 0, 'imported', '{"sector": "subscription", "type": "geek_box"}'),

('wine', 'Wine', 'Assinaturas', 'Clube de Vinhos', 'merchant',
 ARRAY['wine', 'wine club'], ARRAY['assinatura vinhos', 'clube do vinho', 'adega', 'vinho'],
 0.90, 90, 0, 'imported', '{"sector": "subscription", "type": "wine_club"}'),

('box petiko', 'Box.Petiko', 'Assinaturas', 'Box Pet', 'merchant',
 ARRAY['petiko', 'box petiko', 'box.petiko'], ARRAY['assinatura pet', 'cachorro', 'gato', 'box'],
 0.88, 88, 0, 'imported', '{"sector": "subscription", "type": "pet_box"}'),

('tag livros', 'TAG Livros', 'Assinaturas', 'Clube de Livros', 'merchant',
 ARRAY['tag', 'tag livros'], ARRAY['assinatura livros', 'clube do livro', 'literatura'],
 0.88, 88, 0, 'imported', '{"sector": "subscription", "type": "book_club"}'),

('clube do vinil', 'Clube do Vinil', 'Assinaturas', 'Clube de Música', 'merchant',
 ARRAY['clube do vinil'], ARRAY['assinatura musica', 'disco', 'lp', 'vinil'],
 0.88, 88, 0, 'imported', '{"sector": "subscription", "type": "music"}'),

('clubecafe', 'ClubeCafé', 'Assinaturas', 'Clube de Café', 'merchant',
 ARRAY['clubecafe', 'clube cafe'], ARRAY['assinatura café', 'café especial', 'grãos'],
 0.88, 88, 0, 'imported', '{"sector": "subscription", "type": "coffee_club"}'),

('coffee and joy', 'Coffee & Joy', 'Assinaturas', 'Clube de Café', 'merchant',
 ARRAY['coffee and joy', 'coffee & joy'], ARRAY['assinatura café', 'café especial'],
 0.88, 88, 0, 'imported', '{"sector": "subscription", "type": "coffee_club"}'),

('cafes do brasil club', 'Cafés do Brasil Club', 'Assinaturas', 'Clube de Café', 'merchant',
 ARRAY['cafes do brasil', 'cafés do brasil'], ARRAY['assinatura café', 'clube de café'],
 0.88, 88, 0, 'imported', '{"sector": "subscription", "type": "coffee_club"}'),

('encantos do cafe', 'Encantos do Café', 'Assinaturas', 'Clube de Café', 'merchant',
 ARRAY['encantos do cafe', 'encantos do café'], ARRAY['assinatura café', 'café especial'],
 0.88, 88, 0, 'imported', '{"sector": "subscription", "type": "coffee_club"}'),

('veroo', 'Veroo', 'Assinaturas', 'Clube de Café', 'merchant',
 ARRAY['veroo'], ARRAY['assinatura café', 'café especial'],
 0.88, 88, 0, 'imported', '{"sector": "subscription", "type": "coffee_club"}'),

('um coffee co', 'Um Coffee Co', 'Assinaturas', 'Clube de Café', 'merchant',
 ARRAY['um coffee', 'um coffee co'], ARRAY['assinatura café', 'café especial', 'barista'],
 0.88, 88, 0, 'imported', '{"sector": "subscription", "type": "coffee_club"}'),

-- ============================================================================
-- ASSINATURAS - JORNAIS E REVISTAS
-- ============================================================================

('o globo', 'O Globo', 'Assinaturas', 'Jornal', 'merchant',
 ARRAY['o globo', 'globo'], ARRAY['assinatura jornal', 'notícias', 'digital', 'impresso'],
 0.92, 92, 0, 'imported', '{"sector": "subscription", "type": "newspaper"}'),

('folha de s paulo', 'Folha de S. Paulo', 'Assinaturas', 'Jornal', 'merchant',
 ARRAY['folha', 'fsp', 'folha de sao paulo'], ARRAY['assinatura jornal', 'notícias', 'uol'],
 0.92, 92, 0, 'imported', '{"sector": "subscription", "type": "newspaper"}'),

('estadao', 'Estadão', 'Assinaturas', 'Jornal', 'merchant',
 ARRAY['estadao', 'estadão', 'o estado de s. paulo'], ARRAY['assinatura jornal', 'notícias'],
 0.92, 92, 0, 'imported', '{"sector": "subscription", "type": "newspaper"}'),

('valor economico', 'Valor Econômico', 'Assinaturas', 'Jornal', 'merchant',
 ARRAY['valor', 'valor economico', 'valor econômico'], ARRAY['assinatura jornal', 'economia', 'finanças'],
 0.92, 92, 0, 'imported', '{"sector": "subscription", "type": "newspaper"}'),

('zero hora', 'Zero Hora', 'Assinaturas', 'Jornal', 'merchant',
 ARRAY['zero hora', 'zh'], ARRAY['assinatura jornal', 'rio grande do sul', 'rs', 'notícias'],
 0.90, 90, 0, 'imported', '{"sector": "subscription", "type": "newspaper"}'),

('veja', 'Veja', 'Assinaturas', 'Revista', 'merchant',
 ARRAY['veja', 'revista veja'], ARRAY['assinatura revista', 'notícias', 'abril'],
 0.92, 92, 0, 'imported', '{"sector": "subscription", "type": "magazine"}'),

('forbes brasil', 'Forbes Brasil', 'Assinaturas', 'Revista', 'merchant',
 ARRAY['forbes', 'forbes brasil'], ARRAY['assinatura revista', 'negócios', 'economia'],
 0.90, 90, 0, 'imported', '{"sector": "subscription", "type": "magazine"}'),

('istoe', 'IstoÉ', 'Assinaturas', 'Revista', 'merchant',
 ARRAY['istoe', 'istoé', 'revista istoe'], ARRAY['assinatura revista', 'notícias'],
 0.90, 90, 0, 'imported', '{"sector": "subscription", "type": "magazine"}'),

('nexo jornal', 'Nexo Jornal', 'Assinaturas', 'Jornal Digital', 'merchant',
 ARRAY['nexo', 'nexo jornal'], ARRAY['jornalismo', 'assinatura digital', 'podcast', 'notícias'],
 0.90, 90, 0, 'imported', '{"sector": "subscription", "type": "digital_newspaper"}'),

-- ============================================================================
-- ASSINATURAS - STREAMING E ENTRETENIMENTO
-- ============================================================================

('crunchyroll', 'Crunchyroll', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['crunchyroll'], ARRAY['assinatura anime', 'streaming', 'simulcast', 'manga'],
 0.95, 95, 0, 'imported', '{"sector": "streaming", "type": "anime"}'),

('mubi', 'Mubi', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['mubi'], ARRAY['assinatura filmes', 'streaming', 'cinema', 'cult'],
 0.90, 90, 0, 'imported', '{"sector": "streaming", "type": "cinema"}'),

('cazetv', 'CazéTV', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['cazetv', 'cazé tv', 'caze tv'], ARRAY['assinatura esportes', 'streaming', 'futebol', 'ao vivo'],
 0.90, 90, 0, 'imported', '{"sector": "streaming", "type": "sports"}'),

('goat', 'GOAT', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['goat', 'goat streaming'], ARRAY['assinatura esportes', 'streaming', 'futebol'],
 0.88, 88, 0, 'imported', '{"sector": "streaming", "type": "sports"}'),

('dsports', 'DSports', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['dsports', 'directv go', 'directv'], ARRAY['assinatura esportes', 'streaming'],
 0.88, 88, 0, 'imported', '{"sector": "streaming", "type": "sports"}'),

('pictv', 'PicTV', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['pictv', 'pic tv'], ARRAY['picpay', 'assinatura esportes', 'streaming', 'nascar'],
 0.88, 88, 0, 'imported', '{"sector": "streaming", "type": "sports"}'),

-- ============================================================================
-- ASSINATURAS - SAAS E PRODUTIVIDADE
-- ============================================================================

('lark', 'Lark', 'Assinaturas', 'SaaS', 'merchant',
 ARRAY['lark', 'larksuite'], ARRAY['saas', 'produtividade', 'colaboração'],
 0.90, 90, 0, 'imported', '{"sector": "saas", "type": "productivity"}'),

('microsoft teams', 'Microsoft Teams', 'Assinaturas', 'SaaS', 'merchant',
 ARRAY['teams', 'microsoft teams'], ARRAY['microsoft', 'saas', 'colaboração', 'reunião online'],
 0.95, 95, 0, 'imported', '{"sector": "saas", "type": "productivity"}'),

('rd station', 'RD Station', 'Assinaturas', 'SaaS', 'merchant',
 ARRAY['rd', 'rd station', 'rdstation'], ARRAY['saas', 'marketing digital', 'automação', 'crm'],
 0.90, 90, 0, 'imported', '{"sector": "saas", "type": "marketing"}'),

('hubspot', 'HubSpot', 'Assinaturas', 'SaaS', 'merchant',
 ARRAY['hubspot'], ARRAY['saas', 'crm', 'marketing', 'vendas'],
 0.95, 95, 0, 'imported', '{"sector": "saas", "type": "crm"}'),

('github', 'GitHub', 'Assinaturas', 'SaaS', 'merchant',
 ARRAY['github', 'git'], ARRAY['saas', 'versionamento', 'código', 'desenvolvedor'],
 0.95, 95, 0, 'imported', '{"sector": "saas", "type": "dev_tools"}'),

('jira', 'Jira', 'Assinaturas', 'SaaS', 'merchant',
 ARRAY['jira', 'atlassian'], ARRAY['saas', 'gerenciamento de projetos', 'agile'],
 0.95, 95, 0, 'imported', '{"sector": "saas", "type": "project_management"}'),

-- ============================================================================
-- E-COMMERCE - TECNOLOGIA E INFORMÁTICA
-- ============================================================================

('kabum', 'Kabum!', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['kabum', 'kabum!'], ARRAY['e-commerce', 'informática', 'hardware', 'pc gamer'],
 0.95, 95, 0, 'imported', '{"sector": "ecommerce", "category": "tech"}'),

('pichau', 'Pichau', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['pichau'], ARRAY['e-commerce', 'informática', 'hardware', 'pc gamer'],
 0.92, 92, 0, 'imported', '{"sector": "ecommerce", "category": "tech"}'),

('terabyteshop', 'TerabyteShop', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['terabyte', 'terabyteshop'], ARRAY['e-commerce', 'informática', 'hardware'],
 0.92, 92, 0, 'imported', '{"sector": "ecommerce", "category": "tech"}'),

('gigantec', 'Gigantec', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['gigantec'], ARRAY['e-commerce', 'informática', 'gamer', 'hardware'],
 0.90, 90, 0, 'imported', '{"sector": "ecommerce", "category": "tech"}'),

-- ============================================================================
-- E-COMMERCE - ESPORTES
-- ============================================================================

('netshoes', 'Netshoes', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['netshoes'], ARRAY['e-commerce', 'artigos esportivos', 'tênis', 'esportes'],
 0.95, 95, 0, 'imported', '{"sector": "ecommerce", "category": "sports"}'),

('centauro', 'Centauro', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['centauro'], ARRAY['e-commerce', 'esportes', 'material esportivo'],
 0.95, 95, 0, 'imported', '{"sector": "ecommerce", "category": "sports"}'),

('fut fanatics', 'Fut Fanatics', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['futfanatics', 'fut fanatics'], ARRAY['e-commerce', 'futebol', 'camisa de time'],
 0.90, 90, 0, 'imported', '{"sector": "ecommerce", "category": "sports"}'),

-- ============================================================================
-- E-COMMERCE - BELEZA E COSMÉTICOS
-- ============================================================================

('sephora', 'Sephora', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['sephora'], ARRAY['e-commerce', 'cosméticos', 'maquiagem', 'perfume'],
 0.95, 95, 0, 'imported', '{"sector": "ecommerce", "category": "beauty"}'),

('beleza na web', 'Beleza na Web', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['beleza na web', 'belezanaweb'], ARRAY['e-commerce', 'cosméticos', 'cabelo', 'skincare'],
 0.92, 92, 0, 'imported', '{"sector": "ecommerce", "category": "beauty"}'),

('o boticario', 'O Boticário', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['boticario', 'boticário', 'o boticario'], ARRAY['e-commerce', 'perfume', 'maquiagem', 'cosméticos'],
 0.95, 95, 0, 'imported', '{"sector": "ecommerce", "category": "beauty"}'),

('vult', 'Vult', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['vult'], ARRAY['e-commerce', 'maquiagem', 'cosméticos'],
 0.90, 90, 0, 'imported', '{"sector": "ecommerce", "category": "beauty"}'),

('soneda', 'Soneda', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['soneda'], ARRAY['e-commerce', 'perfumaria', 'cosméticos'],
 0.90, 90, 0, 'imported', '{"sector": "ecommerce", "category": "beauty"}'),

-- ============================================================================
-- E-COMMERCE - LIVROS
-- ============================================================================

('estante virtual', 'Estante Virtual', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['estante virtual', 'estantevirtual'], ARRAY['e-commerce', 'livros', 'sebo', 'livros usados'],
 0.92, 92, 0, 'imported', '{"sector": "ecommerce", "category": "books"}'),

('livraria nobel', 'Livraria Nobel', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['nobel', 'livraria nobel'], ARRAY['livraria', 'e-commerce', 'livros'],
 0.90, 90, 0, 'imported', '{"sector": "ecommerce", "category": "books"}'),

('martins fontes', 'Martins Fontes', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['martins fontes'], ARRAY['livraria', 'e-commerce', 'livros'],
 0.90, 90, 0, 'imported', '{"sector": "ecommerce", "category": "books"}'),

-- ============================================================================
-- GATEWAYS DE PAGAMENTO
-- ============================================================================

('mercado pago', 'Mercado Pago', 'Gastos com PJ / Profissionais Autônomos', 'Gateway de Pagamento', 'merchant',
 ARRAY['mercado pago', 'mercadopago', 'mp'], ARRAY['gateway de pagamento', 'pgto', 'mercado livre'],
 0.95, 95, 0, 'imported', '{"sector": "payment_gateway"}'),

('pagar me', 'Pagar.me', 'Gastos com PJ / Profissionais Autônomos', 'Gateway de Pagamento', 'merchant',
 ARRAY['pagar.me', 'pagarme', 'pagar me'], ARRAY['gateway de pagamento', 'api', 'fintech'],
 0.92, 92, 0, 'imported', '{"sector": "payment_gateway"}'),

('pagseguro', 'PagSeguro', 'Gastos com PJ / Profissionais Autônomos', 'Gateway de Pagamento', 'merchant',
 ARRAY['pagseguro', 'pag seguro', 'pagbank'], ARRAY['gateway de pagamento', 'uol', 'fintech'],
 0.95, 95, 0, 'imported', '{"sector": "payment_gateway"}'),

('cielo', 'Cielo', 'Gastos com PJ / Profissionais Autônomos', 'Gateway de Pagamento', 'merchant',
 ARRAY['cielo'], ARRAY['gateway de pagamento', 'adquirente', 'maquininha'],
 0.95, 95, 0, 'imported', '{"sector": "payment_gateway"}'),

('getnet', 'Getnet', 'Gastos com PJ / Profissionais Autônomos', 'Gateway de Pagamento', 'merchant',
 ARRAY['getnet'], ARRAY['santander', 'gateway de pagamento', 'adquirente'],
 0.95, 95, 0, 'imported', '{"sector": "payment_gateway"}'),

-- ============================================================================
-- VIAGENS E TURISMO
-- ============================================================================

('decolar', 'Decolar', 'Férias / Viagens', 'Agência Online', 'merchant',
 ARRAY['decolar', 'decolar.com'], ARRAY['passagens aéreas', 'hotel', 'pacote de viagem', 'ota'],
 0.95, 95, 0, 'imported', '{"sector": "travel", "type": "ota"}'),

('booking com', 'Booking.com', 'Férias / Viagens', 'Agência Online', 'merchant',
 ARRAY['booking', 'booking.com'], ARRAY['hotel', 'hospedagem', 'reserva', 'ota'],
 0.95, 95, 0, 'imported', '{"sector": "travel", "type": "ota"}'),

('expedia', 'Expedia', 'Férias / Viagens', 'Agência Online', 'merchant',
 ARRAY['expedia'], ARRAY['viagem', 'hotel', 'passagem', 'ota'],
 0.95, 95, 0, 'imported', '{"sector": "travel", "type": "ota"}'),

('cvc viagens', 'CVC Viagens', 'Férias / Viagens', 'Agência de Viagem', 'merchant',
 ARRAY['cvc', 'cvc viagens'], ARRAY['pacote de viagem', 'agência de viagem', 'ota'],
 0.95, 95, 0, 'imported', '{"sector": "travel", "type": "agency"}'),

-- ============================================================================
-- LAZER - INGRESSOS E EVENTOS
-- ============================================================================

('sympla', 'Sympla', 'Lazer', 'Ingressos', 'merchant',
 ARRAY['sympla'], ARRAY['ingressos', 'eventos', 'show', 'curso', 'tickets'],
 0.95, 95, 0, 'imported', '{"sector": "entertainment", "type": "tickets"}'),

('ingresso live', 'Ingresso Live', 'Lazer', 'Ingressos', 'merchant',
 ARRAY['ingresso live', 'ingressolive'], ARRAY['ingressos', 'eventos', 'show', 'tickets'],
 0.92, 92, 0, 'imported', '{"sector": "entertainment", "type": "tickets"}'),

('total acesso', 'Total Acesso', 'Lazer', 'Ingressos', 'merchant',
 ARRAY['total acesso', 'totalacesso'], ARRAY['ingressos', 'show', 'futebol', 'tickets'],
 0.92, 92, 0, 'imported', '{"sector": "entertainment", "type": "tickets"}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- PADRÕES BANCÁRIOS ADICIONAIS
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

('estorno', 'Estorno', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Estornos', 'banking_pattern',
 0.95, 95, 'estorno', 0, 'imported', '{"pattern_type": "banking", "description": "Devolução, reembolso, compra cancelada, crédito"}'),

('lancamentos futuros', 'Lançamentos Futuros', 'Outros', 'Débitos Automáticos', 'banking_pattern',
 0.85, 85, 'agendamento', 0, 'imported', '{"pattern_type": "banking", "description": "Agendamento, débito futuro, provisão"}'),

('encargo limite de credito', 'Encargo Limite de Crédito', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros', 'banking_pattern',
 0.92, 92, 'encargo', 0, 'imported', '{"pattern_type": "banking", "description": "Juros cheque especial, adiantamento depositante"}'),

('pagamento de cobranca', 'Pagamento de Cobrança', 'Outros', 'Pagamentos', 'banking_pattern',
 0.88, 88, 'pagamento', 0, 'imported', '{"pattern_type": "banking", "description": "Pagamento de boleto, pagamento de título"}'
)

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- ATUALIZAR MATERIALIZED VIEW
-- ============================================================================

REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_frequent_merchants;

COMMIT;

