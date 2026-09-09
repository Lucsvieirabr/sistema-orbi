// ============================================================================
// CORS — allowlist de origem (antes era Access-Control-Allow-Origin: '*')
// ============================================================================
// Com '*', qualquer site conseguia chamar as Edge Functions a partir do
// browser da vítima. A autenticação é por header Authorization (não por
// cookie), então não havia CSRF clássico, mas um token roubado via XSS em
// qualquer página passava a valer contra o nosso backend sem restrição de
// origem. Agora só as origens declaradas em ALLOWED_ORIGINS recebem eco.
//
// ALLOWED_ORIGINS: lista separada por vírgula. Ex.:
//   supabase secrets set ALLOWED_ORIGINS="https://app.orbi.com.br,https://orbi.com.br"
// Vazia => apenas localhost de desenvolvimento.

const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]

function allowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? ''
  const configured = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  return configured.length ? configured : DEFAULT_ORIGINS
}

const BASE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
}

/** Headers de CORS para esta requisição. Origem desconhecida não é ecoada. */
export function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const list = allowedOrigins()

  if (list.includes('*')) {
    return { ...BASE_HEADERS, 'Access-Control-Allow-Origin': '*' }
  }

  if (origin && list.includes(origin)) {
    return { ...BASE_HEADERS, 'Access-Control-Allow-Origin': origin }
  }

  // Sem Origin (server-to-server) ou origem não autorizada: nenhum ACAO.
  // O browser bloqueia a leitura da resposta; chamadas server-side seguem.
  return { ...BASE_HEADERS }
}

/** @deprecated use corsFor(req) — mantido para compatibilidade de import. */
export const corsHeaders = BASE_HEADERS

export function preflight(req: Request): Response {
  return new Response('ok', { headers: corsFor(req) })
}

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

/** Resposta JSON já com o CORS resolvido para a requisição. */
export function jsonFor(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), 'Content-Type': 'application/json', ...extraHeaders },
  })
}
