-- Migration: Adicionar keywords de Investimentos e Estudos
-- Data: 11 de Outubro de 2025

BEGIN;

-- Inserir keywords de INVESTIMENTOS
INSERT INTO public.merchants_dictionary (
  merchant_key,
  entity_name,
  category,
  subcategory,
  aliases,
  keywords,
  confidence_modifier,
  priority,
  entry_type,
  is_active
) VALUES
-- Renda Fixa / Títulos Públicos
('tesouro direto', 'Tesouro Direto', 'Investimentos (pelo menos 20% da receita)', 'Renda Fixa/Títulos Públicos', ARRAY['tesouro', 'direto'], ARRAY['tesouro', 'direto'], 0.90, 85, 'keyword', true),
('tesouro selic', 'Tesouro Selic', 'Investimentos (pelo menos 20% da receita)', 'Renda Fixa/Títulos Públicos', ARRAY['tesouro', 'selic'], ARRAY['tesouro', 'selic'], 0.90, 85, 'keyword', true),
('tesouro ipca', 'Tesouro IPCA', 'Investimentos (pelo menos 20% da receita)', 'Renda Fixa/Títulos Públicos', ARRAY['tesouro', 'ipca'], ARRAY['tesouro', 'ipca'], 0.90, 85, 'keyword', true),
('tesouro educa+', 'Tesouro Educa+', 'Investimentos (pelo menos 20% da receita)', 'Renda Fixa/Títulos Públicos', ARRAY['tesouro', 'educa'], ARRAY['tesouro', 'educa'], 0.90, 85, 'keyword', true),

-- Renda Fixa Geral
('renda fixa', 'Renda Fixa', 'Investimentos (pelo menos 20% da receita)', 'Renda Fixa/Geral', ARRAY['renda', 'fixa'], ARRAY['renda', 'fixa'], 0.85, 80, 'keyword', true),
('cdb', 'CDB', 'Investimentos (pelo menos 20% da receita)', 'Renda Fixa/CDB', ARRAY['cdb', 'certificado'], ARRAY['cdb'], 0.90, 85, 'keyword', true),
('lca', 'LCA', 'Investimentos (pelo menos 20% da receita)', 'Renda Fixa/LCI/LCA', ARRAY['lca'], ARRAY['lca'], 0.90, 85, 'keyword', true),
('lci', 'LCI', 'Investimentos (pelo menos 20% da receita)', 'Renda Fixa/LCI/LCA', ARRAY['lci'], ARRAY['lci'], 0.90, 85, 'keyword', true),

-- Crédito Privado
('debêntures', 'Debêntures', 'Investimentos (pelo menos 20% da receita)', 'Renda Fixa/Crédito Privado', ARRAY['debentures'], ARRAY['debentures'], 0.85, 80, 'keyword', true),
('debêntures incentivadas', 'Debêntures Incentivadas', 'Investimentos (pelo menos 20% da receita)', 'Renda Fixa/Crédito Privado', ARRAY['debentures', 'incentivadas'], ARRAY['debentures', 'incentivadas'], 0.85, 80, 'keyword', true),
('crédito privado', 'Crédito Privado', 'Investimentos (pelo menos 20% da receita)', 'Renda Fixa/Crédito Privado', ARRAY['credito', 'privado'], ARRAY['credito', 'privado'], 0.85, 80, 'keyword', true),

-- Previdência
('previdência privada', 'Previdência Privada', 'Investimentos (pelo menos 20% da receita)', 'Previdência', ARRAY['previdencia', 'privada'], ARRAY['previdencia', 'privada'], 0.90, 85, 'keyword', true),

-- Aportes
('aporte', 'Aporte', 'Investimentos (pelo menos 20% da receita)', 'Aporte/Aplicação', ARRAY['aporte', 'aplicacao'], ARRAY['aporte'], 0.85, 80, 'keyword', true),
('aplicação', 'Aplicação', 'Investimentos (pelo menos 20% da receita)', 'Aporte/Aplicação', ARRAY['aplicacao'], ARRAY['aplicacao'], 0.80, 75, 'keyword', true),
('investi', 'Investimento', 'Investimentos (pelo menos 20% da receita)', 'Aporte/Aplicação', ARRAY['investi', 'investimento'], ARRAY['investi', 'investimento'], 0.80, 75, 'keyword', true),

-- Resgates (Income)
('resgate', 'Resgate', 'Renda de Investimentos', 'Resgate/Desinvestimento', ARRAY['resgate'], ARRAY['resgate'], 0.85, 80, 'keyword', true),
('rentabilidade', 'Rentabilidade', 'Renda de Investimentos', 'Resgate/Desinvestimento', ARRAY['rentabilidade'], ARRAY['rentabilidade'], 0.80, 75, 'keyword', true),
('dividendos', 'Dividendos', 'Renda de Investimentos', 'Renda de Investimentos', ARRAY['dividendos'], ARRAY['dividendos'], 0.90, 85, 'keyword', true),
('juros s/capital', 'Juros sobre Capital Próprio', 'Renda de Investimentos', 'Renda de Investimentos', ARRAY['juros', 'capital'], ARRAY['juros', 'capital'], 0.90, 85, 'keyword', true),

-- Renda Variável
('ações', 'Ações', 'Investimentos (pelo menos 20% da receita)', 'Renda Variável/Ações', ARRAY['acoes'], ARRAY['acoes'], 0.85, 80, 'keyword', true),
('fundos de investimento', 'Fundos de Investimento', 'Investimentos (pelo menos 20% da receita)', 'Fundos de Investimento', ARRAY['fundos', 'investimento'], ARRAY['fundos', 'investimento'], 0.85, 80, 'keyword', true),
('fundo imobiliario', 'Fundo Imobiliário', 'Investimentos (pelo menos 20% da receita)', 'FIIs', ARRAY['fundo', 'imobiliario', 'fii'], ARRAY['fundo', 'imobiliario'], 0.85, 80, 'keyword', true),
('etf', 'ETF', 'Investimentos (pelo menos 20% da receita)', 'ETFs', ARRAY['etf'], ARRAY['etf'], 0.85, 80, 'keyword', true),
('bdr', 'BDR', 'Investimentos (pelo menos 20% da receita)', 'BDRs', ARRAY['bdr'], ARRAY['bdr'], 0.85, 80, 'keyword', true),

-- ETFs Específicos
('bova11', 'BOVA11', 'Investimentos (pelo menos 20% da receita)', 'ETFs (Ibovespa)', ARRAY['bova11', 'ibovespa'], ARRAY['bova11'], 0.90, 85, 'keyword', true),
('bovv11', 'BOVV11', 'Investimentos (pelo menos 20% da receita)', 'ETFs (Ibovespa)', ARRAY['bovv11'], ARRAY['bovv11'], 0.90, 85, 'keyword', true),
('smal11', 'SMAL11', 'Investimentos (pelo menos 20% da receita)', 'ETFs (Small Cap)', ARRAY['smal11', 'small cap'], ARRAY['smal11'], 0.90, 85, 'keyword', true),
('ivvb11', 'IVVB11', 'Investimentos (pelo menos 20% da receita)', 'ETFs (Internacional)', ARRAY['ivvb11', 'sp500'], ARRAY['ivvb11'], 0.90, 85, 'keyword', true),
('hash11', 'HASH11', 'Investimentos (pelo menos 20% da receita)', 'ETFs (Cripto)', ARRAY['hash11', 'cripto'], ARRAY['hash11'], 0.90, 85, 'keyword', true),
('gold11', 'GOLD11', 'Investimentos (pelo menos 20% da receita)', 'ETFs (Commodities)', ARRAY['gold11', 'ouro'], ARRAY['gold11'], 0.90, 85, 'keyword', true),
('nasd11', 'NASD11', 'Investimentos (pelo menos 20% da receita)', 'ETFs (Internacional)', ARRAY['nasd11', 'nasdaq'], ARRAY['nasd11'], 0.90, 85, 'keyword', true),
('teck11', 'TECK11', 'Investimentos (pelo menos 20% da receita)', 'ETFs (Tecnologia)', ARRAY['teck11', 'tech'], ARRAY['teck11'], 0.90, 85, 'keyword', true),
('qbtc11', 'QBTC11', 'Investimentos (pelo menos 20% da receita)', 'ETFs (Cripto)', ARRAY['qbtc11', 'bitcoin'], ARRAY['qbtc11'], 0.90, 85, 'keyword', true),

-- FIIs Específicos
('kncr11', 'KNCR11', 'Investimentos (pelo menos 20% da receita)', 'FIIs', ARRAY['kncr11'], ARRAY['kncr11'], 0.90, 85, 'keyword', true),
('mxrf11', 'MXRF11', 'Investimentos (pelo menos 20% da receita)', 'FIIs', ARRAY['mxrf11'], ARRAY['mxrf11'], 0.90, 85, 'keyword', true),
('hglg11', 'HGLG11', 'Investimentos (pelo menos 20% da receita)', 'FIIs', ARRAY['hglg11'], ARRAY['hglg11'], 0.90, 85, 'keyword', true),
('btlg11', 'BTLG11', 'Investimentos (pelo menos 20% da receita)', 'FIIs', ARRAY['btlg11'], ARRAY['btlg11'], 0.90, 85, 'keyword', true),
('vghf11', 'VGHF11', 'Investimentos (pelo menos 20% da receita)', 'FIIs', ARRAY['vghf11'], ARRAY['vghf11'], 0.90, 85, 'keyword', true),

-- Corretoras
('xp investimentos', 'XP Investimentos', 'Investimentos (pelo menos 20% da receita)', 'Corretora/Plataforma', ARRAY['xp', 'investimentos'], ARRAY['xp', 'investimentos'], 0.95, 90, 'merchant', true),
('btg pactual', 'BTG Pactual', 'Investimentos (pelo menos 20% da receita)', 'Corretora/Plataforma', ARRAY['btg'], ARRAY['btg'], 0.95, 90, 'merchant', true),
('btg investimentos', 'BTG Investimentos', 'Investimentos (pelo menos 20% da receita)', 'Corretora/Plataforma', ARRAY['btg'], ARRAY['btg'], 0.95, 90, 'merchant', true),
('rico', 'Rico', 'Investimentos (pelo menos 20% da receita)', 'Corretora/Plataforma', ARRAY['rico'], ARRAY['rico'], 0.90, 85, 'merchant', true),
('clear', 'Clear', 'Investimentos (pelo menos 20% da receita)', 'Corretora/Plataforma', ARRAY['clear'], ARRAY['clear'], 0.90, 85, 'merchant', true),
('nuinvest', 'Nu Invest', 'Investimentos (pelo menos 20% da receita)', 'Corretora/Plataforma', ARRAY['nuinvest', 'nu'], ARRAY['nuinvest'], 0.90, 85, 'merchant', true),
('xp inc', 'XP Inc', 'Investimentos (pelo menos 20% da receita)', 'Corretora/Plataforma', ARRAY['xp'], ARRAY['xp'], 0.95, 90, 'merchant', true),
('b3', 'B3', 'Investimentos (pelo menos 20% da receita)', 'Corretora/Plataforma', ARRAY['b3', 'bovespa'], ARRAY['b3'], 0.95, 90, 'merchant', true),

-- Cripto
('binance', 'Binance', 'Investimentos (pelo menos 20% da receita)', 'Criptoativos/Câmbio', ARRAY['binance'], ARRAY['binance'], 0.95, 90, 'merchant', true),
('criptoativos', 'Criptoativos', 'Investimentos (pelo menos 20% da receita)', 'Criptoativos/Câmbio', ARRAY['criptoativos', 'cripto'], ARRAY['criptoativos', 'cripto'], 0.85, 80, 'keyword', true),

-- Termos Gerais
('ibovespa', 'Ibovespa', 'Investimentos (pelo menos 20% da receita)', 'Renda Variável/Ações', ARRAY['ibovespa'], ARRAY['ibovespa'], 0.85, 80, 'keyword', true),
('carteira', 'Carteira de Investimentos', 'Investimentos (pelo menos 20% da receita)', 'Aporte/Aplicação', ARRAY['carteira'], ARRAY['carteira'], 0.75, 70, 'keyword', true),
('alocação', 'Alocação', 'Investimentos (pelo menos 20% da receita)', 'Aporte/Aplicação', ARRAY['alocacao'], ARRAY['alocacao'], 0.80, 75, 'keyword', true),
('reserva', 'Reserva de Emergência', 'Investimentos (pelo menos 20% da receita)', 'Poupança/Reserva', ARRAY['reserva'], ARRAY['reserva'], 0.80, 75, 'keyword', true);

-- Inserir keywords de ESTUDOS
INSERT INTO public.merchants_dictionary (
  merchant_key,
  entity_name,
  category,
  subcategory,
  aliases,
  keywords,
  confidence_modifier,
  priority,
  entry_type,
  is_active
) VALUES
-- Universidades Públicas
('usp', 'USP', 'Estudos', 'Universidade/Mensalidade', ARRAY['usp', 'universidade sao paulo'], ARRAY['usp'], 0.95, 90, 'keyword', true),
('unicamp', 'UNICAMP', 'Estudos', 'Universidade/Mensalidade', ARRAY['unicamp'], ARRAY['unicamp'], 0.95, 90, 'keyword', true),
('unesp', 'UNESP', 'Estudos', 'Universidade/Mensalidade', ARRAY['unesp'], ARRAY['unesp'], 0.95, 90, 'keyword', true),
('ufrj', 'UFRJ', 'Estudos', 'Universidade/Mensalidade', ARRAY['ufrj'], ARRAY['ufrj'], 0.95, 90, 'keyword', true),
('ufmg', 'UFMG', 'Estudos', 'Universidade/Mensalidade', ARRAY['ufmg'], ARRAY['ufmg'], 0.95, 90, 'keyword', true),
('ufsc', 'UFSC', 'Estudos', 'Universidade/Mensalidade', ARRAY['ufsc'], ARRAY['ufsc'], 0.95, 90, 'keyword', true),
('ufpr', 'UFPR', 'Estudos', 'Universidade/Mensalidade', ARRAY['ufpr'], ARRAY['ufpr'], 0.95, 90, 'keyword', true),
('fiocruz', 'Fiocruz', 'Estudos', 'Universidade/Mensalidade', ARRAY['fiocruz'], ARRAY['fiocruz'], 0.95, 90, 'keyword', true),
('unifesp', 'UNIFESP', 'Estudos', 'Universidade/Mensalidade', ARRAY['unifesp'], ARRAY['unifesp'], 0.95, 90, 'keyword', true),

-- Universidades Privadas
('fgv', 'FGV', 'Estudos', 'Universidade/Mensalidade', ARRAY['fgv', 'getulio vargas'], ARRAY['fgv'], 0.95, 90, 'keyword', true),
('mackenzie', 'Mackenzie', 'Estudos', 'Universidade/Mensalidade', ARRAY['mackenzie'], ARRAY['mackenzie'], 0.90, 85, 'keyword', true),
('puc', 'PUC', 'Estudos', 'Universidade/Mensalidade', ARRAY['puc', 'pontificia'], ARRAY['puc'], 0.90, 85, 'keyword', true),

-- Grandes Grupos EAD
('estácio', 'Estácio', 'Estudos', 'Universidade/Mensalidade', ARRAY['estacio'], ARRAY['estacio'], 0.90, 85, 'merchant', true),
('kroton', 'Kroton', 'Estudos', 'Universidade/Mensalidade', ARRAY['kroton'], ARRAY['kroton'], 0.90, 85, 'merchant', true),
('unopar', 'Unopar', 'Estudos', 'Universidade/Mensalidade', ARRAY['unopar'], ARRAY['unopar'], 0.90, 85, 'merchant', true),
('unicesumar', 'Unicesumar', 'Estudos', 'Universidade/Mensalidade', ARRAY['unicesumar'], ARRAY['unicesumar'], 0.90, 85, 'merchant', true),
('uninter', 'Uninter', 'Estudos', 'Universidade/Mensalidade', ARRAY['uninter'], ARRAY['uninter'], 0.90, 85, 'merchant', true),
('anhanguera', 'Anhanguera', 'Estudos', 'Universidade/Mensalidade', ARRAY['anhanguera'], ARRAY['anhanguera'], 0.90, 85, 'merchant', true),
('uniasselvi', 'Uniasselvi', 'Estudos', 'Universidade/Mensalidade', ARRAY['uniasselvi'], ARRAY['uniasselvi'], 0.90, 85, 'merchant', true),
('unip', 'UNIP', 'Estudos', 'Universidade/Mensalidade', ARRAY['unip'], ARRAY['unip'], 0.90, 85, 'merchant', true),
('cruzeiro do sul', 'Cruzeiro do Sul', 'Estudos', 'Universidade/Mensalidade', ARRAY['cruzeiro do sul'], ARRAY['cruzeiro', 'sul'], 0.90, 85, 'merchant', true),

-- Ensino Básico
('universidade', 'Universidade', 'Estudos', 'Universidade/Mensalidade', ARRAY['universidade'], ARRAY['universidade'], 0.80, 75, 'keyword', true),
('faculdade', 'Faculdade', 'Estudos', 'Universidade/Mensalidade', ARRAY['faculdade'], ARRAY['faculdade'], 0.80, 75, 'keyword', true),
('colegio', 'Colégio', 'Estudos', 'Ensino Básico', ARRAY['colegio', 'escola'], ARRAY['colegio'], 0.85, 80, 'keyword', true),
('escola', 'Escola', 'Estudos', 'Ensino Básico', ARRAY['escola'], ARRAY['escola'], 0.80, 75, 'keyword', true),

-- Pagamentos
('mensalidade', 'Mensalidade', 'Estudos', 'Mensalidade/Cursos', ARRAY['mensalidade'], ARRAY['mensalidade'], 0.80, 75, 'keyword', true),
('matricula', 'Matrícula', 'Estudos', 'Mensalidade/Cursos', ARRAY['matricula'], ARRAY['matricula'], 0.85, 80, 'keyword', true),

-- Cursos Online
('ead', 'EAD', 'Estudos', 'Cursos Online', ARRAY['ead', 'ensino a distancia'], ARRAY['ead'], 0.85, 80, 'keyword', true),
('alura', 'Alura', 'Estudos', 'Cursos Online', ARRAY['alura'], ARRAY['alura'], 0.95, 90, 'merchant', true),
('coursera', 'Coursera', 'Estudos', 'Cursos Online', ARRAY['coursera'], ARRAY['coursera'], 0.95, 90, 'merchant', true),
('udemy', 'Udemy', 'Estudos', 'Cursos Online', ARRAY['udemy'], ARRAY['udemy'], 0.95, 90, 'merchant', true),
('edx', 'edX', 'Estudos', 'Cursos Online', ARRAY['edx'], ARRAY['edx'], 0.95, 90, 'merchant', true),

-- Escolas de Idiomas
('ingles', 'Inglês', 'Estudos', 'Escola de Idiomas', ARRAY['ingles', 'english'], ARRAY['ingles'], 0.80, 75, 'keyword', true),
('espanhol', 'Espanhol', 'Estudos', 'Escola de Idiomas', ARRAY['espanhol'], ARRAY['espanhol'], 0.80, 75, 'keyword', true),
('wizard', 'Wizard', 'Estudos', 'Escola de Idiomas', ARRAY['wizard'], ARRAY['wizard'], 0.90, 85, 'merchant', true),
('knn idiomas', 'KNN Idiomas', 'Estudos', 'Escola de Idiomas', ARRAY['knn'], ARRAY['knn'], 0.90, 85, 'merchant', true),
('cultura inglesa', 'Cultura Inglesa', 'Estudos', 'Escola de Idiomas', ARRAY['cultura inglesa'], ARRAY['cultura', 'inglesa'], 0.90, 85, 'merchant', true),
('english live', 'English Live', 'Estudos', 'Escola de Idiomas', ARRAY['english live', 'ef'], ARRAY['english', 'live'], 0.90, 85, 'merchant', true),
('cambly', 'Cambly', 'Estudos', 'Escola de Idiomas', ARRAY['cambly'], ARRAY['cambly'], 0.95, 90, 'merchant', true),
('open english', 'Open English', 'Estudos', 'Escola de Idiomas', ARRAY['open english'], ARRAY['open', 'english'], 0.90, 85, 'merchant', true),
('wise up', 'Wise Up', 'Estudos', 'Escola de Idiomas', ARRAY['wise up'], ARRAY['wise', 'up'], 0.90, 85, 'merchant', true),
('berlitz', 'Berlitz', 'Estudos', 'Escola de Idiomas', ARRAY['berlitz'], ARRAY['berlitz'], 0.90, 85, 'merchant', true),

-- Material
('curso', 'Curso', 'Estudos', 'Cursos Livres', ARRAY['curso'], ARRAY['curso'], 0.75, 70, 'keyword', true),
('livraria', 'Livraria', 'Estudos', 'Material Escolar/Livros', ARRAY['livraria'], ARRAY['livraria'], 0.80, 75, 'keyword', true),
('livro', 'Livro', 'Estudos', 'Material Escolar/Livros', ARRAY['livro'], ARRAY['livro'], 0.75, 70, 'keyword', true);

COMMIT;

