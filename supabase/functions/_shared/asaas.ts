import { HttpError } from './errors.ts'

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

const ASAAS_ID = /^[A-Za-z0-9_-]{1,64}$/
const ASAAS_TIMEOUT_MS = 20_000

export class AsaasError extends HttpError {
  readonly upstreamStatus: number

  constructor(upstreamStatus: number, publicMessage: string, internal: string) {
    const status = upstreamStatus === 400 || upstreamStatus === 422 ? 422 : 502
    super(status, publicMessage, { code: status === 422 ? 'GATEWAY_REJECTED' : 'GATEWAY_UNAVAILABLE', internal })
    this.upstreamStatus = upstreamStatus
  }
}

function apiKey(): string {
  const key = Deno.env.get('ASAAS_API_KEY')
  if (!key) {
    throw new HttpError(503, 'Pagamentos indisponíveis no momento.', { internal: 'ASAAS_API_KEY ausente' })
  }
  return key
}

export function asaasId(value: unknown, label = 'id'): string {
  if (typeof value !== 'string' || !ASAAS_ID.test(value)) {
    throw new HttpError(500, 'Erro interno do servidor.', { internal: `identificador Asaas inválido (${label})` })
  }
  return value
}

function publicGatewayMessage(parsed: any): string {
  const descriptions: string[] = Array.isArray(parsed?.errors)
    ? parsed.errors
        .map((e: any) => (typeof e?.description === 'string' ? e.description : ''))
        .filter(Boolean)
    : []
  const text = descriptions.join(' ').replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 300) : 'Os dados enviados foram recusados pelo gateway de pagamento.'
}

export async function asaasFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = init.method ?? 'GET'
  let res: Response

  try {
    res = await fetch(`${ASAAS_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey(),
        'User-Agent': 'sistema-orbi',
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(ASAAS_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new AsaasError(0, 'Gateway de pagamento indisponível.', `Asaas ${method} ${path}: ${(error as Error)?.name}`)
  }

  const text = await res.text()
  let parsed: any = null
  try { parsed = text ? JSON.parse(text) : null } catch { parsed = null }

  if (!res.ok) {
    const detail = parsed?.errors?.map((e: any) => e?.description).join('; ') || text.slice(0, 500)
    throw new AsaasError(
      res.status,
      res.status === 400 || res.status === 422 ? publicGatewayMessage(parsed) : 'Gateway de pagamento indisponível.',
      `Asaas ${method} ${path} falhou (${res.status}): ${detail}`,
    )
  }

  return parsed as T
}

export function isAsaasNotFound(error: unknown): boolean {
  return error instanceof AsaasError && error.upstreamStatus === 404
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
    throw new HttpError(400, 'CPF ou CNPJ inválido.')
  }
  return d
}

/**
 * Garante que o customer tenha documento. Sem isso o Asaas responde
 * 400 "é necessário preencher o CPF ou CNPJ do cliente" no POST /subscriptions.
 */
async function ensureCustomerDocument(customer: AsaasCustomer, cpfCnpj?: string): Promise<AsaasCustomer> {
  if (!cpfCnpj || normalizeCpfCnpj(customer.cpfCnpj) === cpfCnpj) return customer
  return await asaasFetch<AsaasCustomer>(`/customers/${asaasId(customer.id, 'customer')}`, {
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
      const found = await asaasFetch<AsaasCustomer>(`/customers/${asaasId(params.asaasCustomerId, 'customer')}`)
      if (!found.deleted) return await ensureCustomerDocument(found, cpfCnpj)
    } catch (error) {
      // customer removido no Asaas (404): recria abaixo. Outros erros sobem.
      if (!isAsaasNotFound(error)) throw error
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
