/**
 * Primeiro acesso: decide se a introdução (`OnboardingModal`) aparece.
 *
 * Gatilho = `user_profiles.onboarding_completed` diferente de `true` E zero
 * contas próprias. A flag existe desde a estrutura SaaS (nasce `false` em
 * `handle_new_user`); a migration 20260925120000 marca como concluído quem já
 * tinha dados. A contagem cobre o resto (linha de perfil ausente em conta
 * antiga, flag nunca gravada): quem já tem conta nunca vê a introdução.
 *
 * Concluir ou pular grava `true` por upsert (RLS: só o próprio perfil;
 * `guard_user_profile_writes` fixa `user_id` pelo JWT).
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getCachedAuthUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

export const ONBOARDING_QUERY_KEY = ["onboarding"] as const;

async function fetchNeedsOnboarding(): Promise<boolean> {
  const { data: { user } } = await getCachedAuthUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (data?.onboarding_completed === true) return false;

  const { count, error: countError } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) throw countError;
  return (count ?? 0) === 0;
}

export function useOnboarding() {
  const queryClient = useQueryClient();
  // Sem retry: falha na leitura = não interrompe ninguém com a introdução.
  const query = useQuery({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: fetchNeedsOnboarding,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

  /** Fecha na hora (otimista) e persiste. Falha na gravação não reabre nesta sessão. */
  const complete = useCallback(async () => {
    queryClient.setQueryData(ONBOARDING_QUERY_KEY, false);
    const { data: { user } } = await getCachedAuthUser();
    if (!user) throw new Error("Sessão expirada. Entre novamente.");
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: "user_id" });
    if (error) throw error;
  }, [queryClient]);

  return { needsOnboarding: query.data === true, complete };
}
