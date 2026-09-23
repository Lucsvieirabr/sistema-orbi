import { QueryClient } from "@tanstack/react-query";

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

/**
 * Instancia unica: utilitarios fora da arvore React (mutations e loaders)
 * consultam o mesmo cache usado por `useQuery`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => failureCount < 3 && !isClientError(error),
    },
  },
});
