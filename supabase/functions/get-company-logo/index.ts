// Edge Function to get company logo with local caching
// This function checks local storage first, then fetches from logo.dev API if needed

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from "../_shared/cors.ts"

interface LogoRequest {
  companyName: string
}

interface LogoResponse {
  logo_url: string
  source: 'storage' | 'api'
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { companyName }: LogoRequest = await req.json()

    if (!companyName || companyName.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Company name is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    // Edge Functions run in Docker, so they need to use internal URLs (kong:8000)
    // But we return public URLs (127.0.0.1:54331) to the frontend
    const internalUrl = 'http://kong:8000'  // Internal Docker URL for API calls
    const publicBaseUrl = 'http://127.0.0.1:54331'  // Public URL for frontend
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')     
    const supabase = createClient(internalUrl, supabaseServiceKey)

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Obter usuário do token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verificar se o usuário tem a feature de detecção de logos
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select(`
        id,
        status,
        subscription_plans (
          features
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verificar feature
    const planFeatures = subscription.subscription_plans?.features || {}
    const hasLogoDetection = planFeatures['ia_deteccao_logos'] === true

    if (!hasLogoDetection) {
      return new Response(
        JSON.stringify({ error: 'Logo detection feature not available in your plan. Upgrade to access this feature.' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Normalize company name for file naming
    const normalizedName = companyName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')
    const fileName = `${normalizedName}.png`
    const storagePath = `logos/${fileName}`

    // Step 1: Check if logo exists in storage (CACHE FIRST!)
    const { data: existingFile } = await supabase
      .storage
      .from('company-logos')
      .list('logos', {
        search: fileName
      })

    if (existingFile && existingFile.length > 0) {
      // Logo exists in storage, return the public URL
      const publicUrl = `${publicBaseUrl}/storage/v1/object/public/company-logos/${storagePath}`

      return new Response(
        JSON.stringify({
          logo_url: publicUrl,
          source: 'storage'
        } as LogoResponse),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 2: Logo not in storage, fetch from logo.dev API

    const LOGO_DEV_TOKEN = Deno.env.get('LOGO_DEV_TOKEN')
    const LOGO_DEV_TOKEN_IMAGES = Deno.env.get('LOGO_DEV_TOKEN_IMAGES')
    
    if (!LOGO_DEV_TOKEN || !LOGO_DEV_TOKEN_IMAGES) {
      return new Response(
        JSON.stringify({ error: 'API tokens not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Search for company domain
    const searchUrl = `https://api.logo.dev/search?q=${encodeURIComponent(companyName.toLowerCase())}`
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${LOGO_DEV_TOKEN}`,
        'Accept': 'application/json'
      }
    })

    if (!searchResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to search logo' }),
        { 
          status: searchResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const searchData = await searchResponse.json()
    
    // Extract domain from the first result
    let domain: string | undefined
    if (searchData && Array.isArray(searchData) && searchData.length > 0) {
      domain = searchData[0]?.domain
    } else if (searchData && searchData.domain) {
      domain = searchData.domain
    }

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'No logo found for this company' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 3: Download logo from logo.dev CDN
    const logoUrl = `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN_IMAGES}`
    const logoResponse = await fetch(logoUrl)

    if (!logoResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to download logo' }),
        { 
          status: logoResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get logo as blob
    const logoBlob = await logoResponse.blob()
    const logoArrayBuffer = await logoBlob.arrayBuffer()

    // Step 4: Upload logo to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('company-logos')
      .upload(storagePath, logoArrayBuffer, {
        contentType: 'image/png',
        cacheControl: '31536000', // Cache for 1 year
        upsert: true
      })

    if (uploadError) {
      // Return the original URL from logo.dev as fallback
      return new Response(
        JSON.stringify({
          logo_url: logoUrl,
          source: 'api'
        } as LogoResponse),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 5: Return the public URL from storage
    const publicUrl = `${publicBaseUrl}/storage/v1/object/public/company-logos/${storagePath}`

    return new Response(
      JSON.stringify({
        logo_url: publicUrl,
        source: 'storage'
      } as LogoResponse),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

