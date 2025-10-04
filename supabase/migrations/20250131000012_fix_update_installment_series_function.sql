-- Fix update_installment_series function signature and add series cleanup
-- This migration fixes the function signature and adds automatic series cleanup

BEGIN;

-- 1. Drop existing function to recreate with correct signature
DROP FUNCTION IF EXISTS update_installment_series(UUID, UUID, JSONB);

-- 2. Create corrected update_installment_series function
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
  total_value NUMERIC;
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

-- 3. Create function to clean up orphaned series
CREATE OR REPLACE FUNCTION cleanup_orphaned_series()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete series that have no associated transactions
  DELETE FROM series 
  WHERE id NOT IN (
    SELECT DISTINCT series_id 
    FROM transactions 
    WHERE series_id IS NOT NULL
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Removidas % séries órfãs', deleted_count;
  END IF;
  
  RETURN deleted_count;
END;
$$;

-- 4. Create function to update series total value when individual transaction is updated
CREATE OR REPLACE FUNCTION update_series_total_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  series_total_value NUMERIC;
  series_total_installments INTEGER;
BEGIN
  -- Only process if this is a transaction with series_id
  IF NEW.series_id IS NOT NULL THEN
    -- Calculate new total value and count for the series
    SELECT 
      COALESCE(SUM(value), 0),
      COUNT(*)
    INTO series_total_value, series_total_installments
    FROM transactions 
    WHERE series_id = NEW.series_id AND user_id = NEW.user_id;
    
    -- Update the series record
    UPDATE series 
    SET 
      total_value = series_total_value,
      total_installments = series_total_installments,
      updated_at = NOW()
    WHERE id = NEW.series_id AND user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Create trigger to automatically update series when transactions change
DROP TRIGGER IF EXISTS trigger_update_series_total_value ON transactions;
CREATE TRIGGER trigger_update_series_total_value
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_series_total_value();

-- 6. Create function to delete series and all its transactions
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
  -- Verify series exists and belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM series 
    WHERE id = p_series_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Série não encontrada ou não pertence ao usuário';
  END IF;
  
  -- Delete all transactions in the series
  DELETE FROM transactions 
  WHERE series_id = p_series_id AND user_id = p_user_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete the series itself
  DELETE FROM series 
  WHERE id = p_series_id AND user_id = p_user_id;
  
  RAISE NOTICE 'Série % deletada com % transações', p_series_id, deleted_count;
  
  RETURN deleted_count;
END;
$$;

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION update_installment_series TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_orphaned_series TO authenticated;
GRANT EXECUTE ON FUNCTION delete_installment_series TO authenticated;

-- 8. Update comments
COMMENT ON FUNCTION update_installment_series IS 'Atualiza uma série de parcelas existente com novos valores e datas. Parâmetros: p_installments_data, p_series_id, p_user_id';
COMMENT ON FUNCTION cleanup_orphaned_series IS 'Remove séries que não possuem transações associadas';
COMMENT ON FUNCTION update_series_total_value IS 'Trigger function que atualiza automaticamente o valor total da série quando transações são modificadas';
COMMENT ON FUNCTION delete_installment_series IS 'Deleta uma série e todas as suas transações associadas';

COMMIT;
