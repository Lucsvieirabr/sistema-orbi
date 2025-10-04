-- Fix installment_number column to allow NULL values for simple transactions
-- This migration adds a default value and makes the column nullable for non-series transactions

BEGIN;

-- 1. Make installment_number nullable (it should be NULL for simple transactions)
-- The column is already nullable, but we need to ensure it has proper handling

-- 2. Add a comment to clarify the usage
COMMENT ON COLUMN public.transactions.installment_number IS 'Número da parcela (1, 2, 3, etc.) para transações que fazem parte de uma série. NULL para transações simples.';

-- 3. Create a check constraint to ensure installment_number is only set for series transactions
-- If series_id is NULL, then installment_number must be NULL
-- If series_id is NOT NULL, then installment_number must be NOT NULL
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_installment_number_check
  CHECK (
    (series_id IS NULL AND installment_number IS NULL) OR
    (series_id IS NOT NULL AND installment_number IS NOT NULL)
  );

-- 4. Update the create_installment_series function to ensure it sets installment_number correctly
CREATE OR REPLACE FUNCTION create_installment_series(
  p_user_id UUID,
  p_description TEXT,
  p_type TEXT,
  p_account_id UUID,
  p_category_id UUID,
  p_payment_method TEXT,
  p_credit_card_id UUID,
  p_person_id UUID,
  p_is_fixed BOOLEAN,
  p_installments_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  series_id UUID;
  installment_record JSONB;
  total_value NUMERIC;
  total_installments INTEGER;
  i INTEGER;
BEGIN
  -- Validar se p_installments_data é um array válido
  IF jsonb_typeof(p_installments_data) != 'array' THEN
    RAISE EXCEPTION 'installments_data deve ser um array JSON';
  END IF;
  
  -- Calcular valores totais para a série
  total_installments := jsonb_array_length(p_installments_data);
  total_value := 0;
  
  -- Calcular valor total das parcelas
  FOR i IN 0..total_installments - 1 LOOP
    installment_record := p_installments_data->i;
    total_value := total_value + (installment_record->>'value')::numeric;
  END LOOP;
  
  -- Gerar um series_id único para a série
  series_id := gen_random_uuid();
  
  -- Criar registro na tabela series
  INSERT INTO series (
    id, user_id, description, total_value, total_installments, is_fixed, category_id
  ) VALUES (
    series_id, p_user_id, p_description, total_value, total_installments, p_is_fixed, p_category_id
  );
  
  -- Iterar sobre cada parcela no array e inserir transações
  FOR i IN 0..total_installments - 1 LOOP
    installment_record := p_installments_data->i;
    
    -- Validar campos obrigatórios da parcela
    IF NOT (installment_record ? 'value' AND installment_record ? 'date' AND installment_record ? 'status') THEN
      RAISE EXCEPTION 'Cada parcela deve ter os campos: value, date, status';
    END IF;
    
    -- Inserir a transação com installment_number
    INSERT INTO transactions (
      user_id, description, type, value, date, status,
      account_id, category_id, payment_method, credit_card_id, person_id, series_id,
      installment_number
    ) VALUES (
      p_user_id,
      p_description,
      p_type,
      (installment_record->>'value')::numeric,
      (installment_record->>'date')::date,
      installment_record->>'status',
      CASE WHEN p_account_id IS NULL THEN NULL ELSE p_account_id END,
      CASE WHEN p_category_id IS NULL THEN NULL ELSE p_category_id END,
      p_payment_method,
      CASE WHEN p_credit_card_id IS NULL THEN NULL ELSE p_credit_card_id END,
      CASE WHEN p_person_id IS NULL THEN NULL ELSE p_person_id END,
      series_id,
      i + 1  -- installment_number starts from 1
    );
  END LOOP;
  
  -- Log da criação da série
  RAISE NOTICE 'Série de parcelas criada: % com % parcelas', series_id, total_installments;
  
  RETURN series_id;
END;
$$;

COMMIT;
