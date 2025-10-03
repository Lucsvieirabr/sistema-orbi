-- Adicionar campo liquidation_date para controlar quando a transação foi liquidada (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'liquidation_date'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN liquidation_date timestamptz;
    END IF;
END $$;

-- Comentário explicativo
COMMENT ON COLUMN public.transactions.liquidation_date IS 'Data e hora exata em que a transação foi liquidada (status alterado para PAID). Usado para ordenação inteligente do extrato.';

-- Criar índice para otimizar consultas de ordenação (se não existir)
CREATE INDEX IF NOT EXISTS idx_transactions_liquidation_date ON public.transactions(liquidation_date) 
WHERE liquidation_date IS NOT NULL;

-- Atualizar transações existentes que já estão como PAID
-- Definir liquidation_date como updated_at para transações já pagas
UPDATE public.transactions 
SET liquidation_date = updated_at 
WHERE status = 'PAID' AND liquidation_date IS NULL;

-- Função para atualizar liquidation_date automaticamente quando status muda para PAID
CREATE OR REPLACE FUNCTION update_liquidation_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o status mudou para PAID e liquidation_date é NULL, definir como NOW()
    IF NEW.status = 'PAID' AND OLD.status != 'PAID' AND NEW.liquidation_date IS NULL THEN
        NEW.liquidation_date = NOW();
    END IF;
    
    -- Se o status mudou de PAID para PENDING, limpar liquidation_date
    IF OLD.status = 'PAID' AND NEW.status = 'PENDING' THEN
        NEW.liquidation_date = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para executar a função automaticamente (se não existir)
DROP TRIGGER IF EXISTS trigger_update_liquidation_date ON public.transactions;
CREATE TRIGGER trigger_update_liquidation_date
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_liquidation_date();

-- Comentário na função
COMMENT ON FUNCTION update_liquidation_date() IS 'Atualiza automaticamente o campo liquidation_date quando o status da transação muda para PAID ou sai do status PAID.';
