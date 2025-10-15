// Edge Function para criar customer no Asaas
// Chamada quando um novo usuário se registra

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, userEmail, userName, cpfCnpj, phone } = await req.json()

    // TODO: Implementar chamada à API do Asaas
    // const asaasResponse = await fetch('https://api.asaas.com/v3/customers', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'access_token': Deno.env.get('ASAAS_API_KEY') ?? ''
    //   },
    //   body: JSON.stringify({
    //     name: userName,
    //     email: userEmail,
    //     cpfCnpj: cpfCnpj,
    //     phone: phone
    //   })
    // })

    // const asaasData = await asaasResponse.json()

    // Atualizar user_profiles com asaas_customer_id
    // await supabaseClient
    //   .from('user_profiles')
    //   .update({ asaas_customer_id: asaasData.id })
    //   .eq('user_id', userId)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Estrutura preparada. Implemente a integração com Asaas.',
        // customer_id: asaasData.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})


