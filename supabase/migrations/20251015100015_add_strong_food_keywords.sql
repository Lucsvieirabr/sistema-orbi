-- Migration: Adiciona keywords fortes e genéricas de alimentação
-- 
-- Problema identificado:
-- "BIDUSKY LANCHES" não estava sendo classificado porque "lanches" não existia como keyword.
-- Existiam apenas 4 keywords genéricas de alimentação (fast food, padaria, restaurante, supermercado).
--
-- Solução:
-- Adicionar keywords robustas e genéricas que cobrem os principais tipos de estabelecimentos
-- e palavras comuns relacionadas a alimentação.

BEGIN;

-- =============================================================================
-- KEYWORDS GENÉRICAS DE TIPOS DE ESTABELECIMENTOS
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key,
  entity_name,
  entry_type,
  category,
  subcategory,
  aliases,
  keywords,
  confidence_modifier,
  priority,
  metadata
)
VALUES
  -- Lanches e Lanchonetes
  (
    'lanche',
    'Lanche',
    'keyword',
    'Alimentação',
    'Lanchonete',
    ARRAY['lanche', 'lanches', 'lanchonete', 'lancheria'],
    ARRAY['lanche', 'lanches', 'lanchonete'],
    0.88,
    85,
    jsonb_build_object('type', 'food', 'subtype', 'snack_bar')
  ),
  
  -- Pizza e Pizzarias
  (
    'pizza',
    'Pizza',
    'keyword',
    'Alimentação',
    'Pizzaria',
    ARRAY['pizza', 'pizzas', 'pizzaria', 'pizzarias'],
    ARRAY['pizza', 'pizzaria'],
    0.92,
    90,
    jsonb_build_object('type', 'food', 'subtype', 'pizzeria')
  ),
  
  -- Sushi e Comida Japonesa
  (
    'sushi',
    'Sushi',
    'keyword',
    'Alimentação',
    'Japonesa',
    ARRAY['sushi', 'sushis', 'japones', 'japonesa', 'oriental'],
    ARRAY['sushi', 'japones', 'japonesa'],
    0.90,
    88,
    jsonb_build_object('type', 'food', 'subtype', 'japanese')
  ),
  
  -- Churrasco e Churrascarias
  (
    'churrasco',
    'Churrasco',
    'keyword',
    'Alimentação',
    'Churrascaria',
    ARRAY['churrasco', 'churrascos', 'churrascaria', 'churrascarias', 'rodizio'],
    ARRAY['churrasco', 'churrascaria', 'rodizio'],
    0.90,
    88,
    jsonb_build_object('type', 'food', 'subtype', 'steakhouse')
  ),
  
  -- Hamburger
  (
    'hamburger',
    'Hamburger',
    'keyword',
    'Alimentação',
    'Hamburgueria',
    ARRAY['hamburger', 'hamburguer', 'hambúrguer', 'hamburgueria', 'burger'],
    ARRAY['hamburger', 'hamburguer', 'burger'],
    0.91,
    89,
    jsonb_build_object('type', 'food', 'subtype', 'burger')
  ),
  
  -- Pastel e Pastelarias
  (
    'pastel',
    'Pastel',
    'keyword',
    'Alimentação',
    'Pastelaria',
    ARRAY['pastel', 'pasteis', 'pastéis', 'pastelaria'],
    ARRAY['pastel', 'pastelaria'],
    0.89,
    86,
    jsonb_build_object('type', 'food', 'subtype', 'pastel_shop')
  ),
  
  -- Açaí
  (
    'acai',
    'Açaí',
    'keyword',
    'Alimentação',
    'Açaiteria',
    ARRAY['acai', 'açai', 'açaí', 'acaiteria'],
    ARRAY['acai', 'açai'],
    0.92,
    90,
    jsonb_build_object('type', 'food', 'subtype', 'acai_shop')
  ),
  
  -- Tapioca
  (
    'tapioca',
    'Tapioca',
    'keyword',
    'Alimentação',
    'Regional',
    ARRAY['tapioca', 'tapiocas', 'tapiocaria'],
    ARRAY['tapioca'],
    0.88,
    85,
    jsonb_build_object('type', 'food', 'subtype', 'tapioca')
  ),
  
  -- Bar e Cervejaria
  (
    'bar',
    'Bar',
    'keyword',
    'Alimentação',
    'Bar / Petiscaria',
    ARRAY['bar', 'bares', 'boteco', 'botequim', 'cervejaria', 'choperia'],
    ARRAY['bar', 'boteco', 'cervejaria'],
    0.82,
    78,
    jsonb_build_object('type', 'food', 'subtype', 'bar')
  ),
  
  -- Café e Cafeteria
  (
    'cafe',
    'Café',
    'keyword',
    'Alimentação',
    'Cafeteria',
    ARRAY['cafe', 'café', 'cafes', 'cafés', 'cafeteria', 'cafeterias'],
    ARRAY['cafe', 'cafeteria'],
    0.86,
    83,
    jsonb_build_object('type', 'food', 'subtype', 'coffee_shop')
  ),
  
  -- Buffet
  (
    'buffet',
    'Buffet',
    'keyword',
    'Alimentação',
    'Buffet / Self-Service',
    ARRAY['buffet', 'buffets', 'self service', 'selfservice'],
    ARRAY['buffet', 'self'],
    0.85,
    82,
    jsonb_build_object('type', 'food', 'subtype', 'buffet')
  ),
  
  -- Sorvete e Sorveteria
  (
    'sorvete',
    'Sorvete',
    'keyword',
    'Alimentação',
    'Sorveteria',
    ARRAY['sorvete', 'sorvetes', 'sorveteria', 'gelato', 'gelatos'],
    ARRAY['sorvete', 'sorveteria', 'gelato'],
    0.90,
    87,
    jsonb_build_object('type', 'food', 'subtype', 'ice_cream')
  ),
  
  -- Doceria e Confeitaria
  (
    'doceria',
    'Doceria',
    'keyword',
    'Alimentação',
    'Doceria / Confeitaria',
    ARRAY['doceria', 'doces', 'confeitaria', 'bomboniere'],
    ARRAY['doceria', 'doces', 'confeitaria'],
    0.87,
    84,
    jsonb_build_object('type', 'food', 'subtype', 'sweets')
  ),
  
  -- Padaria (reforço - já existe mas vou melhorar)
  (
    'padoca',
    'Padoca',
    'keyword',
    'Alimentação',
    'Padaria',
    ARRAY['padoca', 'panificadora', 'panificacao'],
    ARRAY['padoca', 'panificadora'],
    0.88,
    85,
    jsonb_build_object('type', 'food', 'subtype', 'bakery_alt')
  )
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- KEYWORDS GENÉRICAS DE TIPOS DE COMIDA
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key,
  entity_name,
  entry_type,
  category,
  subcategory,
  aliases,
  keywords,
  confidence_modifier,
  priority,
  metadata
)
VALUES
  -- Comida (genérico)
  (
    'comida',
    'Comida',
    'keyword',
    'Alimentação',
    'Restaurante',
    ARRAY['comida', 'comidas', 'alimentacao', 'alimentação'],
    ARRAY['comida', 'alimentacao'],
    0.75,
    70,
    jsonb_build_object('type', 'food', 'subtype', 'generic_food')
  ),
  
  -- Refeição
  (
    'refeicao',
    'Refeição',
    'keyword',
    'Alimentação',
    'Restaurante',
    ARRAY['refeicao', 'refeição', 'refeicoes', 'refeições', 'almoço', 'almoco', 'jantar'],
    ARRAY['refeicao', 'almoco', 'jantar'],
    0.78,
    73,
    jsonb_build_object('type', 'food', 'subtype', 'meal')
  ),
  
  -- Lanche (alternativa)
  (
    'snack',
    'Snack',
    'keyword',
    'Alimentação',
    'Lanchonete',
    ARRAY['snack', 'snacks', 'lanchinho'],
    ARRAY['snack', 'lanchinho'],
    0.80,
    75,
    jsonb_build_object('type', 'food', 'subtype', 'snack')
  ),
  
  -- Marmita e Marmitaria
  (
    'marmita',
    'Marmita',
    'keyword',
    'Alimentação',
    'Marmitaria',
    ARRAY['marmita', 'marmitas', 'marmitaria', 'quentinha'],
    ARRAY['marmita', 'marmitaria', 'quentinha'],
    0.89,
    86,
    jsonb_build_object('type', 'food', 'subtype', 'lunch_box')
  ),
  
  -- Cozinha (genérico)
  (
    'cozinha',
    'Cozinha',
    'keyword',
    'Alimentação',
    'Restaurante',
    ARRAY['cozinha', 'culinaria', 'culinária'],
    ARRAY['cozinha', 'culinaria'],
    0.72,
    67,
    jsonb_build_object('type', 'food', 'subtype', 'kitchen')
  ),
  
  -- Petisco e Petiscaria
  (
    'petisco',
    'Petisco',
    'keyword',
    'Alimentação',
    'Bar / Petiscaria',
    ARRAY['petisco', 'petiscos', 'petiscaria', 'tira-gosto'],
    ARRAY['petisco', 'petiscaria'],
    0.83,
    79,
    jsonb_build_object('type', 'food', 'subtype', 'appetizers')
  ),
  
  -- Espetinho e Espetaria
  (
    'espetinho',
    'Espetinho',
    'keyword',
    'Alimentação',
    'Espetaria',
    ARRAY['espetinho', 'espetinhos', 'espeto', 'espetos', 'espetaria'],
    ARRAY['espetinho', 'espeto', 'espetaria'],
    0.89,
    86,
    jsonb_build_object('type', 'food', 'subtype', 'skewers')
  ),
  
  -- Feijoada
  (
    'feijoada',
    'Feijoada',
    'keyword',
    'Alimentação',
    'Restaurante',
    ARRAY['feijoada', 'feijoadas'],
    ARRAY['feijoada'],
    0.85,
    81,
    jsonb_build_object('type', 'food', 'subtype', 'brazilian_food')
  )
ON CONFLICT (merchant_key) DO NOTHING;

-- =============================================================================
-- KEYWORDS DE TIPOS DE COZINHA/CULINÁRIA
-- =============================================================================

INSERT INTO merchants_dictionary (
  merchant_key,
  entity_name,
  entry_type,
  category,
  subcategory,
  aliases,
  keywords,
  confidence_modifier,
  priority,
  metadata
)
VALUES
  -- Italiana
  (
    'italiana',
    'Italiana',
    'keyword',
    'Alimentação',
    'Italiana',
    ARRAY['italiana', 'italiano', 'italianissimo', 'cantina'],
    ARRAY['italiana', 'italiano', 'cantina'],
    0.86,
    83,
    jsonb_build_object('type', 'food', 'subtype', 'italian')
  ),
  
  -- Mexicana
  (
    'mexicana',
    'Mexicana',
    'keyword',
    'Alimentação',
    'Mexicana',
    ARRAY['mexicana', 'mexicano', 'taco', 'tacos', 'burrito'],
    ARRAY['mexicana', 'mexicano', 'taco'],
    0.88,
    85,
    jsonb_build_object('type', 'food', 'subtype', 'mexican')
  ),
  
  -- Árabe
  (
    'arabe',
    'Árabe',
    'keyword',
    'Alimentação',
    'Árabe',
    ARRAY['arabe', 'árabe', 'esfiha', 'esfirra', 'kebab'],
    ARRAY['arabe', 'esfiha', 'kebab'],
    0.89,
    86,
    jsonb_build_object('type', 'food', 'subtype', 'arabic')
  ),
  
  -- Chinesa
  (
    'chinesa',
    'Chinesa',
    'keyword',
    'Alimentação',
    'Chinesa',
    ARRAY['chinesa', 'chines', 'chinês'],
    ARRAY['chinesa', 'chines'],
    0.87,
    84,
    jsonb_build_object('type', 'food', 'subtype', 'chinese')
  ),
  
  -- Frutos do Mar
  (
    'frutos_mar',
    'Frutos do Mar',
    'keyword',
    'Alimentação',
    'Frutos do Mar',
    ARRAY['frutos', 'mar', 'peixaria', 'pescado'],
    ARRAY['frutos', 'peixaria'],
    0.84,
    80,
    jsonb_build_object('type', 'food', 'subtype', 'seafood')
  ),
  
  -- Vegetariana/Vegana
  (
    'vegetariana',
    'Vegetariana',
    'keyword',
    'Alimentação',
    'Vegetariana / Vegana',
    ARRAY['vegetariana', 'vegetariano', 'vegana', 'vegano', 'vegan'],
    ARRAY['vegetariana', 'vegana', 'vegan'],
    0.90,
    87,
    jsonb_build_object('type', 'food', 'subtype', 'vegetarian')
  )
ON CONFLICT (merchant_key) DO NOTHING;

COMMIT;

-- =============================================================================
-- ATUALIZAÇÃO DE ÍNDICES (FORA DA TRANSAÇÃO)
-- =============================================================================

-- Reindex para melhorar performance nas buscas
REINDEX INDEX idx_merchants_aliases_gin;

-- =============================================================================
-- COMENTÁRIOS
-- =============================================================================

COMMENT ON TABLE merchants_dictionary IS 
'Dicionário expandido com keywords robustas de alimentação para melhor cobertura de classificação automática.';

