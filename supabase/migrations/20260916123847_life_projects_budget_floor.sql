CREATE OR REPLACE FUNCTION public.orbi_projects_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status_ok boolean := COALESCE(current_setting('orbi.project_status', true), '') = 'on';
  v_goal_ok   boolean := NEW.goal_id IS NOT NULL
                         AND COALESCE(current_setting('orbi.goal_execute', true), '') = NEW.goal_id::text;
  v_ledger_owner uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'O dono do projeto não pode mudar.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.orbi_require_feature(NEW.user_id, 'projetos_vida', 'Projetos de Vida');

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'active';
    NEW.archived_at := NULL;
    NEW.final_report := NULL;
    IF NOT v_goal_ok THEN
      NEW.goal_id := NULL;
      NEW.funded_from_goal := 0;
    END IF;
  ELSE
    IF OLD.status = 'archived' AND NEW.status = 'archived' AND NOT v_status_ok THEN
      RAISE EXCEPTION 'Projeto arquivado é somente leitura. Reabra-o para editar.' USING ERRCODE = '23514';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT v_status_ok THEN
      RAISE EXCEPTION 'Use Arquivar ou Reabrir para mudar a fase do projeto.' USING ERRCODE = '42501';
    END IF;

    IF NEW.goal_id IS DISTINCT FROM OLD.goal_id AND NOT (v_goal_ok OR NEW.goal_id IS NULL) THEN
      RAISE EXCEPTION 'O vínculo com a meta só nasce em Executar meta.' USING ERRCODE = '42501';
    END IF;

    IF NOT v_goal_ok THEN
      NEW.funded_from_goal := CASE WHEN NEW.goal_id IS NULL THEN 0 ELSE OLD.funded_from_goal END;
    END IF;

    IF NOT v_status_ok THEN
      NEW.final_report := OLD.final_report;
      NEW.archived_at := OLD.archived_at;
    END IF;
  END IF;

  IF NEW.goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.goals g WHERE g.id = NEW.goal_id AND g.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Meta inexistente ou de outro usuário.' USING ERRCODE = '42501';
  END IF;

  IF NEW.ledger_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.ledger_id IS DISTINCT FROM OLD.ledger_id) THEN
    PERFORM public.orbi_require_feature(NEW.user_id, 'contratos_rateio', 'Acertos de viagem');
    SELECT l.user_id INTO v_ledger_owner FROM public.ledgers l WHERE l.id = NEW.ledger_id;
    IF v_ledger_owner IS NULL OR v_ledger_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'Evento de acerto inexistente ou de outro usuário.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'archived' THEN
      NEW.archived_at := NOW();
    ELSE
      NEW.archived_at := NULL;
      NEW.final_report := NULL;
    END IF;
  END IF;

  NEW.name := btrim(NEW.name);
  NEW.description := NULLIF(btrim(NEW.description), '');
  NEW.budget := round(NEW.budget, 2);
  NEW.funded_from_goal := round(NEW.funded_from_goal, 2);

  IF NEW.budget < NEW.funded_from_goal THEN
    RAISE EXCEPTION 'O orçamento não pode ficar abaixo do valor que veio da meta (%).', to_char(NEW.funded_from_goal, 'FM999999999990.00')
      USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.orbi_projects_guard() FROM PUBLIC, anon, authenticated;
