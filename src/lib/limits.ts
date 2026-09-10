/**
 * ============================================================================
 * TRADUÇÃO DE LIMITES — 429 da borda e cotas de plano do banco
 * ============================================================================
 * Duas coisas diferentes chegam ao cliente como "erro" e precisavam de
 * tratamento distinto, mas eram exibidas como `error.message` cru:
 *
 *  1. RATE LIMIT (HTTP 429, Edge Function) — abuso/velocidade. O usuário só
 *     precisa esperar; não existe upgrade que resolva.
 *  2. COTA DE PLANO (erro do Postgres vindo do trigger) — o teto do plano.
 *     Aqui sim o caminho é o /pricing.
 *
 * Códigos definidos na migration 20260910120001_plan_quota_atomic:
 *   P0004 = nenhuma assinatura ativa
 *   P0005 = cota/feature do plano insuficiente
 */

export type LimitKind = 'rate_limit' | 'plan_quota' | 'no_subscription' | 'unknown';

export interface LimitDiagnosis {
  kind: LimitKind;
  /** Mensagem pronta para toast. */
  message: string;
  /** Segundos até poder tentar de novo (só em rate_limit). */
  retryAfterSeconds?: number;
  /** true quando faz sentido oferecer /pricing. */
  suggestUpgrade: boolean;
}

function asRecord(value: unknown): Record<string, any> {
  return (value && typeof value === 'object' ? value : {}) as Record<string, any>;
}

export function diagnoseLimitError(error: unknown): LimitDiagnosis {
  const err = asRecord(error);
  const code = String(err.code ?? '');
  const status = Number(err.status ?? err.statusCode ?? 0);
  const message = String(err.message ?? '');

  // ---- 429 vindo da Edge Function -----------------------------------------
  if (status === 429 || code === '429') {
    const retry = Number(err.retry_after_seconds ?? asRecord(err.context).retry_after_seconds ?? 0);
    return {
      kind: 'rate_limit',
      message: retry
        ? `Muitas requisições. Tente novamente em ${formatWait(retry)}.`
        : 'Muitas requisições em pouco tempo. Aguarde um instante e tente de novo.',
      retryAfterSeconds: retry || undefined,
      suggestUpgrade: false,
    };
  }

  // ---- Cota de plano (trigger no Postgres) --------------------------------
  if (code === 'P0005' || err.hint === 'plan_quota_exceeded' || err.hint === 'plan_feature_required') {
    return {
      kind: 'plan_quota',
      message: message || 'Você atingiu o limite do seu plano.',
      suggestUpgrade: true,
    };
  }

  if (code === 'P0004' || err.hint === 'no_active_subscription') {
    return {
      kind: 'no_subscription',
      message: message || 'Nenhuma assinatura ativa. Escolha um plano para continuar.',
      suggestUpgrade: true,
    };
  }

  return {
    kind: 'unknown',
    message: message || 'Não foi possível concluir a operação.',
    suggestUpgrade: false,
  };
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}

/** -1 = ilimitado, em todo o sistema (plano, trigger e UI). */
export const UNLIMITED = -1;

export function isUnlimited(limit: number | null | undefined): boolean {
  return limit === UNLIMITED;
}

export function remainingOf(limit: number | null | undefined, used: number): number | null {
  if (limit === null || limit === undefined || isUnlimited(limit)) return null;
  return Math.max(0, limit - used);
}
