// Edge Function para criar customer no Asaas
// Chamada quando um novo usuário se registra ou faz sua primeira compra

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateCustomerRequest {
  userId: string
  userEmail: string
  userName: string
  cpfCnpj?: string
  phone?: string
  mobilePhone?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  postalCode?: string
}

interface AsaasCustomerResponse {
  id: string
  name: string
  email: string
  cpfCnpj?: string
  phone?: string
  mobilePhone?: string
  company?: string
  object: string
}

const ASAAS_BASE_URL = Deno.env.get('ASAAS_SANDBOX') === 'true' 
  ? 'https://sandbox.asaas.com/api/v3' 
  : 'https://api.asaas.com/v3'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body: CreateCustomerRequest = await req.json()
    const { userId, userEmail, userName, cpfCnpj, phone, mobilePhone } = body

    // Validações
    if (!userId || !userEmail || !userName) {
      throw new Error('Missing required fields: userId, userEmail, userName')
    }

    // Verificar se o customer já existe
    const { data: existingProfile } = await supabaseClient
      .from('user_profiles')
      .select('asaas_customer_id')
      .eq('user_id', userId)
      .single()

    if (existingProfile?.asaas_customer_id) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Customer already exists',
          customer_id: existingProfile.asaas_customer_id,
          already_exists: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Criar customer no Asaas
    console.log('Creating Asaas customer for:', userEmail)
    
    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': Deno.env.get('ASAAS_API_KEY') ?? ''
      },
      body: JSON.stringify({
        name: userName,
        email: userEmail,
        cpfCnpj: cpfCnpj,
        phone: phone,
        mobilePhone: mobilePhone || phone,
        notificationDisabled: false
      })
    })

    if (!asaasResponse.ok) {
      const errorText = await asaasResponse.text()
      console.error('Asaas API error:', errorText)
      throw new Error(`Asaas API error: ${errorText}`)
    }

    const asaasData: AsaasCustomerResponse = await asaasResponse.json()
    console.log('Asaas customer created:', asaasData.id)

    // Atualizar user_profiles com asaas_customer_id
    const { error: updateError } = await supabaseClient
      .from('user_profiles')
      .update({ asaas_customer_id: asaasData.id })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error updating user_profiles:', updateError)
      throw new Error(`Failed to update user profile: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Customer created successfully',
        customer_id: asaasData.id,
        customer_data: asaasData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in asaas-create-customer:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})


