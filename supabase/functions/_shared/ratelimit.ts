import { adminClient } from './auth.ts'
import { HttpError } from './errors.ts'

export function rateLimitHeaders(retryAfter: number): Record<string, string> {
  const seconds = Math.max(1, Math.ceil(retryAfter))
  return {
    'Retry-After': String(seconds),
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + seconds),
  }
}

export class RateLimitError extends HttpError {
  readonly retryAfter: number
  constructor(retryAfter: number) {
    const seconds = Math.max(1, Math.ceil(retryAfter))
    super(429, 'Limite de requisições excedido. Tente novamente em instantes.', {
      code: 'RATE_LIMITED',
      headers: rateLimitHeaders(seconds),
    })
    this.retryAfter = seconds
  }
}

export interface RateLimitRule {
  bucket: string
  limit: number
  windowSeconds: number
  failOpen?: boolean
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const IPV6_CHARS = /^[0-9a-f:.]{2,45}$/i

function expandIpv6(address: string): string[] | null {
  if (!IPV6_CHARS.test(address) || !address.includes(':')) return null
  const pieces = address.split('::')
  if (pieces.length > 2) return null
  const compressed = pieces.length === 2
  const head = pieces[0] ? pieces[0].split(':') : []
  const tail = compressed && pieces[1] ? pieces[1].split(':') : []
  const fill = compressed ? 8 - head.length - tail.length : 0
  if (compressed ? fill < 1 : head.length !== 8) return null
  const parts = [...head, ...Array<string>(fill).fill('0'), ...tail]
  if (parts.length !== 8 || parts.some((p) => !/^[0-9a-f]{1,4}$/i.test(p))) return null
  return parts.map((p) => p.toLowerCase().padStart(4, '0'))
}

export function normalizeIp(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().replace(/^\[|\]$/g, '')
  if (!value || value.length > 45) return null
  if (IPV4.test(value)) return value
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(value)
  if (mapped && IPV4.test(mapped[1])) return mapped[1]
  const groups = expandIpv6(value)
  if (!groups) return null
  return `${groups.slice(0, 4).join(':')}::/64`
}

export function clientIp(req: Request): string {
  const candidates = [
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0],
  ]
  for (const candidate of candidates) {
    const ip = normalizeIp(candidate)
    if (ip) return ip
  }
  return 'unknown'
}

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^A-Za-z0-9:._/@-]/g, '').slice(0, 120)
}

interface CounterDecision {
  allowed?: boolean
  blocked?: boolean
  retry_after_seconds?: number
}

async function callCounter(fn: string, identity: string, rule: RateLimitRule): Promise<CounterDecision | null> {
  try {
    const res = await adminClient().rpc(fn, {
      p_identity: sanitizeKeyPart(identity),
      p_bucket: sanitizeKeyPart(rule.bucket),
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    })
    if (res.error) throw new Error(res.error.message)
    return (res.data ?? null) as CounterDecision | null
  } catch (err) {
    console.error(`${fn} indisponível (${rule.bucket}):`, (err as Error)?.message)
    if (rule.failOpen !== false) return null
    throw new RateLimitError(rule.windowSeconds)
  }
}

export async function consumeRateLimit(identity: string, rule: RateLimitRule): Promise<void> {
  const decision = await callCounter('consume_rate_limit_key', identity, rule)
  if (decision?.allowed === false) {
    throw new RateLimitError(Number(decision.retry_after_seconds ?? rule.windowSeconds))
  }
}

export async function assertNotLockedOut(identity: string, rule: RateLimitRule): Promise<void> {
  const decision = await callCounter('peek_rate_limit_key', identity, rule)
  if (decision?.blocked === true) {
    throw new RateLimitError(Number(decision.retry_after_seconds ?? rule.windowSeconds))
  }
}

export async function enforceUserRateLimit(
  userId: string,
  bucket: string,
  limit: number,
  windowSeconds: number,
  failOpen = true,
): Promise<void> {
  await consumeRateLimit(`user:${userId}`, { bucket, limit, windowSeconds, failOpen })
}

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

export async function enforceRateLimit(
  userId: string,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  await enforceUserRateLimit(userId, bucket, limit, windowSeconds, true)
}
