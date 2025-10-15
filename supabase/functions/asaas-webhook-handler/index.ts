// Edge Function para processar webhooks do Asaas
// Recebe notificações de pagamentos, cancelamentos, etc.

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

    const payload = await req.json()

    // TODO: Validar signature do webhook
    // const signature = req.headers.get('asaas-signature')
    // if (!validateSignature(payload, signature)) {
    //   throw new Error('Invalid webhook signature')
    // }

    console.log('Webhook received:', payload.event)

    switch (payload.event) {
      case 'PAYMENT_CONFIRMED':
        await handlePaymentConfirmed(supabaseClient, payload)
        break
      
      case 'PAYMENT_RECEIVED':
        await handlePaymentReceived(supabaseClient, payload)
        break
      
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(supabaseClient, payload)
        break
      
      case 'SUBSCRIPTION_CANCELED':
        await handleSubscriptionCanceled(supabaseClient, payload)
        break
      
      default:
        console.log('Unhandled event:', payload.event)
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function handlePaymentConfirmed(supabase: any, payload: any) {
  // TODO: Atualizar status da assinatura para 'active'
  // TODO: Registrar pagamento em payment_history
  console.log('Payment confirmed:', payload)
}

async function handlePaymentReceived(supabase: any, payload: any) {
  // TODO: Atualizar data de liquidação
  console.log('Payment received:', payload)
}

async function handlePaymentOverdue(supabase: any, payload: any) {
  // TODO: Atualizar status da assinatura para 'past_due'
  console.log('Payment overdue:', payload)
}

async function handleSubscriptionCanceled(supabase: any, payload: any) {
  // TODO: Atualizar status da assinatura para 'canceled'
  // TODO: Registrar data de cancelamento
  console.log('Subscription canceled:', payload)
}


