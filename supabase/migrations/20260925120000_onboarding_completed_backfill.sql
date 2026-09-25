-- ============================================================================
-- Onboarding de primeiro acesso — `user_profiles.onboarding_completed`.
--
-- A coluna existe desde 20251016000001 (DEFAULT false, `handle_new_user` grava
-- false) mas nunca foi usada: todo perfil está false. O front
-- (`use-onboarding.ts`) mostra a introdução quando a flag não é true E o
-- usuário não tem conta própria. Este backfill marca como concluído quem já
-- usa o sistema, para que a flag passe a ser a fonte de verdade:
--   * tem conta, cartão ou lançamento próprio;
--   * ou já é membro de um grupo Casal (entrou pelo convite do dono).
--
-- Escrita pelo cliente continua coberta pelo que já existe: RLS
-- `orbi_profiles_update/insert` (auth.uid() = user_id) + trigger
-- `guard_user_profile_writes` (user_id/e-mail/cobrança congelados).
-- Roda como owner: o guard só age para role `authenticated`.
-- ============================================================================

UPDATE public.user_profiles up
   SET onboarding_completed = true
 WHERE up.onboarding_completed IS DISTINCT FROM true
   AND (
         EXISTS (SELECT 1 FROM public.accounts a WHERE a.user_id = up.user_id)
      OR EXISTS (SELECT 1 FROM public.credit_cards c WHERE c.user_id = up.user_id)
      OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.user_id = up.user_id)
      OR EXISTS (SELECT 1 FROM public.family_group_members m WHERE m.user_id = up.user_id)
   );

COMMENT ON COLUMN public.user_profiles.onboarding_completed IS
  'true = introdução de primeiro acesso concluída ou pulada (OnboardingModal). Gravada só pelo próprio usuário.';
