-- Migration: Seed priority merchants - Health, Retail, Education
-- High priority merchants focusing on gaps: electronics, health, construction, fashion, pet, entertainment
-- Based on comprehensive market research

BEGIN;

-- ============================================================================
-- VAREJO - ELETRÔNICOS E TECNOLOGIA
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

('fast shop', 'Fast Shop', 'Presentes / Compras', 'Eletrônicos', 'merchant',
 ARRAY['fastshop', 'fast', 'shop'], ARRAY['eletronicos', 'informatica', 'celular', 'tv'],
 0.92, 92, 0, 'imported', '{"sector": "electronics_retail", "chain": true}'),

('samsung store', 'Samsung Store', 'Presentes / Compras', 'Eletrônicos', 'merchant',
 ARRAY['samsung'], ARRAY['galaxy', 'qled', 'bespoke', 'celular', 'tv', 'eletrodomestico'],
 0.92, 92, 0, 'imported', '{"sector": "electronics_retail", "brand": true}'),

('apple store iplace', 'Apple Store / iPlace', 'Presentes / Compras', 'Eletrônicos', 'merchant',
 ARRAY['apple', 'iplace'], ARRAY['iphone', 'ipad', 'mac', 'macbook', 'watch', 'airpods'],
 0.95, 95, 0, 'imported', '{"sector": "electronics_retail", "brand": true}'),

('xiaomi store', 'Xiaomi Store', 'Presentes / Compras', 'Eletrônicos', 'merchant',
 ARRAY['xiaomi', 'mistore', 'mi'], ARRAY['redmi', 'poco', 'celular', 'smartband'],
 0.90, 90, 0, 'imported', '{"sector": "electronics_retail", "brand": true}'),

('positivo tecnologia', 'Positivo Tecnologia', 'Presentes / Compras', 'Eletrônicos', 'merchant',
 ARRAY['positivo'], ARRAY['informatica', 'computador', 'notebook', 'celular', 'vaio'],
 0.90, 90, 0, 'imported', '{"sector": "electronics_retail", "brand": true}'),

('dell', 'Dell', 'Presentes / Compras', 'Eletrônicos', 'merchant',
 ARRAY['dell'], ARRAY['computadores', 'notebook', 'laptop', 'alienware', 'monitor'],
 0.92, 92, 0, 'imported', '{"sector": "electronics_retail", "brand": true}'),

('hp store', 'HP Store', 'Presentes / Compras', 'Eletrônicos', 'merchant',
 ARRAY['hp', 'hewlettpackard'], ARRAY['impressora', 'notebook', 'desktop', 'instantink'],
 0.90, 90, 0, 'imported', '{"sector": "electronics_retail", "brand": true}'),

('multi multilaser', 'Multi', 'Presentes / Compras', 'Eletrônicos', 'merchant',
 ARRAY['multi', 'multilaser'], ARRAY['eletronicos', 'acessorios', 'warrior', 'pulse', 'giga'],
 0.88, 88, 0, 'imported', '{"sector": "electronics_retail", "brand": true}'),

-- ============================================================================
-- VAREJO - CONSTRUÇÃO E REFORMA
-- ============================================================================

('dicico', 'Dicico', 'Casa', 'Construção', 'merchant',
 ARRAY['dicico', 'sodimac'], ARRAY['construcao', 'reforma', 'casa', 'piso', 'tinta'],
 0.92, 92, 0, 'imported', '{"sector": "home_improvement", "chain": true}'),

('leroy merlin', 'Leroy Merlin', 'Casa', 'Construção', 'merchant',
 ARRAY['leroymerlin', 'leroy', 'merlin', 'lmcv'], ARRAY['bricolagem', 'construcao', 'decoracao', 'jardim'],
 0.95, 95, 0, 'imported', '{"sector": "home_improvement", "chain": true}'),

('obramax', 'Obramax', 'Casa', 'Construção', 'merchant',
 ARRAY['obramax', 'obra', 'max'], ARRAY['construcao', 'atacado', 'profissional', 'reforma'],
 0.90, 90, 0, 'imported', '{"sector": "home_improvement", "chain": true}'),

('telhanorte', 'Telhanorte', 'Casa', 'Construção', 'merchant',
 ARRAY['telhanorte', 'telha', 'norte'], ARRAY['construcao', 'reforma', 'acabamento'],
 0.92, 92, 0, 'imported', '{"sector": "home_improvement", "chain": true}'),

('c&c casa e construcao', 'C&C Casa e Construção', 'Casa', 'Construção', 'merchant',
 ARRAY['c&c', 'cec'], ARRAY['casa', 'construcao', 'reforma', 'piso', 'banheiro'],
 0.90, 90, 0, 'imported', '{"sector": "home_improvement", "chain": true}'),

-- ============================================================================
-- VAREJO - MÓVEIS E DECORAÇÃO
-- ============================================================================

('mobly', 'Mobly', 'Casa', 'Móveis', 'merchant',
 ARRAY['mobly'], ARRAY['moveis', 'decoracao', 'sofa', 'cama', 'casa', 'online'],
 0.92, 92, 0, 'imported', '{"sector": "furniture", "online": true}'),

('madeira madeira', 'Madeira Madeira', 'Casa', 'Móveis', 'merchant',
 ARRAY['madeiramadeira', 'madeira'], ARRAY['moveis', 'decoracao', 'casa', 'online'],
 0.92, 92, 0, 'imported', '{"sector": "furniture", "online": true}'),

('tokstok', 'Tok&Stok', 'Casa', 'Móveis', 'merchant',
 ARRAY['tokstok', 'tok', 'stok'], ARRAY['moveis', 'decoracao', 'design', 'casa', 'presente'],
 0.92, 92, 0, 'imported', '{"sector": "furniture", "chain": true}'),

('etna', 'Etna', 'Casa', 'Móveis', 'merchant',
 ARRAY['etna'], ARRAY['moveis', 'decoracao', 'utilidades', 'casa', 'cama', 'mesa', 'banho'],
 0.90, 90, 0, 'imported', '{"sector": "furniture", "chain": true}'),

('camicado', 'Camicado', 'Casa', 'Utilidades', 'merchant',
 ARRAY['camicado'], ARRAY['casa', 'cozinha', 'decoracao', 'lista', 'casamento', 'louca'],
 0.90, 90, 0, 'imported', '{"sector": "home_goods", "chain": true}'),

-- ============================================================================
-- VAREJO - ÓTICAS
-- ============================================================================

('oticas carol', 'Óticas Carol', 'Presentes / Compras', 'Ótica', 'merchant',
 ARRAY['oticascarol', 'oticas', 'carol'], ARRAY['oculos', 'lentes', 'armacao'],
 0.92, 92, 0, 'imported', '{"sector": "optical", "chain": true}'),

('oticas diniz', 'Óticas Diniz', 'Presentes / Compras', 'Ótica', 'merchant',
 ARRAY['oticasdiniz', 'oticas', 'diniz'], ARRAY['oculos', 'lentes', 'visao'],
 0.92, 92, 0, 'imported', '{"sector": "optical", "chain": true}'),

('chilli beans', 'Chilli Beans', 'Presentes / Compras', 'Ótica', 'merchant',
 ARRAY['chillibeans', 'chilli', 'beans'], ARRAY['oculos', 'sol', 'relogio', 'armacao'],
 0.92, 92, 0, 'imported', '{"sector": "optical", "chain": true}'),

-- ============================================================================
-- VAREJO - LIVRARIAS
-- ============================================================================

('livraria da travessa', 'Livraria da Travessa', 'Presentes / Compras', 'Livraria', 'merchant',
 ARRAY['livrariadatravessa', 'travessa'], ARRAY['livros', 'dvd', 'blueray'],
 0.90, 90, 0, 'imported', '{"sector": "bookstore", "chain": true}'),

('livraria leitura', 'Livraria Leitura', 'Presentes / Compras', 'Livraria', 'merchant',
 ARRAY['livrarialeitura', 'leitura'], ARRAY['livros', 'papelaria', 'revista'],
 0.90, 90, 0, 'imported', '{"sector": "bookstore", "chain": true}'),

('fnac', 'Fnac', 'Presentes / Compras', 'Livraria', 'merchant',
 ARRAY['fnac'], ARRAY['livros', 'eletronicos', 'cultura', 'musica'],
 0.92, 92, 0, 'imported', '{"sector": "bookstore", "chain": true}'),

('livraria da vila', 'Livraria da Vila', 'Presentes / Compras', 'Livraria', 'merchant',
 ARRAY['livrariadavila', 'vila'], ARRAY['livros', 'cultura', 'papelaria'],
 0.90, 90, 0, 'imported', '{"sector": "bookstore", "chain": true}'),

-- ============================================================================
-- SAÚDE - HOSPITAIS E CLÍNICAS
-- ============================================================================

('hospital albert einstein', 'Hospital Albert Einstein', 'Proteção Pessoal / Saúde / Farmácia', 'Hospital', 'merchant',
 ARRAY['einstein'], ARRAY['hospital', 'saude', 'consulta', 'exame', 'internacao'],
 0.95, 95, 0, 'imported', '{"sector": "health", "type": "hospital", "tier": "premium"}'),

('hospital sirio libanes', 'Hospital Sírio-Libanês', 'Proteção Pessoal / Saúde / Farmácia', 'Hospital', 'merchant',
 ARRAY['siriolibanes', 'sirio', 'libanes', 'hsl'], ARRAY['hospital', 'saude', 'consulta'],
 0.95, 95, 0, 'imported', '{"sector": "health", "type": "hospital", "tier": "premium"}'),

('hospital santa catarina', 'Hospital Santa Catarina', 'Proteção Pessoal / Saúde / Farmácia', 'Hospital', 'merchant',
 ARRAY['hospitalsantacatarina', 'santa', 'catarina'], ARRAY['hospital', 'avpaulista', 'saude'],
 0.92, 92, 0, 'imported', '{"sector": "health", "type": "hospital"}'),

('hospital alemao oswaldo cruz', 'Hospital Alemão Oswaldo Cruz', 'Proteção Pessoal / Saúde / Farmácia', 'Hospital', 'merchant',
 ARRAY['oswaldocruz', 'hospitalalemao', 'haoc'], ARRAY['hospital', 'saude', 'consulta'],
 0.92, 92, 0, 'imported', '{"sector": "health", "type": "hospital", "tier": "premium"}'),

('dr consulta', 'Dr. Consulta', 'Proteção Pessoal / Saúde / Farmácia', 'Clínica', 'merchant',
 ARRAY['drconsulta', 'doutorconsulta'], ARRAY['clinica', 'medico', 'exame', 'popular'],
 0.95, 95, 0, 'imported', '{"sector": "health", "type": "clinic", "tier": "popular"}'),

('omint', 'Omint', 'Proteção Pessoal / Saúde / Farmácia', 'Plano de Saúde', 'merchant',
 ARRAY['omint'], ARRAY['planosaude', 'convenio', 'medico', 'clinica', 'reembolso'],
 0.92, 92, 0, 'imported', '{"sector": "health_insurance"}'),

('clinipam', 'Clinipam', 'Proteção Pessoal / Saúde / Farmácia', 'Plano de Saúde', 'merchant',
 ARRAY['clinipam'], ARRAY['hapvida', 'ndi', 'planosaude', 'consulta', 'exame'],
 0.90, 90, 0, 'imported', '{"sector": "health_insurance"}'),

('santa casa de misericordia', 'Santa Casa de Misericórdia', 'Proteção Pessoal / Saúde / Farmácia', 'Hospital', 'merchant',
 ARRAY['santacasa', 'misericordia'], ARRAY['hospital', 'sus', 'filantropico'],
 0.92, 92, 0, 'imported', '{"sector": "health", "type": "hospital", "tier": "public"}'),

-- ============================================================================
-- SAÚDE - LABORATÓRIOS
-- ============================================================================

('grupo fleury', 'Grupo Fleury', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório', 'merchant',
 ARRAY['fleury'], ARRAY['laboratorio', 'exame', 'diagnostico', 'sangue', 'imagem', 'saudeid', 'pupilla'],
 0.95, 95, 0, 'imported', '{"sector": "health", "type": "lab", "group": true}'),

('alta diagnosticos', 'Alta Diagnósticos', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório', 'merchant',
 ARRAY['altadiagnosticos', 'alta'], ARRAY['dasa', 'laboratorio', 'exame', 'imagem', 'diagnostico'],
 0.92, 92, 0, 'imported', '{"sector": "health", "type": "lab"}'),

('db diagnosticos do brasil', 'DB Diagnósticos do Brasil', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório', 'merchant',
 ARRAY['dbdiagnosticos', 'dblab'], ARRAY['laboratorio', 'apoio', 'exame', 'analise'],
 0.90, 90, 0, 'imported', '{"sector": "health", "type": "lab"}'),

('hermes pardini', 'Hermes Pardini', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório', 'merchant',
 ARRAY['hermespardini', 'pardini'], ARRAY['laboratorio', 'exame', 'diagnostico', 'genetica'],
 0.92, 92, 0, 'imported', '{"sector": "health", "type": "lab"}'),

('laboratorio sabin', 'Laboratório Sabin', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório', 'merchant',
 ARRAY['sabin'], ARRAY['laboratorio', 'exame', 'analise', 'clinica', 'vacina'],
 0.92, 92, 0, 'imported', '{"sector": "health", "type": "lab"}'),

('lab exame', 'Lab Exame', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório', 'merchant',
 ARRAY['labexame', 'exame'], ARRAY['laboratorio', 'analise', 'clinica', 'diagnostico'],
 0.90, 90, 0, 'imported', '{"sector": "health", "type": "lab"}'),

('laboratorio alvaro', 'Laboratório Alvaro', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório', 'merchant',
 ARRAY['alvaro'], ARRAY['laboratorio', 'nav', 'dasa', 'exame', 'vacina', 'diagnostico'],
 0.90, 90, 0, 'imported', '{"sector": "health", "type": "lab"}'),

-- ============================================================================
-- SAÚDE - ODONTOLOGIA
-- ============================================================================

('odontoprev', 'OdontoPrev', 'Proteção Pessoal / Saúde / Farmácia', 'Plano Odontológico', 'merchant',
 ARRAY['odontoprev', 'odonto', 'prev'], ARRAY['dental', 'dentista', 'plano', 'bradesco'],
 0.95, 95, 0, 'imported', '{"sector": "dental_insurance"}'),

('amil dental', 'Amil Dental', 'Proteção Pessoal / Saúde / Farmácia', 'Plano Odontológico', 'merchant',
 ARRAY['amildental', 'amil'], ARRAY['dental', 'odonto', 'plano', 'dentista', 'e35', 'k25'],
 0.92, 92, 0, 'imported', '{"sector": "dental_insurance"}'),

('dentaluni', 'DentalUni', 'Proteção Pessoal / Saúde / Farmácia', 'Plano Odontológico', 'merchant',
 ARRAY['dentaluni', 'dental', 'uni'], ARRAY['cooperativa', 'odonto', 'plano', 'dentista'],
 0.90, 90, 0, 'imported', '{"sector": "dental_insurance", "type": "cooperative"}'),

('odonto company', 'Odonto Company', 'Proteção Pessoal / Saúde / Farmácia', 'Odontologia', 'merchant',
 ARRAY['odontocompany', 'odonto', 'company'], ARRAY['clinica', 'dentista', 'implante', 'ortodontia'],
 0.92, 92, 0, 'imported', '{"sector": "dental_clinic", "chain": true}'),

('sorridents', 'Sorridents', 'Proteção Pessoal / Saúde / Farmácia', 'Odontologia', 'merchant',
 ARRAY['sorridents'], ARRAY['clinica', 'odontologica', 'dentista', 'sorriso', 'tratamento'],
 0.90, 90, 0, 'imported', '{"sector": "dental_clinic", "chain": true}'),

-- ============================================================================
-- LAZER - CINEMAS
-- ============================================================================

('uci cinemas', 'UCI Cinemas', 'Lazer', 'Cinema', 'merchant',
 ARRAY['uci', 'ucinemas'], ARRAY['cinema', 'filme', 'ingresso', 'kinoplex'],
 0.92, 92, 0, 'imported', '{"sector": "entertainment", "type": "cinema"}'),

('kinoplex', 'Kinoplex', 'Lazer', 'Cinema', 'merchant',
 ARRAY['kinoplex'], ARRAY['cinema', 'severianoribeiro', 'filme', 'ingresso'],
 0.92, 92, 0, 'imported', '{"sector": "entertainment", "type": "cinema"}'),

('moviecom cinemas', 'Moviecom Cinemas', 'Lazer', 'Cinema', 'merchant',
 ARRAY['moviecom'], ARRAY['cinema', 'filme', 'ingresso', 'moviecom+'],
 0.90, 90, 0, 'imported', '{"sector": "entertainment", "type": "cinema"}'),

('cinematografica araujo', 'Cinematográfica Araújo', 'Lazer', 'Cinema', 'merchant',
 ARRAY['cinearaujo', 'araujo'], ARRAY['cinema', 'filme', 'ingresso'],
 0.88, 88, 0, 'imported', '{"sector": "entertainment", "type": "cinema"}'),

('cineflix', 'Cineflix', 'Lazer', 'Cinema', 'merchant',
 ARRAY['cineflix'], ARRAY['cinemas', 'filme', 'ingresso', 'shopping'],
 0.88, 88, 0, 'imported', '{"sector": "entertainment", "type": "cinema"}'),

('espaco itau de cinema', 'Espaço Itaú de Cinema', 'Lazer', 'Cinema', 'merchant',
 ARRAY['espacoitau', 'itaucinemas'], ARRAY['cinema', 'filme', 'cult', 'arte'],
 0.88, 88, 0, 'imported', '{"sector": "entertainment", "type": "cinema"}'),

-- ============================================================================
-- LAZER - INGRESSOS E EVENTOS
-- ============================================================================

('sympla', 'Sympla', 'Lazer', 'Ingressos', 'merchant',
 ARRAY['sympla'], ARRAY['ingresso', 'show', 'evento', 'curso', 'palestra', 'online'],
 0.95, 95, 0, 'imported', '{"sector": "entertainment", "type": "tickets"}'),

('ingresso com', 'Ingresso.com', 'Lazer', 'Ingressos', 'merchant',
 ARRAY['ingressocom', 'ingresso'], ARRAY['cinema', 'show', 'teatro', 'futebol'],
 0.95, 95, 0, 'imported', '{"sector": "entertainment", "type": "tickets"}'),

('eventbrite', 'Eventbrite', 'Lazer', 'Ingressos', 'merchant',
 ARRAY['eventbrite'], ARRAY['ingresso', 'evento', 'inscricao', 'conferencia'],
 0.92, 92, 0, 'imported', '{"sector": "entertainment", "type": "tickets"}'),

('ticketmaster', 'Ticketmaster', 'Lazer', 'Ingressos', 'merchant',
 ARRAY['ticketmaster'], ARRAY['ingresso', 'show', 'festival', 'lollapalooza', 'concerto'],
 0.95, 95, 0, 'imported', '{"sector": "entertainment", "type": "tickets"}'),

('bilheteria digital', 'Bilheteria Digital', 'Lazer', 'Ingressos', 'merchant',
 ARRAY['bilheteriadigital'], ARRAY['ingresso', 'evento', 'festa', 'show'],
 0.90, 90, 0, 'imported', '{"sector": "entertainment", "type": "tickets"}'),

('t4f', 'T4F', 'Lazer', 'Ingressos', 'merchant',
 ARRAY['t4f', 'ticketsforfun'], ARRAY['ingresso', 'show', 'teatro', 'musical', 'evento'],
 0.90, 90, 0, 'imported', '{"sector": "entertainment", "type": "tickets"}'),

-- ============================================================================
-- LAZER - PARQUES E ATRAÇÕES
-- ============================================================================

('hopi hari', 'Hopi Hari', 'Lazer', 'Parque Temático', 'merchant',
 ARRAY['hopihari'], ARRAY['parque', 'diversao', 'montanharussa', 'ingresso', 'vinhedo'],
 0.92, 92, 0, 'imported', '{"sector": "entertainment", "type": "theme_park"}'),

('beto carrero world', 'Beto Carrero World', 'Lazer', 'Parque Temático', 'merchant',
 ARRAY['betocarrero', 'beto', 'carrero'], ARRAY['parque', 'penha', 'diversao', 'show'],
 0.92, 92, 0, 'imported', '{"sector": "entertainment", "type": "theme_park"}'),

('playcenter family', 'Playcenter Family', 'Lazer', 'Parque Temático', 'merchant',
 ARRAY['playcenter', 'playcenterfamily'], ARRAY['parque', 'diversao', 'shopping', 'aricanduva'],
 0.88, 88, 0, 'imported', '{"sector": "entertainment", "type": "theme_park"}'),

('hot park', 'Hot Park', 'Lazer', 'Parque Aquático', 'merchant',
 ARRAY['hotpark'], ARRAY['rioquente', 'parque', 'aquatico', 'goias', 'toboga', 'piscina'],
 0.90, 90, 0, 'imported', '{"sector": "entertainment", "type": "water_park"}'),

('thermas dos laranjais', 'Thermas dos Laranjais', 'Lazer', 'Parque Aquático', 'merchant',
 ARRAY['thermaslaranjais', 'thermas', 'laranjais'], ARRAY['olimpia', 'parque', 'aquatico', 'piscina'],
 0.92, 92, 0, 'imported', '{"sector": "entertainment", "type": "water_park"}'),

('wetnwild', 'Wet''n Wild', 'Lazer', 'Parque Aquático', 'merchant',
 ARRAY['wetnwild', 'wet', 'wild'], ARRAY['parque', 'aquatico', 'piscina', 'toboagua'],
 0.90, 90, 0, 'imported', '{"sector": "entertainment", "type": "water_park"}'),

('snowland gramado', 'Snowland Gramado', 'Lazer', 'Parque Temático', 'merchant',
 ARRAY['snowland'], ARRAY['gramado', 'neve', 'parque', 'esqui', 'snowboard'],
 0.88, 88, 0, 'imported', '{"sector": "entertainment", "type": "theme_park"}'),

-- ============================================================================
-- LAZER - TEATROS
-- ============================================================================

('teatro alfa', 'Teatro Alfa', 'Lazer', 'Teatro', 'merchant',
 ARRAY['teatroalfa', 'teatro', 'alfa'], ARRAY['musical', 'espetaculo', 'show'],
 0.88, 88, 0, 'imported', '{"sector": "entertainment", "type": "theater"}'),

('teatro bradesco', 'Teatro Bradesco', 'Lazer', 'Teatro', 'merchant',
 ARRAY['teatrobradesco', 'teatro', 'bradesco'], ARRAY['show', 'musical', 'bourbon'],
 0.88, 88, 0, 'imported', '{"sector": "entertainment", "type": "theater"}'),

('teatro gazeta', 'Teatro Gazeta', 'Lazer', 'Teatro', 'merchant',
 ARRAY['teatrogazeta', 'teatro', 'gazeta'], ARRAY['comedia', 'standup', 'paulista'],
 0.85, 85, 0, 'imported', '{"sector": "entertainment", "type": "theater"}'),

('teatro faap', 'Teatro FAAP', 'Lazer', 'Teatro', 'merchant',
 ARRAY['teatrofaap', 'teatro', 'faap'], ARRAY['espetaculo', 'peca', 'higienopolis'],
 0.85, 85, 0, 'imported', '{"sector": "entertainment", "type": "theater"}'),

-- ============================================================================
-- PET - LOJAS E SERVIÇOS
-- ============================================================================

('zee dog', 'Zee.Dog', 'Pet', 'Pet Shop', 'merchant',
 ARRAY['zeedog', 'zeenow'], ARRAY['pet', 'petshop', 'cachorro', 'gato', 'coleira', 'guia'],
 0.90, 90, 0, 'imported', '{"sector": "pet", "type": "retail"}'),

('petco', 'Petco', 'Pet', 'Pet Shop', 'merchant',
 ARRAY['petco'], ARRAY['pet', 'shop', 'animal', 'racao', 'brinquedo'],
 0.88, 88, 0, 'imported', '{"sector": "pet", "type": "retail"}'),

('pet urban', 'Pet Urban', 'Pet', 'Pet Shop', 'merchant',
 ARRAY['peturban', 'pet', 'urbano'], ARRAY['banho', 'tosa', 'racao'],
 0.85, 85, 0, 'imported', '{"sector": "pet", "type": "retail"}'),

('animale pet', 'Animale Pet', 'Pet', 'Pet Shop', 'merchant',
 ARRAY['animalepet', 'pet'], ARRAY['shop', 'acessorios', 'animal'],
 0.85, 85, 0, 'imported', '{"sector": "pet", "type": "retail"}'),

('vet quality', 'Vet Quality', 'Pet', 'Veterinária', 'merchant',
 ARRAY['vetquality'], ARRAY['veterinario', 'clinica', 'pet', 'animal', 'consulta'],
 0.88, 88, 0, 'imported', '{"sector": "pet", "type": "vet"}'),

('doghero', 'DogHero', 'Pet', 'Serviços Pet', 'merchant',
 ARRAY['doghero'], ARRAY['pet', 'cachorro', 'gato', 'hotel', 'hospedagem', 'passeador', 'creche'],
 0.90, 90, 0, 'imported', '{"sector": "pet", "type": "service", "app": true}'),

('petanjo', 'PetAnjo', 'Pet', 'Serviços Pet', 'merchant',
 ARRAY['petanjo'], ARRAY['pet', 'servicos', 'babapet', 'adestrador'],
 0.85, 85, 0, 'imported', '{"sector": "pet", "type": "service"}'),

('cao cidadao', 'Cão Cidadão', 'Pet', 'Serviços Pet', 'merchant',
 ARRAY['caocidadao', 'cao', 'cidadao'], ARRAY['adestramento', 'comportamento', 'petz', 'drpet'],
 0.85, 85, 0, 'imported', '{"sector": "pet", "type": "service"}'),

('royal canin store', 'Royal Canin Store', 'Pet', 'Pet Shop', 'merchant',
 ARRAY['royalcanin', 'royal', 'canin'], ARRAY['racao', 'pet', 'gato', 'cachorro'],
 0.88, 88, 0, 'imported', '{"sector": "pet", "type": "retail", "brand": true}'),

('farmina', 'Farmina', 'Pet', 'Pet Shop', 'merchant',
 ARRAY['farmina'], ARRAY['racao', 'pet', 'n&d', 'natural', 'delicious', 'gato', 'cachorro'],
 0.85, 85, 0, 'imported', '{"sector": "pet", "type": "retail", "brand": true}'),

('premier pet', 'Premier Pet', 'Pet', 'Pet Shop', 'merchant',
 ARRAY['premierpet', 'premier'], ARRAY['racao', 'golden', 'pet', 'cachorro', 'gato'],
 0.85, 85, 0, 'imported', '{"sector": "pet", "type": "retail", "brand": true}'),

-- ============================================================================
-- ESTUDOS - ESCOLAS K-12
-- ============================================================================

('colegio objetivo', 'Colégio Objetivo', 'Estudos', 'Escola', 'merchant',
 ARRAY['objetivo'], ARRAY['colegio', 'escola', 'mensalidade', 'sistema', 'ensino'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "k12"}'),

('colegio anglo', 'Colégio Anglo', 'Estudos', 'Escola', 'merchant',
 ARRAY['anglo'], ARRAY['colegio', 'escola', 'mensalidade', 'sistema', 'vestibular'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "k12"}'),

('colegio etapa', 'Colégio Etapa', 'Estudos', 'Escola', 'merchant',
 ARRAY['etapa'], ARRAY['colegio', 'escola', 'mensalidade', 'cursinho', 'vestibular'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "k12"}'),

('colegio bandeirantes', 'Colégio Bandeirantes', 'Estudos', 'Escola', 'merchant',
 ARRAY['bandeirantes', 'band'], ARRAY['colegio', 'escola', 'mensalidade'],
 0.90, 90, 0, 'imported', '{"sector": "education", "type": "k12"}'),

('colegio dante alighieri', 'Colégio Dante Alighieri', 'Estudos', 'Escola', 'merchant',
 ARRAY['dantealighieri', 'dante'], ARRAY['colegio', 'escola', 'mensalidade', 'italiano'],
 0.90, 90, 0, 'imported', '{"sector": "education", "type": "k12"}'),

('colegio porto seguro', 'Colégio Porto Seguro', 'Estudos', 'Escola', 'merchant',
 ARRAY['portoseguro', 'colegioporto', 'porto'], ARRAY['escola', 'mensalidade', 'alemao'],
 0.90, 90, 0, 'imported', '{"sector": "education", "type": "k12"}'),

('colegio pentagono', 'Colégio Pentágono', 'Estudos', 'Escola', 'merchant',
 ARRAY['pentagono'], ARRAY['colegio', 'escola', 'mensalidade', 'sistema', 'ensino'],
 0.88, 88, 0, 'imported', '{"sector": "education", "type": "k12"}'),

('colegio miguel de cervantes', 'Colégio Miguel de Cervantes', 'Estudos', 'Escola', 'merchant',
 ARRAY['migueldecervantes', 'cervantes'], ARRAY['colegio', 'escola', 'mensalidade', 'espanhol'],
 0.88, 88, 0, 'imported', '{"sector": "education", "type": "k12"}'),

-- ============================================================================
-- FILHOS / DEPENDENTES - BRINQUEDOS
-- ============================================================================

('ri happy', 'Ri Happy', 'Filhos / Dependentes', 'Brinquedos', 'merchant',
 ARRAY['rihappy', 'ri', 'happy'], ARRAY['brinquedos', 'criancas', 'presente', 'jogo'],
 0.92, 92, 0, 'imported', '{"sector": "toys", "chain": true}'),

('pbkids', 'PBKids', 'Filhos / Dependentes', 'Brinquedos', 'merchant',
 ARRAY['pbkids'], ARRAY['brinquedos', 'criancas', 'bebe', 'presente'],
 0.90, 90, 0, 'imported', '{"sector": "toys", "chain": true}'),

('lego store', 'Lego Store', 'Filhos / Dependentes', 'Brinquedos', 'merchant',
 ARRAY['legostore', 'lego'], ARRAY['blocos', 'brinquedo', 'crianca', 'construcao'],
 0.90, 90, 0, 'imported', '{"sector": "toys", "brand": true}'),

-- ============================================================================
-- ROUPAS E ACESSÓRIOS - INFANTIL
-- ============================================================================

('lilica e tigor', 'Lilica & Tigor', 'Roupas e acessórios', 'Infantil', 'merchant',
 ARRAY['lilicaetigor', 'lilicaripilica', 'tigorttigre'], ARRAY['roupa', 'infantil', 'crianca'],
 0.90, 90, 0, 'imported', '{"sector": "fashion", "type": "kids"}'),

('brandili', 'Brandili', 'Roupas e acessórios', 'Infantil', 'merchant',
 ARRAY['brandili'], ARRAY['roupa', 'infantil', 'crianca', 'bebe', 'moda'],
 0.88, 88, 0, 'imported', '{"sector": "fashion", "type": "kids"}'),

('malwee kids', 'Malwee Kids', 'Roupas e acessórios', 'Infantil', 'merchant',
 ARRAY['malweekids', 'malwee'], ARRAY['roupa', 'infantil', 'crianca', 'moda'],
 0.88, 88, 0, 'imported', '{"sector": "fashion", "type": "kids"}'),

('hering kids', 'Hering Kids', 'Roupas e acessórios', 'Infantil', 'merchant',
 ARRAY['heringkids', 'hering'], ARRAY['roupa', 'infantil', 'crianca', 'basico'],
 0.88, 88, 0, 'imported', '{"sector": "fashion", "type": "kids"}'),

('marisol', 'Marisol', 'Roupas e acessórios', 'Infantil', 'merchant',
 ARRAY['marisol'], ARRAY['roupa', 'infantil', 'crianca', 'bebe', 'mineral', 'kids'],
 0.88, 88, 0, 'imported', '{"sector": "fashion", "type": "kids"}'),

-- ============================================================================
-- ROUPAS E ACESSÓRIOS - MODA PREMIUM
-- ============================================================================

('farm rio', 'Farm Rio', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['farm', 'farmrio'], ARRAY['roupa', 'moda', 'feminina', 'vestido', 'estampa'],
 0.92, 92, 0, 'imported', '{"sector": "fashion", "tier": "premium"}'),

('animale', 'Animale', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['animale'], ARRAY['roupa', 'moda', 'feminina', 'premium', 'grife'],
 0.92, 92, 0, 'imported', '{"sector": "fashion", "tier": "premium"}'),

('colcci', 'Colcci', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['colcci'], ARRAY['roupa', 'moda', 'jeans', 'gisele', 'fashion'],
 0.90, 90, 0, 'imported', '{"sector": "fashion"}'),

('richards', 'Richards', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['richards'], ARRAY['roupa', 'moda', 'masculina', 'feminina', 'classica'],
 0.88, 88, 0, 'imported', '{"sector": "fashion"}'),

('dudalina', 'Dudalina', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['dudalina'], ARRAY['camisa', 'social', 'roupa', 'moda', 'feminina', 'masculina'],
 0.90, 90, 0, 'imported', '{"sector": "fashion"}'),

('reserva', 'Reserva', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['reserva', 'usereserva'], ARRAY['roupa', 'moda', 'masculina', 'camiseta', 'pica-pau'],
 0.92, 92, 0, 'imported', '{"sector": "fashion"}'),

('aramis', 'Aramis', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['aramis'], ARRAY['menswear', 'roupa', 'moda', 'masculina', 'social', 'camisa'],
 0.88, 88, 0, 'imported', '{"sector": "fashion"}'),

('john john', 'John John', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['johnjohn'], ARRAY['roupa', 'moda', 'jeans', 'jovem', 'balada'],
 0.88, 88, 0, 'imported', '{"sector": "fashion"}'),

-- ============================================================================
-- ROUPAS E ACESSÓRIOS - CALÇADOS E ACESSÓRIOS
-- ============================================================================

('arezzo', 'Arezzo', 'Roupas e acessórios', 'Calçados', 'merchant',
 ARRAY['arezzo'], ARRAY['sapato', 'calcado', 'bolsa', 'sandalia', 'bota', 'feminino'],
 0.92, 92, 0, 'imported', '{"sector": "fashion", "type": "shoes"}'),

('schutz', 'Schutz', 'Roupas e acessórios', 'Calçados', 'merchant',
 ARRAY['schutz'], ARRAY['sapato', 'calcado', 'bolsa', 'sandalia', 'salto', 'bota'],
 0.92, 92, 0, 'imported', '{"sector": "fashion", "type": "shoes"}'),

('melissa', 'Melissa', 'Roupas e acessórios', 'Calçados', 'merchant',
 ARRAY['melissa', 'melissaoficial'], ARRAY['sapato', 'plastico', 'sandalia', 'galeriamelissa'],
 0.92, 92, 0, 'imported', '{"sector": "fashion", "type": "shoes"}'),

('havaianas store', 'Havaianas Store', 'Roupas e acessórios', 'Calçados', 'merchant',
 ARRAY['havaianas'], ARRAY['chinelo', 'sandalia', 'alpargatas', 'loja'],
 0.92, 92, 0, 'imported', '{"sector": "fashion", "type": "shoes"}'),

('nike store', 'Nike Store', 'Roupas e acessórios', 'Calçados', 'merchant',
 ARRAY['nikestore', 'nike'], ARRAY['tenis', 'roupa', 'esporte', 'corrida', 'airjordan', 'dunk'],
 0.95, 95, 0, 'imported', '{"sector": "fashion", "type": "sports"}'),

('adidas store', 'Adidas Store', 'Roupas e acessórios', 'Calçados', 'merchant',
 ARRAY['adidasstore', 'adidas'], ARRAY['tenis', 'roupa', 'esporte', 'originals', 'samba', 'gazelle'],
 0.95, 95, 0, 'imported', '{"sector": "fashion", "type": "sports"}'),

('puma store', 'Puma Store', 'Roupas e acessórios', 'Calçados', 'merchant',
 ARRAY['pumastore', 'puma'], ARRAY['tenis', 'roupa', 'esporte', 'sneaker'],
 0.90, 90, 0, 'imported', '{"sector": "fashion", "type": "sports"}'),

('zattini', 'Zattini', 'Roupas e acessórios', 'Calçados', 'merchant',
 ARRAY['zattini'], ARRAY['sapatos', 'bolsas', 'moda', 'online'],
 0.90, 90, 0, 'imported', '{"sector": "fashion", "type": "shoes", "online": true}'),

('dafiti', 'Dafiti', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['dafiti'], ARRAY['moda', 'online', 'roupa', 'calcados'],
 0.92, 92, 0, 'imported', '{"sector": "fashion", "online": true}'),

('posthaus', 'Posthaus', 'Roupas e acessórios', 'Vestuário', 'merchant',
 ARRAY['posthaus'], ARRAY['moda', 'online', 'roupa'],
 0.88, 88, 0, 'imported', '{"sector": "fashion", "online": true}'),

-- ============================================================================
-- ROUPAS E ACESSÓRIOS - ÍNTIMAS E MODA PRAIA
-- ============================================================================

('hope', 'Hope', 'Roupas e acessórios', 'Lingerie', 'merchant',
 ARRAY['hope'], ARRAY['lingerie', 'calcinha', 'sutia', 'pijama', 'moda', 'intima'],
 0.90, 90, 0, 'imported', '{"sector": "fashion", "type": "lingerie"}'),

('lupo store', 'Lupo Store', 'Roupas e acessórios', 'Lingerie', 'merchant',
 ARRAY['lupo'], ARRAY['meias', 'cueca', 'lingerie', 'semcostura', 'roupa', 'fitness'],
 0.90, 90, 0, 'imported', '{"sector": "fashion", "type": "underwear"}'),

('salinas', 'Salinas', 'Roupas e acessórios', 'Moda Praia', 'merchant',
 ARRAY['salinas'], ARRAY['moda', 'praia', 'biquini', 'maio', 'saida', 'verao'],
 0.88, 88, 0, 'imported', '{"sector": "fashion", "type": "beachwear"}'),

('rosa cha', 'Rosa Chá', 'Roupas e acessórios', 'Moda Praia', 'merchant',
 ARRAY['rosacha', 'rosa', 'cha'], ARRAY['moda', 'praia', 'biquini', 'fitness', 'roupa'],
 0.88, 88, 0, 'imported', '{"sector": "fashion", "type": "beachwear"}'),

-- ============================================================================
-- INVESTIMENTOS - CRIPTOMOEDAS
-- ============================================================================

('mercado bitcoin', 'Mercado Bitcoin', 'Investimentos (pelo menos 20% da receita)', 'Criptomoedas', 'merchant',
 ARRAY['mercadobitcoin', 'mb'], ARRAY['crypto', 'bitcoin', 'criptomoedas', 'exchange', 'btc', 'eth'],
 0.95, 95, 0, 'imported', '{"sector": "crypto", "type": "exchange"}'),

('binance', 'Binance', 'Investimentos (pelo menos 20% da receita)', 'Criptomoedas', 'merchant',
 ARRAY['binance'], ARRAY['crypto', 'criptomoedas', 'bitcoin', 'exchange', 'corretora', 'bnb'],
 0.95, 95, 0, 'imported', '{"sector": "crypto", "type": "exchange"}'),

('foxbit', 'Foxbit', 'Investimentos (pelo menos 20% da receita)', 'Criptomoedas', 'merchant',
 ARRAY['foxbit'], ARRAY['crypto', 'bitcoin', 'criptomoedas', 'exchange', 'corretora'],
 0.92, 92, 0, 'imported', '{"sector": "crypto", "type": "exchange"}'),

('bitso brasil', 'Bitso Brasil', 'Investimentos (pelo menos 20% da receita)', 'Criptomoedas', 'merchant',
 ARRAY['bitso'], ARRAY['crypto', 'bitcoin', 'criptomoedas', 'exchange', 'corretora'],
 0.90, 90, 0, 'imported', '{"sector": "crypto", "type": "exchange"}'),

('novadax', 'NovaDAX', 'Investimentos (pelo menos 20% da receita)', 'Criptomoedas', 'merchant',
 ARRAY['novadax', 'dax'], ARRAY['crypto', 'bitcoin', 'criptomoedas', 'exchange', 'corretora'],
 0.90, 90, 0, 'imported', '{"sector": "crypto", "type": "exchange"}'),

-- ============================================================================
-- INVESTIMENTOS - CORRETORAS
-- ============================================================================

('modalmais', 'Modalmais', 'Investimentos (pelo menos 20% da receita)', 'Corretora', 'merchant',
 ARRAY['modalmais', 'modal'], ARRAY['investimentos', 'corretora', 'banco', 'digital', 'trader', 'homebroker'],
 0.92, 92, 0, 'imported', '{"sector": "brokerage"}'),

('orama', 'Órama', 'Investimentos (pelo menos 20% da receita)', 'Corretora', 'merchant',
 ARRAY['orama'], ARRAY['investimentos', 'corretora', 'fundos', 'acoes', 'tesouro'],
 0.90, 90, 0, 'imported', '{"sector": "brokerage"}'),

('terra investimentos', 'Terra Investimentos', 'Investimentos (pelo menos 20% da receita)', 'Corretora', 'merchant',
 ARRAY['terrainvestimentos', 'terra'], ARRAY['corretora', 'investimento', 'agro', 'mercado', 'futuro'],
 0.88, 88, 0, 'imported', '{"sector": "brokerage"}'),

('guide investimentos', 'Guide Investimentos', 'Investimentos (pelo menos 20% da receita)', 'Corretora', 'merchant',
 ARRAY['guide'], ARRAY['investimentos', 'corretora', 'acoes', 'assessoria', 'xp'],
 0.88, 88, 0, 'imported', '{"sector": "brokerage"}'),

('agora investimentos', 'Ágora Investimentos', 'Investimentos (pelo menos 20% da receita)', 'Corretora', 'merchant',
 ARRAY['agora', 'agorainvestimentos'], ARRAY['bradesco', 'corretora', 'acoes', 'investir'],
 0.90, 90, 0, 'imported', '{"sector": "brokerage"}'),

('genial investimentos', 'Genial Investimentos', 'Investimentos (pelo menos 20% da receita)', 'Corretora', 'merchant',
 ARRAY['genial'], ARRAY['investimentos', 'corretora', 'plataforma', 'trader', 'acoes'],
 0.88, 88, 0, 'imported', '{"sector": "brokerage"}'),

-- ============================================================================
-- GASTOS COM PJ - CONTABILIDADE
-- ============================================================================

('contabilizei', 'Contabilizei', 'Gastos com PJ / Profissionais Autônomos', 'Contabilidade', 'merchant',
 ARRAY['contabilizei'], ARRAY['contabilidade', 'online', 'contador', 'pj', 'mei', 'abrir', 'empresa'],
 0.95, 95, 0, 'imported', '{"sector": "accounting", "online": true}'),

('agilize', 'Agilize', 'Gastos com PJ / Profissionais Autônomos', 'Contabilidade', 'merchant',
 ARRAY['agilize'], ARRAY['contabilidade', 'online', 'contador', 'pj', 'simples', 'nacional'],
 0.92, 92, 0, 'imported', '{"sector": "accounting", "online": true}'),

('contmais', 'ContMais', 'Gastos com PJ / Profissionais Autônomos', 'Contabilidade', 'merchant',
 ARRAY['contmais'], ARRAY['contabilidade', 'assessoria', 'consultoria', 'pj', 'empresa'],
 0.88, 88, 0, 'imported', '{"sector": "accounting"}'),

-- ============================================================================
-- GASTOS COM PJ - SEGUROS
-- ============================================================================

('porto seguro', 'Porto Seguro', 'Gastos com PJ / Profissionais Autônomos', 'Seguros', 'merchant',
 ARRAY['portoseguro', 'porto', 'seguro'], ARRAY['auto', 'carro', 'residencia', 'vida', 'itau'],
 0.95, 95, 0, 'imported', '{"sector": "insurance"}'),

('sulamerica', 'SulAmérica', 'Gastos com PJ / Profissionais Autônomos', 'Seguros', 'merchant',
 ARRAY['sulamerica'], ARRAY['seguros', 'saude', 'vida', 'odonto', 'previdencia', 'auto'],
 0.95, 95, 0, 'imported', '{"sector": "insurance"}'),

('bradesco seguros', 'Bradesco Seguros', 'Gastos com PJ / Profissionais Autônomos', 'Seguros', 'merchant',
 ARRAY['bradescoseguros', 'bradesco'], ARRAY['seguro', 'auto', 'vida', 'residencia', 'saude'],
 0.95, 95, 0, 'imported', '{"sector": "insurance"}'),

('itau seguros', 'Itaú Seguros', 'Gastos com PJ / Profissionais Autônomos', 'Seguros', 'merchant',
 ARRAY['itauseguros', 'itau'], ARRAY['seguro', 'vida', 'viagem', 'prestamista', 'portoseguro'],
 0.95, 95, 0, 'imported', '{"sector": "insurance"}'),

('mapfre', 'Mapfre', 'Gastos com PJ / Profissionais Autônomos', 'Seguros', 'merchant',
 ARRAY['mapfre'], ARRAY['seguros', 'auto', 'carro', 'vida', 'residencial', 'assistencia'],
 0.92, 92, 0, 'imported', '{"sector": "insurance"}'),

('liberty seguros', 'Liberty Seguros', 'Gastos com PJ / Profissionais Autônomos', 'Seguros', 'merchant',
 ARRAY['liberty'], ARRAY['seguros', 'auto', 'vida', 'residencia', 'empresa'],
 0.90, 90, 0, 'imported', '{"sector": "insurance"}'),

-- ============================================================================
-- BEM ESTAR / BELEZA - ACADEMIAS
-- ============================================================================

('runner', 'Runner', 'Bem Estar / Beleza', 'Academia', 'merchant',
 ARRAY['runner'], ARRAY['academia', 'club', 'fitness', 'ginastica', 'musculacao'],
 0.88, 88, 0, 'imported', '{"sector": "fitness"}'),

('curves', 'Curves', 'Bem Estar / Beleza', 'Academia', 'merchant',
 ARRAY['curves'], ARRAY['academia', 'mulheres', 'fitness', 'circuito', 'emagrecimento'],
 0.88, 88, 0, 'imported', '{"sector": "fitness", "specialty": "women"}'),

-- ============================================================================
-- BEM ESTAR / BELEZA - SALÕES E COSMÉTICOS
-- ============================================================================

('jacques janine', 'Jacques Janine', 'Bem Estar / Beleza', 'Salão', 'merchant',
 ARRAY['jacquesjanine', 'jj'], ARRAY['salao', 'beleza', 'cabelo', 'cabeleireiro', 'estetica'],
 0.92, 92, 0, 'imported', '{"sector": "beauty", "type": "salon"}'),

('marco antonio de biaggi', 'Marco Antonio de Biaggi', 'Bem Estar / Beleza', 'Salão', 'merchant',
 ARRAY['mbiaggi', 'm.a.b.'], ARRAY['salao', 'beleza', 'cabelo', 'cabeleireiro', 'mg', 'hair'],
 0.90, 90, 0, 'imported', '{"sector": "beauty", "type": "salon"}'),

('beleza natural', 'Beleza Natural', 'Bem Estar / Beleza', 'Salão', 'merchant',
 ARRAY['belezanatural', 'bn'], ARRAY['salao', 'cabelo', 'cachos', 'crespo', 'tratamento'],
 0.92, 92, 0, 'imported', '{"sector": "beauty", "type": "salon", "specialty": "curly_hair"}'),

('epoca cosmeticos', 'Época Cosméticos', 'Bem Estar / Beleza', 'Cosméticos', 'merchant',
 ARRAY['epocacosmeticos', 'epoca'], ARRAY['cosmeticos', 'perfume', 'maquiagem', 'beleza', 'magalu'],
 0.90, 90, 0, 'imported', '{"sector": "beauty", "type": "cosmetics"}'),

('the beauty box', 'The Beauty Box', 'Bem Estar / Beleza', 'Cosméticos', 'merchant',
 ARRAY['thebeautybox', 'beauty', 'box'], ARRAY['cosmeticos', 'perfume', 'maquiagem', 'boticario'],
 0.88, 88, 0, 'imported', '{"sector": "beauty", "type": "cosmetics"}'),

('quem disse berenice', 'Quem Disse Berenice', 'Bem Estar / Beleza', 'Cosméticos', 'merchant',
 ARRAY['quemdisseberenice', 'qdb', 'berenice'], ARRAY['maquiagem', 'cosmeticos', 'batom', 'boticario'],
 0.92, 92, 0, 'imported', '{"sector": "beauty", "type": "cosmetics"}'),

('natura', 'Natura', 'Bem Estar / Beleza', 'Cosméticos', 'merchant',
 ARRAY['natura'], ARRAY['cosmeticos', 'perfume', 'beleza'],
 0.95, 95, 0, 'imported', '{"sector": "beauty", "type": "cosmetics"}'),

('sephora', 'Sephora', 'Bem Estar / Beleza', 'Cosméticos', 'merchant',
 ARRAY['sephora'], ARRAY['maquiagem', 'cosmeticos', 'perfume', 'importado'],
 0.95, 95, 0, 'imported', '{"sector": "beauty", "type": "cosmetics"}'),

('avon', 'Avon', 'Bem Estar / Beleza', 'Cosméticos', 'merchant',
 ARRAY['avon'], ARRAY['cosmeticos', 'maquiagem', 'revendedora'],
 0.92, 92, 0, 'imported', '{"sector": "beauty", "type": "cosmetics"}'),

('mac cosmetics', 'MAC Cosmetics', 'Bem Estar / Beleza', 'Cosméticos', 'merchant',
 ARRAY['mac'], ARRAY['maquiagem', 'cosmeticos', 'batom'],
 0.92, 92, 0, 'imported', '{"sector": "beauty", "type": "cosmetics", "tier": "premium"}'),

-- ============================================================================
-- PRESENTES / COMPRAS - E-COMMERCE E VAREJO GERAL
-- ============================================================================

('pernambucanas', 'Pernambucanas', 'Presentes / Compras', 'Varejo', 'merchant',
 ARRAY['pernambucanas'], ARRAY['lojas', 'casa', 'roupa'],
 0.90, 90, 0, 'imported', '{"sector": "retail", "chain": true}'),

('havan', 'Havan', 'Presentes / Compras', 'Varejo', 'merchant',
 ARRAY['havan'], ARRAY['lojas', 'departamento', 'casa', 'roupa'],
 0.92, 92, 0, 'imported', '{"sector": "retail", "chain": true}'),

('submarino', 'Submarino', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['submarino'], ARRAY['compras', 'online', 'livros', 'games', 'tecnologia'],
 0.92, 92, 0, 'imported', '{"sector": "ecommerce"}'),

('shoptime', 'Shoptime', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['shoptime'], ARRAY['compras', 'online', 'casa', 'tv'],
 0.90, 90, 0, 'imported', '{"sector": "ecommerce"}'),

('olx', 'OLX', 'Presentes / Compras', 'Classificados', 'merchant',
 ARRAY['olx'], ARRAY['classificados', 'usados', 'compras'],
 0.90, 90, 0, 'imported', '{"sector": "marketplace", "type": "classifieds"}'),

('enjoei', 'Enjoei', 'Presentes / Compras', 'E-commerce', 'merchant',
 ARRAY['enjoei'], ARRAY['brecho', 'online', 'usados', 'roupa'],
 0.90, 90, 0, 'imported', '{"sector": "ecommerce", "type": "secondhand"}'),

('kalunga', 'Kalunga', 'Presentes / Compras', 'Papelaria', 'merchant',
 ARRAY['kalunga'], ARRAY['papelaria', 'escritorio', 'informatica'],
 0.92, 92, 0, 'imported', '{"sector": "stationery", "chain": true}'),

-- ============================================================================
-- CASA - IMOBILIÁRIO
-- ============================================================================

('quintoandar', 'QuintoAndar', 'Casa', 'Aluguel', 'merchant',
 ARRAY['quintoandar'], ARRAY['aluguel', 'imobiliaria', 'boleto'],
 0.95, 95, 0, 'imported', '{"sector": "real_estate", "type": "rental"}'),

('loft', 'Loft', 'Casa', 'Imobiliária', 'merchant',
 ARRAY['loft'], ARRAY['imoveis', 'compra', 'venda', 'reforma'],
 0.90, 90, 0, 'imported', '{"sector": "real_estate"}'),

-- ============================================================================
-- CASA - CONCESSIONÁRIAS ADICIONAIS
-- ============================================================================

('celesc', 'Celesc', 'Casa', 'Energia Elétrica', 'merchant',
 ARRAY['celesc'], ARRAY['energia', 'luz', 'conta', 'sc'],
 0.95, 95, 0, 'imported', '{"sector": "utility", "type": "energy", "state": "SC"}'),

('ceee equatorial', 'CEEE Equatorial', 'Casa', 'Energia Elétrica', 'merchant',
 ARRAY['ceee', 'equatorial'], ARRAY['energia', 'luz', 'conta', 'rs'],
 0.92, 92, 0, 'imported', '{"sector": "utility", "type": "energy", "state": "RS"}'),

('rge sul', 'RGE Sul', 'Casa', 'Energia Elétrica', 'merchant',
 ARRAY['rge'], ARRAY['energia', 'luz', 'conta', 'rs', 'cpfl'],
 0.92, 92, 0, 'imported', '{"sector": "utility", "type": "energy", "state": "RS"}'),

('aguas do rio', 'Águas do Rio', 'Casa', 'Água e Esgoto', 'merchant',
 ARRAY['aguasdorio'], ARRAY['agua', 'saneamento', 'conta', 'rj'],
 0.92, 92, 0, 'imported', '{"sector": "utility", "type": "water", "state": "RJ"}'),

('compesa', 'Compesa', 'Casa', 'Água e Esgoto', 'merchant',
 ARRAY['compesa'], ARRAY['agua', 'saneamento', 'conta', 'pe'],
 0.92, 92, 0, 'imported', '{"sector": "utility", "type": "water", "state": "PE"}'),

('saneago', 'Saneago', 'Casa', 'Água e Esgoto', 'merchant',
 ARRAY['saneago'], ARRAY['agua', 'saneamento', 'conta', 'go'],
 0.92, 92, 0, 'imported', '{"sector": "utility", "type": "water", "state": "GO"}'),

('algar telecom', 'Algar Telecom', 'Assinaturas', 'Telefonia', 'merchant',
 ARRAY['algar', 'telecom'], ARRAY['internet', 'celular', 'conta'],
 0.90, 90, 0, 'imported', '{"sector": "telecom"}'),

('ultragaz', 'Ultragaz', 'Casa', 'Gás', 'merchant',
 ARRAY['ultragaz'], ARRAY['gas', 'botijao'],
 0.92, 92, 0, 'imported', '{"sector": "utility", "type": "gas"}'),

('brasilgas', 'Brasilgás', 'Casa', 'Gás', 'merchant',
 ARRAY['brasilgas'], ARRAY['gas', 'botijao'],
 0.90, 90, 0, 'imported', '{"sector": "utility", "type": "gas"}'),

-- ============================================================================
-- PRESENTES / COMPRAS - VAREJO ADICIONAL
-- ============================================================================

('decathlon', 'Decathlon', 'Presentes / Compras', 'Esportes', 'merchant',
 ARRAY['decathlon'], ARRAY['esportes', 'artigos', 'roupa', 'equipamento'],
 0.95, 95, 0, 'imported', '{"sector": "sports_retail", "chain": true}'),

('trackfield', 'Track&Field', 'Presentes / Compras', 'Esportes', 'merchant',
 ARRAY['trackfield'], ARRAY['esportes', 'corrida', 'roupa'],
 0.90, 90, 0, 'imported', '{"sector": "sports_retail"}'),

-- ============================================================================
-- DIARISTA / PRESTADORES - SERVIÇOS
-- ============================================================================

('getninjas', 'GetNinjas', 'Diarista / Prestadores Serv.', 'App de Serviços', 'merchant',
 ARRAY['getninjas'], ARRAY['servicos', 'prestadores', 'reforma', 'frete'],
 0.92, 92, 0, 'imported', '{"sector": "services", "type": "app"}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- ATUALIZAR MATERIALIZED VIEW
-- ============================================================================

REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_frequent_merchants;

COMMIT;

