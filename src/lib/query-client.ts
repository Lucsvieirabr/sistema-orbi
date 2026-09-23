import { QueryCache, QueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { bootSession } from "@/lib/auth/session";

/**
 * Erro 4xx (RLS 403, PGRST116 406, uuid 22P02, etc.) nao melhora com retry:
 * repetir so multiplica requests. Retry fica para rede e 5xx.
 */
export function isClientError(error: unknown): boolean {
  const e = error as { status?: number; code?: unknown; context?: { status?: number } } | null;
  const status = e?.status ?? e?.context?.status;
  if (typeof status === "number" && status >= 400 && status < 500) return true;
  // PostgrestError nao traz status: PGRST*, SQLSTATE 22/23/28/42 e P0 (RAISE de regra
  // de negocio: plano, cota, "inexistente") sao erros do cliente.
  return typeof e?.code === "string" && /^(PGRST|22|23|28|42|P0)/.test(e.code);
}

/** JWT recusado pelo PostgREST (vencido, assinatura invalida, sessao revogada). */
function isJwtRejected(error: unknown): boolean {
  const e = error as { status?: number; code?: unknown; message?: unknown } | null;
  if (e?.status === 401) return true;
  if (typeof e?.code === "string" && /^PGRST30[1-3]$/.test(e.code)) return true;
  return /\bjwt\b/i.test(String(e?.message ?? ""));
}

/**
 * Aba aberta de um dia para o outro: o boot ja passou, entao a renovacao
 * acontece aqui. Primeiro 401 → renova (uma vez, compartilhada) e refaz as
 * queries ativas. Refresh recusado → signOut local → App manda para o login
 * com `?next=`. Janela de 30s impede laco se o servidor seguir recusando.
 */
let recovering: Promise<unknown> | null = null;
let lastRecoveryAt = 0;

function recoverSession(): void {
  if (recovering || Date.now() - lastRecoveryAt < 30_000) return;
  lastRecoveryAt = Date.now();
  recovering = bootSession()
    .then((session) =>
      session ? queryClient.invalidateQueries({ refetchType: "active" }) : supabase.auth.signOut({ scope: "local" }),
    )
    .catch(() => undefined)
    .finally(() => {
      recovering = null;
    });
}

/**
 * Instancia unica: utilitarios fora da arvore React (mutations e loaders)
 * consultam o mesmo cache usado por `useQuery`.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isJwtRejected(error)) recoverSession();
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => failureCount < 3 && !isClientError(error),
    },
  },
});
