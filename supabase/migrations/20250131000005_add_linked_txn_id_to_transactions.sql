-- Adicionar campo linked_txn_id na tabela transactions
-- Este campo cria relacionamento entre transações de rateio (gasto bruto vs compensação)

ALTER TABLE transactions
ADD COLUMN linked_txn_id UUID REFERENCES transactions(id) ON DELETE CASCADE;

-- Adicionar comentário na coluna para documentação
COMMENT ON COLUMN transactions.linked_txn_id IS 'Chave de ligação para transações relacionadas em rateios (gasto bruto aponta para compensação e vice-versa)';
