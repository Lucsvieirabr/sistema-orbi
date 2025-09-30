-- Adicionar campo compensation_value na tabela transactions
-- Este campo registra a parte do gasto que será compensada pelas dívidas (usado em rateios e empréstimos)

ALTER TABLE transactions
ADD COLUMN compensation_value NUMERIC(12,2) DEFAULT 0;

-- Adicionar comentário na coluna para documentação
COMMENT ON COLUMN transactions.compensation_value IS 'Valor de compensação - parte do gasto que será compensada pelas dívidas (usado em rateios e empréstimos)';
