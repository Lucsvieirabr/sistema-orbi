import { assertAllowedOrigin, jsonFor, OriginError } from './cors.ts'
import { requireUser } from './auth.ts'
import { HttpError, publicServerMessage } from './errors.ts'
import { enforceIpRateLimit, enforceUserRateLimit } from './ratelimit.ts'

export interface GateOptions {
  bucket: string
  ipLimit: number
  userLimit?: number
  windowSeconds?: number
  methods?: string[]
  strict?: boolean
  maxBodyBytes?: number
}

export class MethodError extends HttpError {
  readonly allow: string
  constructor(methods: string[]) {
    const allow = [...methods, 'OPTIONS'].join(', ')
    super(405, 'Método não permitido.', { headers: { Allow: allow } })
    this.allow = allow
  }
}

function assertDeclaredBodySize(req: Request, maxBytes?: number): void {
  if (!maxBytes) return
  const declared = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, `Payload excede ${Math.floor(maxBytes / 1024)}KB.`)
  }
}

export async function gateAnonymous(req: Request, options: GateOptions): Promise<void> {
  const methods = options.methods ?? ['POST']
  const window = options.windowSeconds ?? 3600

  if (!methods.includes(req.method)) throw new MethodError(methods)

  assertAllowedOrigin(req)
  assertDeclaredBodySize(req, options.maxBodyBytes)

  await enforceIpRateLimit(req, options.bucket, options.ipLimit, window, !options.strict)
}

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

export function gateFailure(
  req: Request,
  error: unknown,
  logPrefix: string,
  envelope = false,
): Response {
  const wrap = (message: string, extra: Record<string, unknown> = {}) =>
    envelope ? { success: false, error: message, ...extra } : { error: message, ...extra }

  if (error instanceof OriginError) {
    return jsonFor(req, wrap(error.message, { code: 'ORIGIN_REJECTED' }), 403)
  }

  if (error instanceof HttpError) {
    if (error.internal || error.status >= 500) {
      console.error(`${logPrefix}: [${error.status}] ${error.code}`, error.internal ?? '')
    }

    const extra: Record<string, unknown> = { code: error.code }
    if (error.expose && error.details) Object.assign(extra, error.details)
    if (error.status === 429 && 'retryAfter' in error) {
      extra.retry_after_seconds = (error as HttpError & { retryAfter: number }).retryAfter
    }

    const message = error.expose ? error.message : publicServerMessage(error.status)
    return jsonFor(req, wrap(message, extra), error.status, error.headers)
  }

  console.error(`${logPrefix}:`, error)
  return jsonFor(req, wrap(publicServerMessage(500), { code: 'INTERNAL_ERROR' }), 500)
}
