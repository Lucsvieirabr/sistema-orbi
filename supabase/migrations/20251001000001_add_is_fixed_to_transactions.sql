-- Add is_fixed column back to transactions table
-- This migration adds the is_fixed column to transactions table to support fixed/recurring transactions
-- The column allows NULL values and defaults to FALSE for backward compatibility

BEGIN;

-- Add is_fixed column to transactions table
-- This column will be used to mark transactions as fixed/recurring
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS is_fixed boolean DEFAULT FALSE;

-- Update existing transactions to have is_fixed = FALSE by default
-- This ensures backward compatibility with existing data
UPDATE public.transactions 
SET is_fixed = FALSE 
WHERE is_fixed IS NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN public.transactions.is_fixed IS 'Indicates if the transaction is fixed/recurring. Used for recurring transactions functionality.';

-- Create index for performance on is_fixed queries
CREATE INDEX idx_transactions_is_fixed ON public.transactions(is_fixed) WHERE is_fixed = TRUE;

-- Note: Series table functionality was removed in previous migrations
-- The is_fixed column in transactions table is sufficient for fixed/recurring transactions

-- Note: Series-based maintenance functions removed as series table is not available
-- Fixed transactions can be maintained using existing functions that work with the current schema

COMMIT;
