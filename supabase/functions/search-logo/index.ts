// ============================================================================
// search-logo — busca de logo corporativo via logo.dev
// ============================================================================
// CORRECOES DE SEGURANCA:
//  1. [AUTH] A funcao era 100% publica: qualquer um na internet queimava a
//     cota paga do logo.dev. Agora exige JWT valido (requireUser).
//  2. [VAZAMENTO DE SEGREDO] A resposta devolvia
//     `https://img.logo.dev/<dominio>?token=<LOGO_DEV_TOKEN_IMAGES>`,
//     entregando o token do servidor ao browser em texto claro. Agora a
//     imagem e buscada server-side e devolvida como data URL — o token
//     nunca sai da Edge Function.
//  3. [RATE LIMIT] 30 buscas por hora por usuario.
//  4. [CORS] origem restrita a ALLOWED_ORIGINS.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsFor, preflight, jsonFor } from "../_shared/cors.ts"
import { requireUser, errorStatus } from "../_shared/auth.ts"
import { enforceRateLimit, RateLimitError } from "../_shared/ratelimit.ts"

interface LogoSearchRequest {
  query: string
}

const MAX_QUERY_LENGTH = 100
const MAX_IMAGE_BYTES = 512 * 1024 // 512KB — e um logo, nao um upload
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g
const DOMAIN_RE = /^[a-z0-9.-]{1,253}\.[a-z]{2,}$/i

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  if (req.method !== 'POST') {
    return jsonFor(req, { error: 'Method not allowed' }, 405)
  }

  try {
    // [1] Autenticacao obrigatoria
    const user = await requireUser(req)

    // [3] Rate limit: 30/h por usuario
    await enforceRateLimit(user.id, 'search-logo', 30, 3600)

    const body: LogoSearchRequest = await req.json().catch(() => ({ query: '' }))
    const rawQuery = typeof body?.query === 'string' ? body.query : ''

    // Sanitizacao: sem caracteres de controle, tamanho limitado.
    const query = rawQuery.replace(CONTROL_CHARS, '').trim().slice(0, MAX_QUERY_LENGTH)

    if (!query) {
      return jsonFor(req, { error: 'Query parameter is required' }, 400)
    }

    const LOGO_DEV_TOKEN = Deno.env.get('LOGO_DEV_TOKEN')
    const LOGO_DEV_TOKEN_IMAGES = Deno.env.get('LOGO_DEV_TOKEN_IMAGES')

    if (!LOGO_DEV_TOKEN || !LOGO_DEV_TOKEN_IMAGES) {
      console.error('LOGO_DEV_TOKEN/LOGO_DEV_TOKEN_IMAGES nao configurados')
      return jsonFor(req, { error: 'Servico de logos indisponivel' }, 503)
    }

    const searchResponse = await fetch(
      `https://api.logo.dev/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${LOGO_DEV_TOKEN}`,
          'Accept': 'application/json',
        },
      },
    )

    if (!searchResponse.ok) {
      console.error(`Logo.dev API error: ${searchResponse.status}`)
      // Nao repassa o status bruto do terceiro: evita oraculo sobre a conta.
      return jsonFor(req, { error: 'Failed to search logo' }, 502)
    }

    const searchData = await searchResponse.json()

    let domain: string | undefined
    if (Array.isArray(searchData) && searchData.length > 0) {
      domain = searchData[0]?.domain
    } else if (searchData?.domain) {
      domain = searchData.domain
    }

    // Valida o dominio antes de montar a URL — o valor vem de terceiro.
    if (!domain || !DOMAIN_RE.test(domain)) {
      return jsonFor(req, { error: 'No logo found for this company' }, 404)
    }

    // [2] Proxy server-side: o token fica aqui dentro.
    const imageResponse = await fetch(
      `https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN_IMAGES}`,
    )

    if (!imageResponse.ok) {
      return jsonFor(req, { error: 'Failed to download logo' }, 502)
    }

    const contentType = imageResponse.headers.get('content-type') ?? 'image/png'
    if (!contentType.startsWith('image/')) {
      return jsonFor(req, { error: 'Resposta do provedor nao e uma imagem' }, 502)
    }

    const bytes = new Uint8Array(await imageResponse.arrayBuffer())
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return jsonFor(req, { error: 'Logo excede o tamanho permitido' }, 413)
    }

    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const dataUrl = `data:${contentType};base64,${btoa(binary)}`

    return jsonFor(req, { domain, logo_url: dataUrl })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 429,
        headers: {
          ...corsFor(req),
          'Content-Type': 'application/json',
          'Retry-After': String(error.retryAfter),
        },
      })
    }

    console.error('search-logo:', error)
    const status = errorStatus(error)
    // Nao devolve error.message em 5xx: evita vazar detalhe de infraestrutura.
    return jsonFor(
      req,
      { error: status >= 500 ? 'Internal server error' : (error as Error).message },
      status,
    )
  }
})
