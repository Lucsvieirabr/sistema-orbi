import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { jsonFor, preflight } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'
import { gateFailure, gateUser } from '../_shared/gate.ts'
import { badRequest } from '../_shared/errors.ts'
import { toPublicPayment, toPublicSubscription } from '../_shared/projections.ts'
import { parseJson, z } from '../_shared/validation.ts'
import {
  AsaasPayment,
  AsaasSubscription,
  asaasFetch,
  asaasId,
  isAsaasNotFound,
  normalizeBillingCycle,
  toAsaasCycle,
  toIsoDate,
} from '../_shared/asaas.ts'

const MAX_BODY_BYTES = 1024

const bodySchema = z.object({ action: z.enum(['cancel', 'reactivate', 'invoice']) }).strict()

function periodIsOpen(sub: { current_period_end?: string | null }): boolean {
  return !!sub.current_period_end && new Date(sub.current_period_end).getTime() > Date.now()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  try {
    const user = await gateUser(req, {
      bucket: 'asaas-manage-subscription',
      ipLimit: 40,
      userLimit: 20,
      windowSeconds: 3600,
      strict: true,
      maxBodyBytes: MAX_BODY_BYTES,
    })
    const body = await parseJson(req, bodySchema, { maxBytes: MAX_BODY_BYTES })
    const supabase = adminClient()

    const { data: sub, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'trial', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!sub) throw badRequest('Nenhuma assinatura encontrada')

    // ------------------------------------------------------------------------
    // CANCELAR
    // ------------------------------------------------------------------------
    // Duas saídas, decididas aqui e nunca pelo cliente:
    //   * período pago em curso (active/trial) → cancel_at_period_end. O acesso
    //     segue até current_period_end e a RPC get_my_subscription_status
    //     devolve no_plan depois dessa data;
    //   * nada pago a preservar (pending, past_due, período vencido) → encerra
    //     na hora (status = canceled).
    //
    // Ordem: banco ANTES do Asaas. O DELETE dispara SUBSCRIPTION_DELETED no
    // webhook; se ele chegasse antes da marca cancel_at_period_end, o handler
    // cortaria um período já pago. Falha no Asaas desfaz a marca.
    if (body.action === 'cancel') {
      if (sub.cancel_at_period_end) {
        return jsonFor(req, {
          success: true,
          immediate: false,
          access_until: sub.current_period_end,
          subscription: toPublicSubscription(sub),
        })
      }

      if (!sub.asaas_subscription_id) {
        throw badRequest('Este plano não tem cobrança recorrente para cancelar')
      }

      const immediate =
        sub.status === 'pending' || sub.status === 'past_due' || !periodIsOpen(sub)
      const now = new Date().toISOString()

      const previous = {
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        next_due_date: sub.next_due_date,
        grace_period_end: sub.grace_period_end,
        blocked_reason: sub.blocked_reason,
      }

      const patch = immediate
        ? {
            status: 'canceled',
            cancel_at_period_end: false,
            next_due_date: null,
            grace_period_end: null,
            blocked_reason: 'Cancelada pelo usuário',
            updated_at: now,
          }
        : {
            cancel_at_period_end: true,
            next_due_date: null,
            blocked_reason: null,
            updated_at: now,
          }

      const { data: updated, error: updateError } = await supabase
        .from('user_subscriptions')
        .update(patch)
        .eq('id', sub.id)
        .select()
        .single()

      if (updateError) throw updateError

      try {
        await asaasFetch(`/subscriptions/${asaasId(sub.asaas_subscription_id, 'subscription')}`, { method: 'DELETE' })
      } catch (asaasError) {
        if (!isAsaasNotFound(asaasError)) {
          await supabase
            .from('user_subscriptions')
            .update({ ...previous, updated_at: new Date().toISOString() })
            .eq('id', sub.id)
          throw asaasError
        }
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: immediate ? 'subscription_canceled' : 'subscription_cancel_scheduled',
        entity_type: 'user_subscriptions',
        entity_id: sub.id,
        metadata: { asaas_subscription_id: sub.asaas_subscription_id, access_until: sub.current_period_end },
      }).then(() => undefined, () => undefined)

      return jsonFor(req, {
        success: true,
        immediate,
        access_until: immediate ? null : sub.current_period_end,
        subscription: toPublicSubscription(updated),
      })
    }

    // ------------------------------------------------------------------------
    // RETOMAR (desfaz cancelamento agendado)
    // ------------------------------------------------------------------------
    // A assinatura antiga foi removida no Asaas; cria-se uma nova para o mesmo
    // plano com a primeira cobrança no fim do período já pago. Nada é cobrado
    // antes disso. Falha ao gravar no banco remove a assinatura recém-criada.
    if (body.action === 'reactivate') {
      if (!sub.cancel_at_period_end || !['active', 'trial'].includes(sub.status) || !periodIsOpen(sub)) {
        throw badRequest('Não há cancelamento agendado para retomar')
      }

      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', sub.plan_id)
        .maybeSingle()

      if (planError) throw planError
      if (!plan || !plan.is_active) {
        throw badRequest('Este plano não está mais disponível. Escolha um plano na página de planos.')
      }

      const billingCycle = normalizeBillingCycle(sub.billing_cycle)
      const amount = Number(billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly)
      if (!(amount > 0)) throw badRequest('Plano gratuito não tem renovação para retomar')

      let customerId: string | null = sub.asaas_customer_id ?? null
      if (!customerId) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('asaas_customer_id')
          .eq('user_id', user.id)
          .maybeSingle()
        customerId = profile?.asaas_customer_id ?? null
      }
      if (!customerId) {
        throw badRequest('Cliente não encontrado no gateway. Escolha o plano novamente na página de planos.')
      }

      const firstDue = new Date(sub.current_period_end)
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const nextDueDate = toIsoDate(firstDue > tomorrow ? firstDue : tomorrow)

      const created = await asaasFetch<AsaasSubscription>('/subscriptions', {
        method: 'POST',
        body: {
          customer: asaasId(customerId, 'customer'),
          billingType: 'UNDEFINED',
          value: amount,
          nextDueDate,
          cycle: toAsaasCycle(billingCycle),
          description: `Orbi - ${plan.name}`,
          externalReference: `orbi:${user.id}:${plan.id}:${billingCycle}`,
        },
      })

      const { data: resumed, error: resumeError } = await supabase
        .from('user_subscriptions')
        .update({
          asaas_subscription_id: created.id,
          asaas_customer_id: customerId,
          cancel_at_period_end: false,
          next_due_date: created.nextDueDate ?? nextDueDate,
          blocked_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id)
        .select()
        .single()

      if (resumeError) {
        await asaasFetch(`/subscriptions/${asaasId(created.id, 'subscription')}`, { method: 'DELETE' }).catch(() => undefined)
        throw resumeError
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'subscription_reactivated',
        entity_type: 'user_subscriptions',
        entity_id: sub.id,
        metadata: { asaas_subscription_id: created.id, next_due_date: nextDueDate },
      }).then(() => undefined, () => undefined)

      return jsonFor(req, { success: true, subscription: toPublicSubscription(resumed) })
    }

    // ------------------------------------------------------------------------
    // SEGUNDA VIA
    // ------------------------------------------------------------------------
    if (body.action === 'invoice') {
      if (!sub.asaas_subscription_id) throw badRequest('Assinatura sem cobrança no gateway')

      const subscriptionId = asaasId(sub.asaas_subscription_id, 'subscription')
      const payments = await asaasFetch<{ data: AsaasPayment[] }>(
        `/subscriptions/${subscriptionId}/payments?status=PENDING&limit=1`,
      )
      let payment = payments?.data?.[0] ?? null

      if (!payment) {
        const overdue = await asaasFetch<{ data: AsaasPayment[] }>(
          `/subscriptions/${subscriptionId}/payments?status=OVERDUE&limit=1`,
        )
        payment = overdue?.data?.[0] ?? null
      }

      if (!payment) throw badRequest('Nenhuma cobrança em aberto')

      await supabase.from('payment_history').upsert(
        {
          user_id: user.id,
          subscription_id: sub.id,
          amount: Number(payment.value ?? 0),
          currency: 'BRL',
          status: payment.status === 'OVERDUE' ? 'failed' : 'pending',
          payment_method: payment.billingType,
          asaas_payment_id: payment.id,
          asaas_invoice_url: payment.invoiceUrl,
          invoice_url: payment.invoiceUrl,
          bank_slip_url: payment.bankSlipUrl,
          due_date: payment.dueDate,
        },
        { onConflict: 'asaas_payment_id' },
      )

      return jsonFor(req, { success: true, payment: toPublicPayment(payment) })
    }

    throw badRequest('Ação inválida')
  } catch (error) {
    return gateFailure(req, error, 'asaas-manage-subscription', true)
  }
})
