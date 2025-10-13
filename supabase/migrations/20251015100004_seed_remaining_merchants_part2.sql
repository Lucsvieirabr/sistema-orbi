-- Migration: Seed remaining merchants Part 2
-- Casa, Assinaturas, Compras

BEGIN;

-- ============================================================================
-- CASA E MORADIA - Concessionárias e Serviços (faltantes)
-- ============================================================================

INSERT INTO public.merchants_dictionary (
  merchant_key, entity_name, category, subcategory, entry_type,
  aliases, keywords, confidence_modifier, priority, usage_count, source_type, metadata
) VALUES

-- Energia Elétrica
('enel', 'Enel', 'Casa', 'Energia Elétrica', 'utility',
 ARRAY['enel sp', 'enel rj', 'eletropaulo'], ARRAY['energia', 'luz', 'eletricidade'],
 0.95, 100, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["SP", "RJ"]}'),

('cpfl', 'CPFL', 'Casa', 'Energia Elétrica', 'utility',
 ARRAY['cpfl paulista', 'cpfl energia', 'clfsc'], ARRAY['energia', 'luz'],
 0.95, 100, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["SP"]}'),

('neoenergia', 'Neoenergia', 'Casa', 'Energia Elétrica', 'utility',
 ARRAY['elektro', 'coelba', 'celpe', 'cosern', 'celesc'], ARRAY['energia', 'luz'],
 0.90, 95, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["SP", "BA", "PE", "RN", "SC"]}'),

('energisa', 'Energisa', 'Casa', 'Energia Elétrica', 'utility',
 ARRAY['energisa energia'], ARRAY['energia', 'luz'],
 0.90, 95, 0, 'system', '{"sector": "utility", "state_specific": true}'),

('light', 'Light', 'Casa', 'Energia Elétrica', 'utility',
 ARRAY['light energia', 'light rj'], ARRAY['energia', 'luz'],
 0.95, 100, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["RJ"]}'),

('cemig', 'CEMIG', 'Casa', 'Energia Elétrica', 'utility',
 ARRAY['cemig mg', 'cemig energia'], ARRAY['energia', 'luz'],
 0.95, 100, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["MG"]}'),

('copel', 'Copel', 'Casa', 'Energia Elétrica', 'utility',
 ARRAY['copel energia', 'copel pr'], ARRAY['energia', 'luz'],
 0.90, 95, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["PR"]}'),

('enel sao paulo', 'Enel São Paulo', 'Casa', 'Energia Elétrica', 'utility',
 ARRAY['enel sp'], ARRAY['energia', 'luz'],
 0.95, 100, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["SP"]}'),

-- Água e Esgoto
('cedae', 'CEDAE', 'Casa', 'Água e Esgoto', 'utility',
 ARRAY['cedae rj'], ARRAY['agua', 'esgoto', 'saneamento'],
 0.90, 95, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["RJ"]}'),

('copasa', 'COPASA', 'Casa', 'Água e Esgoto', 'utility',
 ARRAY['copasa mg'], ARRAY['agua', 'esgoto', 'saneamento'],
 0.90, 95, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["MG"]}'),

('sanepar', 'Sanepar', 'Casa', 'Água e Esgoto', 'utility',
 ARRAY['sanepar pr'], ARRAY['agua', 'esgoto', 'saneamento'],
 0.85, 90, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["PR"]}'),

('casan', 'Casan', 'Casa', 'Água e Esgoto', 'utility',
 ARRAY['casan sc'], ARRAY['agua', 'esgoto', 'saneamento'],
 0.85, 90, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["SC"]}'),

('corsan', 'Corsan', 'Casa', 'Água e Esgoto', 'utility',
 ARRAY['corsan rs'], ARRAY['agua', 'esgoto', 'saneamento'],
 0.85, 90, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["RS"]}'),

('saneago', 'SANEAGO', 'Casa', 'Água e Esgoto', 'utility',
 ARRAY['saneago go', 'saneamento goias'], ARRAY['agua', 'esgoto', 'saneamento'],
 0.90, 95, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["GO"]}'),

-- Gás
('naturgy', 'Naturgy', 'Casa', 'Gás', 'utility',
 ARRAY['naturgy gas', 'ceg'], ARRAY['gas', 'gnv'],
 0.85, 90, 0, 'system', '{"sector": "utility", "state_specific": true, "states": ["RJ"]}'),

-- Internet e TV
('oi', 'Oi', 'Assinaturas', 'Internet e TV', 'merchant',
 ARRAY['oi fibra', 'oi internet', 'oi tv'], ARRAY['internet', 'tv', 'telefonia'],
 0.85, 90, 0, 'system', '{"sector": "telecom", "utility": true}'),

('sky', 'Sky', 'Assinaturas', 'Internet e TV', 'merchant',
 ARRAY['sky tv', 'sky brasil'], ARRAY['tv', 'televisao', 'assinatura'],
 0.85, 90, 0, 'system', '{"sector": "telecom", "utility": true}'),

-- Material de Construção
('leroy merlin', 'Leroy Merlin', 'Casa', 'Material de Construção', 'merchant',
 ARRAY['leroy'], ARRAY['construcao', 'reforma', 'material'],
 0.90, 95, 0, 'system', '{"sector": "home_improvement", "chain": true}'),

('telhanorte', 'Telhanorte', 'Casa', 'Material de Construção', 'merchant',
 ARRAY['saint-gobain', 'saintgobain'], ARRAY['construcao', 'reforma', 'material'],
 0.85, 90, 0, 'system', '{"sector": "home_improvement", "chain": true}'),

('cassol', 'Cassol', 'Casa', 'Material de Construção', 'merchant',
 ARRAY['cassol materiais'], ARRAY['construcao', 'reforma', 'material'],
 0.80, 85, 0, 'system', '{"sector": "home_improvement", "chain": true}'),

('cec', 'CEC', 'Casa', 'Material de Construção', 'merchant',
 ARRAY['cec materiais'], ARRAY['construcao', 'reforma', 'material'],
 0.75, 80, 0, 'system', '{"sector": "home_improvement", "chain": true}'),

-- Móveis e Decoração
('tok&stok', 'Tok&Stok', 'Casa', 'Móveis e Decoração', 'merchant',
 ARRAY['tokstok', 'tok stok'], ARRAY['moveis', 'decoracao'],
 0.85, 90, 0, 'system', '{"sector": "furniture", "chain": true}'),

('etna', 'Etna', 'Casa', 'Móveis e Decoração', 'merchant',
 ARRAY['etna moveis'], ARRAY['moveis', 'decoracao'],
 0.80, 85, 0, 'system', '{"sector": "furniture", "chain": true}'),

('camicado', 'Camicado', 'Casa', 'Móveis e Decoração', 'merchant',
 ARRAY['camicado casa'], ARRAY['decoracao', 'utilidades'],
 0.80, 85, 0, 'system', '{"sector": "home_goods", "chain": true}'),

-- ============================================================================
-- ASSINATURAS E SERVIÇOS DIGITAIS (faltantes)
-- ============================================================================

-- Streaming de Vídeo
('disney plus', 'Disney+', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['disney+', 'disneyplus', 'disney assinatura'], ARRAY['streaming', 'filme', 'serie'],
 0.95, 100, 0, 'system', '{"sector": "streaming", "subscription": true}'),

('hbo max', 'HBO Max', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['max', 'hbo assinatura', 'max assinatura'], ARRAY['streaming', 'filme', 'serie'],
 0.95, 100, 0, 'system', '{"sector": "streaming", "subscription": true}'),

('globoplay', 'Globoplay', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['globo play', 'globoplay assinatura'], ARRAY['streaming', 'filme', 'serie'],
 0.85, 90, 0, 'system', '{"sector": "streaming", "subscription": true}'),

-- Streaming de Música
('deezer', 'Deezer', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['deezer premium', 'deezer assinatura'], ARRAY['streaming', 'musica'],
 0.85, 90, 0, 'system', '{"sector": "streaming", "subscription": true}'),

('apple music', 'Apple Music', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['apple assinatura', 'itunes'], ARRAY['streaming', 'musica'],
 0.95, 100, 0, 'system', '{"sector": "streaming", "subscription": true}'),

('amazon music', 'Amazon Music', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['amazon music unlimited'], ARRAY['streaming', 'musica'],
 0.85, 90, 0, 'system', '{"sector": "streaming", "subscription": true}'),

('youtube premium', 'YouTube Premium', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['youtube music', 'youtube assinatura'], ARRAY['streaming', 'video', 'musica'],
 0.90, 95, 0, 'system', '{"sector": "streaming", "subscription": true}'),

-- Software e SaaS
('cursor ai', 'Cursor AI', 'Assinaturas', 'Software', 'merchant',
 ARRAY['cursor', 'cursor ai powered'], ARRAY['software', 'programacao', 'ide'],
 0.90, 95, 0, 'system', '{"sector": "software", "subscription": true}'),

('microsoft 365', 'Microsoft 365', 'Assinaturas', 'Software', 'merchant',
 ARRAY['office 365', 'office365', 'microsoft office'], ARRAY['software', 'office', 'produtividade'],
 0.95, 100, 0, 'system', '{"sector": "software", "subscription": true}'),

('adobe', 'Adobe', 'Assinaturas', 'Software', 'merchant',
 ARRAY['creative cloud', 'adobe cc', 'adobe creative'], ARRAY['software', 'design'],
 0.90, 95, 0, 'system', '{"sector": "software", "subscription": true}'),

('google workspace', 'Google Workspace', 'Assinaturas', 'Software', 'merchant',
 ARRAY['gsuite', 'g suite', 'google apps'], ARRAY['software', 'produtividade'],
 0.85, 90, 0, 'system', '{"sector": "software", "subscription": true}'),

('aws', 'Amazon Web Services', 'Assinaturas', 'Serviços de TI', 'merchant',
 ARRAY['amazon web services', 'aws cloud'], ARRAY['cloud', 'servidor', 'hospedagem'],
 0.90, 95, 0, 'system', '{"sector": "cloud", "subscription": true}'),

('google cloud', 'Google Cloud', 'Assinaturas', 'Serviços de TI', 'merchant',
 ARRAY['gcp', 'google cloud platform'], ARRAY['cloud', 'servidor', 'hospedagem'],
 0.85, 90, 0, 'system', '{"sector": "cloud", "subscription": true}'),

-- Armazenamento em Nuvem
('google one', 'Google One', 'Assinaturas', 'Armazenamento', 'merchant',
 ARRAY['google armazenamento'], ARRAY['armazenamento', 'nuvem', 'cloud'],
 0.90, 90, 0, 'system', '{"sector": "cloud_storage", "subscription": true}'),

('icloud', 'iCloud', 'Assinaturas', 'Armazenamento', 'merchant',
 ARRAY['icloud armazenamento', 'icloud+'], ARRAY['armazenamento', 'nuvem', 'cloud'],
 0.90, 90, 0, 'system', '{"sector": "cloud_storage", "subscription": true}'),

('dropbox', 'Dropbox', 'Assinaturas', 'Armazenamento', 'merchant',
 ARRAY['dropbox assinatura'], ARRAY['armazenamento', 'nuvem', 'cloud'],
 0.85, 85, 0, 'system', '{"sector": "cloud_storage", "subscription": true}'),

-- Domínios e Hospedagem
('nic br', 'NIC.br', 'Assinaturas', 'Registro de Domínio', 'merchant',
 ARRAY['registro.br', 'nic.br', 'registro br'], ARRAY['dominio', 'registro'],
 0.95, 100, 0, 'system', '{"sector": "domain", "subscription": true}'),

('godaddy', 'GoDaddy', 'Assinaturas', 'Hospedagem e Domínio', 'merchant',
 ARRAY['go daddy'], ARRAY['dominio', 'hospedagem'],
 0.85, 90, 0, 'system', '{"sector": "hosting", "subscription": true}'),

('hostgator', 'HostGator', 'Assinaturas', 'Hospedagem e Domínio', 'merchant',
 ARRAY['host gator'], ARRAY['dominio', 'hospedagem'],
 0.80, 85, 0, 'system', '{"sector": "hosting", "subscription": true}'),

('hostinger', 'Hostinger', 'Assinaturas', 'Hospedagem e Domínio', 'merchant',
 ARRAY['hostinger brasil'], ARRAY['dominio', 'hospedagem'],
 0.80, 85, 0, 'system', '{"sector": "hosting", "subscription": true}'),

-- ============================================================================
-- COMPRAS E VAREJO (faltantes)
-- ============================================================================

-- Lojas de Moda e Vestuário
('renner', 'Lojas Renner', 'Roupas e acessórios', 'Vestuário e Acessórios', 'merchant',
 ARRAY['lojas renner', 'renner lojas'], ARRAY['roupa', 'moda', 'vestuario'],
 0.90, 95, 0, 'system', '{"sector": "fashion", "chain": true}'),

('riachuelo', 'Riachuelo', 'Roupas e acessórios', 'Vestuário e Acessórios', 'merchant',
 ARRAY['rchlo', 'lojas riachuelo'], ARRAY['roupa', 'moda', 'vestuario'],
 0.90, 95, 0, 'system', '{"sector": "fashion", "chain": true}'),

('c&a', 'C&A', 'Roupas e acessórios', 'Vestuário e Acessórios', 'merchant',
 ARRAY['cea', 'c e a'], ARRAY['roupa', 'moda', 'vestuario'],
 0.85, 90, 0, 'system', '{"sector": "fashion", "chain": true}'),

('pernambucanas', 'Pernambucanas', 'Roupas e acessórios', 'Loja de Departamento', 'merchant',
 ARRAY['lojas pernambucanas'], ARRAY['roupa', 'departamento'],
 0.85, 90, 0, 'system', '{"sector": "department_store", "chain": true}'),

('hering', 'Hering', 'Roupas e acessórios', 'Vestuário e Acessórios', 'merchant',
 ARRAY['hering store'], ARRAY['roupa', 'moda'],
 0.80, 85, 0, 'system', '{"sector": "fashion", "chain": true}'),

('zara', 'Zara', 'Roupas e acessórios', 'Vestuário e Acessórios', 'merchant',
 ARRAY['zara brasil'], ARRAY['roupa', 'moda', 'vestuario'],
 0.85, 90, 0, 'system', '{"sector": "fashion", "chain": true}'),

('marisa', 'Marisa', 'Roupas e acessórios', 'Vestuário e Acessórios', 'merchant',
 ARRAY['lojas marisa'], ARRAY['roupa', 'moda'],
 0.80, 85, 0, 'system', '{"sector": "fashion", "chain": true}'),

('studio z', 'Studio Z', 'Roupas e acessórios', 'Calçados', 'merchant',
 ARRAY['studioz'], ARRAY['calcado', 'sapato'],
 0.80, 85, 0, 'system', '{"sector": "footwear", "chain": true}'),

('pdv cia da moda', 'Cia da Moda', 'Roupas e acessórios', 'Vestuário e Acessórios', 'merchant',
 ARRAY['cia da moda', 'companhia da moda'], ARRAY['roupa', 'moda'],
 0.75, 80, 0, 'system', '{"sector": "fashion", "regional": true}'),

-- Marketplaces e E-commerce
('mercado livre', 'Mercado Livre', 'Compras', 'Marketplace', 'merchant',
 ARRAY['mercadolivre', 'mercadopago', 'mercado pago'], ARRAY['marketplace', 'compras', 'loja online'],
 0.95, 100, 0, 'system', '{"sector": "marketplace", "chain": true}'),

('amazon', 'Amazon', 'Compras', 'Marketplace', 'merchant',
 ARRAY['amz', 'amazon brasil', 'amazon.com.br'], ARRAY['marketplace', 'compras', 'loja online'],
 0.95, 100, 0, 'system', '{"sector": "marketplace", "chain": true}'),

('magazine luiza', 'Magazine Luiza', 'Compras', 'Varejo', 'merchant',
 ARRAY['magalu', 'magazine luiza', 'magaz luiza'], ARRAY['varejo', 'loja', 'eletronicos'],
 0.90, 95, 0, 'system', '{"sector": "retail", "chain": true}'),

('casas bahia', 'Casas Bahia', 'Compras', 'Varejo', 'merchant',
 ARRAY['casasbahia'], ARRAY['varejo', 'loja', 'eletronicos'],
 0.90, 95, 0, 'system', '{"sector": "retail", "chain": true}'),

('ponto', 'Ponto', 'Compras', 'Varejo', 'merchant',
 ARRAY['pontofrio', 'ponto frio'], ARRAY['varejo', 'loja', 'eletronicos'],
 0.85, 90, 0, 'system', '{"sector": "retail", "chain": true}'),

('americanas', 'Americanas', 'Compras', 'Varejo', 'merchant',
 ARRAY['lojas americanas', 'americanas.com', 'b2w'], ARRAY['varejo', 'loja'],
 0.90, 95, 0, 'system', '{"sector": "retail", "chain": true}'),

('shopee', 'Shopee', 'Compras', 'Marketplace', 'merchant',
 ARRAY['shopee brasil'], ARRAY['marketplace', 'compras', 'loja online'],
 0.95, 100, 0, 'system', '{"sector": "marketplace", "app": true}'),

('shein', 'Shein', 'Roupas e acessórios', 'Vestuário e Acessórios', 'merchant',
 ARRAY['shein brasil'], ARRAY['roupa', 'moda', 'loja online'],
 0.85, 90, 0, 'system', '{"sector": "fashion_marketplace", "app": true}'),

('aliexpress', 'AliExpress', 'Compras', 'Marketplace', 'merchant',
 ARRAY['ali express'], ARRAY['marketplace', 'compras', 'importado'],
 0.85, 90, 0, 'system', '{"sector": "marketplace", "app": true}'),

('pix marketplace', 'Pix Marketplace', 'Compras', 'Marketplace', 'merchant',
 ARRAY['marketplace pix'], ARRAY['marketplace', 'compras'],
 0.70, 75, 0, 'system', '{"sector": "marketplace", "regional": true}'),

-- E-commerce de Moda
('dafiti', 'Dafiti', 'Roupas e acessórios', 'E-commerce Moda', 'merchant',
 ARRAY['dafiti brasil', 'dafiti.com.br'], ARRAY['roupa', 'moda', 'loja online'],
 0.90, 95, 0, 'system', '{"sector": "fashion_ecommerce", "chain": true}'),

('zattini', 'Zattini', 'Roupas e acessórios', 'E-commerce Moda/Calçados', 'merchant',
 ARRAY['zattini.com.br'], ARRAY['calcado', 'roupa', 'loja online'],
 0.85, 90, 0, 'system', '{"sector": "fashion_ecommerce", "chain": true}'),

('colcci', 'Colcci', 'Roupas e acessórios', 'Marcas de Moda Premium', 'merchant',
 ARRAY['colcci store', 'loja colcci'], ARRAY['roupa', 'moda', 'premium'],
 0.85, 90, 0, 'system', '{"sector": "fashion_premium", "chain": true}'),

-- E-commerce de Eletrônicos
('kabum', 'KaBuM!', 'Compras', 'E-commerce Eletrônicos', 'merchant',
 ARRAY['kabum!', 'kabum.com.br'], ARRAY['eletronicos', 'informatica', 'loja online'],
 0.90, 95, 0, 'system', '{"sector": "electronics_ecommerce", "chain": true}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- ATUALIZAR MATERIALIZED VIEW
-- ============================================================================

REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_frequent_merchants;

COMMIT;

