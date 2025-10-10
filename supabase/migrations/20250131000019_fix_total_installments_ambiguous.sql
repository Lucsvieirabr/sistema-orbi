-- Fix ambiguous column reference for total_installments in update_installment_series function
-- This migration fixes the ambiguous column reference error for 'total_installments'

BEGIN;

-- Drop and recreate the function with fixed column references
DROP FUNCTION IF EXISTS update_installment_series(JSONB, UUID, UUID);

CREATE OR REPLACE FUNCTION update_installment_series(
  p_installments_data JSONB,
  p_series_id UUID,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
  installment_record JSONB;
  calculated_total_value NUMERIC;  -- Renamed to avoid ambiguity
  calculated_total_installments INTEGER;  -- Renamed to avoid ambiguity
  i INTEGER;
  series_exists BOOLEAN;
  original_txn RECORD;
BEGIN
  -- Verificar se a série existe e pertence ao usuário
  SELECT EXISTS(
    SELECT 1 FROM series 
    WHERE id = p_series_id AND user_id = p_user_id
  ) INTO series_exists;
  
  IF NOT series_exists THEN
    RAISE EXCEPTION 'Série não encontrada ou não pertence ao usuário';
  END IF;
  
  -- Validar se p_installments_data é um array válido
  IF jsonb_typeof(p_installments_data) != 'array' THEN
    RAISE EXCEPTION 'installments_data deve ser um array JSON';
  END IF;
  
  -- Calcular novos valores totais
  calculated_total_installments := jsonb_array_length(p_installments_data);  -- Use renamed variable
  calculated_total_value := 0;  -- Use renamed variable
  
  -- Calcular valor total das parcelas
  FOR i IN 0..calculated_total_installments - 1 LOOP  -- Use renamed variable
    installment_record := p_installments_data->i;
    calculated_total_value := calculated_total_value + (installment_record->>'value')::numeric;
  END LOOP;
  
  -- Atualizar registro da série
  UPDATE series 
  SET 
    total_value = calculated_total_value,  -- Use renamed variable
    total_installments = calculated_total_installments,  -- Use renamed variable
    updated_at = NOW()
  WHERE id = p_series_id AND user_id = p_user_id;
  
  -- Get original transaction details to preserve them
  SELECT 
    user_id, description, type, account_id, category_id, 
    payment_method, credit_card_id, person_id
  INTO original_txn
  FROM transactions 
  WHERE series_id = p_series_id AND user_id = p_user_id 
  LIMIT 1;
  
  -- Deletar transações existentes da série
  DELETE FROM transactions WHERE series_id = p_series_id AND user_id = p_user_id;
  
  -- Recriar as transações com os novos dados
  FOR i IN 0..calculated_total_installments - 1 LOOP  -- Use renamed variable
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
    ) VALUES (
      original_txn.user_id,
      original_txn.description,
      original_txn.type,
      (installment_record->>'value')::numeric,
      (installment_record->>'date')::date,
      installment_record->>'status',
      original_txn.account_id,
      original_txn.category_id,
      original_txn.payment_method,
      original_txn.credit_card_id,
      original_txn.person_id,
      p_series_id,
      i + 1  -- installment_number starts from 1
    );
  END LOOP;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Série de parcelas atualizada: % com % parcelas', p_series_id, calculated_total_installments;  -- Use renamed variable
  
  RETURN updated_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_installment_series TO authenticated;

-- Update comment
COMMENT ON FUNCTION update_installment_series IS 'Atualiza uma série de parcelas existente com novos valores e datas. Parâmetros: p_installments_data, p_series_id, p_user_id';

COMMIT;
