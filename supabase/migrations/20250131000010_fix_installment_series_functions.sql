-- Fix installment series functions to work with new series-based structure
-- This migration updates the create_installment_series and update_installment_series functions

BEGIN;

-- Drop the old functions
DROP FUNCTION IF EXISTS create_installment_series(UUID, TEXT, TEXT, UUID, UUID, TEXT, UUID, UUID, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS update_installment_series(UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS delete_installment_series(UUID, UUID);

-- Create updated create_installment_series function
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
    
    -- Inserir a transação (sem os campos removidos)
    INSERT INTO transactions (
      user_id, description, type, value, date, status,
      account_id, category_id, payment_method, credit_card_id, person_id, series_id
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
      series_id
    );
  END LOOP;
  
  -- Log da criação da série
  RAISE NOTICE 'Série de parcelas criada: % com % parcelas', series_id, total_installments;
  
  RETURN series_id;
END;
$$;

-- Create updated update_installment_series function
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
    total_value = total_value,
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
    
    -- Inserir a transação atualizada (sem os campos removidos)
    INSERT INTO transactions (
      user_id, description, type, value, date, status,
      account_id, category_id, payment_method, credit_card_id, person_id, series_id
    ) 
    SELECT 
      user_id, description, type, 
      (installment_record->>'value')::numeric,
      (installment_record->>'date')::date,
      installment_record->>'status',
      account_id, category_id, payment_method, credit_card_id, person_id,
      p_series_id
    FROM transactions 
    WHERE series_id = p_series_id AND user_id = p_user_id
    LIMIT 1;
  END LOOP;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Série de parcelas atualizada: % com % parcelas', p_series_id, total_installments;
  
  RETURN updated_count;
END;
$$;

-- Create updated delete_installment_series function
CREATE OR REPLACE FUNCTION delete_installment_series(
  p_series_id UUID,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Verificar se a série existe e pertence ao usuário
  IF NOT EXISTS (
    SELECT 1 FROM series 
    WHERE id = p_series_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Série não encontrada ou não pertence ao usuário';
  END IF;
  
  -- Deletar todas as transações da série
  DELETE FROM transactions 
  WHERE series_id = p_series_id AND user_id = p_user_id;
  
  -- Deletar o registro da série
  DELETE FROM series 
  WHERE id = p_series_id AND user_id = p_user_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Série de parcelas deletada: % (% transações removidas)', p_series_id, deleted_count;
  
  RETURN deleted_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_installment_series TO authenticated;
GRANT EXECUTE ON FUNCTION update_installment_series TO authenticated;
GRANT EXECUTE ON FUNCTION delete_installment_series TO authenticated;

-- Update comments
COMMENT ON FUNCTION create_installment_series IS 'Cria uma série de transações parceladas com valores e datas individuais. Retorna o series_id gerado.';
COMMENT ON FUNCTION update_installment_series IS 'Atualiza uma série de parcelas existente com novos valores e datas.';
COMMENT ON FUNCTION delete_installment_series IS 'Deleta uma série de parcelas completa.';

COMMIT;
