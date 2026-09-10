-- Migration: Add TicketMais merchant
-- Single merchant addition for ticket sales platform

BEGIN;

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

('ticketmais', 'TicketMais', 'Lazer', 'Ingressos', 'merchant',
 ARRAY['ticketmais'], ARRAY['ingressos', 'eventos', 'show', 'curso', 'tickets'],
 0.95, 95, 0, 'imported', '{"sector": "entertainment", "type": "tickets"}')

ON CONFLICT (merchant_key) DO NOTHING;

-- Atualizar materialized view
-- REFRESH ... CONCURRENTLY não pode rodar dentro de bloco de transação
-- (esta migration está em BEGIN/COMMIT) e exige a matview já populada.
DO $refresh$
BEGIN
  IF to_regclass('public.mv_frequent_merchants') IS NOT NULL THEN
    REFRESH MATERIALIZED VIEW public.mv_frequent_merchants;
  END IF;
END
$refresh$;

COMMIT;

