-- ============================================================================
-- MÓDULOS PREMIUM — hardening das funções de trigger
-- ----------------------------------------------------------------------------
-- Funções de trigger não precisam de EXECUTE no papel do chamador (o Postgres
-- só confere esse privilégio no CREATE TRIGGER). Tirar o grant remove a rota
-- /rest/v1/rpc/orbi_*_guard da superfície exposta (Supabase lint 0029).
-- Validado: INSERT em budgets/goals/goal_allocations como `authenticated`
-- continua disparando os guards normalmente.
-- ============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.orbi_budgets_guard()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_goals_guard()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orbi_goal_allocations_guard() FROM PUBLIC, anon, authenticated;

COMMIT;
