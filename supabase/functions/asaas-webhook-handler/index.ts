import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { adminClient } from '../_shared/auth.ts'
import { addCycle } from '../_shared/asaas.ts'
import { RateLimitError, enforceIpRateLimit, rateLimitHeaders } from '../_shared/ratelimit.ts'

const GRACE_DAYS = Number(Deno.env.get('ASAAS_GRACE_DAYS') ?? '3')

interface WebhookPayload {
  id?: string
  event: string
  dateCreated?: string
  payment?: Record<string, any>
  subscription?: Record<string, any>
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

function jsonOk(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

serve(async (req) => {
  if (req.method !== 'POST') return jsonOk({ error: 'Method not allowed' }, 405)

  // ---- Rate limit por IP: este endpoint é público por definição. -----------
  // verify_jwt = false, então antes disto qualquer um na internet pagava zero
  // para forçar, a cada requisição, uma comparação de token e um INSERT no
  // ledger de idempotência. 600 eventos / 5 min por IP acomoda um lote real do
  // Asaas e fecha a porta ao flood e ao brute-force do webhook token.
  // Fail-OPEN de propósito: contador indisponível não pode travar a baixa de
  // pagamento (o Asaas reentrega, mas atrasar cobrança é pior que o flood).
  try {
    await enforceIpRateLimit(req, 'asaas-webhook', 600, 300, true)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(err.retryAfter) },
      })
    }
    throw err
  }

  // ---- Autenticação: fail-closed. Sem token configurado, nada é aceito. ----
  const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')
  if (!expectedToken) {
    console.error('ASAAS_WEBHOOK_TOKEN não configurada — webhook rejeitado')
    return jsonOk({ error: 'Webhook not configured' }, 401)
  }

  const receivedToken =
    req.headers.get('asaas-access-token') ?? req.headers.get('Asaas-Access-Token') ?? ''

  if (!timingSafeEqual(receivedToken, expectedToken)) {
    console.error('Token de webhook inválido')
    return jsonOk({ error: 'Unauthorized' }, 401)
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return jsonOk({ error: 'Invalid payload' }, 400)
  }

  if (!payload?.event) return jsonOk({ error: 'Missing event' }, 400)

  const supabase = adminClient()
  const payment = payload.payment ?? null
  const subscription = payload.subscription ?? null

  const eventId =
    payload.id ??
    `${payload.event}:${payment?.id ?? subscription?.id ?? 'unknown'}:${payment?.status ?? subscription?.status ?? ''}`

  // ---- Idempotência: PK colide em reentrega, evento é ignorado. ----
  const { error: ledgerError } = await supabase.from('asaas_webhook_events').insert({
    id: eventId,
    event: payload.event,
    asaas_payment_id: payment?.id ?? null,
    asaas_subscription_id: subscription?.id ?? payment?.subscription ?? null,
    asaas_customer_id: payment?.customer ?? subscription?.customer ?? null,
    payload: payload as unknown as Record<string, unknown>,
  })

  if (ledgerError) {
    if (ledgerError.code === '23505') {
      return jsonOk({ received: true, duplicate: true })
    }
    console.error('Falha ao registrar evento:', ledgerError)
    return jsonOk({ error: 'Ledger failure' }, 500)
  }

  try {
    switch (payload.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_RECEIVED_IN_CASH':
        await handlePaymentSettled(supabase, payload)
        break

      case 'PAYMENT_CREATED':
      case 'PAYMENT_UPDATED':
        await handlePaymentPending(supabase, payload)
        break

      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(supabase, payload)
        break

      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
      case 'PAYMENT_REVERSED':
        await handlePaymentRevoked(supabase, payload)
        break

      case 'SUBSCRIPTION_DELETED':
      case 'SUBSCRIPTION_INACTIVATED':
        await handleSubscriptionCanceled(supabase, payload)
        break

      case 'SUBSCRIPTION_CREATED':
      case 'SUBSCRIPTION_UPDATED':
        await handleSubscriptionSynced(supabase, payload)
        break

      default:
        console.log('Evento não tratado:', payload.event)
    }

    await supabase
      .from('asaas_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', eventId)
  } catch (error) {
    console.error('Erro ao processar webhook:', payload.event, error)
    await supabase
      .from('asaas_webhook_events')
      .update({ process_error: (error as Error).message })
      .eq('id', eventId)
    // 200: o evento está persistido no ledger e pode ser reprocessado
    // manualmente; devolver erro faria o Asaas entrar em retry infinito.
  }

  return jsonOk({ received: true })
})

// ============================================================================
// RESOLUÇÃO DE ASSINATURA
// ============================================================================

async function resolveSubscription(supabase: any, payload: WebhookPayload) {
  const payment = payload.payment
  const subscription = payload.subscription
  const asaasSubscriptionId = subscription?.id ?? payment?.subscription ?? null

  if (asaasSubscriptionId) {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('asaas_subscription_id', asaasSubscriptionId)
      .maybeSingle()
    if (data) return data
  }

  if (payment?.id) {
    const { data } = await supabase
      .from('payment_history')
      .select('subscription_id')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle()

    if (data?.subscription_id) {
      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('id', data.subscription_id)
        .maybeSingle()
      if (sub) return sub
    }
  }

  const externalReference: string | undefined =
    payment?.externalReference ?? subscription?.externalReference
  const userId = externalReference?.startsWith('orbi:')
    ? externalReference.split(':')[1]
    : undefined

  if (userId) {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'past_due', 'trial', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return data
  }

  const customerId = payment?.customer ?? subscription?.customer
  if (customerId) {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('asaas_customer_id', customerId)
      .in('status', ['pending', 'past_due', 'trial', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return data
  }

  return null
}

async function upsertPayment(
  supabase: any,
  sub: any,
  payment: Record<string, any>,
  status: string,
  paidAt: string | null,
) {
  await supabase.from('payment_history').upsert(
    {
      user_id: sub.user_id,
      subscription_id: sub.id,
      amount: Number(payment.value ?? 0),
      currency: 'BRL',
      status,
      payment_method: payment.billingType ?? null,
      asaas_payment_id: payment.id,
      asaas_invoice_url: payment.invoiceUrl ?? null,
      invoice_url: payment.invoiceUrl ?? null,
      bank_slip_url: payment.bankSlipUrl ?? null,
      due_date: payment.dueDate ?? null,
      paid_at: paidAt,
      metadata: {
        net_value: payment.netValue ?? null,
        asaas_subscription_id: payment.subscription ?? null,
        receipt_url: payment.transactionReceiptUrl ?? null,
      },
    },
    { onConflict: 'asaas_payment_id' },
  )
}

// ============================================================================
// HANDLERS (idempotentes: aplicam estado absoluto, nunca incrementos)
// ============================================================================

async function handlePaymentPending(supabase: any, payload: WebhookPayload) {
  const payment = payload.payment
  if (!payment?.id) return

  const sub = await resolveSubscription(supabase, payload)
  if (!sub) return

  await upsertPayment(supabase, sub, payment, 'pending', null)
}

async function handlePaymentSettled(supabase: any, payload: WebhookPayload) {
  const payment = payload.payment
  if (!payment?.id) return

  const sub = await resolveSubscription(supabase, payload)
  if (!sub) {
    throw new Error(`Assinatura não localizada para o pagamento ${payment.id}`)
  }

  const paidAt =
    payment.paymentDate ?? payment.confirmedDate ?? payment.clientPaymentDate ?? new Date().toISOString()

  await upsertPayment(supabase, sub, payment, 'confirmed', new Date(paidAt).toISOString())

  // Período calculado a partir da data de referência do pagamento, não do valor
  // atual da linha — reprocessar o mesmo evento produz exatamente o mesmo período.
  const periodStart = new Date(paidAt)
  const periodEnd = addCycle(periodStart, sub.billing_cycle)

  await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      grace_period_end: null,
      blocked_reason: null,
      last_payment_at: new Date(paidAt).toISOString(),
      next_due_date: payment.dueDate ?? null,
      asaas_subscription_id: sub.asaas_subscription_id ?? payment.subscription ?? null,
      asaas_customer_id: sub.asaas_customer_id ?? payment.customer ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id)
}

async function handlePaymentOverdue(supabase: any, payload: WebhookPayload) {
  const payment = payload.payment
  if (!payment?.id) return

  const sub = await resolveSubscription(supabase, payload)
  if (!sub) return

  await upsertPayment(supabase, sub, payment, 'failed', null)

  const graceEnd = new Date(payment.dueDate ? `${payment.dueDate}T00:00:00Z` : Date.now())
  graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS)

  await supabase
    .from('user_subscriptions')
    .update({
      status: 'past_due',
      grace_period_end: graceEnd.toISOString(),
      blocked_reason: 'Pagamento em atraso',
      next_due_date: payment.dueDate ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id)
}

async function handlePaymentRevoked(supabase: any, payload: WebhookPayload) {
  const payment = payload.payment
  if (!payment?.id) return

  const sub = await resolveSubscription(supabase, payload)
  const status = payload.event === 'PAYMENT_DELETED' ? 'canceled' : 'refunded'

  if (sub) {
    await upsertPayment(supabase, sub, payment, status, null)
  } else {
    await supabase
      .from('payment_history')
      .update({ status })
      .eq('asaas_payment_id', payment.id)
    return
  }

  // DELETE da assinatura no Asaas apaga as cobranças futuras dela: isso é o
  // cancelamento agendado seguindo seu curso, não perda do período já pago.
  if (payload.event === 'PAYMENT_DELETED' && isScheduledCancellation(sub)) return

  // Assinatura já encerrada não volta a existir como `expired`: isso a tiraria
  // do filtro `status <> 'canceled'` da RPC e mandaria o usuário para /billing.
  if (sub.status === 'canceled') return

  // Só revoga acesso se o pagamento revogado for o que sustenta o período atual.
  const { data: stillPaid } = await supabase
    .from('payment_history')
    .select('id')
    .eq('subscription_id', sub.id)
    .eq('status', 'confirmed')
    .limit(1)

  if (stillPaid?.length) return

  await supabase
    .from('user_subscriptions')
    .update({
      status: 'expired',
      grace_period_end: null,
      blocked_reason:
        payload.event === 'PAYMENT_DELETED' ? 'Cobrança removida' : 'Pagamento estornado',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id)
}

async function handleSubscriptionSynced(supabase: any, payload: WebhookPayload) {
  const subscription = payload.subscription
  if (!subscription?.id) return

  const sub = await resolveSubscription(supabase, payload)
  if (!sub) return

  // Evento tardio da assinatura removida no cancelamento agendado: não reescreve
  // a próxima cobrança que deixou de existir.
  if (isScheduledCancellation(sub) && sub.asaas_subscription_id === subscription.id) return

  await supabase
    .from('user_subscriptions')
    .update({
      asaas_subscription_id: subscription.id,
      next_due_date: subscription.nextDueDate ?? sub.next_due_date,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id)
}

/**
 * Cancelamento agendado pelo próprio usuário (asaas-manage-subscription grava
 * cancel_at_period_end ANTES do DELETE no Asaas): o período já pago é
 * preservado. A RPC get_my_subscription_status encerra o acesso na data.
 */
function isScheduledCancellation(sub: any): boolean {
  return (
    sub?.cancel_at_period_end === true &&
    ['active', 'trial'].includes(sub?.status) &&
    !!sub?.current_period_end &&
    new Date(sub.current_period_end).getTime() > Date.now()
  )
}

async function handleSubscriptionCanceled(supabase: any, payload: WebhookPayload) {
  const subscription = payload.subscription
  if (!subscription?.id) return

  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('asaas_subscription_id', subscription.id)
    .maybeSingle()

  if (!sub) return

  if (isScheduledCancellation(sub)) {
    await supabase
      .from('user_subscriptions')
      .update({ next_due_date: null, updated_at: new Date().toISOString() })
      .eq('id', sub.id)
    return
  }

  await supabase
    .from('user_subscriptions')
    .update({
      status: 'canceled',
      cancel_at_period_end: false,
      blocked_reason: 'Assinatura cancelada',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id)
}
