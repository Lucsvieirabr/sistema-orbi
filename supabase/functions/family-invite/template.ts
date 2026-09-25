import { escapeHtml, type EmailMessage } from '../_shared/email.ts'

/**
 * E-mail de convite do Plano Casal.
 *
 * Mesmo layout de `supabase/templates/confirmation.html` (card 480px, cabeçalho
 * "Orbi", CTA escuro, link de fallback, rodapé): o convite chega com a cara dos
 * e-mails de conta. Mudou um, muda o outro.
 */
export function familyInviteEmail(input: {
  to: string
  inviterName: string | null
  acceptUrl: string
  validDays: number
}): EmailMessage {
  const who = input.inviterName?.trim() || null
  const headline = who
    ? `${who} convidou você para compartilhar o universo financeiro no Orbi`
    : 'Você recebeu um convite para compartilhar o universo financeiro no Orbi'
  const url = escapeHtml(input.acceptUrl)
  const headlineHtml = who
    ? `<span style="color:#1c1917;">${escapeHtml(who)}</span> convidou você para compartilhar o universo financeiro no Orbi`
    : escapeHtml(headline)

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Convite para o Plano Casal — Orbi</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
      Aceite para acompanharem as finanças de vocês dois no mesmo lugar. O convite vale por ${input.validDays} dias.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;">
            <tr>
              <td style="padding:28px 28px 0;">
                <p style="margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;color:#1c1917;">Orbi</p>
                <p style="margin:4px 0 0;font-size:13px;line-height:1.5;color:#78716c;">Suas finanças, organizadas.</p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 28px 0;">
                <div style="height:1px;line-height:1px;font-size:0;background:#e7e5e4;">&nbsp;</div>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 28px 8px;">
                <p style="margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#78716c;">
                  Plano Casal
                </p>
                <h1 style="margin:0 0 12px;font-size:18px;font-weight:600;line-height:1.4;color:#1c1917;">
                  ${headlineHtml}
                </h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#44403c;">
                  Ao aceitar, vocês dois passam a acompanhar contas, cartões e lançamentos no mesmo lugar.
                  Cada um continua dono do que cadastra. Nada é compartilhado antes do seu aceite.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:8px;background:#1c1917;">
                      <a href="${url}"
                         target="_blank"
                         rel="noopener"
                         style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px;">
                        Ver convite
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 24px;">
                <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#78716c;">
                  O botão não funcionou? Copie e cole este endereço no navegador:
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;">
                  <a href="${url}" target="_blank" rel="noopener" style="color:#57534e;text-decoration:underline;">${url}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 28px;">
                <div style="height:1px;line-height:1px;font-size:0;background:#e7e5e4;">&nbsp;</div>
                <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#78716c;">
                  O convite vale por ${input.validDays} dias e só pode ser aceito pela conta do Orbi com o e-mail
                  <span style="font-weight:600;color:#44403c;word-break:break-all;">${escapeHtml(input.to)}</span>.
                  Não conhece quem enviou? Ignore este e-mail — nada será compartilhado.
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#a8a29e;">
            Orbi · Gestão financeira pessoal
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    `${headline}.`,
    '',
    'Ao aceitar, vocês dois passam a acompanhar contas, cartões e lançamentos no mesmo lugar. Cada um continua dono do que cadastra. Nada é compartilhado antes do seu aceite.',
    '',
    `Ver convite: ${input.acceptUrl}`,
    '',
    `O convite vale por ${input.validDays} dias e só pode ser aceito pela conta do Orbi com o e-mail ${input.to}. Não conhece quem enviou? Ignore este e-mail.`,
  ].join('\n')

  return { to: input.to, subject: headline, html, text }
}
