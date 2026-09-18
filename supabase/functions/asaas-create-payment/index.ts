import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { preflight, jsonFor } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'
import { gateUser, gateFailure } from '../_shared/gate.ts'
import { badRequest, conflict, notFound, unprocessable } from '../_shared/errors.ts'
import { toPublicPayment, toPublicSubscription } from '../_shared/projections.ts'
import { cpfCnpjSchema, mobilePhoneSchema, parseJson, uuidSchema, z } from '../_shared/validation.ts'
import {
  AsaasPayment,
  AsaasSubscription,
  addCycle,
  asaasFetch,
  asaasId,
  findOrCreateCustomer,
  isAsaasNotFound,
  normalizeBillingCycle,
  parseCpfCnpj,
  toAsaasCycle,
  toIsoDate,
} from '../_shared/asaas.ts'

const MAX_BODY_BYTES = 4 * 1024

const bodySchema = z
  .object({
    planId: uuidSchema,
    billingCycle: z.enum(['monthly', 'yearly', 'annual']),
    cpfCnpj: cpfCnpjSchema.optional(),
    mobilePhone: mobilePhoneSchema.optional(),
  })
  .strict()

const ACTIVE_STATUSES = ['pending', 'trial', 'active', 'past_due']

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  try {
    const user = await gateUser(req, {
      bucket: 'asaas-create-payment',
      ipLimit: 20,
      userLimit: 10,
      windowSeconds: 3600,
      strict: true,
      maxBodyBytes: MAX_BODY_BYTES,
    })
    const body = await parseJson(req, bodySchema, { maxBytes: MAX_BODY_BYTES })
    const supabase = adminClient()

    const billingCycle = normalizeBillingCycle(body.billingCycle)

    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, price_monthly, price_yearly, is_active')
      .eq('id', body.planId)
      .eq('is_active', true)
      .maybeSingle()

    if (planError) throw planError
    if (!plan) throw notFound('Plano não encontrado ou inativo.')

    const amount = Number(billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly)

    if (!(amount > 0)) {
      const now = new Date()

      // ----------------------------------------------------------------------
      // DOWNGRADE PARA O PLANO GRATUITO
      // ----------------------------------------------------------------------
      // Antes só o banco era atualizado: a assinatura seguia viva no Asaas e o
      // usuário continuava recebendo faturas de um plano que não tem mais.
      // Encerra a recorrência no gateway ANTES de gravar. Se o DELETE falhar, o
      // banco não é tocado e o usuário permanece no plano pago (estado
      // consistente) em vez de ficar "free" sendo cobrado.
      const { data: activeSubs, error: activeError } = await supabase
        .from('user_subscriptions')
        .select('id, asaas_subscription_id')
        .eq('user_id', user.id)
        .in('status', ACTIVE_STATUSES)

      if (activeError) throw activeError

      const gatewayIds = Array.from(
        new Set(
          (activeSubs ?? [])
            .map((s) => s.asaas_subscription_id)
            .filter((id): id is string => !!id),
        ),
      )

      for (const subscriptionId of gatewayIds) {
        try {
          await asaasFetch(`/subscriptions/${asaasId(subscriptionId, 'subscription')}`, { method: 'DELETE' })
        } catch (asaasError) {
          // Já removida no gateway: segue o fluxo. Qualquer outra falha aborta.
          if (!isAsaasNotFound(asaasError)) throw asaasError
        }
      }

      await supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: false,
          next_due_date: null,
          updated_at: now.toISOString(),
        })
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

      if (gatewayIds.length) {
        await supabase
          .from('audit_logs')
          .insert({
            user_id: user.id,
            action: 'subscription_downgraded_free',
            entity_type: 'user_subscriptions',
            entity_id: data.id,
            metadata: { canceled_asaas_subscription_ids: gatewayIds },
          })
          .then(() => undefined, () => undefined)
      }

      return jsonFor(req, {
        success: true,
        free_plan: true,
        canceled_gateway_subscriptions: gatewayIds.length,
        subscription: toPublicSubscription(data),
      })
    }

    // Valida antes de qualquer escrita no gateway: documento malformado = 400.
    const cpfCnpj = parseCpfCnpj(body.cpfCnpj)

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, email, full_name, asaas_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) throw profileError

    const email = profile?.email || user.email
    if (!email) throw unprocessable('E-mail do usuário não encontrado.')

    const customer = await findOrCreateCustomer({
      asaasCustomerId: profile?.asaas_customer_id,
      name: profile?.full_name || email,
      email,
      cpfCnpj,
      mobilePhone: body.mobilePhone,
      externalReference: user.id,
    })

    if (!customer.cpfCnpj) {
      throw badRequest('Informe o CPF ou CNPJ para concluir a assinatura.')
    }

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

    // Cancelamento agendado: a assinatura do Asaas já foi removida (PUT nela
    // falharia), mas o período pago segue valendo. Assinar de novo dentro dele
    // cria uma assinatura nova com a 1ª cobrança no fim do período — o usuário
    // não paga duas vezes pelo mesmo intervalo e não perde acesso no meio.
    const scheduledCancel = !!current?.cancel_at_period_end
    const resumeWithinPeriod =
      scheduledCancel &&
      ['active', 'trial'].includes(current!.status) &&
      !!current!.current_period_end &&
      new Date(current!.current_period_end).getTime() > Date.now()

    const isPaidActive = !!current?.asaas_subscription_id && !scheduledCancel
    const reuseCurrentRow = isPaidActive || resumeWithinPeriod

    if (isSamePlan && current?.status === 'active' && !scheduledCancel) {
      throw conflict('Você já possui este plano ativo.')
    }

    const cycle = toAsaasCycle(billingCycle)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const periodEnd = resumeWithinPeriod ? new Date(current!.current_period_end) : null
    const nextDueDate = toIsoDate(periodEnd ? (periodEnd > tomorrow ? periodEnd : tomorrow) : new Date())
    const externalReference = `orbi:${user.id}:${plan.id}:${billingCycle}`

    let asaasSubscription: AsaasSubscription

    if (isPaidActive) {
      // Upgrade/downgrade: reaproveita a assinatura do Asaas, sincroniza valor e ciclo
      asaasSubscription = await asaasFetch<AsaasSubscription>(
        `/subscriptions/${asaasId(current!.asaas_subscription_id, 'subscription')}`,
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
      .filter((s) => !(reuseCurrentRow && s.id === current!.id))
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

    if (reuseCurrentRow) {
      // Upgrade sobre plano já pago (ou retomada dentro do período): mantém
      // acesso, ajusta o plano imediatamente e desfaz o cancelamento agendado.
      const { data, error } = await supabase
        .from('user_subscriptions')
        .update({
          ...basePayload,
          status: current!.status === 'past_due' ? 'past_due' : current!.status,
          cancel_at_period_end: false,
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
      `/subscriptions/${asaasId(asaasSubscription.id, 'subscription')}/payments?limit=1`,
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
      subscription: toPublicSubscription(subscriptionRow),
      payment: toPublicPayment(payment),
      upgraded: reuseCurrentRow,
    })
  } catch (error) {
    return gateFailure(req, error, 'asaas-create-payment', true)
  }
})
