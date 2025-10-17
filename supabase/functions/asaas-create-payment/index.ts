// Edge Function para criar cobrança/pagamento no Asaas
// Chamada quando o usuário escolhe um plano

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreatePaymentRequest {
  planId: string
  billingCycle: 'monthly' | 'annual'
}

interface AsaasPaymentResponse {
  id: string
  customer: string
  billingType: string
  value: number
  dueDate: string
  status: string
  invoiceUrl: string
  bankSlipUrl?: string
  pixQrCodeUrl?: string
  pixCopyAndPaste?: string
  installmentUrl?: string
}

interface AsaasSubscriptionResponse {
  id: string
  customer: string
  billingType: string
  value: number
  nextDueDate: string
  cycle: string
  status: string
}

const ASAAS_BASE_URL = Deno.env.get('ASAAS_SANDBOX') === 'true' 
  ? 'https://sandbox.asaas.com/api/v3' 
  : 'https://api.asaas.com/v3'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Obter token de autenticação
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Obter usuário autenticado
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const body: CreatePaymentRequest = await req.json()
    const { planId, billingCycle } = body

    // Validações
    if (!planId || !billingCycle) {
      throw new Error('Missing required fields: planId, billingCycle')
    }

    // Usar cliente com service role para operações sensíveis
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar dados do usuário
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*, user_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Buscar dados do plano
    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      throw new Error('Plan not found or inactive')
    }

    // Determinar valor baseado no ciclo
    const amount = billingCycle === 'annual' ? plan.price_yearly : plan.price_monthly
    
    // Verificar se é plano gratuito
    if (amount === 0) {
      // Criar assinatura gratuita diretamente
      const { data: subscription, error: subError } = await supabaseAdmin
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: planId,
          status: 'active',
          billing_cycle: billingCycle,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + (billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()

      if (subError) throw subError

      return new Response(
        JSON.stringify({
          success: true,
          subscription,
          free_plan: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Verificar se o customer existe no Asaas
    let asaasCustomerId = userProfile.asaas_customer_id

    if (!asaasCustomerId) {
      // Criar customer no Asaas
      console.log('Creating Asaas customer...')
      const customerResponse = await fetch(`${ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': Deno.env.get('ASAAS_API_KEY') ?? ''
        },
        body: JSON.stringify({
          name: userProfile.full_name || userProfile.email,
          email: userProfile.email,
          notificationDisabled: false
        })
      })

      if (!customerResponse.ok) {
        const errorText = await customerResponse.text()
        console.error('Asaas customer creation error:', errorText)
        throw new Error(`Failed to create Asaas customer: ${errorText}`)
      }

      const customerData = await customerResponse.json()
      asaasCustomerId = customerData.id

      // Atualizar user_profiles
      await supabaseAdmin
        .from('user_profiles')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('user_id', user.id)
    }

    console.log('Creating payment link for plan:', plan.name)

    // Criar Payment Link no Asaas
    // Isso permite que o cliente escolha a forma de pagamento e gera a cobrança automaticamente
    
    // URL de callback após pagamento
    const baseUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://sistema-orbi.vercel.app'
    const callbackUrl = `${baseUrl}/sistema?payment=success`
    
    const paymentLinkPayload = {
      name: `${plan.name} - ${userProfile.full_name || userProfile.email}`,
      description: plan.description || `Assinatura ${plan.name}`,
      billingType: 'UNDEFINED', // Permite que o cliente escolha (PIX, Boleto, Cartão)
      chargeType: 'RECURRENT',
      value: parseFloat(amount.toString()),
      subscriptionCycle: billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY',
      dueDateLimitDays: 3, // 3 dias úteis para pagar boleto
      notificationEnabled: true,
      externalReference: `plan_${planId}_user_${user.id}_${Date.now()}`,
      callback: {
        successUrl: callbackUrl,
        autoRedirect: true
      }
    }

    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/paymentLinks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': Deno.env.get('ASAAS_API_KEY') ?? ''
      },
      body: JSON.stringify(paymentLinkPayload)
    })

    if (!asaasResponse.ok) {
      const errorText = await asaasResponse.text()
      console.error('Asaas payment link creation error:', errorText)
      throw new Error(`Failed to create payment link: ${errorText}`)
    }

    const paymentLinkData = await asaasResponse.json()
    console.log('Payment link created:', paymentLinkData.id, paymentLinkData.url)

    // Converter billing_cycle para o formato do banco (annual -> yearly)
    const dbBillingCycle = billingCycle === 'annual' ? 'yearly' : 'monthly'
    
    // Criar/atualizar assinatura no banco
    const { data: existingSubscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_id', planId)
      .single()

    let subscription
    if (existingSubscription) {
      // Atualizar assinatura existente - status 'pending' até confirmar pagamento
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'pending',
          billing_cycle: dbBillingCycle,
          asaas_customer_id: asaasCustomerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id)
        .select()
        .single()

      if (updateError) throw updateError
      subscription = updated
    } else {
      // Criar nova assinatura - status 'pending' até confirmar pagamento via webhook
      const { data: created, error: createError } = await supabaseAdmin
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: planId,
          status: 'pending',
          billing_cycle: dbBillingCycle,
          asaas_customer_id: asaasCustomerId,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + (billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()

      if (createError) throw createError
      subscription = created
    }

    // Registrar payment link no histórico
    const { error: paymentHistoryError } = await supabaseAdmin
      .from('payment_history')
      .insert({
        user_id: user.id,
        subscription_id: subscription.id,
        amount: amount,
        currency: 'BRL',
        status: 'pending',
        payment_method: 'PAYMENT_LINK',
        asaas_payment_id: paymentLinkData.id,
        invoice_url: paymentLinkData.url,
        metadata: {
          payment_link_id: paymentLinkData.id,
          charge_type: paymentLinkData.chargeType,
          subscription_cycle: paymentLinkData.subscriptionCycle
        }
      })

    if (paymentHistoryError) {
      console.error('Error creating payment history:', paymentHistoryError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription,
        payment: {
          id: paymentLinkData.id,
          url: paymentLinkData.url,
          value: paymentLinkData.value,
          active: paymentLinkData.active,
          chargeType: paymentLinkData.chargeType,
          subscriptionCycle: paymentLinkData.subscriptionCycle,
          redirectUrl: paymentLinkData.url
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in asaas-create-payment:', error)
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

