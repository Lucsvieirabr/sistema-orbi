-- Drop composition_details from series table (cleanup from previous attempt)
ALTER TABLE public.series DROP COLUMN IF EXISTS composition_details;

-- Add composition_details column to transactions table
-- This column stores a JSON string with informational details about composite split items
-- Format: [{"value": 32, "description": "Coca", "date": "2025-10-08"}, ...]

ALTER TABLE public.transactions
ADD COLUMN composition_details TEXT NULL;

COMMENT ON COLUMN public.transactions.composition_details IS 'JSON string containing array of composition items for audit and visualization purposes only. Not used in balance calculations.';

