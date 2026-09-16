import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HttpError, unauthenticated } from './errors.ts'

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const MAX_JWT_LENGTH = 4096

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new HttpError(503, 'Serviço temporariamente indisponível.', { internal: `${name} ausente` })
  }
  return value
}

export function adminClient(): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function bearerToken(req: Request): string {
  const header = req.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  const token = match?.[1]?.trim() ?? ''
  if (!token || token.length > MAX_JWT_LENGTH || !JWT_SHAPE.test(token)) throw unauthenticated()
  return token
}

export async function requireUser(req: Request) {
  const token = bearerToken(req)
  const { data, error } = await adminClient().auth.getUser(token)

  if (error || !data?.user) throw unauthenticated()

  return data.user
}

export function userClient(req: Request): SupabaseClient {
  const token = bearerToken(req)
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function errorStatus(error: unknown): number {
  if (error instanceof HttpError) return error.status
  const status = (error as { status?: unknown })?.status
  return typeof status === 'number' && status >= 400 && status < 600 ? status : 500
}
