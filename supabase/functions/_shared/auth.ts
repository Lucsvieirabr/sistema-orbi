import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Não autenticado'), { status: 401 })
  }

  const token = authHeader.slice(7)
  const { data, error } = await adminClient().auth.getUser(token)

  if (error || !data?.user) {
    throw Object.assign(new Error('Não autenticado'), { status: 401 })
  }

  return data.user
}

/** Cliente com o JWT do usuário: preserva auth.uid() em RPCs SECURITY DEFINER. */
export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? ''
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

export function errorStatus(error: unknown): number {
  const status = (error as { status?: number })?.status
  return typeof status === 'number' ? status : 400
}
