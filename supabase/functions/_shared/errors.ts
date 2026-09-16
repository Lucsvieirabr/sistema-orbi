export interface HttpErrorOptions {
  code?: string
  details?: Record<string, unknown>
  internal?: string
  headers?: Record<string, string>
}

export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: Record<string, unknown>
  readonly internal?: string
  readonly headers: Record<string, string>

  constructor(status: number, publicMessage: string, options: HttpErrorOptions = {}) {
    super(publicMessage)
    this.name = 'HttpError'
    this.status = status
    this.code = options.code ?? defaultCode(status)
    this.details = options.details
    this.internal = options.internal
    this.headers = options.headers ?? {}
  }

  get expose(): boolean {
    return this.status < 500
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST'
    case 401: return 'UNAUTHENTICATED'
    case 403: return 'FORBIDDEN'
    case 404: return 'NOT_FOUND'
    case 405: return 'METHOD_NOT_ALLOWED'
    case 409: return 'CONFLICT'
    case 413: return 'PAYLOAD_TOO_LARGE'
    case 415: return 'UNSUPPORTED_MEDIA_TYPE'
    case 422: return 'UNPROCESSABLE'
    case 429: return 'RATE_LIMITED'
    case 502: return 'UPSTREAM_UNAVAILABLE'
    case 503: return 'SERVICE_UNAVAILABLE'
    case 504: return 'UPSTREAM_TIMEOUT'
    default: return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_REJECTED'
  }
}

export const badRequest = (message: string, options?: HttpErrorOptions) => new HttpError(400, message, options)
export const unauthenticated = (message = 'Não autenticado.') => new HttpError(401, message)
export const forbidden = (message = 'Acesso negado.') => new HttpError(403, message)
export const notFound = (message: string) => new HttpError(404, message)
export const conflict = (message: string) => new HttpError(409, message)
export const unprocessable = (message: string, options?: HttpErrorOptions) => new HttpError(422, message, options)

export const PUBLIC_5XX_MESSAGES: Record<number, string> = {
  502: 'Serviço externo indisponível. Tente novamente em instantes.',
  503: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
  504: 'O serviço externo demorou demais para responder. Tente novamente.',
}

export function publicServerMessage(status: number): string {
  return PUBLIC_5XX_MESSAGES[status] ?? 'Erro interno do servidor.'
}
