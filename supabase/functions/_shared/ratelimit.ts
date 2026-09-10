// ============================================================================
// RATE LIMITING na borda — por USUÁRIO e por IP
// ============================================================================
// v1 só sabia limitar `user_id`, o que deixava sem teto tudo que acontece
// ANTES do JWT: o webhook do Asaas (endpoint público por definição), qualquer
// rota chamada com token inválido e a própria tentativa de descobrir um token
// válido. Um atacante sem conta pagava zero para inundar a função.
//
// Agora a chave é uma string com prefixo de escopo:
//   `user:<uuid>`  cota do assinante  (fail-open: contador fora do ar não
//                                      pode derrubar o produto)
//   `ip:<addr>`    contenção de abuso (fail-closed nas rotas de dinheiro e no
//                                      webhook: sem contador, não passa)
//
// FAIL-FAST: chamar SEMPRE antes de parsear body grande, chamar o Asaas ou
// rodar o classificador. O custo é 1 UPSERT atômico no Postgres.
// ============================================================================

import { adminClient } from './auth.ts'

export class RateLimitError extends Error {
  status = 429
  retryAfter: number
  constructor(retryAfter: number) {
    super('Limite de requisições excedido. Tente novamente em instantes.')
    this.retryAfter = retryAfter
  }
}

export interface RateLimitRule {
  /** Nome do balde. Compõe a chave junto com a identidade. */
  bucket: string
  /** Requisições permitidas na janela. */
  limit: number
  /** Tamanho da janela, em segundos. */
  windowSeconds: number
  /**
   * `false` = indisponibilidade do contador BLOQUEIA a requisição.
   * Use em rota de dinheiro e em endpoint anônimo. Padrão: true (fail-open).
   */
  failOpen?: boolean
}

/**
 * IP de origem. Atrás do proxy da Supabase o valor confiável é o PRIMEIRO
 * elemento de x-forwarded-for; os demais são atribuíveis pelo cliente.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const first = forwarded.split(',')[0]?.trim()
  return (
    first ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

/** Consome 1 unidade da janela de `identity` no balde da regra. */
export async function consumeRateLimit(identity: string, rule: RateLimitRule): Promise<void> {
  const failOpen = rule.failOpen !== false

  let data: { allowed?: boolean; retry_after_seconds?: number } | null = null

  try {
    const res = await adminClient().rpc('consume_rate_limit_key', {
      p_identity: identity,
      p_bucket: rule.bucket,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    })

    if (res.error) throw new Error(res.error.message)
    data = res.data as typeof data
  } catch (err) {
    console.error(`rate limit indisponível (${rule.bucket}):`, (err as Error)?.message)
    if (failOpen) return
    // fail-closed: sem contador, a rota cara/anônima não abre.
    throw new RateLimitError(rule.windowSeconds)
  }

  if (data && data.allowed === false) {
    throw new RateLimitError(Number(data.retry_after_seconds ?? rule.windowSeconds))
  }
}

/** Cota do assinante. Fail-open por padrão. */
export async function enforceUserRateLimit(
  userId: string,
  bucket: string,
  limit: number,
  windowSeconds: number,
  failOpen = true,
): Promise<void> {
  await consumeRateLimit(`user:${userId}`, { bucket, limit, windowSeconds, failOpen })
}

/** Contenção por IP. Fail-closed por padrão — é a camada anti-abuso. */
export async function enforceIpRateLimit(
  req: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
  failOpen = false,
): Promise<void> {
  await consumeRateLimit(`ip:${clientIp(req)}`, {
    bucket: `${bucket}:ip`,
    limit,
    windowSeconds,
    failOpen,
  })
}

/**
 * Assinatura da v1, mantida para não quebrar chamadas existentes.
 * @deprecated prefira enforceUserRateLimit / enforceIpRateLimit.
 */
export async function enforceRateLimit(
  userId: string,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  await enforceUserRateLimit(userId, bucket, limit, windowSeconds, true)
}

/** Headers de um 429. `Retry-After` é o que o cliente honesto obedece. */
export function rateLimitHeaders(retryAfter: number): Record<string, string> {
  return {
    'Retry-After': String(Math.max(1, Math.ceil(retryAfter))),
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + Math.max(1, retryAfter)),
  }
}
