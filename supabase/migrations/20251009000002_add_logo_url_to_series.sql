-- Migration: Add logo_url field to series table
-- This migration adds a field to store the logo URL from logo.dev CDN

BEGIN;

-- Add logo_url field to series table
ALTER TABLE public.series
ADD COLUMN IF NOT EXISTS logo_url text;

-- Add comment to document the new field
COMMENT ON COLUMN public.series.logo_url IS 'URL of the company logo from logo.dev CDN (e.g., https://img.logo.dev/netflix.com?format=svg&size=60)';

-- Create index for better performance when filtering by logo_url presence
CREATE INDEX IF NOT EXISTS idx_series_logo_url ON public.series(logo_url) WHERE logo_url IS NOT NULL;

COMMIT;

