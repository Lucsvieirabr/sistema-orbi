-- Renomear tabela family_members para people
-- Esta migration renomeia a tabela e todas as suas referências

BEGIN;

-- Renomear a tabela family_members para people
ALTER TABLE family_members RENAME TO people;

-- Renomear as colunas que fazem referência a family_member_id
ALTER TABLE transactions RENAME COLUMN family_member_id TO person_id;

-- Recriar as chaves estrangeiras com o novo nome da tabela e coluna
ALTER TABLE transactions
  DROP CONSTRAINT transactions_family_member_id_fkey;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;

-- Atualizar as políticas RLS para a nova tabela
DROP POLICY "Users can manage their own family members." ON people;
CREATE POLICY "Users can manage their own people."
  ON people FOR ALL USING (auth.uid() = user_id);

-- Criar uma view para manter compatibilidade (opcional, pode ser removida depois)
-- CREATE VIEW family_members AS SELECT * FROM people;

COMMIT;
