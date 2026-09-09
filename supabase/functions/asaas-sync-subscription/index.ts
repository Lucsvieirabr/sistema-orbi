import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { preflight, jsonFor } from '../_shared/cors.ts'
import { adminClient, userClient, requireUser, errorStatus } from '../_shared/auth.ts'
import { AsaasPayment, AsaasSubscription, addCycle, asaasFetch } from '../_shared/asaas.ts'

const GRACE_DAYS = Number(Deno.env.get('ASAAS_GRACE_DAYS') ?? '3')

// Reconciliação sob demanda: usada no login para não depender exclusivamente
// da entrega do webhook. O Asaas continua sendo a fonte da verdade.
serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  try {
    const user = await requireUser(req)
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

    if (!sub?.asaas_subscription_id) {
      const { data: status } = await asUser.rpc('get_my_subscription_status')
      return jsonFor(req, { success: true, synced: false, status })
    }

    const remote = await asaasFetch<AsaasSubscription>(`/subscriptions/${sub.asaas_subscription_id}`)
    const payments = await asaasFetch<{ data: AsaasPayment[] }>(
      `/subscriptions/${sub.asaas_subscription_id}/payments?limit=10`,
    )

    const settled = (payments?.data ?? [])
      .filter((p) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status))
      .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1))[0]

    const overdue = (payments?.data ?? []).find((p) => p.status === 'OVERDUE')

    const patch: Record<string, unknown> = {
      next_due_date: remote.nextDueDate ?? sub.next_due_date,
      updated_at: new Date().toISOString(),
    }

    if (remote.status === 'INACTIVE' || remote.status === 'EXPIRED') {
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
    return jsonFor(req, { success: true, synced: true, status })
  } catch (error) {
    console.error('asaas-sync-subscription:', error)
    return jsonFor(req, { success: false, error: (error as Error).message }, errorStatus(error))
  }
})
