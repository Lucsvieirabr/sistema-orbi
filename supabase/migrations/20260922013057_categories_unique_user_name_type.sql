-- Impede categorias pessoais duplicadas sem misturar os dois domínios
-- ("Alimentação" de gasto continua distinta de uma eventual categoria de
-- ganho com o mesmo nome). A coluna do schema se chama `category_type`.
-- Categorias globais têm user_id NULL e ficam fora deste índice: elas são
-- administradas exclusivamente por migrations e protegidas pelas policies.

DO $$
DECLARE
  duplicate_groups integer;
BEGIN
  SELECT count(*)
    INTO duplicate_groups
    FROM (
      SELECT user_id, lower(name), category_type
        FROM public.categories
       WHERE user_id IS NOT NULL
       GROUP BY user_id, lower(name), category_type
      HAVING count(*) > 1
    ) duplicates;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = format(
        'categories possui %s grupo(s) duplicado(s); consolide as referências antes de criar o índice único',
        duplicate_groups
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX categories_user_lower_name_type_uidx
  ON public.categories (user_id, lower(name), category_type)
  WHERE user_id IS NOT NULL;
