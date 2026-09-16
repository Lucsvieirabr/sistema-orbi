-- ============================================================================
-- Classificador v2 — saneamento e enriquecimento do merchants_dictionary
-- ============================================================================
-- A Edge Function classify-transactions agora carrega o dicionário em memória
-- e só aceita categoria que EXISTE para o usuário e tem o tipo do lançamento.
-- Esta migration corrige os dados que faziam o match "certo" cair em "Outros":
--
--  1. Categorias fora do catálogo: "Educação" e "Compras" não existem em
--     `categories` — o front descartava e jogava a linha em "Outros".
--  2. Semântica errada em banking_pattern: saque (retirada de dinheiro) e
--     pagamento de fatura/boleto estavam como "Tarifas Bancárias".
--  3. Aliases de soft descriptor que faltavam em merchants existentes
--     (AMZN MKTP, DL*UBERRIDES, Wellhub = ex-Gympass). Só acrescenta alias
--     ausente — nenhuma linha duplicada.
--  4. Merchants brasileiros comuns sem nenhuma entrada (verificado por chave,
--     entity_name, aliases e keywords antes de inserir). Idempotente: ON
--     CONFLICT na chave + NOT EXISTS por sobreposição de alias.
--
-- Siglas bancárias (TAR, CESTA, SISPAG, PAGTO ELO, APLIC CDB, CRED SAL...)
-- NÃO entram aqui: dependem de direção (crédito/débito) e ordem de
-- precedência, e vivem no motor de regras da função (banking-rules.ts).
-- ============================================================================

-- 1) Categorias fora do catálogo --------------------------------------------
UPDATE public.merchants_dictionary
   SET category = 'Estudos'
 WHERE category = 'Educação';

UPDATE public.merchants_dictionary
   SET category = 'Presentes / Compras'
 WHERE category = 'Compras';

-- 2) Semântica de banking_pattern -------------------------------------------
UPDATE public.merchants_dictionary
   SET category = 'Outros', subcategory = 'Saque em Dinheiro'
 WHERE entry_type = 'banking_pattern'
   AND context IN ('saque', 'saque_internacional');

UPDATE public.merchants_dictionary
   SET category = 'Outras Receitas (Aluguéis, extras, reembolso etc.)', subcategory = 'Pagamento de Fatura'
 WHERE entry_type = 'banking_pattern'
   AND merchant_key = 'pagamento recebido';

UPDATE public.merchants_dictionary
   SET category = 'Outros', subcategory = 'Pagamento de Fatura'
 WHERE entry_type = 'banking_pattern'
   AND merchant_key = 'pagamento minimo';

UPDATE public.merchants_dictionary
   SET category = 'Outros', subcategory = 'Boletos e Contas'
 WHERE entry_type = 'banking_pattern'
   AND merchant_key = 'pagamento boleto bancario';

-- 3) Aliases ausentes em merchants existentes -------------------------------
WITH extra(merchant_key, alias) AS (
  VALUES
    ('amazon', 'amzn'),
    ('amazon', 'amzn mktp'),
    ('amazon', 'amazon marketplace'),
    ('uber', 'uberrides'),
    ('uber', 'uber rides'),
    ('gympass', 'wellhub')
)
UPDATE public.merchants_dictionary m
   SET aliases = m.aliases || ARRAY[e.alias]
  FROM extra e
 WHERE m.merchant_key = e.merchant_key
   AND NOT (e.alias = ANY (COALESCE(m.aliases, '{}')));

-- 4) Merchants novos ---------------------------------------------------------
WITH novos(merchant_key, entity_name, category, subcategory, aliases, keywords, priority, confidence_modifier) AS (
  VALUES
    ('apple com bill',          'Apple (App Store / iCloud)', 'Assinaturas',                          'Apps e Serviços',        ARRAY['apple com bill','apple bill','itunes com bill','apple services'], ARRAY['app store','icloud'], 92, 0.92),
    ('google play',             'Google Play',                'Assinaturas',                          'Apps e Serviços',        ARRAY['google play','googleplay','google play store'],                  ARRAY['apps'],               90, 0.90),
    ('openai',                  'OpenAI / ChatGPT',           'Assinaturas',                          'Software e IA',          ARRAY['openai','chatgpt','chat gpt','openai chatgpt'],                  ARRAY['ia','software'],      92, 0.92),
    ('99food',                  '99Food',                     'Alimentação',                          'Delivery',               ARRAY['99food','99 food'],                                               ARRAY['delivery'],           92, 0.92),
    ('keeta',                   'Keeta',                      'Alimentação',                          'Delivery',               ARRAY['keeta'],                                                          ARRAY['delivery'],           90, 0.90),
    ('temu',                    'Temu',                       'Presentes / Compras',                  'Marketplace',            ARRAY['temu','temu com'],                                                ARRAY['marketplace'],        90, 0.90),
    ('estapar',                 'Estapar',                    'Transporte',                           'Estacionamento',         ARRAY['estapar','zul estapar'],                                          ARRAY['estacionamento'],     92, 0.92),
    ('indigo estacionamento',   'Indigo Estacionamentos',     'Transporte',                           'Estacionamento',         ARRAY['indigo estacionamento','indigo park'],                            ARRAY['estacionamento'],     88, 0.88),
    ('move mais',               'Move Mais',                  'Transporte',                           'Pedágio',                ARRAY['move mais','movemais'],                                           ARRAY['pedagio','tag'],      88, 0.88),
    ('indrive',                 'inDrive',                    'Transporte',                           'Transporte por Aplicativo', ARRAY['indrive','indriver'],                                          ARRAY['corrida'],            90, 0.90),
    ('cabify',                  'Cabify',                     'Transporte',                           'Transporte por Aplicativo', ARRAY['cabify'],                                                      ARRAY['corrida'],            90, 0.90),
    ('blablacar',               'BlaBlaCar',                  'Transporte',                           'Carona',                 ARRAY['blablacar','bla bla car'],                                        ARRAY['carona'],             88, 0.88),
    ('uber one',                'Uber One',                   'Assinaturas',                          'Clube de Benefícios',    ARRAY['uber one'],                                                       ARRAY['assinatura'],         93, 0.93),
    ('kiwify',                  'Kiwify',                     'Estudos',                              'Cursos Online',          ARRAY['kiwify'],                                                         ARRAY['curso online'],       88, 0.88),
    ('descomplica',             'Descomplica',                'Estudos',                              'Cursos Online',          ARRAY['descomplica'],                                                    ARRAY['curso online'],       90, 0.90),
    ('estrategia concursos',    'Estratégia Concursos',       'Estudos',                              'Cursos Online',          ARRAY['estrategia concursos','estrategia educacional'],                  ARRAY['concurso'],           90, 0.90),
    ('gran cursos',             'Gran Cursos Online',         'Estudos',                              'Cursos Online',          ARRAY['gran cursos','grancursos','gran concursos'],                      ARRAY['concurso'],           90, 0.90),
    ('senac',                   'Senac',                      'Estudos',                              'Cursos Livres',          ARRAY['senac'],                                                          ARRAY['curso'],              88, 0.88),
    ('epic games',              'Epic Games',                 'Lazer',                                'Jogos/Plataformas Digitais', ARRAY['epic games','epicgames','epic games store'],                  ARRAY['games'],              90, 0.90),
    ('tinder',                  'Tinder',                     'Assinaturas',                          'Apps e Serviços',        ARRAY['tinder','tinder plus','tinder gold'],                             ARRAY['app'],                88, 0.88),
    ('linkedin',                'LinkedIn',                   'Assinaturas',                          'Profissional',           ARRAY['linkedin','linkedin premium'],                                    ARRAY['premium'],            90, 0.90),
    ('telecine',                'Telecine',                   'Assinaturas',                          'Streaming',              ARRAY['telecine','telecine play'],                                       ARRAY['streaming'],          90, 0.90),
    ('premiere fc',             'Premiere',                   'Assinaturas',                          'Streaming',              ARRAY['premiere fc','premiere play','globo premiere'],                   ARRAY['streaming'],          88, 0.88),
    ('oxxo',                    'OXXO',                       'Alimentação',                          'Mercado de Proximidade', ARRAY['oxxo'],                                                           ARRAY['mercado'],            90, 0.90),
    ('br mania',                'BR Mania',                   'Alimentação',                          'Conveniência',           ARRAY['br mania','brmania'],                                             ARRAY['conveniencia'],       88, 0.88),
    ('makro',                   'Makro Atacadista',           'Alimentação',                          'Atacado',                ARRAY['makro','makro atacadista'],                                       ARRAY['atacado'],            90, 0.90),
    ('condor supermercados',    'Condor Supermercados',       'Alimentação',                          'Supermercado',           ARRAY['condor','supermercado condor','condor super center'],             ARRAY['supermercado'],       88, 0.88),
    ('supermercados guanabara', 'Supermercados Guanabara',    'Alimentação',                          'Supermercado',           ARRAY['guanabara','supermercado guanabara'],                             ARRAY['supermercado'],       88, 0.88),
    ('st marche',               'St Marche',                  'Alimentação',                          'Supermercado',           ARRAY['st marche','saint marche','stmarche'],                            ARRAY['supermercado'],       88, 0.88),
    ('hirota',                  'Hirota Food',                'Alimentação',                          'Supermercado',           ARRAY['hirota','hirota food'],                                           ARRAY['supermercado'],       88, 0.88),
    ('nagumo',                  'Supermercados Nagumo',       'Alimentação',                          'Supermercado',           ARRAY['nagumo','supermercado nagumo'],                                   ARRAY['supermercado'],       88, 0.88),
    ('bretas',                  'Supermercados Bretas',       'Alimentação',                          'Supermercado',           ARRAY['bretas','supermercado bretas'],                                   ARRAY['supermercado'],       88, 0.88),
    ('verdemar',                'Verdemar',                   'Alimentação',                          'Supermercado',           ARRAY['verdemar'],                                                       ARRAY['supermercado'],       88, 0.88),
    ('lavoisier',               'Lavoisier Medicina Diagnóstica', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório',          ARRAY['lavoisier','laboratorio lavoisier'],                              ARRAY['exame'],              90, 0.90),
    ('delboni auriemo',         'Delboni Medicina Diagnóstica', 'Proteção Pessoal / Saúde / Farmácia', 'Laboratório',            ARRAY['delboni','delboni auriemo'],                                      ARRAY['exame'],              90, 0.90)
)
INSERT INTO public.merchants_dictionary (
  merchant_key, entity_name, category, subcategory, entry_type, aliases, keywords,
  priority, confidence_modifier, source_type, metadata
)
SELECT n.merchant_key, n.entity_name, n.category, n.subcategory, 'merchant', n.aliases, n.keywords,
       n.priority, n.confidence_modifier, 'system', jsonb_build_object('source', 'classifier_v2')
  FROM novos n
 WHERE NOT EXISTS (
         SELECT 1
           FROM public.merchants_dictionary m
          WHERE m.merchant_key = n.merchant_key
             OR lower(m.entity_name) = lower(n.entity_name)
             OR COALESCE(m.aliases, '{}') && n.aliases
       )
ON CONFLICT (merchant_key) DO NOTHING;
