import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/query-client";

export const AUTH_USER_QUERY_KEY = ["auth", "user"] as const;

const THIRTY_MINUTES = 30 * 60 * 1000;

/**
 * Validacao remota centralizada. `getUser()` autentica o JWT no Auth server,
 * portanto deve acontecer uma vez por janela de cache, nao em cada hook.
 */
async function fetchAuthenticatedUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
}

export const authUserQueryOptions = queryOptions({
  queryKey: AUTH_USER_QUERY_KEY,
  queryFn: fetchAuthenticatedUser,
  staleTime: THIRTY_MINUTES,
  gcTime: Infinity,
  retry: 1,
});

export function useCurrentUser() {
  return useQuery(authUserQueryOptions);
}

/** Leitura compartilhada para queryFns e mutations que nao podem usar hooks. */
export async function getCachedAuthUser(): Promise<{
  data: { user: User | null };
  error: unknown | null;
}> {
  try {
    const user = await queryClient.ensureQueryData(authUserQueryOptions);
    return { data: { user }, error: null };
  } catch (error) {
    return { data: { user: null }, error };
  }
}

/**
 * UID imediato para fluxos imperativos. `getSession()` le o storage local e
 * pode renovar o token; nao abre uma validacao remota por chamada como
 * `getUser()`. Autorizacao continua no RLS/RPC do servidor.
 */
export async function getImmediateSessionUser(): Promise<User | null> {
  const cached = queryClient.getQueryData<User | null>(AUTH_USER_QUERY_KEY);
  if (cached) return cached;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const user = data.session?.user ?? null;
  queryClient.setQueryData(AUTH_USER_QUERY_KEY, user);
  return user;
}

/** Mantem cache e evento de Auth atomicamente alinhados. */
export function syncAuthUser(session: Session | null): void {
  const previous = queryClient.getQueryData<User | null>(AUTH_USER_QUERY_KEY);
  const next = session?.user ?? null;

  // Nunca reaproveita dados de React Query entre duas identidades.
  if (previous !== undefined && previous?.id !== next?.id) {
    queryClient.clear();
  }
  queryClient.setQueryData(AUTH_USER_QUERY_KEY, next);
}
