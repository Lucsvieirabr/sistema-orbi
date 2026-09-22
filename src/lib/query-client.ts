import { QueryClient } from "@tanstack/react-query";

/**
 * Instancia unica: utilitarios fora da arvore React (mutations e loaders)
 * consultam o mesmo cache usado por `useQuery`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});
