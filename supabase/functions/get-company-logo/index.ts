// ============================================================================
// get-company-logo — logo corporativo com cache no Storage
// ============================================================================
// CORRECOES DE SEGURANCA:
//  1. [VAZAMENTO DE SEGREDO] No caminho de fallback (falha de upload) a
//     funcao devolvia `https://img.logo.dev/...?token=<LOGO_DEV_TOKEN_IMAGES>`
//     e o frontend GRAVAVA essa URL em series.logo_url — o token do servidor
//     ficava persistido no banco e renderizado no HTML de todos os usuarios.
//     Agora o fallback e uma data URL; o token nunca sai daqui.
//  2. [CONFIG DE PRODUCAO] `internalUrl = 'http://kong:8000'` e
//     `publicBaseUrl = 'http://127.0.0.1:54331'` estavam hardcoded: em
//     producao o client admin apontava para host inexistente e as URLs
//     devolvidas ao frontend eram localhost. Agora vem de SUPABASE_URL e do
//     proprio getPublicUrl() do Storage.
//  3. [SERVICE ROLE] usa SUPABASE_SERVICE_ROLE_KEY (nome padrao do runtime),
//     com fallback para SERVICE_ROLE_KEY, e falha fechado se ausente.
//  4. [RATE LIMIT] 60 resolucoes de logo por hora por usuario.
//  5. [INPUT] companyName sanitizado e limitado (era usado para montar o
//     caminho no Storage).
//  6. [CORS] origem restrita a ALLOWED_ORIGINS.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsFor, preflight, jsonFor } from "../_shared/cors.ts"
import { enforceRateLimit, RateLimitError } from "../_shared/ratelimit.ts"

interface LogoRequest {
  companyName: string
}

const BUCKET = 'company-logos'
const MAX_NAME_LENGTH = 120
const MAX_IMAGE_BYTES = 512 * 1024
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g
const DOMAIN_RE = /^[a-z0-9.-]{1,253}\.[a-z]{2,}$/i

function toDataUrl(bytes: Uint8Array, contentType: string): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:${contentType};base64,${btoa(binary)}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  if (req.method !== 'POST') {
    return jsonFor(req, { error: 'Method not allowed' }, 405)
  }

  try {
    // [2][3] Configuracao vem do ambiente, nunca hardcoded.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) {
      console.error('SUPABASE_URL/SERVICE_ROLE_KEY nao configurados')
      return jsonFor(req, { error: 'Servico indisponivel' }, 503)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ---- Autenticacao ----
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonFor(req, { error: 'Unauthorized' }, 401)
    }

    const token = authHeader.slice(7)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return jsonFor(req, { error: 'Unauthorized' }, 401)
    }

    // [4] Rate limit por usuario
    await enforceRateLimit(user.id, 'get-company-logo', 60, 3600)

    // [5] Entrada sanitizada antes de virar caminho no Storage.
    const body: LogoRequest = await req.json().catch(() => ({ companyName: '' }))
    const rawName = typeof body?.companyName === 'string' ? body.companyName : ''
    const companyName = rawName
      .replace(CONTROL_CHARS, '')
      .trim()
      .slice(0, MAX_NAME_LENGTH)

    if (!companyName) {
      return jsonFor(req, { error: 'Company name is required' }, 400)
    }

    // ---- Autorizacao por feature do plano ----
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('id, status, subscription_plans ( features )')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError || !subscription) {
      return jsonFor(req, { error: 'No active subscription found' }, 403)
    }

    const planFeatures = (subscription as Record<string, any>)?.subscription_plans?.features ?? {}
    if (planFeatures['ia_deteccao_logos'] !== true) {
      return jsonFor(
        req,
        { error: 'Logo detection feature not available in your plan. Upgrade to access this feature.' },
        403,
      )
    }

    // Nome normalizado: apenas [a-z0-9-], sem barras — imune a path traversal.
    const normalizedName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, MAX_NAME_LENGTH)
    if (!normalizedName.replace(/-/g, '')) {
      return jsonFor(req, { error: 'Company name invalido' }, 400)
    }

    const fileName = `${normalizedName}.png`
    const storagePath = `logos/${fileName}`

    // ---- Cache no Storage ----
    const { data: existingFile } = await supabase.storage
      .from(BUCKET)
      .list('logos', { search: fileName })

    if (existingFile && existingFile.length > 0) {
      // [2] URL publica derivada do projeto real, nao de 127.0.0.1.
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
      return jsonFor(req, { logo_url: pub.publicUrl, source: 'storage' })
    }

    const LOGO_DEV_TOKEN = Deno.env.get('LOGO_DEV_TOKEN')
    const LOGO_DEV_TOKEN_IMAGES = Deno.env.get('LOGO_DEV_TOKEN_IMAGES')

    if (!LOGO_DEV_TOKEN || !LOGO_DEV_TOKEN_IMAGES) {
      return jsonFor(req, { error: 'Servico de logos indisponivel' }, 503)
    }

    const searchResponse = await fetch(
      `https://api.logo.dev/search?q=${encodeURIComponent(companyName.toLowerCase())}`,
      {
        headers: {
          'Authorization': `Bearer ${LOGO_DEV_TOKEN}`,
          'Accept': 'application/json',
        },
      },
    )

    if (!searchResponse.ok) {
      return jsonFor(req, { error: 'Failed to search logo' }, 502)
    }

    const searchData = await searchResponse.json()

    let domain: string | undefined
    if (Array.isArray(searchData) && searchData.length > 0) {
      domain = searchData[0]?.domain
    } else if (searchData?.domain) {
      domain = searchData.domain
    }

    if (!domain || !DOMAIN_RE.test(domain)) {
      return jsonFor(req, { error: 'No logo found for this company' }, 404)
    }

    const logoResponse = await fetch(
      `https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN_IMAGES}`,
    )

    if (!logoResponse.ok) {
      return jsonFor(req, { error: 'Failed to download logo' }, 502)
    }

    const contentType = logoResponse.headers.get('content-type') ?? 'image/png'
    if (!contentType.startsWith('image/')) {
      return jsonFor(req, { error: 'Resposta do provedor nao e uma imagem' }, 502)
    }

    const logoBytes = new Uint8Array(await logoResponse.arrayBuffer())
    if (logoBytes.byteLength > MAX_IMAGE_BYTES) {
      return jsonFor(req, { error: 'Logo excede o tamanho permitido' }, 413)
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, logoBytes, {
        contentType,
        cacheControl: '31536000',
        upsert: true,
      })

    if (uploadError) {
      // [1] Fallback SEM token: data URL. A URL tokenizada do logo.dev nunca
      // pode ser devolvida — o frontend persiste este valor em series.logo_url.
      console.error('falha ao cachear logo:', uploadError.message)
      return jsonFor(req, { logo_url: toDataUrl(logoBytes, contentType), source: 'api' })
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    return jsonFor(req, { logo_url: pub.publicUrl, source: 'storage' })
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

    console.error('get-company-logo:', error)
    return jsonFor(req, { error: 'Internal server error' }, 500)
  }
})
