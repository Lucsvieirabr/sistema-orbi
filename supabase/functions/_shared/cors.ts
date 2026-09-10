// ============================================================================
// CORS + ORIGEM + HEADERS DE SEGURANÇA
// ============================================================================
// Histórico: era `Access-Control-Allow-Origin: '*'`. Hoje só as origens de
// ALLOWED_ORIGINS recebem eco.
//
// O que faltava e entra aqui:
//
//  1. CORS é um controle de LEITURA, não de ESCRITA. Sem `Allow-Origin` o
//     browser bloqueia o atacante de LER a resposta — mas a requisição já
//     chegou e o efeito colateral já aconteceu. Para rota que muda estado
//     (cobrança, assinatura), origem desconhecida agora é rejeitada com 403
//     ANTES do handler: `assertAllowedOrigin(req)`.
//  2. Requisições de browser sempre trazem `Origin`. Server-to-server não
//     traz — por isso ausência de Origin é permitida (é o caso do webhook e
//     de integrações), e presença de Origin fora da allowlist é recusada.
//  3. Headers de resposta que faltavam em todas as funções: `nosniff`,
//     `no-store` (resposta com dado financeiro não pode ficar em cache
//     compartilhado), `Referrer-Policy`, `X-Frame-Options`.
//  4. `Access-Control-Allow-Credentials` NÃO é enviado de propósito: a auth é
//     por header Authorization, não por cookie. Enviar isso transformaria
//     qualquer XSS em CSRF com sessão.
//
// ALLOWED_ORIGINS: lista separada por vírgula. Ex.:
//   supabase secrets set ALLOWED_ORIGINS="https://app.orbi.com.br,https://orbi.com.br"
// Vazia => apenas localhost de desenvolvimento.
// ============================================================================

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
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)

  return configured.length ? configured : DEFAULT_ORIGINS
}

/** Headers de endurecimento aplicados a TODA resposta. */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Cross-Origin-Resource-Policy': 'same-site',
}

const BASE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
  ...SECURITY_HEADERS,
}

export class OriginError extends Error {
  status = 403
  constructor() {
    super('Origem não autorizada.')
  }
}

/** Origem da requisição, normalizada (sem barra final). */
export function requestOrigin(req: Request): string {
  return (req.headers.get('Origin') ?? '').trim().replace(/\/+$/, '')
}

/** true quando a origem é conhecida OU não há origem (server-to-server). */
export function isOriginAllowed(req: Request): boolean {
  const origin = requestOrigin(req)
  if (!origin) return true

  const list = allowedOrigins()
  return list.includes('*') || list.includes(origin)
}

/**
 * Fail-fast de origem para rotas que MUDAM ESTADO. Chamar como primeira linha
 * do handler, depois do preflight. Rejeitar aqui evita que o efeito colateral
 * ocorra — CORS sozinho só esconderia a resposta.
 */
export function assertAllowedOrigin(req: Request): void {
  if (!isOriginAllowed(req)) {
    console.warn('origem rejeitada:', requestOrigin(req))
    throw new OriginError()
  }
}

/** Headers de CORS para esta requisição. Origem desconhecida não é ecoada. */
export function corsFor(req: Request): Record<string, string> {
  const origin = requestOrigin(req)
  const list = allowedOrigins()

  if (list.includes('*')) {
    return { ...BASE_HEADERS, 'Access-Control-Allow-Origin': '*' }
  }

  if (origin && list.includes(origin)) {
    return { ...BASE_HEADERS, 'Access-Control-Allow-Origin': origin }
  }

  // Sem Origin (server-to-server) ou origem não autorizada: nenhum ACAO.
  return { ...BASE_HEADERS }
}

/** @deprecated use corsFor(req) — mantido para compatibilidade de import. */
export const corsHeaders = BASE_HEADERS

export function preflight(req: Request): Response {
  // Preflight de origem desconhecida também não recebe eco: o browser aborta
  // antes de emitir a requisição real.
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
