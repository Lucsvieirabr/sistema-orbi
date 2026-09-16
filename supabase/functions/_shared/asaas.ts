export const ASAAS_BASE_URL = Deno.env.get('ASAAS_SANDBOX') === 'true'
  ? 'https://api-sandbox.asaas.com/v3'
  : 'https://api.asaas.com/v3'

export type AsaasCycle = 'MONTHLY' | 'YEARLY'

export interface AsaasCustomer {
  id: string
  name: string
  email: string
  cpfCnpj?: string
  deleted?: boolean
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

/** "123.456.789-09" -> "12345678909". Mantém letras do CNPJ alfanumérico. */
export function normalizeCpfCnpj(v?: string | null): string | undefined {
  if (!v) return undefined
  const clean = v.toUpperCase().replace(/[^0-9A-Z]/g, '')
  return clean.length ? clean : undefined
}

function isValidCpf(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false
  const dv = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

function isValidCnpj(d: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(d) || /^(.)\1{13}$/.test(d)) return false
  const dv = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((acc, w, i) => acc + (d.charCodeAt(i) - 48) * w, 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13])
}

/** Espelho de `src/lib/validation/schemas.ts` — o backend nunca confia no cliente. */
export function isValidCpfCnpj(v?: string | null): boolean {
  const d = normalizeCpfCnpj(v)
  if (!d) return false
  return d.length === 11 ? isValidCpf(d) : d.length === 14 ? isValidCnpj(d) : false
}

/** Normaliza e valida; lança 400 com mensagem legível se vier malformado. */
export function parseCpfCnpj(v?: string | null): string | undefined {
  const d = normalizeCpfCnpj(v)
  if (!d) return undefined
  if (!isValidCpfCnpj(d)) {
    throw Object.assign(new Error('CPF ou CNPJ inválido'), { status: 400 })
  }
  return d
}

/**
 * Garante que o customer tenha documento. Sem isso o Asaas responde
 * 400 "é necessário preencher o CPF ou CNPJ do cliente" no POST /subscriptions.
 */
async function ensureCustomerDocument(customer: AsaasCustomer, cpfCnpj?: string): Promise<AsaasCustomer> {
  if (!cpfCnpj || normalizeCpfCnpj(customer.cpfCnpj) === cpfCnpj) return customer
  return await asaasFetch<AsaasCustomer>(`/customers/${customer.id}`, {
    method: 'PUT',
    body: { cpfCnpj },
  })
}

export async function findOrCreateCustomer(params: {
  asaasCustomerId?: string | null
  name: string
  email: string
  cpfCnpj?: string
  mobilePhone?: string
  externalReference: string
}): Promise<AsaasCustomer> {
  const cpfCnpj = normalizeCpfCnpj(params.cpfCnpj)

  if (params.asaasCustomerId) {
    try {
      const found = await asaasFetch<AsaasCustomer>(`/customers/${params.asaasCustomerId}`)
      if (!found.deleted) return await ensureCustomerDocument(found, cpfCnpj)
    } catch (_) {
      // customer removido no Asaas: recria abaixo
    }
  }

  const existing = await asaasFetch<{ data: AsaasCustomer[] }>(
    `/customers?email=${encodeURIComponent(params.email)}&limit=1`,
  )
  if (existing?.data?.length) return await ensureCustomerDocument(existing.data[0], cpfCnpj)

  return await asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: {
      name: params.name,
      email: params.email,
      cpfCnpj,
      mobilePhone: onlyDigits(params.mobilePhone),
      externalReference: params.externalReference,
      notificationDisabled: false,
    },
  })
}
