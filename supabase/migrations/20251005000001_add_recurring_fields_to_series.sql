-- Migration: Add recurring/frequency fields to series table for fixed transactions
-- This migration adds frequency, start_date, and end_date fields to support recurring transactions

BEGIN;

-- Add frequency field to series table
ALTER TABLE public.series
ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly'));

-- Add start_date field to series table
ALTER TABLE public.series
ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE;

-- Add end_date field to series table (optional for recurring series)
ALTER TABLE public.series
ADD COLUMN IF NOT EXISTS end_date date;

-- Add comments to document the new fields
COMMENT ON COLUMN public.series.frequency IS 'Frequency of recurring transactions: daily, weekly, monthly, yearly';
COMMENT ON COLUMN public.series.start_date IS 'Start date for recurring transactions';
COMMENT ON COLUMN public.series.end_date IS 'Optional end date for recurring transactions (NULL for infinite series)';

-- Create indexes for better performance on recurring queries
CREATE INDEX IF NOT EXISTS idx_series_frequency ON public.series(frequency) WHERE is_fixed = TRUE;
CREATE INDEX IF NOT EXISTS idx_series_start_date ON public.series(start_date) WHERE is_fixed = TRUE;
CREATE INDEX IF NOT EXISTS idx_series_end_date ON public.series(end_date) WHERE end_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_series_fixed_active ON public.series(is_fixed, start_date, end_date) WHERE is_fixed = TRUE;

-- Update existing fixed series to have reasonable start dates
UPDATE public.series
SET start_date = created_at::date
WHERE is_fixed = TRUE AND start_date = CURRENT_DATE;

COMMIT;
