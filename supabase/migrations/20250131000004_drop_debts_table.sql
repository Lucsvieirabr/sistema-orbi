-- Eliminar tabela debts completamente
-- Esta migration remove a tabela debts que não é mais necessária
-- com a nova arquitetura que usa apenas a tabela transactions

DROP TABLE IF EXISTS debts;

-- Remover comentários relacionados à tabela debts
-- (eles serão removidos automaticamente com a tabela)
