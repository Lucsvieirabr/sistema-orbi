-- ============================================================================
-- Classificador v2 — correção do passo 3 de 20260916113346
-- ============================================================================
-- UPDATE ... FROM com várias linhas-fonte para o MESMO alvo aplica só uma
-- delas (Postgres não acumula). O merchant "amazon" recebeu só "amzn". Aqui os
-- aliases ausentes são agregados por merchant antes do UPDATE. Idempotente.
-- ============================================================================

WITH extra(merchant_key, alias) AS (
  VALUES ('amazon', 'amzn'), ('amazon', 'amzn mktp'), ('amazon', 'amazon marketplace'),
         ('uber', 'uberrides'), ('uber', 'uber rides'), ('gympass', 'wellhub')
),
missing AS (
  SELECT e.merchant_key, array_agg(e.alias ORDER BY e.alias) AS aliases
    FROM extra e
    JOIN public.merchants_dictionary m ON m.merchant_key = e.merchant_key
   WHERE NOT (e.alias = ANY (COALESCE(m.aliases, '{}')))
   GROUP BY e.merchant_key
)
UPDATE public.merchants_dictionary m
   SET aliases = COALESCE(m.aliases, '{}') || missing.aliases
  FROM missing
 WHERE m.merchant_key = missing.merchant_key;
