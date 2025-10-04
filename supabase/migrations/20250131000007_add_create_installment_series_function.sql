-- Função para criar série de parcelas com valores e datas individuais
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
  installment_data JSONB;
  installment_record JSONB;
  transaction_data JSONB;
  i INTEGER;
BEGIN
  -- Gerar um series_id único para a série
  series_id := gen_random_uuid();
  
  -- Validar se p_installments_data é um array válido
  IF jsonb_typeof(p_installments_data) != 'array' THEN
    RAISE EXCEPTION 'installments_data deve ser um array JSON';
  END IF;
  
  -- Iterar sobre cada parcela no array
  FOR i IN 0..jsonb_array_length(p_installments_data) - 1 LOOP
    installment_record := p_installments_data->i;
    
    -- Validar campos obrigatórios da parcela
    IF NOT (installment_record ? 'value' AND installment_record ? 'date' AND installment_record ? 'status') THEN
      RAISE EXCEPTION 'Cada parcela deve ter os campos: value, date, status';
    END IF;
    
    -- Construir dados da transação
    transaction_data := jsonb_build_object(
      'user_id', p_user_id,
      'description', p_description,
      'type', p_type,
      'value', (installment_record->>'value')::numeric,
      'date', installment_record->>'date',
      'status', installment_record->>'status',
      'account_id', p_account_id,
      'category_id', p_category_id,
      'payment_method', p_payment_method,
      'credit_card_id', p_credit_card_id,
      'person_id', p_person_id,
      'is_fixed', p_is_fixed,
      'installments', jsonb_array_length(p_installments_data),
      'installment_number', i + 1,
      'series_id', series_id,
      'created_at', NOW(),
      'updated_at', NOW()
    );
    
    -- Inserir a transação
    INSERT INTO transactions (
      user_id, description, type, value, date, status,
      account_id, category_id, payment_method, credit_card_id, person_id,
      is_fixed, installments, installment_number, series_id
    ) VALUES (
      (transaction_data->>'user_id')::uuid,
      transaction_data->>'description',
      transaction_data->>'type',
      (transaction_data->>'value')::numeric,
      (transaction_data->>'date')::date,
      transaction_data->>'status',
      CASE WHEN transaction_data->>'account_id' = 'null' THEN NULL ELSE (transaction_data->>'account_id')::uuid END,
      CASE WHEN transaction_data->>'category_id' = 'null' THEN NULL ELSE (transaction_data->>'category_id')::uuid END,
      transaction_data->>'payment_method',
      CASE WHEN transaction_data->>'credit_card_id' = 'null' THEN NULL ELSE (transaction_data->>'credit_card_id')::uuid END,
      CASE WHEN transaction_data->>'person_id' = 'null' THEN NULL ELSE (transaction_data->>'person_id')::uuid END,
      (transaction_data->>'is_fixed')::boolean,
      (transaction_data->>'installments')::integer,
      (transaction_data->>'installment_number')::integer,
      (transaction_data->>'series_id')::uuid
    );
  END LOOP;
  
  -- Log da criação da série
  RAISE NOTICE 'Série de parcelas criada: % com % parcelas', series_id, jsonb_array_length(p_installments_data);
  
  RETURN series_id;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION create_installment_series IS 'Cria uma série de transações parceladas com valores e datas individuais. Retorna o series_id gerado.';

-- Função para atualizar série de parcelas existente
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
  installment_data JSONB;
  installment_record JSONB;
  i INTEGER;
  transaction_id UUID;
BEGIN
  -- Verificar se a série existe e pertence ao usuário
  IF NOT EXISTS (
    SELECT 1 FROM transactions 
    WHERE series_id = p_series_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Série não encontrada ou não pertence ao usuário';
  END IF;
  
  -- Deletar transações existentes da série
  DELETE FROM transactions WHERE series_id = p_series_id AND user_id = p_user_id;
  
  -- Recriar as transações com os novos dados
  FOR i IN 0..jsonb_array_length(p_installments_data) - 1 LOOP
    installment_record := p_installments_data->i;
    
    -- Validar campos obrigatórios da parcela
    IF NOT (installment_record ? 'value' AND installment_record ? 'date' AND installment_record ? 'status') THEN
      RAISE EXCEPTION 'Cada parcela deve ter os campos: value, date, status';
    END IF;
    
    -- Inserir a transação atualizada
    INSERT INTO transactions (
      user_id, description, type, value, date, status,
      account_id, category_id, payment_method, credit_card_id, person_id,
      is_fixed, installments, installment_number, series_id
    ) 
    SELECT 
      user_id, description, type, 
      (installment_record->>'value')::numeric,
      (installment_record->>'date')::date,
      installment_record->>'status',
      account_id, category_id, payment_method, credit_card_id, person_id,
      is_fixed, 
      jsonb_array_length(p_installments_data),
      i + 1,
      p_series_id
    FROM transactions 
    WHERE series_id = p_series_id AND user_id = p_user_id
    LIMIT 1;
  END LOOP;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Série de parcelas atualizada: % com % parcelas', p_series_id, jsonb_array_length(p_installments_data);
  
  RETURN updated_count;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION update_installment_series IS 'Atualiza uma série de parcelas existente com novos valores e datas.';

-- Função para deletar série de parcelas
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
  -- Deletar todas as transações da série
  DELETE FROM transactions 
  WHERE series_id = p_series_id AND user_id = p_user_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Série de parcelas deletada: % (% transações removidas)', p_series_id, deleted_count;
  
  RETURN deleted_count;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION delete_installment_series IS 'Deleta uma série de parcelas completa.';
