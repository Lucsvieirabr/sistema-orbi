-- Funções de trigger não precisam de EXECUTE no papel do chamador (o Postgres
-- só confere esse privilégio no CREATE TRIGGER). Tirar o grant remove a rota
-- /rest/v1/rpc/orbi_*_guard da superfície exposta (lint 0029).
REVOKE EXECUTE ON FUNCTION public.orbi_budgets_guard()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_goals_guard()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_goal_allocations_guard() FROM PUBLIC, anon, authenticated;
