-- Fix ambiguous column reference in update_installment_series function
-- This migration fixes the ambiguous column reference error for 'total_value'

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
  total_installments INTEGER;
  i INTEGER;
  series_exists BOOLEAN;
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
  total_installments := jsonb_array_length(p_installments_data);
  calculated_total_value := 0;  -- Use renamed variable
  
  -- Calcular valor total das parcelas
  FOR i IN 0..total_installments - 1 LOOP
    installment_record := p_installments_data->i;
    calculated_total_value := calculated_total_value + (installment_record->>'value')::numeric;
  END LOOP;
  
  -- Atualizar registro da série
  UPDATE series 
  SET 
    total_value = calculated_total_value,  -- Use renamed variable
    total_installments = total_installments,
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
    FROM series s
    WHERE s.id = p_series_id AND s.user_id = p_user_id;
  END LOOP;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Série de parcelas atualizada: % com % parcelas', p_series_id, total_installments;
  
  RETURN updated_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_installment_series TO authenticated;

-- Update comment
COMMENT ON FUNCTION update_installment_series IS 'Atualiza uma série de parcelas existente com novos valores e datas. Parâmetros: p_installments_data, p_series_id, p_user_id';

COMMIT;
