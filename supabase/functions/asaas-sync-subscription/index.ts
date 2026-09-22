import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { preflight, jsonFor } from '../_shared/cors.ts'
import { adminClient, userClient } from '../_shared/auth.ts'
import { gateUser, gateFailure } from '../_shared/gate.ts'
import { forbidden } from '../_shared/errors.ts'
import { AsaasPayment, AsaasSubscription, addCycle, asaasFetch, asaasId } from '../_shared/asaas.ts'
import { gatewayIdSchema, parseJson, z } from '../_shared/validation.ts'

const GRACE_DAYS = Math.min(Math.max(Number(Deno.env.get('ASAAS_GRACE_DAYS') ?? '3') || 3, 0), 30)
const MAX_BODY_BYTES = 256

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  try {
    const user = await gateUser(req, {
      bucket: 'asaas-sync-subscription',
      ipLimit: 400,
      userLimit: 240,
      windowSeconds: 3600,
      strict: false,
      maxBodyBytes: MAX_BODY_BYTES,
    })
    const body = await parseJson(
      req,
      z.object({ paymentId: gatewayIdSchema.optional() }).strict(),
      { maxBytes: MAX_BODY_BYTES, allowEmpty: true },
    )
    const supabase = adminClient()
    const asUser = userClient(req)

    const { data: sub, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'trial', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    // Cancelamento agendado: a assinatura já foi removida no Asaas de propósito.
    // Reconciliar agora leria INACTIVE/404 e cortaria o período já pago — o fim
    // do acesso é decidido pela RPC em current_period_end.
    if (!sub?.asaas_subscription_id || sub.cancel_at_period_end) {
      const { data: status } = await asUser.rpc('get_my_subscription_status')
      return jsonFor(req, { success: true, synced: false, payment_confirmed: false, status })
    }

    const subscriptionId = asaasId(sub.asaas_subscription_id, 'subscription')
    const remote = await asaasFetch<AsaasSubscription>(`/subscriptions/${subscriptionId}`)
    const payments = await asaasFetch<{ data: AsaasPayment[] }>(
      `/subscriptions/${subscriptionId}/payments?limit=10`,
    )

    let requestedPayment: AsaasPayment | null = null
    if (body.paymentId) {
      requestedPayment =
        (payments?.data ?? []).find((payment) => payment.id === body.paymentId) ??
        await asaasFetch<AsaasPayment>(`/payments/${asaasId(body.paymentId, 'payment')}`)

      if (requestedPayment.subscription !== subscriptionId || requestedPayment.customer !== sub.asaas_customer_id) {
        throw forbidden('Cobrança não pertence a esta assinatura.')
      }
    }

    const isSettled = (payment: AsaasPayment) =>
      ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(payment.status)

    // Reconciliar a cobrança mais recente evita que um pagamento antigo já
    // liquidado reative uma assinatura cuja cobrança atual ainda está pendente
    // ou vencida. Quando o front informa paymentId, o alvo é exatamente a
    // cobrança aberta pelo checkout.
    const paymentToReconcile =
      requestedPayment ??
      [...(payments?.data ?? [])].sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1))[0]
    const settled = paymentToReconcile && isSettled(paymentToReconcile) ? paymentToReconcile : undefined
    const overdue = paymentToReconcile?.status === 'OVERDUE' ? paymentToReconcile : undefined

    const patch: Record<string, unknown> = {
      next_due_date: remote.nextDueDate ?? sub.next_due_date,
      updated_at: new Date().toISOString(),
    }

    if (remote.deleted || remote.status === 'INACTIVE' || remote.status === 'EXPIRED') {
      patch.status = 'canceled'
      patch.blocked_reason = 'Assinatura inativa no gateway'
    } else if (settled) {
      const paidAt = settled.paymentDate ?? settled.confirmedDate ?? settled.dueDate
      const periodStart = new Date(paidAt)
      patch.status = 'active'
      patch.current_period_start = periodStart.toISOString()
      patch.current_period_end = addCycle(periodStart, sub.billing_cycle).toISOString()
      patch.last_payment_at = periodStart.toISOString()
      patch.grace_period_end = null
      patch.blocked_reason = null
    } else if (overdue) {
      const graceEnd = new Date(`${overdue.dueDate}T00:00:00Z`)
      graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS)
      patch.status = 'past_due'
      patch.grace_period_end = graceEnd.toISOString()
      patch.blocked_reason = 'Pagamento em atraso'
    }

    await supabase.from('user_subscriptions').update(patch).eq('id', sub.id)

    const { data: status } = await asUser.rpc('get_my_subscription_status')
    return jsonFor(req, {
      success: true,
      synced: true,
      payment_confirmed: body.paymentId ? !!settled : undefined,
      status,
    })
  } catch (error) {
    return gateFailure(req, error, 'asaas-sync-subscription', true)
  }
})
