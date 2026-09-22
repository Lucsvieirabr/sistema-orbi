import { queryOptions, useQuery } from "@tanstack/react-query";

import { useCurrentUser } from "@/hooks/use-current-user";
import { queryClient } from "@/lib/query-client";
import { getMfaStatus, type MfaStatus } from "@/services/auth/mfa";

export const MFA_STATUS_QUERY_KEY = ["auth", "mfa-status"] as const;

const FIVE_MINUTES = 5 * 60 * 1000;

export const mfaStatusQueryOptions = queryOptions({
  queryKey: MFA_STATUS_QUERY_KEY,
  queryFn: getMfaStatus,
  staleTime: FIVE_MINUTES,
  retry: 1,
});

/** Estado compartilhado entre o shell e Configurações → Segurança. */
export function useMfaStatus() {
  const { data: user } = useCurrentUser();

  return useQuery({
    ...mfaStatusQueryOptions,
    enabled: Boolean(user),
  });
}

/** Mantém o lembrete do shell sincronizado sem uma segunda chamada de rede. */
export function syncMfaStatus(status: MfaStatus): void {
  queryClient.setQueryData(MFA_STATUS_QUERY_KEY, status);
}
