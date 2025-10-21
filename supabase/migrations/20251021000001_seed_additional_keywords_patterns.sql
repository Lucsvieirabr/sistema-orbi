-- Migration: Seed additional keywords and patterns
-- Part 2: Education, Subscriptions, Travel, Banking, and Income patterns

BEGIN;

-- ============================================================================
-- ESTUDOS - UNIVERSIDADES (Complemento)
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

('unopar', 'Unopar', 'Estudos', 'Universidade', 'merchant',
 ARRAY['unopar'], ARRAY['universidade', 'mensalidade', 'ead', 'cogna'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "private_university", "ead": true}'),

('anhanguera', 'Anhanguera', 'Estudos', 'Universidade', 'merchant',
 ARRAY['anhanguera'], ARRAY['faculdade', 'universidade', 'ead', 'cogna'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "private_university", "ead": true}'),

('mackenzie', 'Mackenzie', 'Estudos', 'Universidade', 'merchant',
 ARRAY['mackenzie'], ARRAY['universidade', 'presbiteriana', 'mensalidade'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "private_university"}'),

('ufsc', 'UFSC', 'Estudos', 'Universidade', 'merchant',
 ARRAY['ufsc'], ARRAY['universidade', 'federal', 'santa', 'catarina', 'publica', 'taxa'],
 0.95, 95, 0, 'imported', '{"sector": "education", "type": "public_university"}'),

('unb', 'UnB', 'Estudos', 'Universidade', 'merchant',
 ARRAY['unb'], ARRAY['universidade', 'brasilia', 'publica', 'taxa'],
 0.95, 95, 0, 'imported', '{"sector": "education", "type": "public_university"}'),

-- ============================================================================
-- ESTUDOS - CURSOS ONLINE
-- ============================================================================

('alura', 'Alura', 'Estudos', 'Cursos Online', 'merchant',
 ARRAY['alura'], ARRAY['cursos', 'online', 'tecnologia', 'programacao'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "online", "focus": "tech"}'),

('hotmart', 'Hotmart', 'Estudos', 'Cursos Online', 'merchant',
 ARRAY['hotmart'], ARRAY['curso', 'online', 'plataforma'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "platform"}'),

('eduzz', 'Eduzz', 'Estudos', 'Cursos Online', 'merchant',
 ARRAY['eduzz'], ARRAY['curso', 'online', 'plataforma'],
 0.90, 90, 0, 'imported', '{"sector": "education", "type": "platform"}'),

-- ============================================================================
-- ESTUDOS - IDIOMAS
-- ============================================================================

('wizard', 'Wizard', 'Estudos', 'Idiomas', 'merchant',
 ARRAY['wizard'], ARRAY['idiomas', 'ingles', 'escola'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "language"}'),

('ccaa', 'CCAA', 'Estudos', 'Idiomas', 'merchant',
 ARRAY['ccaa'], ARRAY['idiomas', 'ingles', 'espanhol', 'escola'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "language"}'),

('cultura inglesa', 'Cultura Inglesa', 'Estudos', 'Idiomas', 'merchant',
 ARRAY['culturainglesa'], ARRAY['ingles', 'escola', 'idiomas'],
 0.92, 92, 0, 'imported', '{"sector": "education", "type": "language"}'),

-- ============================================================================
-- ASSINATURAS - STREAMING
-- ============================================================================

('disney plus', 'Disney+', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['disneyplus', 'disney'], ARRAY['streaming', 'filmes', 'pixar', 'marvel'],
 0.95, 95, 0, 'imported', '{"sector": "streaming"}'),

('star plus', 'Star+', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['starplus', 'star'], ARRAY['streaming', 'espn', 'futebol', 'series'],
 0.92, 92, 0, 'imported', '{"sector": "streaming", "type": "sports"}'),

('apple tv plus', 'Apple TV+', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['appletv', 'apple'], ARRAY['streaming', 'series'],
 0.92, 92, 0, 'imported', '{"sector": "streaming"}'),

('paramount plus', 'Paramount+', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['paramount'], ARRAY['streaming', 'filmes', 'series'],
 0.90, 90, 0, 'imported', '{"sector": "streaming"}'),

('youtube premium', 'YouTube Premium', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['youtube', 'premium'], ARRAY['musica', 'videos', 'sem', 'anuncios'],
 0.95, 95, 0, 'imported', '{"sector": "streaming", "type": "video"}'),

('deezer', 'Deezer', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['deezer'], ARRAY['musica', 'streaming'],
 0.90, 90, 0, 'imported', '{"sector": "streaming", "type": "music"}'),

('apple music', 'Apple Music', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['applemusic'], ARRAY['musica', 'streaming'],
 0.92, 92, 0, 'imported', '{"sector": "streaming", "type": "music"}'),

('tidal', 'Tidal', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['tidal'], ARRAY['musica', 'streaming', 'hifi'],
 0.88, 88, 0, 'imported', '{"sector": "streaming", "type": "music"}'),

('amazon music', 'Amazon Music', 'Assinaturas', 'Streaming', 'merchant',
 ARRAY['amazonmusic'], ARRAY['musica', 'streaming'],
 0.90, 90, 0, 'imported', '{"sector": "streaming", "type": "music"}'),

-- ============================================================================
-- ASSINATURAS - CLOUD E SAAS
-- ============================================================================

('google cloud', 'Google Cloud', 'Assinaturas', 'Cloud', 'merchant',
 ARRAY['googlecloud', 'gcp'], ARRAY['cloud', 'hospedagem', 'servidor', 'api'],
 0.95, 95, 0, 'imported', '{"sector": "cloud"}'),

('amazon web services', 'Amazon Web Services', 'Assinaturas', 'Cloud', 'merchant',
 ARRAY['aws', 'amazon'], ARRAY['cloud', 'servidor', 's3', 'ec2'],
 0.95, 95, 0, 'imported', '{"sector": "cloud"}'),

('vercel', 'Vercel', 'Assinaturas', 'Cloud', 'merchant',
 ARRAY['vercel'], ARRAY['hospedagem', 'frontend', 'deploy'],
 0.92, 92, 0, 'imported', '{"sector": "cloud"}'),

('digitalocean', 'DigitalOcean', 'Assinaturas', 'Cloud', 'merchant',
 ARRAY['digitalocean', 'do'], ARRAY['cloud', 'servidor', 'droplet'],
 0.92, 92, 0, 'imported', '{"sector": "cloud"}'),

('microsoft azure', 'Microsoft Azure', 'Assinaturas', 'Cloud', 'merchant',
 ARRAY['azure', 'microsoft'], ARRAY['cloud', 'servidor'],
 0.95, 95, 0, 'imported', '{"sector": "cloud"}'),

('ibm cloud', 'IBM Cloud', 'Assinaturas', 'Cloud', 'merchant',
 ARRAY['ibmcloud', 'ibm'], ARRAY['cloud', 'servidor'],
 0.90, 90, 0, 'imported', '{"sector": "cloud"}'),

('oracle cloud', 'Oracle Cloud', 'Assinaturas', 'Cloud', 'merchant',
 ARRAY['oraclecloud', 'oci'], ARRAY['cloud', 'servidor'],
 0.90, 90, 0, 'imported', '{"sector": "cloud"}'),

('adobe', 'Adobe', 'Assinaturas', 'Software', 'merchant',
 ARRAY['adobe'], ARRAY['creative', 'cloud', 'photoshop', 'pdf', 'assinatura'],
 0.95, 95, 0, 'imported', '{"sector": "software"}'),

('microsoft 365', 'Microsoft 365', 'Assinaturas', 'Software', 'merchant',
 ARRAY['microsoft365', 'office'], ARRAY['word', 'excel', 'assinatura'],
 0.95, 95, 0, 'imported', '{"sector": "software"}'),

('google workspace', 'Google Workspace', 'Assinaturas', 'Software', 'merchant',
 ARRAY['google', 'workspace', 'gsuite'], ARRAY['gmail', 'drive', 'docs'],
 0.95, 95, 0, 'imported', '{"sector": "software"}'),

('dropbox', 'Dropbox', 'Assinaturas', 'Cloud', 'merchant',
 ARRAY['dropbox'], ARRAY['armazenamento', 'nuvem', 'cloud', 'backup'],
 0.92, 92, 0, 'imported', '{"sector": "cloud_storage"}'),

('icloud', 'iCloud', 'Assinaturas', 'Cloud', 'merchant',
 ARRAY['icloud', 'apple'], ARRAY['armazenamento', 'nuvem', 'backup'],
 0.92, 92, 0, 'imported', '{"sector": "cloud_storage"}'),

('jetbrains', 'JetBrains', 'Assinaturas', 'Software', 'merchant',
 ARRAY['jetbrains'], ARRAY['ide', 'programacao', 'software', 'licenca'],
 0.90, 90, 0, 'imported', '{"sector": "software", "type": "dev_tools"}'),

('figma', 'Figma', 'Assinaturas', 'Software', 'merchant',
 ARRAY['figma'], ARRAY['design', 'ui', 'ux', 'prototipo', 'assinatura'],
 0.95, 95, 0, 'imported', '{"sector": "software", "type": "design"}'),

('canva', 'Canva', 'Assinaturas', 'Software', 'merchant',
 ARRAY['canva'], ARRAY['design', 'pro', 'assinatura'],
 0.95, 95, 0, 'imported', '{"sector": "software", "type": "design"}'),

-- ============================================================================
-- ASSINATURAS - GAMES
-- ============================================================================

('steam', 'Steam', 'Assinaturas', 'Games', 'merchant',
 ARRAY['steam'], ARRAY['jogos', 'games', 'valve', 'compra'],
 0.95, 95, 0, 'imported', '{"sector": "gaming"}'),

('nuuvem', 'Nuuvem', 'Assinaturas', 'Games', 'merchant',
 ARRAY['nuuvem'], ARRAY['jogos', 'games', 'pc', 'compra'],
 0.90, 90, 0, 'imported', '{"sector": "gaming"}'),

('playstation network', 'PlayStation Network', 'Assinaturas', 'Games', 'merchant',
 ARRAY['psn', 'playstation', 'sony'], ARRAY['jogos', 'plus', 'assinatura'],
 0.95, 95, 0, 'imported', '{"sector": "gaming"}'),

('xbox live', 'Xbox Live', 'Assinaturas', 'Games', 'merchant',
 ARRAY['xbox', 'live'], ARRAY['game', 'pass', 'microsoft', 'jogos', 'assinatura'],
 0.95, 95, 0, 'imported', '{"sector": "gaming"}'),

('nintendo eshop', 'Nintendo eShop', 'Assinaturas', 'Games', 'merchant',
 ARRAY['nintendo', 'eshop'], ARRAY['switch', 'jogos', 'compra'],
 0.92, 92, 0, 'imported', '{"sector": "gaming"}'),

-- ============================================================================
-- BEM ESTAR / BELEZA - ACADEMIAS (Assinaturas)
-- ============================================================================

('gympass', 'Gympass', 'Bem Estar / Beleza', 'Academia', 'merchant',
 ARRAY['gympass'], ARRAY['academia', 'bem', 'estar', 'assinatura'],
 0.95, 95, 0, 'imported', '{"sector": "fitness", "type": "subscription"}'),

('totalpass', 'Totalpass', 'Bem Estar / Beleza', 'Academia', 'merchant',
 ARRAY['totalpass'], ARRAY['academia', 'bem', 'estar', 'assinatura'],
 0.92, 92, 0, 'imported', '{"sector": "fitness", "type": "subscription"}'),

-- ============================================================================
-- PROTEÇÃO PESSOAL / SAÚDE / FARMÁCIA - FARMÁCIAS ADICIONAIS
-- ============================================================================

('panvel', 'Panvel', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['panvel'], ARRAY['farmacia', 'remedios', 'sul'],
 0.92, 92, 0, 'imported', '{"sector": "pharmacy", "chain": true, "region": "sul"}'),

('drogaria onofre', 'Drogaria Onofre', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['onofre'], ARRAY['drogaria', 'farmacia', 'remedios'],
 0.90, 90, 0, 'imported', '{"sector": "pharmacy", "chain": true}'),

('extrafarma', 'Extrafarma', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['extrafarma'], ARRAY['farmacia', 'remedios'],
 0.90, 90, 0, 'imported', '{"sector": "pharmacy", "chain": true}'),

('ultrafarma', 'Ultrafarma', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['ultrafarma'], ARRAY['farmacia', 'remedios', 'genericos'],
 0.90, 90, 0, 'imported', '{"sector": "pharmacy", "chain": true}'),

('farmacias app', 'Farmácias App', 'Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant',
 ARRAY['farmaciasapp'], ARRAY['delivery', 'farmacia', 'remedios'],
 0.88, 88, 0, 'imported', '{"sector": "pharmacy", "type": "delivery"}'),

-- ============================================================================
-- PROTEÇÃO PESSOAL / SAÚDE / FARMÁCIA - PLANOS ADICIONAIS
-- ============================================================================

('golden cross', 'Golden Cross', 'Proteção Pessoal / Saúde / Farmácia', 'Plano de Saúde', 'merchant',
 ARRAY['goldencross'], ARRAY['plano', 'saude', 'convenio', 'medico'],
 0.90, 90, 0, 'imported', '{"sector": "health_insurance"}'),

-- ============================================================================
-- LAZER - ENTRETENIMENTO ADICIONAL
-- ============================================================================

('sesc', 'Sesc', 'Lazer', 'Centro de Lazer', 'merchant',
 ARRAY['sesc'], ARRAY['servico', 'social', 'comercio', 'lazer', 'cultura', 'almoco'],
 0.92, 92, 0, 'imported', '{"sector": "entertainment", "type": "social_service"}'),

-- ============================================================================
-- FÉRIAS / VIAGENS - AGÊNCIAS E HOSPEDAGEM
-- ============================================================================

('cvc', 'CVC', 'Férias / Viagens', 'Agência', 'merchant',
 ARRAY['cvc'], ARRAY['viagem', 'turismo', 'pacote', 'hotel', 'agencia'],
 0.95, 95, 0, 'imported', '{"sector": "travel"}'),

('decolar', 'Decolar', 'Férias / Viagens', 'Agência Online', 'merchant',
 ARRAY['decolar'], ARRAY['viagem', 'passagem', 'hotel', 'pacote', 'online'],
 0.95, 95, 0, 'imported', '{"sector": "travel", "type": "ota"}'),

('booking com', 'Booking.com', 'Férias / Viagens', 'Agência Online', 'merchant',
 ARRAY['booking'], ARRAY['hotel', 'reserva', 'hospedagem', 'viagem'],
 0.95, 95, 0, 'imported', '{"sector": "travel", "type": "ota"}'),

('airbnb', 'Airbnb', 'Férias / Viagens', 'Hospedagem', 'merchant',
 ARRAY['airbnb'], ARRAY['hospedagem', 'aluguel', 'temporada', 'viagem'],
 0.95, 95, 0, 'imported', '{"sector": "travel", "type": "sharing"}'),

('hoteis com', 'Hoteis.com', 'Férias / Viagens', 'Agência Online', 'merchant',
 ARRAY['hoteis'], ARRAY['hotel', 'reserva', 'hospedagem', 'viagem'],
 0.92, 92, 0, 'imported', '{"sector": "travel", "type": "ota"}'),

('trivago', 'Trivago', 'Férias / Viagens', 'Agência Online', 'merchant',
 ARRAY['trivago'], ARRAY['comparador', 'hotel', 'preco', 'viagem'],
 0.90, 90, 0, 'imported', '{"sector": "travel", "type": "comparison"}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- KEYWORDS - EMPRÉSTIMOS, RECEITAS, TARIFAS, ETC.
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

('emprestimo keyword', 'Empréstimo', 'Empréstimos / Financiamentos', 'Empréstimo', 'keyword',
 ARRAY['emprestimo', 'credito', 'pessoal', 'parcela', 'financiamento'],
 0.90, 88, 0, 'imported', '{"pattern_type": "loan"}'),

('financiamento keyword', 'Financiamento', 'Empréstimos / Financiamentos', 'Financiamento', 'keyword',
 ARRAY['financiamento', 'veiculo', 'imovel', 'parcela', 'credito'],
 0.90, 88, 0, 'imported', '{"pattern_type": "financing"}'),

('consorcio keyword', 'Consórcio', 'Empréstimos / Financiamentos', 'Consórcio', 'keyword',
 ARRAY['consorcio', 'parcela', 'contemplacao', 'carta', 'credito'],
 0.88, 85, 0, 'imported', '{"pattern_type": "consortium"}'),

-- ============================================================================
-- OUTROS - KEYWORDS E PATTERNS
-- ============================================================================

('cobranca keyword', 'Cobrança', 'Outros', 'Cobranças', 'keyword',
 ARRAY['cobranca', 'divida', 'boleto', 'negociacao'],
 0.85, 80, 0, 'imported', '{"pattern_type": "billing"}'),

-- ============================================================================
-- SALÁRIO E RECEITAS - KEYWORDS
-- ============================================================================

('salario keyword', 'Salário', 'Salário / 13° Salário / Férias', 'Salário', 'keyword',
 ARRAY['salario', 'pagamento', 'vencimento', 'credito', 'ordenado', 'holerite'],
 0.92, 90, 0, 'imported', '{"pattern_type": "income", "type": "salary"}'),

('credito de salario', 'Crédito de Salário', 'Salário / 13° Salário / Férias', 'Salário', 'keyword',
 ARRAY['credito', 'salario', 'pagamento', 'vencimento'],
 0.92, 90, 0, 'imported', '{"pattern_type": "income", "type": "salary"}'),

('decimo terceiro', '13º Salário', 'Salário / 13° Salário / Férias', '13º Salário', 'keyword',
 ARRAY['decimo', 'terceiro', '13', 'salario', 'gratificacao', 'natal'],
 0.95, 95, 0, 'imported', '{"pattern_type": "income", "type": "bonus"}'),

('ferias keyword', 'Férias', 'Salário / 13° Salário / Férias', 'Férias', 'keyword',
 ARRAY['ferias', 'abono', 'pecuniario', 'pagamento'],
 0.92, 92, 0, 'imported', '{"pattern_type": "income", "type": "vacation"}'),

('pro labore keyword', 'Pró-labore', 'Pró Labore', 'Pró-labore', 'keyword',
 ARRAY['prolabore', 'pro', 'labore', 'retirada', 'socio', 'empresa'],
 0.95, 95, 0, 'imported', '{"pattern_type": "income", "type": "partner_withdrawal"}'),

('participacao lucros', 'Participação nos Lucros', 'Participação de Lucros / Comissões', 'PLR', 'keyword',
 ARRAY['plr', 'ppr', 'participacao', 'lucros', 'resultados', 'bonus', 'comissao'],
 0.95, 95, 0, 'imported', '{"pattern_type": "income", "type": "profit_sharing"}'),

('comissao keyword', 'Comissão', 'Participação de Lucros / Comissões', 'Comissão', 'keyword',
 ARRAY['comissao', 'vendas', 'bonus', 'pagamento'],
 0.90, 88, 0, 'imported', '{"pattern_type": "income", "type": "commission"}'),

('reembolso keyword', 'Reembolso', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Reembolso', 'keyword',
 ARRAY['reembolso', 'devolucao', 'estorno', 'valor'],
 0.92, 90, 0, 'imported', '{"pattern_type": "income", "type": "refund"}'),

('aluguel recebido', 'Aluguel Recebido', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Aluguel', 'keyword',
 ARRAY['aluguel', 'recebimento', 'imovel', 'locacao'],
 0.95, 95, 0, 'imported', '{"pattern_type": "income", "type": "rental"}'),

('dividendos keyword', 'Dividendos', 'Renda de Investimentos', 'Dividendos', 'keyword',
 ARRAY['dividendos', 'proventos', 'jcp', 'acoes', 'investimento'],
 0.95, 95, 0, 'imported', '{"pattern_type": "income", "type": "investment"}'),

('rendimento aplicacao', 'Rendimento Aplicação', 'Renda de Investimentos', 'Rendimentos', 'keyword',
 ARRAY['rendimento', 'aplicacao', 'investimento', 'poupanca', 'cdb', 'fundo'],
 0.92, 92, 0, 'imported', '{"pattern_type": "income", "type": "investment"}'),

('resgate investimento keyword', 'Resgate Investimento', 'Renda de Investimentos', 'Resgate', 'keyword',
 ARRAY['resgate', 'investimento', 'retirada', 'aplicacao'],
 0.90, 90, 0, 'imported', '{"pattern_type": "income", "type": "investment"}'),

-- ============================================================================
-- TARIFAS BANCÁRIAS - KEYWORDS
-- ============================================================================

('tarifa de manutencao', 'Tarifa de Manutenção', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'keyword',
 ARRAY['tarifa', 'manutencao', 'cesta', 'servicos', 'pacote', 'banco'],
 0.95, 95, 0, 'imported', '{"pattern_type": "banking_fee"}'),

('juros cheque especial', 'Juros Cheque Especial', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Juros', 'keyword',
 ARRAY['juros', 'cheque', 'especial', 'lis', 'limite', 'encargos'],
 0.95, 95, 0, 'imported', '{"pattern_type": "banking_fee"}'),

('multa por atraso', 'Multa por Atraso', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Multas', 'keyword',
 ARRAY['multa', 'atraso', 'mora', 'juros', 'boleto', 'fatura'],
 0.92, 92, 0, 'imported', '{"pattern_type": "banking_fee"}'),

('iof keyword', 'IOF', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos', 'keyword',
 ARRAY['iof', 'imposto', 'operacao', 'financeira', 'credito', 'cambio', 'seguro'],
 0.95, 95, 0, 'imported', '{"pattern_type": "tax"}'),

('taxa de saque', 'Taxa de Saque', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'keyword',
 ARRAY['saque', 'retirada', 'taxa', 'tarifa', 'caixa', 'atm'],
 0.92, 92, 0, 'imported', '{"pattern_type": "banking_fee"}'),

('anuidade cartao', 'Anuidade Cartão', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Tarifas Bancárias', 'keyword',
 ARRAY['anuidade', 'cartao', 'credito', 'tarifa', 'taxa'],
 0.95, 95, 0, 'imported', '{"pattern_type": "banking_fee"}'),

('pagamento de fatura', 'Pagamento de Fatura', 'Outros', 'Pagamentos', 'keyword',
 ARRAY['pagamento', 'fatura', 'cartao', 'credito', 'boleto'],
 0.90, 88, 0, 'imported', '{"pattern_type": "payment"}'),

('darf keyword', 'DARF', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos', 'keyword',
 ARRAY['darf', 'imposto', 'receita', 'federal', 'tributo', 'leao'],
 0.95, 95, 0, 'imported', '{"pattern_type": "tax"}'),

('das keyword', 'DAS', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos', 'keyword',
 ARRAY['das', 'simples', 'nacional', 'imposto', 'mei', 'guia', 'arrecadacao'],
 0.95, 95, 0, 'imported', '{"pattern_type": "tax"}'),

('ipva keyword', 'IPVA', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos', 'keyword',
 ARRAY['ipva', 'imposto', 'veiculo', 'automotor', 'detran', 'carro', 'moto'],
 0.95, 95, 0, 'imported', '{"pattern_type": "tax"}'),

('iptu keyword', 'IPTU', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Impostos', 'keyword',
 ARRAY['iptu', 'imposto', 'predial', 'territorial', 'urbano', 'prefeitura', 'imovel'],
 0.95, 95, 0, 'imported', '{"pattern_type": "tax"}'),

-- ============================================================================
-- OUTROS - PIX E TRANSFERÊNCIAS
-- ============================================================================

('pix enviado keyword', 'PIX Enviado', 'Outros', 'Transferências', 'keyword',
 ARRAY['pix', 'enviado', 'transferencia', 'pagamento'],
 0.95, 95, 0, 'imported', '{"pattern_type": "banking", "operation": "transfer"}'),

('pix recebido keyword', 'PIX Recebido', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'PIX', 'keyword',
 ARRAY['pix', 'recebido', 'transferencia', 'valor'],
 0.95, 95, 0, 'imported', '{"pattern_type": "income", "operation": "transfer"}'),

('ted keyword', 'TED', 'Outros', 'Transferências', 'keyword',
 ARRAY['ted', 'transferencia', 'eletronica', 'disponivel', 'banco'],
 0.95, 95, 0, 'imported', '{"pattern_type": "banking", "operation": "transfer"}'),

('doc keyword', 'DOC', 'Outros', 'Transferências', 'keyword',
 ARRAY['doc', 'documento', 'ordem', 'credito', 'transferencia', 'banco'],
 0.95, 95, 0, 'imported', '{"pattern_type": "banking", "operation": "transfer"}'),

('debito automatico keyword', 'Débito Automático', 'Outros', 'Débitos Automáticos', 'keyword',
 ARRAY['deb', 'aut', 'debito', 'automatico', 'conta', 'pagamento'],
 0.92, 92, 0, 'imported', '{"pattern_type": "banking", "operation": "auto_debit"}'),

-- ============================================================================
-- PRESENTES / COMPRAS - GATEWAYS DE PAGAMENTO (Keywords)
-- ============================================================================

('cielo keyword', 'Cielo', 'Outros', 'Pagamentos', 'keyword',
 ARRAY['cielo', 'maquininha', 'cartao', 'pagamento', 'compra'],
 0.92, 90, 0, 'imported', '{"pattern_type": "payment_gateway"}'),

('rede keyword', 'Rede', 'Outros', 'Pagamentos', 'keyword',
 ARRAY['rede', 'maquininha', 'cartao', 'itau', 'pagamento', 'compra'],
 0.92, 90, 0, 'imported', '{"pattern_type": "payment_gateway"}'),

('getnet keyword', 'Getnet', 'Outros', 'Pagamentos', 'keyword',
 ARRAY['getnet', 'maquininha', 'cartao', 'santander', 'pagamento', 'compra'],
 0.92, 90, 0, 'imported', '{"pattern_type": "payment_gateway"}'),

('stone keyword', 'Stone', 'Outros', 'Pagamentos', 'keyword',
 ARRAY['stone', 'maquininha', 'cartao', 'pagamentos', 'compra'],
 0.92, 90, 0, 'imported', '{"pattern_type": "payment_gateway"}'),

-- ============================================================================
-- DESPESAS PESSOAIS - KEYWORDS
-- ============================================================================

('despesas pessoais keyword', 'Despesas Pessoais', 'Despesas Pessoais', 'Saque', 'keyword',
 ARRAY['desp', 'pessoal', 'saque', 'dinheiro', 'retirada'],
 0.85, 80, 0, 'imported', '{"pattern_type": "personal"}'),

('saque keyword', 'Saque', 'Despesas Pessoais', 'Saque', 'keyword',
 ARRAY['saque', 'dinheiro', 'retirada', 'atm', 'banco24h'],
 0.92, 90, 0, 'imported', '{"pattern_type": "withdrawal"}'),

('banco24horas', 'Banco24Horas', 'Despesas Pessoais', 'Saque', 'keyword',
 ARRAY['banco24h', 'saque', 'retirada', 'atm', 'tecban'],
 0.95, 95, 0, 'imported', '{"pattern_type": "withdrawal"}'),

-- ============================================================================
-- FILHOS / DEPENDENTES - KEYWORDS
-- ============================================================================

('escola keyword', 'Escola', 'Filhos / Dependentes', 'Educação', 'keyword',
 ARRAY['escola', 'mensalidade', 'colegio', 'filhos', 'material'],
 0.90, 88, 0, 'imported', '{"pattern_type": "children", "category": "education"}'),

('material escolar keyword', 'Material Escolar', 'Filhos / Dependentes', 'Material Escolar', 'keyword',
 ARRAY['material', 'escolar', 'livros', 'cadernos', 'papelaria'],
 0.88, 85, 0, 'imported', '{"pattern_type": "children", "category": "education"}'),

('mesada keyword', 'Mesada', 'Filhos / Dependentes', 'Mesada', 'keyword',
 ARRAY['mesada', 'filho', 'filha', 'semanada', 'dinheiro'],
 0.90, 88, 0, 'imported', '{"pattern_type": "children"}'),

('pensao alimenticia', 'Pensão Alimentícia', 'Filhos / Dependentes', 'Pensão', 'keyword',
 ARRAY['pensao', 'alimenticia', 'filhos', 'pagamento'],
 0.95, 95, 0, 'imported', '{"pattern_type": "children", "legal": true}'),

('brinquedos keyword', 'Brinquedos', 'Filhos / Dependentes', 'Brinquedos', 'keyword',
 ARRAY['brinquedos', 'presente', 'crianca', 'filhos', 'rihappy', 'pbkids'],
 0.85, 83, 0, 'imported', '{"pattern_type": "children"}'),

('plano de celular filho', 'Plano de Celular Filho', 'Filhos / Dependentes', 'Telefonia', 'keyword',
 ARRAY['celular', 'filho', 'plano', 'conta'],
 0.85, 83, 0, 'imported', '{"pattern_type": "children"}'),

-- ============================================================================
-- BEM ESTAR / BELEZA - KEYWORDS SERVIÇOS
-- ============================================================================

('cabeleireiro keyword', 'Cabeleireiro', 'Bem Estar / Beleza', 'Cabelo', 'keyword',
 ARRAY['cabeleireiro', 'salao', 'beleza', 'corte', 'cabelo'],
 0.90, 88, 0, 'imported', '{"pattern_type": "beauty", "service": "hair"}'),

('manicure keyword', 'Manicure', 'Bem Estar / Beleza', 'Unhas', 'keyword',
 ARRAY['manicure', 'pedicure', 'unhas', 'salao', 'beleza'],
 0.88, 85, 0, 'imported', '{"pattern_type": "beauty", "service": "nails"}'),

('barbearia keyword', 'Barbearia', 'Bem Estar / Beleza', 'Cabelo', 'keyword',
 ARRAY['barbearia', 'barba', 'cabelo', 'corte'],
 0.90, 88, 0, 'imported', '{"pattern_type": "beauty", "service": "barber"}'),

('estetica keyword', 'Estética', 'Bem Estar / Beleza', 'Estética', 'keyword',
 ARRAY['estetica', 'clinica', 'procedimento', 'beleza', 'limpeza', 'pele'],
 0.88, 85, 0, 'imported', '{"pattern_type": "beauty", "service": "aesthetics"}'),

('massagem keyword', 'Massagem', 'Bem Estar / Beleza', 'Massagem', 'keyword',
 ARRAY['massagem', 'terapia', 'relaxamento', 'spa'],
 0.85, 83, 0, 'imported', '{"pattern_type": "wellness"}'),

('terapia keyword', 'Terapia', 'Bem Estar / Beleza', 'Terapia', 'keyword',
 ARRAY['terapia', 'psicologo', 'psicanalista', 'sessao', 'consulta'],
 0.90, 88, 0, 'imported', '{"pattern_type": "wellness", "type": "therapy"}'),

('psicologo keyword', 'Psicólogo', 'Bem Estar / Beleza', 'Psicologia', 'keyword',
 ARRAY['psicologo', 'terapia', 'consulta', 'sessao'],
 0.90, 88, 0, 'imported', '{"pattern_type": "wellness", "type": "therapy"}'),

-- ============================================================================
-- GASTOS COM PJ - SERVIÇOS PROFISSIONAIS
-- ============================================================================

('advogado keyword', 'Advogado', 'Gastos com PJ / Profissionais Autônomos', 'Advocacia', 'keyword',
 ARRAY['advogado', 'honorarios', 'escritorio', 'advocacia', 'processo'],
 0.90, 88, 0, 'imported', '{"pattern_type": "professional", "service": "legal"}'),

('consultoria keyword', 'Consultoria', 'Gastos com PJ / Profissionais Autônomos', 'Consultoria', 'keyword',
 ARRAY['consultoria', 'servicos', 'profissional', 'pj'],
 0.85, 83, 0, 'imported', '{"pattern_type": "professional", "service": "consulting"}'),

('freelancer keyword', 'Freelancer', 'Gastos com PJ / Profissionais Autônomos', 'Freelancer', 'keyword',
 ARRAY['freelancer', 'freela', 'servico', 'pj', 'pagamento'],
 0.85, 83, 0, 'imported', '{"pattern_type": "professional", "service": "freelance"}'),

-- ============================================================================
-- INVESTIMENTOS - PRODUTOS
-- ============================================================================

('aplicacao automatica', 'Aplicação Automática', 'Investimentos (pelo menos 20% da receita)', 'Investimentos', 'keyword',
 ARRAY['aplic', 'aut', 'investimento', 'poupanca'],
 0.88, 85, 0, 'imported', '{"pattern_type": "investment", "automatic": true}'),

('resgate automatico', 'Resgate Automático', 'Renda de Investimentos', 'Resgate', 'keyword',
 ARRAY['resg', 'aut', 'investimento', 'retirada'],
 0.88, 85, 0, 'imported', '{"pattern_type": "investment", "automatic": true}'),

('pgbl', 'PGBL', 'Investimentos (pelo menos 20% da receita)', 'Previdência', 'keyword',
 ARRAY['pgbl', 'previdencia', 'privada', 'investimento', 'aposentadoria'],
 0.92, 92, 0, 'imported', '{"pattern_type": "investment", "type": "pension"}'),

('vgbl', 'VGBL', 'Investimentos (pelo menos 20% da receita)', 'Previdência', 'keyword',
 ARRAY['vgbl', 'previdencia', 'privada', 'investimento', 'aposentadoria'],
 0.92, 92, 0, 'imported', '{"pattern_type": "investment", "type": "pension"}'),

('tesouro direto', 'Tesouro Direto', 'Investimentos (pelo menos 20% da receita)', 'Investimentos', 'keyword',
 ARRAY['tesouro', 'direto', 'selic', 'ipca', 'investimento', 'governo'],
 0.95, 95, 0, 'imported', '{"pattern_type": "investment", "type": "government_bonds"}'),

('xp investimentos', 'XP Investimentos', 'Investimentos (pelo menos 20% da receita)', 'Corretora', 'keyword',
 ARRAY['xp', 'investimentos', 'corretora', 'acoes'],
 0.95, 95, 0, 'imported', '{"pattern_type": "investment"}'),

('rico corretora', 'Rico', 'Investimentos (pelo menos 20% da receita)', 'Corretora', 'keyword',
 ARRAY['rico', 'corretora', 'investimentos', 'xp'],
 0.92, 92, 0, 'imported', '{"pattern_type": "investment"}'),

('clear corretora', 'Clear Corretora', 'Investimentos (pelo menos 20% da receita)', 'Corretora', 'keyword',
 ARRAY['clear', 'corretora', 'investimentos', 'xp'],
 0.92, 92, 0, 'imported', '{"pattern_type": "investment"}'),

('nuinvest', 'NuInvest', 'Investimentos (pelo menos 20% da receita)', 'Corretora', 'keyword',
 ARRAY['nuinvest', 'nubank', 'investimentos', 'corretora', 'easynvest'],
 0.92, 92, 0, 'imported', '{"pattern_type": "investment"}')

ON CONFLICT (merchant_key) DO NOTHING;

-- ============================================================================
-- ATUALIZAR MATERIALIZED VIEW
-- ============================================================================

REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_frequent_merchants;

COMMIT;

