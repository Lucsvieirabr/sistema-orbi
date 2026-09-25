import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { jsonFor, preflight, requestOrigin } from '../_shared/cors.ts'
import { userClient } from '../_shared/auth.ts'
import { gateFailure, gateUser } from '../_shared/gate.ts'
import { HttpError } from '../_shared/errors.ts'
import { emailSender } from '../_shared/email.ts'
import { parseJson, stripControl, z } from '../_shared/validation.ts'
import { familyInviteEmail } from './template.ts'

// ============================================================================
// PLANO CASAL — ENVIAR / REENVIAR CONVITE
// ============================================================================
// 1. `orbi_family_invite_issue` (como o próprio usuário: RLS, trigger de cota
//    e checagem de plano valem) cria ou renova o convite pendente e devolve o
//    token em claro uma única vez.
// 2. O token vai só no link do e-mail. Não volta na resposta nem no log.
// 3. Falha no provedor de e-mail não desfaz o convite: a tela avisa e oferece
//    "Reenviar" (que troca o token).
// ============================================================================

const MAX_BODY_BYTES = 1024
const VALID_DAYS = 7
const ACCEPT_PATH = '/invite/accept'

const bodySchema = z
  .object({ email: z.string().trim().toLowerCase().max(254).email('Informe um e-mail válido.') })
  .strict()

const inviteSchema = z.object({
  member_id: z.string().uuid(),
  email: z.string(),
  status: z.enum(['pending', 'active']),
  expires_at: z.string().nullable(),
  token: z.string().regex(/^[0-9a-f]{64}$/),
  inviter_name: z.string().nullable(),
})

/** Erros do banco com mensagem pública fixa; o resto vira 500 genérico no gateFailure. */
function inviteRpcError(error: { code?: string; hint?: string }): HttpError | null {
  switch (error.code) {
    case '22023': return new HttpError(400, 'Informe um e-mail válido.')
    case 'P0001': return new HttpError(400, 'Você não pode convidar a si mesmo.')
    case 'P0002': return new HttpError(409, 'Crie o Plano Casal antes de convidar.')
    case '23505': return new HttpError(409, 'Esta pessoa já faz parte do seu Plano Casal.')
    case 'P0004': return new HttpError(403, 'Você precisa de uma assinatura ativa para convidar.', { code: 'NO_SUBSCRIPTION' })
    case 'P0005':
      return error.hint === 'plan_quota_exceeded'
        ? new HttpError(409, 'O Plano Casal é para duas pessoas. Cancele o convite atual para chamar outra.', { code: 'PLAN_QUOTA' })
        : new HttpError(403, 'Compartilhamento é exclusivo do Plano Casal.', { code: 'PLAN_FEATURE' })
    default: return null
  }
}

/** Origem do link: a do navegador que pediu (já validada pelo gate) ou APP_URL. */
function appOrigin(req: Request): string {
  const origin = requestOrigin(req) || (Deno.env.get('APP_URL') ?? '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^/\s]+$/.test(origin)) {
    throw new HttpError(503, 'Serviço temporariamente indisponível.', { internal: 'origem do link ausente (APP_URL)' })
  }
  return origin
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  try {
    // strict: rota que dispara e-mail para terceiros — contador fora = bloqueia.
    await gateUser(req, {
      bucket: 'family-invite',
      ipLimit: 30,
      userLimit: 10,
      windowSeconds: 3600,
      strict: true,
      maxBodyBytes: MAX_BODY_BYTES,
    })
    const body = await parseJson(req, bodySchema, { maxBytes: MAX_BODY_BYTES })
    const origin = appOrigin(req)
    const send = emailSender()

    const { data, error } = await userClient(req).rpc('orbi_family_invite_issue', { p_email: body.email })
    if (error) throw inviteRpcError(error) ?? error

    const invite = inviteSchema.parse(data)
    const inviterName = invite.inviter_name ? stripControl(invite.inviter_name).slice(0, 60) : null
    const acceptUrl = `${origin}${ACCEPT_PATH}?token=${invite.token}`

    const emailSent = await send(
      familyInviteEmail({ to: invite.email, inviterName, acceptUrl, validDays: VALID_DAYS }),
    )

    return jsonFor(req, {
      success: true,
      email_sent: emailSent,
      invite: { id: invite.member_id, email: invite.email, status: invite.status, expires_at: invite.expires_at },
    })
  } catch (error) {
    return gateFailure(req, error, 'family-invite', true)
  }
})
