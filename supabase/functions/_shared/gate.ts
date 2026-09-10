// ============================================================================
// GATE — porta de entrada única das Edge Functions
// ============================================================================
// Ordem FAIL-FAST (mais externo e mais barato primeiro). Cada etapa reprovada
// encerra a requisição antes da próxima:
//
//   1. método permitido        0 I/O
//   2. origem na allowlist     0 I/O    — bloqueia o EFEITO COLATERAL. CORS
//                                         sozinho só esconderia a resposta.
//   3. rate limit por IP       1 UPSERT — antes do JWT: validar token já custa
//                                         uma chamada ao GoTrue, e o anônimo
//                                         não tem outra identidade.
//   4. autenticação (JWT)      1 chamada
//   5. rate limit por usuário  1 UPSERT — a cota que o plano paga.
//   6. handler                          — só aqui há trabalho caro.
//
// O body NUNCA é lido antes do passo 6: materializar 15MB de quem já estourou
// a cota é exatamente o custo que se quer evitar.
// ============================================================================

import { assertAllowedOrigin, jsonFor, OriginError } from './cors.ts'
import { requireUser, errorStatus } from './auth.ts'
import {
  RateLimitError,
  enforceIpRateLimit,
  enforceUserRateLimit,
  rateLimitHeaders,
} from './ratelimit.ts'

export interface GateOptions {
  /** Balde de rate limit — use o nome da função. */
  bucket: string
  /** Teto por IP na janela (cobre anônimo e multi-conta). */
  ipLimit: number
  /** Teto por usuário autenticado na janela. */
  userLimit?: number
  /** Janela em segundos. Padrão 3600. */
  windowSeconds?: number
  /** Métodos aceitos além de OPTIONS. Padrão ['POST']. */
  methods?: string[]
  /**
   * true  = contador indisponível BLOQUEIA (rota de dinheiro, rota anônima).
   * false = fail-open, disponibilidade acima da contenção. Padrão false.
   */
  strict?: boolean
}

export class MethodError extends Error {
  status = 405
  allow: string
  constructor(methods: string[]) {
    super('Método não permitido.')
    this.allow = [...methods, 'OPTIONS'].join(', ')
  }
}

/** Etapas 1-3. Use em endpoint sem JWT (webhook). */
export async function gateAnonymous(req: Request, options: GateOptions): Promise<void> {
  const methods = options.methods ?? ['POST']
  const window = options.windowSeconds ?? 3600

  if (!methods.includes(req.method)) throw new MethodError(methods)

  assertAllowedOrigin(req)

  await enforceIpRateLimit(req, options.bucket, options.ipLimit, window, !options.strict)
}

/** Etapas 1-5. Retorna o usuário autenticado. */
export async function gateUser(req: Request, options: GateOptions) {
  await gateAnonymous(req, options)

  const user = await requireUser(req)

  if (options.userLimit !== undefined) {
    await enforceUserRateLimit(
      user.id,
      options.bucket,
      options.userLimit,
      options.windowSeconds ?? 3600,
      !options.strict,
    )
  }

  return user
}

/**
 * Tradução uniforme de erro -> resposta HTTP.
 * `envelope` mantém o formato `{ success:false, error }` das funções Asaas.
 * 5xx nunca ecoa mensagem interna (vazava caminho/stack).
 */
export function gateFailure(
  req: Request,
  error: unknown,
  logPrefix: string,
  envelope = false,
): Response {
  const wrap = (error_: string, extra: Record<string, unknown> = {}) =>
    envelope ? { success: false, error: error_, ...extra } : { error: error_, ...extra }

  if (error instanceof RateLimitError) {
    return jsonFor(
      req,
      wrap(error.message, { retry_after_seconds: error.retryAfter }),
      429,
      rateLimitHeaders(error.retryAfter),
    )
  }

  if (error instanceof OriginError) {
    return jsonFor(req, wrap(error.message), 403)
  }

  if (error instanceof MethodError) {
    return jsonFor(req, wrap(error.message), 405, { Allow: error.allow })
  }

  const status = errorStatus(error)

  if (status >= 500) {
    console.error(`${logPrefix}:`, error)
    return jsonFor(req, wrap('Erro interno do servidor.'), 500)
  }

  return jsonFor(req, wrap((error as Error)?.message ?? 'Requisição inválida.'), status)
}
