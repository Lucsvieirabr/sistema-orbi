import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { preflight, jsonFor } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'
import { gateUser, gateFailure } from '../_shared/gate.ts'
import { unprocessable } from '../_shared/errors.ts'
import { findOrCreateCustomer, parseCpfCnpj } from '../_shared/asaas.ts'
import { cpfCnpjSchema, mobilePhoneSchema, parseJson, singleLine, z } from '../_shared/validation.ts'

const MAX_BODY_BYTES = 4 * 1024

const bodySchema = z
  .object({
    cpfCnpj: cpfCnpjSchema.optional(),
    mobilePhone: mobilePhoneSchema.optional(),
    fullName: singleLine(120).optional(),
  })
  .strict()

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  try {
    const user = await gateUser(req, {
      bucket: 'asaas-create-customer',
      ipLimit: 30,
      userLimit: 10,
      windowSeconds: 3600,
      strict: true,
      maxBodyBytes: MAX_BODY_BYTES,
    })
    const body = await parseJson(req, bodySchema, { maxBytes: MAX_BODY_BYTES, allowEmpty: true })
    const supabase = adminClient()

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, email, full_name, asaas_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) throw profileError

    const email = profile?.email || user.email
    if (!email) throw unprocessable('E-mail do usuário não encontrado.')

    const customer = await findOrCreateCustomer({
      asaasCustomerId: profile?.asaas_customer_id,
      name: body.fullName || profile?.full_name || email,
      email,
      cpfCnpj: parseCpfCnpj(body.cpfCnpj),
      mobilePhone: body.mobilePhone,
      externalReference: user.id,
    })

    if (customer.id !== profile?.asaas_customer_id) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ asaas_customer_id: customer.id })
        .eq('user_id', user.id)

      if (updateError) throw updateError
    }

    return jsonFor(req, { success: true })
  } catch (error) {
    return gateFailure(req, error, 'asaas-create-customer', true)
  }
})
