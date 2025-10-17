// Edge Function para processar webhooks do Asaas
// Recebe notificações de pagamentos, cancelamentos, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
}

interface WebhookPayload {
  event: string
  payment?: {
    id: string
    customer: string
    value: number
    netValue: number
    billingType: string
    status: string
    dueDate: string
    confirmedDate?: string
    paymentDate?: string
    invoiceUrl?: string
    bankSlipUrl?: string
    transactionReceiptUrl?: string
  }
  subscription?: {
    id: string
    customer: string
    status: string
    value: number
    nextDueDate: string
    cycle: string
  }
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

    const payload: WebhookPayload = await req.json()

    // Validar webhook token (Asaas envia um token específico)
    const webhookToken = req.headers.get('asaas-access-token')
    const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')
    
    if (expectedToken && webhookToken !== expectedToken) {
      console.error('Invalid webhook token')
      throw new Error('Invalid webhook token')
    }

    console.log('Webhook received:', payload.event)

    switch (payload.event) {
      case 'PAYMENT_CREATED':
        await handlePaymentCreated(supabaseClient, payload)
        break
      
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_APPROVED':
        await handlePaymentConfirmed(supabaseClient, payload)
        break
      
      case 'PAYMENT_RECEIVED':
        await handlePaymentReceived(supabaseClient, payload)
        break
      
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(supabaseClient, payload)
        break
      
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        await handlePaymentRefunded(supabaseClient, payload)
        break
      
      case 'SUBSCRIPTION_CREATED':
        await handleSubscriptionCreated(supabaseClient, payload)
        break
      
      case 'SUBSCRIPTION_UPDATED':
        await handleSubscriptionUpdated(supabaseClient, payload)
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

// ============================================================================
// HANDLERS DOS EVENTOS
// ============================================================================

async function handlePaymentCreated(supabase: any, payload: WebhookPayload) {
  console.log('Payment created:', payload.payment?.id)
  
  if (!payload.payment) return

  // Buscar assinatura pelo asaas_payment_id no payment_history
  const { data: paymentHistory } = await supabase
    .from('payment_history')
    .select('*')
    .eq('asaas_payment_id', payload.payment.id)
    .single()

  if (paymentHistory) {
    // Atualizar status do pagamento
    await supabase
      .from('payment_history')
      .update({ 
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentHistory.id)
  }
}

async function handlePaymentConfirmed(supabase: any, payload: WebhookPayload) {
  console.log('Payment confirmed:', payload.payment?.id)
  
  if (!payload.payment) return

  // Buscar pagamento no histórico pelo payment_id OU pelo external reference
  let paymentHistory = null
  
  // Tentar buscar pelo payment_id
  const { data: paymentById } = await supabase
    .from('payment_history')
    .select('*, subscription_id, user_id')
    .eq('asaas_payment_id', payload.payment.id)
    .maybeSingle()

  if (paymentById) {
    paymentHistory = paymentById
  } else {
    // Se não encontrar, buscar pela subscription usando user_id da external reference
    // External reference tem formato: plan_xxx_user_xxx_timestamp
    const externalRef = (payload.payment as any).externalReference
    if (externalRef) {
      const match = externalRef.match(/user_([a-f0-9\-]+)/)
      if (match) {
        const userId = match[1]
        // Buscar assinatura mais recente deste usuário com status pending
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (subscription) {
          // Buscar payment_history desta subscription
          const { data: paymentBySubscription } = await supabase
            .from('payment_history')
            .select('*, subscription_id, user_id')
            .eq('subscription_id', subscription.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (paymentBySubscription) {
            paymentHistory = paymentBySubscription
            // Atualizar o asaas_payment_id correto
            await supabase
              .from('payment_history')
              .update({ asaas_payment_id: payload.payment.id })
              .eq('id', paymentBySubscription.id)
          }
        }
      }
    }
  }

  if (!paymentHistory) {
    console.error('Payment not found in history:', payload.payment.id)
    return
  }

  // Atualizar status do pagamento
  await supabase
    .from('payment_history')
    .update({ 
      status: 'confirmed',
      paid_at: payload.payment.confirmedDate || payload.payment.paymentDate || new Date().toISOString()
    })
    .eq('id', paymentHistory.id)

  // Ativar assinatura do usuário
  if (paymentHistory.subscription_id) {
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('*, plan_id')
      .eq('id', paymentHistory.subscription_id)
      .single()

    if (subscription) {
      const now = new Date()
      const periodEnd = new Date(now)
      
      // Calcular período baseado no ciclo
      if (subscription.billing_cycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1)
      }

      await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', paymentHistory.subscription_id)

      console.log('Subscription activated:', paymentHistory.subscription_id)
    }
  }
}

async function handlePaymentReceived(supabase: any, payload: WebhookPayload) {
  console.log('Payment received:', payload.payment?.id)
  
  if (!payload.payment) return

  // Atualizar pagamento como recebido (confirmado e liquidado)
  const { data: paymentHistory } = await supabase
    .from('payment_history')
    .select('*')
    .eq('asaas_payment_id', payload.payment.id)
    .single()

  if (paymentHistory) {
    await supabase
      .from('payment_history')
      .update({ 
        status: 'confirmed',
        paid_at: payload.payment.paymentDate || new Date().toISOString(),
        metadata: {
          ...paymentHistory.metadata,
          received_at: new Date().toISOString(),
          net_value: payload.payment.netValue
        }
      })
      .eq('id', paymentHistory.id)
  }
}

async function handlePaymentOverdue(supabase: any, payload: WebhookPayload) {
  console.log('Payment overdue:', payload.payment?.id)
  
  if (!payload.payment) return

  // Buscar pagamento no histórico
  const { data: paymentHistory } = await supabase
    .from('payment_history')
    .select('*, subscription_id')
    .eq('asaas_payment_id', payload.payment.id)
    .single()

  if (!paymentHistory) return

  // Atualizar status do pagamento
  await supabase
    .from('payment_history')
    .update({ 
      status: 'failed'
    })
    .eq('id', paymentHistory.id)

  // Atualizar status da assinatura para 'past_due'
  if (paymentHistory.subscription_id) {
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentHistory.subscription_id)

    console.log('Subscription marked as past_due:', paymentHistory.subscription_id)
  }
}

async function handlePaymentRefunded(supabase: any, payload: WebhookPayload) {
  console.log('Payment refunded/deleted:', payload.payment?.id)
  
  if (!payload.payment) return

  // Atualizar pagamento como reembolsado
  const { data: paymentHistory } = await supabase
    .from('payment_history')
    .select('*, subscription_id')
    .eq('asaas_payment_id', payload.payment.id)
    .single()

  if (!paymentHistory) return

  await supabase
    .from('payment_history')
    .update({ 
      status: payload.event === 'PAYMENT_REFUNDED' ? 'refunded' : 'canceled'
    })
    .eq('id', paymentHistory.id)

  // Cancelar assinatura se necessário
  if (paymentHistory.subscription_id) {
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentHistory.subscription_id)
  }
}

async function handleSubscriptionCreated(supabase: any, payload: WebhookPayload) {
  console.log('Subscription created:', payload.subscription?.id)
  
  if (!payload.subscription) return

  // Buscar assinatura pelo asaas_subscription_id
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('asaas_subscription_id', payload.subscription.id)
    .single()

  if (subscription) {
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id)
  }
}

async function handleSubscriptionUpdated(supabase: any, payload: WebhookPayload) {
  console.log('Subscription updated:', payload.subscription?.id)
  
  if (!payload.subscription) return

  // Atualizar assinatura
  await supabase
    .from('user_subscriptions')
    .update({
      status: payload.subscription.status === 'ACTIVE' ? 'active' : 'canceled',
      updated_at: new Date().toISOString()
    })
    .eq('asaas_subscription_id', payload.subscription.id)
}

async function handleSubscriptionCanceled(supabase: any, payload: WebhookPayload) {
  console.log('Subscription canceled:', payload.subscription?.id)
  
  if (!payload.subscription) return

  // Cancelar assinatura
  await supabase
    .from('user_subscriptions')
    .update({
      status: 'canceled',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString()
    })
    .eq('asaas_subscription_id', payload.subscription.id)
}


