import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { preflight, jsonFor } from '../_shared/cors.ts'
import { adminClient, requireUser, errorStatus } from '../_shared/auth.ts'
import { gateUser, gateFailure } from '../_shared/gate.ts'
import { AsaasPayment, asaasFetch } from '../_shared/asaas.ts'

interface Body {
  action: 'cancel' | 'reactivate' | 'invoice'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  try {
    // [GATE] metodo -> origem -> rate limit por IP -> JWT -> cota do usuario.
    // cancelar/reativar/2a via: 20/h. strict, porque muda estado de assinatura.
    const user = await gateUser(req, {
      bucket: 'asaas-manage-subscription',
      ipLimit: 40,
      userLimit: 20,
      windowSeconds: 3600,
      strict: true,
    })
    const supabase = adminClient()
    const body: Body = await req.json()

    const { data: sub, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'trial', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!sub) throw new Error('Nenhuma assinatura encontrada')

    if (body.action === 'cancel') {
      if (sub.asaas_subscription_id) {
        await asaasFetch(`/subscriptions/${sub.asaas_subscription_id}`, { method: 'DELETE' })
      }

      const { data, error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          cancel_at_period_end: true,
          blocked_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id)
        .select()
        .single()

      if (updateError) throw updateError
      return jsonFor(req, { success: true, subscription: data })
    }

    if (body.action === 'invoice') {
      if (!sub.asaas_subscription_id) throw new Error('Assinatura sem cobrança no gateway')

      const payments = await asaasFetch<{ data: AsaasPayment[] }>(
        `/subscriptions/${sub.asaas_subscription_id}/payments?status=PENDING&limit=1`,
      )
      let payment = payments?.data?.[0] ?? null

      if (!payment) {
        const overdue = await asaasFetch<{ data: AsaasPayment[] }>(
          `/subscriptions/${sub.asaas_subscription_id}/payments?status=OVERDUE&limit=1`,
        )
        payment = overdue?.data?.[0] ?? null
      }

      if (!payment) throw new Error('Nenhuma cobrança em aberto')

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

      return jsonFor(req, {
        success: true,
        payment: {
          id: payment.id,
          url: payment.invoiceUrl,
          value: payment.value,
          dueDate: payment.dueDate,
          billingType: payment.billingType,
        },
      })
    }

    throw new Error('Ação inválida')
  } catch (error) {
    return gateFailure(req, error, 'asaas-manage-subscription', true)
  }
})
