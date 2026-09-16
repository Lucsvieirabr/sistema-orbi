import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { adminClient } from '../_shared/auth.ts'
import { addCycle } from '../_shared/asaas.ts'
import { SECURITY_HEADERS } from '../_shared/cors.ts'
import { HttpError } from '../_shared/errors.ts'
import {
  RateLimitError,
  assertNotLockedOut,
  clientIp,
  consumeRateLimit,
  enforceIpRateLimit,
  normalizeIp,
  rateLimitHeaders,
} from '../_shared/ratelimit.ts'
import { gatewayIdSchema, parseJson, z } from '../_shared/validation.ts'

const GRACE_DAYS = Math.min(Math.max(Number(Deno.env.get('ASAAS_GRACE_DAYS') ?? '3') || 3, 0), 30)
const MAX_BODY_BYTES = 256 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AUTH_FAILURE_RULE = { bucket: 'asaas-webhook-auth-fail', limit: 10, windowSeconds: 900, failOpen: true }

const looseString = (max: number) => z.string().max(max).nullish()
const looseNumber = z.number().finite().nullish()

const paymentSchema = z
  .object({
    id: gatewayIdSchema,
    customer: gatewayIdSchema.nullish(),
    subscription: gatewayIdSchema.nullish(),
    status: looseString(40),
    billingType: looseString(40),
    value: looseNumber,
    netValue: looseNumber,
    dueDate: looseString(40),
    paymentDate: looseString(40),
    confirmedDate: looseString(40),
    clientPaymentDate: looseString(40),
    invoiceUrl: looseString(2048),
    bankSlipUrl: looseString(2048),
    transactionReceiptUrl: looseString(2048),
    externalReference: looseString(200),
  })
  .passthrough()

const subscriptionSchema = z
  .object({
    id: gatewayIdSchema,
    customer: gatewayIdSchema.nullish(),
    status: looseString(40),
    nextDueDate: looseString(40),
    externalReference: looseString(200),
  })
  .passthrough()

const webhookSchema = z
  .object({
    id: z.string().max(128).nullish(),
    event: z.string().min(1).max(64).regex(/^[A-Z0-9_]+$/),
    dateCreated: looseString(40),
    payment: paymentSchema.nullish(),
    subscription: subscriptionSchema.nullish(),
  })
  .passthrough()

type WebhookPayload = z.infer<typeof webhookSchema>

function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  let diff = ab.length ^ bb.length
  const len = Math.max(ab.length, bb.length)
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
  return diff === 0
}

function jsonOk(body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS, ...extra },
  })
}

function ipAllowlist(): string[] {
  return (Deno.env.get('ASAAS_WEBHOOK_ALLOWED_IPS') ?? '')
    .split(',')
    .map((ip) => normalizeIp(ip))
    .filter((ip): ip is string => !!ip)
}

function tooMany(err: RateLimitError) {
  return jsonOk({ error: 'Too Many Requests' }, 429, rateLimitHeaders(err.retryAfter))
}

serve(async (req) => {
  if (req.method !== 'POST') return jsonOk({ error: 'Method not allowed' }, 405, { Allow: 'POST' })

  const declared = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonOk({ error: 'Payload too large' }, 413)
  }

  const ip = clientIp(req)
  const allowlist = ipAllowlist()
  if (allowlist.length && !allowlist.includes(ip)) {
    console.warn('webhook de IP fora da allowlist:', ip)
    return jsonOk({ error: 'Forbidden' }, 403)
  }

  try {
    await enforceIpRateLimit(req, 'asaas-webhook', 600, 300, true)
    await assertNotLockedOut(`ip:${ip}`, AUTH_FAILURE_RULE)
  } catch (err) {
    if (err instanceof RateLimitError) return tooMany(err)
    console.error('Falha no pré-gate do webhook:', (err as Error)?.message)
    return jsonOk({ error: 'Service unavailable' }, 503)
  }

  const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? ''
  if (!expectedToken) {
    console.error('ASAAS_WEBHOOK_TOKEN ausente — webhook rejeitado')
    return jsonOk({ error: 'Unauthorized' }, 401)
  }
  if (expectedToken.length < 32) {
    console.warn('ASAAS_WEBHOOK_TOKEN com menos de 32 caracteres: rotacionar.')
  }

  const receivedToken = req.headers.get('asaas-access-token') ?? ''

  if (!timingSafeEqual(receivedToken, expectedToken)) {
    console.warn('Token de webhook inválido. IP:', ip)
    await consumeRateLimit(`ip:${ip}`, AUTH_FAILURE_RULE).catch(() => undefined)
    return jsonOk({ error: 'Unauthorized' }, 401)
  }

  let payload: WebhookPayload
  try {
    payload = await parseJson(req, webhookSchema, { maxBytes: MAX_BODY_BYTES })
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400
    console.warn('Payload de webhook rejeitado:', status, (err as HttpError)?.details ?? '')
    return jsonOk({ error: status === 413 ? 'Payload too large' : 'Invalid payload' }, status === 413 || status === 415 ? status : 400)
  }

  const supabase = adminClient()
  const payment = payload.payment ?? null
  const subscription = payload.subscription ?? null

  const eventId = (
    payload.id ??
    `${payload.event}:${payment?.id ?? subscription?.id ?? 'unknown'}:${payment?.status ?? subscription?.status ?? ''}`
  ).slice(0, 200)

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
      .update({ process_error: String((error as Error)?.message ?? error).slice(0, 1000) })
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

  const externalReference = payment?.externalReference ?? subscription?.externalReference ?? undefined
  const referencedUser = externalReference?.startsWith('orbi:')
    ? externalReference.split(':')[1]
    : undefined
  const userId = referencedUser && UUID_RE.test(referencedUser) ? referencedUser : undefined

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
