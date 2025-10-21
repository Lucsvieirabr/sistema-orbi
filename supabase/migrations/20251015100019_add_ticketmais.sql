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
REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_frequent_merchants;

COMMIT;

