import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { preflight, jsonFor } from '../_shared/cors.ts'
import { adminClient, requireUser, errorStatus } from '../_shared/auth.ts'
import {
  AsaasPayment,
  AsaasSubscription,
  addCycle,
  asaasFetch,
  findOrCreateCustomer,
  normalizeBillingCycle,
  onlyDigits,
  toAsaasCycle,
  toIsoDate,
} from '../_shared/asaas.ts'

interface Body {
  planId: string
  billingCycle: 'monthly' | 'yearly' | 'annual'
  cpfCnpj?: string
  mobilePhone?: string
}

const ACTIVE_STATUSES = ['pending', 'trial', 'active', 'past_due']

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  try {
    const user = await requireUser(req)
    const supabase = adminClient()
    const body: Body = await req.json()

    if (!body?.planId || !body?.billingCycle) {
      throw new Error('Campos obrigatórios: planId, billingCycle')
    }

    const billingCycle = normalizeBillingCycle(body.billingCycle)

    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', body.planId)
      .eq('is_active', true)
      .maybeSingle()

    if (planError) throw planError
    if (!plan) throw new Error('Plano não encontrado ou inativo')

    const amount = Number(billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly)

    if (!(amount > 0)) {
      const now = new Date()

      await supabase
        .from('user_subscriptions')
        .update({ status: 'canceled', cancel_at_period_end: false, updated_at: now.toISOString() })
        .eq('user_id', user.id)
        .in('status', ACTIVE_STATUSES)

      const { data, error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          status: 'active',
          billing_cycle: billingCycle,
          current_period_start: now.toISOString(),
          current_period_end: addCycle(now, billingCycle).toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      return jsonFor(req, { success: true, free_plan: true, subscription: data })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, email, full_name, asaas_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) throw profileError

    const email = profile?.email || user.email
    if (!email) throw new Error('E-mail do usuário não encontrado')

    const customer = await findOrCreateCustomer({
      asaasCustomerId: profile?.asaas_customer_id,
      name: profile?.full_name || email,
      email,
      cpfCnpj: onlyDigits(body.cpfCnpj),
      mobilePhone: onlyDigits(body.mobilePhone),
      externalReference: user.id,
    })

    if (customer.id !== profile?.asaas_customer_id) {
      await supabase
        .from('user_profiles')
        .update({ asaas_customer_id: customer.id })
        .eq('user_id', user.id)
    }

    const { data: currentSubs, error: currentError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })

    if (currentError) throw currentError

    const current = currentSubs?.[0] ?? null
    const isSamePlan = current?.plan_id === plan.id && current?.billing_cycle === billingCycle
    const isPaidActive = !!current?.asaas_subscription_id

    if (isSamePlan && current?.status === 'active') {
      throw new Error('Você já possui este plano ativo')
    }

    const cycle = toAsaasCycle(billingCycle)
    const nextDueDate = toIsoDate(new Date())
    const externalReference = `orbi:${user.id}:${plan.id}:${billingCycle}`

    let asaasSubscription: AsaasSubscription

    if (isPaidActive) {
      // Upgrade/downgrade: reaproveita a assinatura do Asaas, sincroniza valor e ciclo
      asaasSubscription = await asaasFetch<AsaasSubscription>(
        `/subscriptions/${current!.asaas_subscription_id}`,
        {
          method: 'PUT',
          body: {
            value: amount,
            cycle,
            description: `Orbi - ${plan.name}`,
            externalReference,
            updatePendingPayments: true,
            billingType: 'UNDEFINED',
          },
        },
      )
    } else {
      asaasSubscription = await asaasFetch<AsaasSubscription>('/subscriptions', {
        method: 'POST',
        body: {
          customer: customer.id,
          billingType: 'UNDEFINED',
          value: amount,
          nextDueDate,
          cycle,
          description: `Orbi - ${plan.name}`,
          externalReference,
        },
      })
    }

    // Assinaturas anteriores que não são a reaproveitada saem de cena
    const staleIds = (currentSubs ?? [])
      .filter((s) => s.asaas_subscription_id !== asaasSubscription.id)
      .map((s) => s.id)

    if (staleIds.length) {
      await supabase
        .from('user_subscriptions')
        .update({ status: 'canceled', cancel_at_period_end: false, updated_at: new Date().toISOString() })
        .in('id', staleIds)
    }

    const now = new Date()
    const basePayload = {
      user_id: user.id,
      plan_id: plan.id,
      billing_cycle: billingCycle,
      asaas_customer_id: customer.id,
      asaas_subscription_id: asaasSubscription.id,
      next_due_date: asaasSubscription.nextDueDate ?? nextDueDate,
      updated_at: now.toISOString(),
    }

    let subscriptionRow

    if (isPaidActive) {
      // Upgrade sobre plano já pago: mantém acesso, ajusta o plano imediatamente
      const { data, error } = await supabase
        .from('user_subscriptions')
        .update({
          ...basePayload,
          status: current!.status === 'past_due' ? 'past_due' : current!.status,
          blocked_reason: null,
        })
        .eq('id', current!.id)
        .select()
        .single()

      if (error) throw error
      subscriptionRow = data
    } else {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .insert({
          ...basePayload,
          status: 'pending',
          current_period_start: now.toISOString(),
          current_period_end: addCycle(now, billingCycle).toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      subscriptionRow = data
    }

    const payments = await asaasFetch<{ data: AsaasPayment[] }>(
      `/subscriptions/${asaasSubscription.id}/payments?limit=1`,
    )
    const payment = payments?.data?.[0] ?? null

    if (payment) {
      await supabase
        .from('payment_history')
        .upsert(
          {
            user_id: user.id,
            subscription_id: subscriptionRow.id,
            amount,
            currency: 'BRL',
            status: 'pending',
            payment_method: payment.billingType,
            asaas_payment_id: payment.id,
            asaas_invoice_url: payment.invoiceUrl,
            invoice_url: payment.invoiceUrl,
            bank_slip_url: payment.bankSlipUrl,
            due_date: payment.dueDate,
            metadata: { asaas_subscription_id: asaasSubscription.id },
          },
          { onConflict: 'asaas_payment_id' },
        )
    }

    return jsonFor(req, {
      success: true,
      subscription: subscriptionRow,
      payment: payment
        ? {
            id: payment.id,
            url: payment.invoiceUrl,
            value: payment.value,
            dueDate: payment.dueDate,
            billingType: payment.billingType,
          }
        : null,
      asaas_subscription_id: asaasSubscription.id,
      upgraded: isPaidActive,
    })
  } catch (error) {
    console.error('asaas-create-payment:', error)
    return jsonFor(req, { success: false, error: (error as Error).message }, errorStatus(error))
  }
})
