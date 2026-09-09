// ============================================================================
// RATE LIMITING por usuário para Edge Functions
// ============================================================================
// Endpoints que consomem CPU (extract-pdf-text, classify-transactions) ou
// cota paga de terceiros (logo.dev) não tinham nenhum limite: um único token
// válido bastava para exaurir recurso/verba. O contador vive no Postgres
// (via RPC atômica) para valer entre instâncias da função.

import { adminClient } from './auth.ts'

export class RateLimitError extends Error {
  status = 429
  retryAfter: number
  constructor(retryAfter: number) {
    super('Limite de requisições excedido. Tente novamente em instantes.')
    this.retryAfter = retryAfter
  }
}

/**
 * Consome 1 unidade da janela deslizante do usuário no bucket informado.
 * Lança RateLimitError (status 429) quando estourado.
 *
 * Falha do próprio limitador NÃO bloqueia a requisição (fail-open): o
 * objetivo é conter abuso, não derrubar o produto por indisponibilidade
 * do contador.
 */
export async function enforceRateLimit(
  userId: string,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  try {
    const { data, error } = await adminClient().rpc('consume_rate_limit', {
      p_user_id: userId,
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      console.error('rate limit indisponível:', error.message)
      return
    }

    if (data && data.allowed === false) {
      throw new RateLimitError(Number(data.retry_after_seconds ?? windowSeconds))
    }
  } catch (err) {
    if (err instanceof RateLimitError) throw err
    console.error('rate limit falhou:', err)
  }
}
