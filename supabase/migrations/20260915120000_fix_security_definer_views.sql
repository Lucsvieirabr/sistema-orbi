-- =============================================================================
-- FIX: Supabase Advisor — views com SECURITY DEFINER (lint 0010_security_definer_view)
--
--   public.series_summary            (origem: 20250131000008)
--   public.transaction_installments  (origem: 20250131000011)
--
-- Sem `security_invoker`, a view roda com privilégios do owner (postgres) e
-- ignora o RLS de `series`/`transactions` → leitura cross-tenant.
-- Com `security_invoker = true` (PG15+), o RLS da tabela base é avaliado com o
-- papel/`auth.uid()` de quem consulta.
--
-- Corpo das views = cópia literal das definições vigentes (colunas conferidas
-- contra src/integrations/supabase/types.ts). Só o cabeçalho muda.
-- CREATE OR REPLACE VIEW preserva GRANTs e dependências existentes.
-- =============================================================================

BEGIN;

-- 1. series_summary -----------------------------------------------------------
CREATE OR REPLACE VIEW public.series_summary
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.user_id,
  s.description,
  s.total_value,
  s.total_installments,
  s.is_fixed,
  s.category_id,
  s.created_at,
  s.updated_at,
  COUNT(t.id) as created_installments,
  COUNT(CASE WHEN t.status = 'PAID' THEN 1 END) as paid_installments,
  COUNT(CASE WHEN t.status = 'PENDING' THEN 1 END) as pending_installments,
  SUM(CASE WHEN t.status = 'PAID' THEN t.value ELSE 0 END) as paid_value,
  SUM(CASE WHEN t.status = 'PENDING' THEN t.value ELSE 0 END) as pending_value
FROM public.series s
LEFT JOIN public.transactions t ON s.id = t.series_id
GROUP BY s.id, s.user_id, s.description, s.total_value, s.total_installments,
         s.is_fixed, s.category_id, s.created_at, s.updated_at;

-- 2. transaction_installments -------------------------------------------------
CREATE OR REPLACE VIEW public.transaction_installments
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.user_id,
  t.description,
  t.value,
  t.date,
  t.type,
  t.status,
  t.series_id,
  t.installment_number,
  s.total_installments,
  CONCAT(t.installment_number, '/', s.total_installments) as installment_display,
  s.description as series_description,
  s.total_value as series_total_value,
  s.is_fixed as series_is_fixed
FROM public.transactions t
LEFT JOIN public.series s ON t.series_id = s.id
WHERE t.series_id IS NOT NULL;

-- 3. Grants (idempotente — mesmo estado das migrations de origem) --------------
GRANT SELECT ON public.series_summary TO authenticated;
GRANT SELECT ON public.transaction_installments TO authenticated;

COMMENT ON VIEW public.transaction_installments IS 'View que mostra transações com informações de parcelas, incluindo installment_display formatado (ex: 1/10). security_invoker = true: RLS de transactions/series aplicado ao chamador.';
COMMENT ON VIEW public.series_summary IS 'Agregados por série (parcelas pagas/pendentes e valores). security_invoker = true: RLS de series/transactions aplicado ao chamador.';

-- 4. Asserção: aborta a migration se a opção não ficou gravada ----------------
DO $$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['series_summary', 'transaction_installments'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_name
        AND c.relkind = 'v'
        AND c.reloptions @> ARRAY['security_invoker=true']
    ) THEN
      RAISE EXCEPTION 'public.% sem security_invoker=true', v_name;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
