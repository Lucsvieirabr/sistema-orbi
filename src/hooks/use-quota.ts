/**
 * ============================================================================
 * HOOK: useQuota — cota de plano + uso atual em UM round-trip
 * ============================================================================
 * Antes, para decidir se habilitava um botão, a UI precisava do plano (1 query)
 * e de uma contagem por recurso (N queries), normalmente puxando as linhas
 * inteiras só para tirar `.length`. Em conta com muitas transações isso é
 * tráfego puro para uma resposta que é um número.
 *
 * `orbi_quota_snapshot()` (migration 20260910120001) devolve limites, features
 * e uso agregado do usuário numa chamada só, com COUNT feito no servidor.
 *
 * IMPORTANTE — camadas:
 *   Este hook é UX (fail-fast: some com o botão antes do usuário tentar).
 *   A AUTORIDADE continua nos triggers BEFORE INSERT, que rodam com advisory
 *   lock por (usuário, recurso) e não podem ser burlados por chamada direta ao
 *   PostgREST nem por requisições concorrentes.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isUnlimited, remainingOf, UNLIMITED } from '@/lib/limits';

// RPC nova: `types.ts` é gerado e ainda não a conhece (mesmo padrão de
// use-family-group.ts). Regenerar os tipos remove este cast.
const db = supabase as any;

export const QUOTA_QUERY_KEY = ['quota-snapshot'] as const;

export type QuotaKey =
  | 'max_contas'
  | 'max_cartoes'
  | 'max_pessoas'
  | 'max_categorias'
  | 'max_transacoes_mes'
  | 'max_membros_familia'
  | 'retencao_dados_meses';

export interface QuotaSnapshot {
  has_subscription: boolean;
  plan_slug?: string;
  plan_name?: string;
  status?: string;
  features?: Record<string, boolean>;
  limits?: Partial<Record<QuotaKey, number>>;
  usage?: Partial<Record<QuotaKey, number>>;
}

export function useQuota() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUOTA_QUERY_KEY,
    queryFn: async (): Promise<QuotaSnapshot> => {
      const { data, error } = await db.rpc('orbi_quota_snapshot');
      if (error) throw error;
      return (data ?? { has_subscription: false }) as QuotaSnapshot;
    },
    // Cota muda pouco; o custo de um snapshot desatualizado é só a UX.
    staleTime: 60_000,
  });

  const limits = data?.limits ?? {};
  const usage = data?.usage ?? {};

  const getLimit = (key: QuotaKey): number => limits[key] ?? 0;
  const getUsage = (key: QuotaKey): number => usage[key] ?? 0;

  /** Quantos ainda cabem. `null` = ilimitado. */
  const getRemaining = (key: QuotaKey): number | null =>
    remainingOf(limits[key], getUsage(key));

  /** Fail-fast de UI: já dá para criar mais um? */
  const canCreate = (key: QuotaKey): boolean => {
    if (!data?.has_subscription) return false;
    const limit = limits[key];
    if (limit === undefined) return true;
    if (isUnlimited(limit)) return true;
    return getUsage(key) < limit;
  };

  const hasFeature = (key: string): boolean => data?.features?.[key] === true;

  /** Chamar depois de qualquer mutação que consome cota. */
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUOTA_QUERY_KEY });

  return {
    snapshot: data,
    hasSubscription: data?.has_subscription ?? false,
    planSlug: data?.plan_slug,
    planName: data?.plan_name,
    limits,
    usage,
    isLoading,
    error,
    getLimit,
    getUsage,
    getRemaining,
    canCreate,
    hasFeature,
    refetch,
    invalidate,
    UNLIMITED,
  };
}
