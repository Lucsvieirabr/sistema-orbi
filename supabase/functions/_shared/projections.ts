import { safeHttpsUrl } from './validation.ts'

export const PAYMENT_URL_HOSTS = ['asaas.com']

export const PUBLIC_SUBSCRIPTION_FIELDS = [
  'id',
  'plan_id',
  'status',
  'billing_cycle',
  'current_period_start',
  'current_period_end',
  'next_due_date',
  'trial_start',
  'trial_end',
  'grace_period_end',
  'cancel_at_period_end',
  'blocked_reason',
  'created_at',
  'updated_at',
] as const

export type PublicSubscription = Partial<Record<(typeof PUBLIC_SUBSCRIPTION_FIELDS)[number], unknown>>

export function pick<T extends Record<string, unknown>, K extends string>(
  row: T | null | undefined,
  fields: readonly K[],
): Partial<Record<K, unknown>> | null {
  if (!row) return null
  const out: Partial<Record<K, unknown>> = {}
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(row, field)) out[field] = row[field]
  }
  return out
}

export function toPublicSubscription(row: Record<string, unknown> | null | undefined): PublicSubscription | null {
  return pick(row, PUBLIC_SUBSCRIPTION_FIELDS)
}

export interface PublicPayment {
  id: string
  url: string | null
  value: number
  dueDate: string | null
  billingType: string | null
}

export function toPublicPayment(
  payment: { id: string; invoiceUrl?: string; value?: number; dueDate?: string; billingType?: string } | null,
): PublicPayment | null {
  if (!payment) return null
  return {
    id: payment.id,
    url: safeHttpsUrl(payment.invoiceUrl, PAYMENT_URL_HOSTS),
    value: Number(payment.value ?? 0),
    dueDate: payment.dueDate ?? null,
    billingType: payment.billingType ?? null,
  }
}
