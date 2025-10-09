// Edge Function to search for company logos using logo.dev API
// This function intermediates the call to logo.dev API to keep the token secure

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

interface LogoSearchRequest {
  query: string
}

interface LogoSearchResponse {
  domain?: string
  logo_url?: string
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the query from request body
    const { query }: LogoSearchRequest = await req.json()

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get the API tokens from environment
    const LOGO_DEV_TOKEN = Deno.env.get('LOGO_DEV_TOKEN')
    const LOGO_DEV_TOKEN_IMAGES = Deno.env.get('LOGO_DEV_TOKEN_IMAGES')
    
    if (!LOGO_DEV_TOKEN) {
      console.error('LOGO_DEV_TOKEN not configured')
      return new Response(
        JSON.stringify({ error: 'API token not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    if (!LOGO_DEV_TOKEN_IMAGES) {
      console.error('LOGO_DEV_TOKEN_IMAGES not configured')
      return new Response(
        JSON.stringify({ error: 'Image token not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Call logo.dev search API
    const searchUrl = `https://api.logo.dev/search?q=${encodeURIComponent(query)}`
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${LOGO_DEV_TOKEN}`,
        'Accept': 'application/json'
      }
    })

    if (!searchResponse.ok) {
      console.error(`Logo.dev API error: ${searchResponse.status}`)
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

    // Construct the CDN logo URL with token for rendering
    // Formatos aceitos: jpg (padrão), png, webp
    const logoUrl = `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN_IMAGES}&format=png&size=60`

    const response: LogoSearchResponse = {
      domain,
      logo_url: logoUrl
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in search-logo function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

