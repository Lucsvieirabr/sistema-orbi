-- Adicionar campo is_shared na tabela transactions
-- Este campo indica se o valor total da transação foi pago pelo usuário mas será rateado entre terceiros

ALTER TABLE transactions
ADD COLUMN is_shared BOOLEAN DEFAULT FALSE;

-- Adicionar comentário na coluna para documentação
COMMENT ON COLUMN transactions.is_shared IS 'Indica se o valor total da transação foi pago pelo usuário mas será rateado entre terceiros (gastos compartilhados)';
