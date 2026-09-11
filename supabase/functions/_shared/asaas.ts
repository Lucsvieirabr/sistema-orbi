export const ASAAS_BASE_URL = Deno.env.get('ASAAS_SANDBOX') === 'true'
  ? 'https://api-sandbox.asaas.com/v3'
  : 'https://api.asaas.com/v3'

export type AsaasCycle = 'MONTHLY' | 'YEARLY'

export interface AsaasCustomer {
  id: string
  name: string
  email: string
  cpfCnpj?: string
}

export interface AsaasSubscription {
  id: string
  customer: string
  value: number
  cycle: string
  status: string
  nextDueDate: string
  billingType: string
  externalReference?: string
  /** true depois de DELETE /subscriptions/:id — o Asaas mantém o registro. */
  deleted?: boolean
}

export interface AsaasPayment {
  id: string
  customer: string
  subscription?: string
  value: number
  netValue?: number
  status: string
  billingType: string
  dueDate: string
  paymentDate?: string
  confirmedDate?: string
  clientPaymentDate?: string
  invoiceUrl?: string
  bankSlipUrl?: string
  transactionReceiptUrl?: string
  externalReference?: string
}

function apiKey(): string {
  const key = Deno.env.get('ASAAS_API_KEY')
  if (!key) throw new Error('ASAAS_API_KEY não configurada')
  return key
}

export async function asaasFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey(),
      'User-Agent': 'sistema-orbi',
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

  const text = await res.text()
  let parsed: any = null
  try { parsed = text ? JSON.parse(text) : null } catch { parsed = { raw: text } }

  if (!res.ok) {
    const detail = parsed?.errors?.map((e: any) => e.description).join('; ') || text
    throw new Error(`Asaas ${init.method ?? 'GET'} ${path} falhou (${res.status}): ${detail}`)
  }

  return parsed as T
}

/** Recurso já removido no Asaas: em cancelamento, é o estado desejado, não erro. */
export function isAsaasNotFound(error: unknown): boolean {
  return /falhou \(404\)/.test((error as Error)?.message ?? '')
}

export function toAsaasCycle(billingCycle: string): AsaasCycle {
  return billingCycle === 'yearly' || billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY'
}

export function normalizeBillingCycle(billingCycle: string): 'monthly' | 'yearly' {
  return billingCycle === 'yearly' || billingCycle === 'annual' ? 'yearly' : 'monthly'
}

export function addCycle(from: Date, billingCycle: string): Date {
  const d = new Date(from)
  if (normalizeBillingCycle(billingCycle) === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function onlyDigits(v?: string | null): string | undefined {
  if (!v) return undefined
  const digits = v.replace(/\D/g, '')
  return digits.length ? digits : undefined
}

export async function findOrCreateCustomer(params: {
  asaasCustomerId?: string | null
  name: string
  email: string
  cpfCnpj?: string
  mobilePhone?: string
  externalReference: string
}): Promise<AsaasCustomer> {
  if (params.asaasCustomerId) {
    try {
      return await asaasFetch<AsaasCustomer>(`/customers/${params.asaasCustomerId}`)
    } catch (_) {
      // customer removido no Asaas: recria abaixo
    }
  }

  const existing = await asaasFetch<{ data: AsaasCustomer[] }>(
    `/customers?email=${encodeURIComponent(params.email)}&limit=1`,
  )
  if (existing?.data?.length) return existing.data[0]

  return await asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: {
      name: params.name,
      email: params.email,
      cpfCnpj: onlyDigits(params.cpfCnpj),
      mobilePhone: onlyDigits(params.mobilePhone),
      externalReference: params.externalReference,
      notificationDisabled: false,
    },
  })
}
