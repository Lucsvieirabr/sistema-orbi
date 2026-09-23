-- P1 #4 — Aviso "Projeto arquivado" de projeto excluído dava 403.
-- (a) orbi_project_overview: projeto inexistente/fora do grupo devolve NULL
--     (200) em vez de RAISE 42501 (PostgREST traduz 42501 em 403).
--     Só o bloco IF NOT FOUND muda; o resto da função é mantido como está.
-- (b) Excluir um projeto apaga os avisos project_archived dele (+ limpeza
--     dos órfãos já existentes).

DO $mig$
DECLARE
  v_def text := pg_get_functiondef('public.orbi_project_overview(uuid)'::regprocedure);
  v_old text := $o$  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto inexistente.' USING ERRCODE = '42501';
  END IF;

  SELECT g.name INTO v_goal_name$o$;
  v_new text := $n$  IF NOT FOUND THEN
    RETURN NULL; -- excluído ou de outro tenant: "não encontrado", sem 403
  END IF;

  SELECT g.name INTO v_goal_name$n$;
BEGIN
  IF position(v_old IN v_def) = 0 THEN
    IF position('RETURN NULL; -- excluído ou de outro tenant' IN v_def) > 0 THEN
      RETURN; -- já aplicada
    END IF;
    RAISE EXCEPTION 'orbi_project_overview mudou; revisar esta migration.';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END;
$mig$;

CREATE OR REPLACE FUNCTION public.orbi_projects_drop_notices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  DELETE FROM public.user_notifications n
   WHERE n.user_id = OLD.user_id
     AND n.kind = 'project_archived'
     AND n.payload ->> 'project_id' = OLD.id::text;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.orbi_projects_drop_notices() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orbi_projects_drop_notices ON public.projects;
CREATE TRIGGER orbi_projects_drop_notices
  AFTER DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.orbi_projects_drop_notices();

DELETE FROM public.user_notifications n
 WHERE n.kind = 'project_archived'
   AND NOT EXISTS (
     SELECT 1 FROM public.projects p WHERE p.id::text = n.payload ->> 'project_id'
   );
