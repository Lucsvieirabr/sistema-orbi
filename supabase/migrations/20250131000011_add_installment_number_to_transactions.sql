-- Add installment_number field to transactions table
-- This migration adds the installment_number field to track which installment each transaction represents

BEGIN;

-- 1. Add installment_number column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN installment_number INTEGER;

-- 2. Add comment to explain the field
COMMENT ON COLUMN public.transactions.installment_number IS 'Número da parcela (1, 2, 3, etc.) para transações que fazem parte de uma série';

-- 3. Create index for performance on installment queries
CREATE INDEX idx_transactions_installment_number ON public.transactions(installment_number) 
WHERE installment_number IS NOT NULL;

-- 4. Update existing transactions with series_id to have installment_number
-- This will set installment_number based on the order of creation for existing series
WITH numbered_transactions AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY series_id ORDER BY created_at) as installment_num
  FROM public.transactions 
  WHERE series_id IS NOT NULL
)
UPDATE public.transactions 
SET installment_number = numbered_transactions.installment_num
FROM numbered_transactions
WHERE public.transactions.id = numbered_transactions.id;

-- 5. Update create_installment_series function to include installment_number
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

-- 6. Update update_installment_series function to include installment_number
CREATE OR REPLACE FUNCTION update_installment_series(
  p_series_id UUID,
  p_user_id UUID,
  p_installments_data JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
  installment_record JSONB;
  total_value NUMERIC;
  total_installments INTEGER;
  i INTEGER;
BEGIN
  -- Verificar se a série existe e pertence ao usuário
  IF NOT EXISTS (
    SELECT 1 FROM series 
    WHERE id = p_series_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Série não encontrada ou não pertence ao usuário';
  END IF;
  
  -- Validar se p_installments_data é um array válido
  IF jsonb_typeof(p_installments_data) != 'array' THEN
    RAISE EXCEPTION 'installments_data deve ser um array JSON';
  END IF;
  
  -- Calcular novos valores totais
  total_installments := jsonb_array_length(p_installments_data);
  total_value := 0;
  
  -- Calcular valor total das parcelas
  FOR i IN 0..total_installments - 1 LOOP
    installment_record := p_installments_data->i;
    total_value := total_value + (installment_record->>'value')::numeric;
  END LOOP;
  
  -- Atualizar registro da série
  UPDATE series 
  SET 
    total_value = update_installment_series.total_value,
    total_installments = update_installment_series.total_installments,
    updated_at = NOW()
  WHERE id = p_series_id AND user_id = p_user_id;
  
  -- Deletar transações existentes da série
  DELETE FROM transactions WHERE series_id = p_series_id AND user_id = p_user_id;
  
  -- Recriar as transações com os novos dados
  FOR i IN 0..total_installments - 1 LOOP
    installment_record := p_installments_data->i;
    
    -- Validar campos obrigatórios da parcela
    IF NOT (installment_record ? 'value' AND installment_record ? 'date' AND installment_record ? 'status') THEN
      RAISE EXCEPTION 'Cada parcela deve ter os campos: value, date, status';
    END IF;
    
    -- Inserir a transação atualizada com installment_number
    INSERT INTO transactions (
      user_id, description, type, value, date, status,
      account_id, category_id, payment_method, credit_card_id, person_id, series_id,
      installment_number
    ) 
    SELECT 
      user_id, description, type, 
      (installment_record->>'value')::numeric,
      (installment_record->>'date')::date,
      installment_record->>'status',
      account_id, category_id, payment_method, credit_card_id, person_id,
      p_series_id,
      i + 1  -- installment_number starts from 1
    FROM transactions 
    WHERE series_id = p_series_id AND user_id = p_user_id
    LIMIT 1;
  END LOOP;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Série de parcelas atualizada: % com % parcelas', p_series_id, total_installments;
  
  RETURN updated_count;
END;
$$;

-- 7. Create a view to show installment information with series details
CREATE OR REPLACE VIEW public.transaction_installments AS
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

-- 8. Grant permissions
GRANT SELECT ON public.transaction_installments TO authenticated;

-- 9. Update comments
COMMENT ON FUNCTION create_installment_series IS 'Cria uma série de transações parceladas com valores e datas individuais. Inclui installment_number para cada parcela. Retorna o series_id gerado.';
COMMENT ON FUNCTION update_installment_series IS 'Atualiza uma série de parcelas existente com novos valores e datas. Inclui installment_number para cada parcela.';
COMMENT ON VIEW public.transaction_installments IS 'View que mostra transações com informações de parcelas, incluindo installment_display formatado (ex: 1/10)';

COMMIT;
