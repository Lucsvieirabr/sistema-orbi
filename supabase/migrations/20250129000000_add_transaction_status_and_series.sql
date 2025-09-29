-- Migration: Add status and series_id to transactions table for cash flow management

BEGIN;

-- Add new columns to transactions table
ALTER TABLE public.transactions
  ADD COLUMN status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN series_id uuid;

-- Add constraint to ensure status has valid values
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('PENDING', 'PAID', 'CANCELED'));

-- Create index on series_id for better query performance
CREATE INDEX idx_transactions_series_id ON public.transactions(series_id);

-- Create index on status for better query performance
CREATE INDEX idx_transactions_status ON public.transactions(status);

-- Update existing transactions to have PAID status (since they were already processed)
-- This ensures backward compatibility - existing transactions are considered as already paid
UPDATE public.transactions
SET status = 'PAID'
WHERE status = 'PENDING';

COMMIT;
