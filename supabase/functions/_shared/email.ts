// ============================================================================
// E-MAIL TRANSACIONAL (Resend) — fora do Supabase Auth
// ============================================================================
// Os e-mails de conta (cadastro, recuperação) saem pelo GoTrue. Os do produto
// (convite do Plano Casal) saem daqui, pela API HTTP do Resend.
//
//   supabase secrets set RESEND_API_KEY=re_... EMAIL_FROM="Orbi <convites@meuorbi.com>"
//
// O domínio do remetente precisa estar verificado no Resend.
// ============================================================================
import { HttpError } from './errors.ts'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10_000

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

/** Falha cedo (503) quando o envio não está configurado — antes de qualquer escrita. */
export function emailSender(): (message: EmailMessage) => Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM')
  if (!apiKey || !from) {
    throw new HttpError(503, 'Envio de e-mail indisponível no momento.', { internal: 'RESEND_API_KEY/EMAIL_FROM ausente' })
  }

  // Nunca lança: o chamador decide o que fazer com `false`. Sem corpo nem
  // destinatário no log — só o status do provedor.
  return async (message) => {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) console.error(`email: Resend respondeu ${response.status}`)
      return response.ok
    } catch (error) {
      console.error('email: falha ao chamar o Resend', (error as Error)?.name ?? 'Error')
      return false
    }
  }
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Todo texto vindo de usuário ou banco passa por aqui antes de entrar no HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}
