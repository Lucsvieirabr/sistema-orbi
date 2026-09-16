import { z, type ZodErrorMap, type ZodTypeAny } from 'https://deno.land/x/zod@v3.23.8/mod.ts'
import { HttpError } from './errors.ts'
import { isValidCpfCnpj, normalizeCpfCnpj } from './asaas.ts'

export { z }

export const DEFAULT_MAX_JSON_BYTES = 64 * 1024

const CONTROL_ALL = new RegExp('[\\u0000-\\u001F\\u007F]', 'g')
const CONTROL_EXCEPT_BREAKS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g')
const ZERO_WIDTH = new RegExp('[\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]', 'g')

export function stripControl(value: string): string {
  return value.replace(CONTROL_ALL, ' ').replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim()
}

export function stripControlMultiline(value: string): string {
  return value.replace(CONTROL_EXCEPT_BREAKS, '').replace(ZERO_WIDTH, '').trim()
}

export const singleLine = (max: number) =>
  z.string().max(max * 4).transform(stripControl).pipe(z.string().max(max, `Máximo de ${max} caracteres.`))

export const requiredLine = (max: number, label: string) =>
  singleLine(max).pipe(z.string().min(1, `${label} é obrigatório.`))

export const multiLine = (max: number) =>
  z.string().max(max * 4).transform(stripControlMultiline).pipe(z.string().max(max, `Máximo de ${max} caracteres.`))

export const uuidSchema = z.string().uuid('Identificador inválido.')

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Data inválida.')

const digits = (v: string) => v.replace(/\D/g, '')

// Mantém as letras do CNPJ alfanumérico e valida dígito verificador.
// Mesma regra de `isValidCpfCnpj` (asaas.ts) e de `src/lib/validation/schemas.ts`.
export const cpfCnpjSchema = z
  .string()
  .max(32, 'CPF/CNPJ inválido.')
  .transform((v) => normalizeCpfCnpj(v) ?? '')
  .refine((v) => isValidCpfCnpj(v), 'CPF/CNPJ inválido.')

export const mobilePhoneSchema = z
  .string()
  .max(32, 'Telefone inválido.')
  .transform(digits)
  .refine((v) => v.length >= 10 && v.length <= 13, 'Telefone inválido.')

export const gatewayIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Identificador inválido.')

const safeErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case 'invalid_type':
      return { message: issue.received === 'undefined' ? 'Campo obrigatório.' : 'Tipo inválido.' }
    case 'invalid_enum_value':
    case 'invalid_literal':
    case 'invalid_union':
    case 'invalid_union_discriminator':
      return { message: 'Valor não permitido.' }
    case 'unrecognized_keys':
      return { message: 'Payload contém campos não permitidos.' }
    case 'invalid_string':
      return { message: 'Formato inválido.' }
    default:
      return { message: ctx.defaultError }
  }
}

export function validate<T extends ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value, { errorMap: safeErrorMap })
  if (result.success) return result.data

  const issues = result.error.issues.slice(0, 10).map((issue) => ({
    path: issue.path.map(String).join('.').slice(0, 120),
    message: issue.message,
  }))

  throw new HttpError(400, issues[0]?.message ?? 'Payload inválido.', {
    code: 'INVALID_PAYLOAD',
    details: { issues },
  })
}

export interface ReadJsonOptions {
  maxBytes?: number
  allowEmpty?: boolean
}

export async function readBodyBytes(req: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, `Payload excede ${Math.floor(maxBytes / 1024)}KB.`)
  }
  if (!req.body) return new Uint8Array(0)

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new HttpError(413, `Payload excede ${Math.floor(maxBytes / 1024)}KB.`)
    }
    chunks.push(value)
  }

  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export function assertJsonContentType(req: Request): void {
  const contentType = (req.headers.get('content-type') ?? '').toLowerCase()
  if (!contentType) return
  if (!/^application\/(?:[a-z0-9.+-]+\+)?json\s*(?:;|$)/.test(contentType)) {
    throw new HttpError(415, 'Content-Type deve ser application/json.')
  }
}

export async function parseJson<T extends ZodTypeAny>(
  req: Request,
  schema: T,
  options: ReadJsonOptions = {},
): Promise<z.infer<T>> {
  assertJsonContentType(req)

  const bytes = await readBodyBytes(req, options.maxBytes ?? DEFAULT_MAX_JSON_BYTES)
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).trim()

  if (!text) {
    if (options.allowEmpty) return validate(schema, {})
    throw new HttpError(400, 'Payload vazio.', { code: 'INVALID_PAYLOAD' })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new HttpError(400, 'JSON malformado.', { code: 'INVALID_JSON' })
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'Payload deve ser um objeto JSON.', { code: 'INVALID_PAYLOAD' })
  }

  return validate(schema, parsed)
}

export function safeHttpsUrl(value: unknown, allowedHostSuffixes: string[]): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  const allowed = allowedHostSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
  return allowed ? url.toString() : null
}
