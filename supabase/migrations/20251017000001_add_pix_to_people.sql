-- Adiciona coluna pix na tabela people
ALTER TABLE people ADD COLUMN IF NOT EXISTS pix TEXT;

-- Adiciona comentário na coluna
COMMENT ON COLUMN people.pix IS 'Chave PIX da pessoa (CPF, email, telefone ou chave aleatória)';

