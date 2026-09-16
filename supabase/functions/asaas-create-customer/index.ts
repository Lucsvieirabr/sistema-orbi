import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { preflight, jsonFor } from '../_shared/cors.ts'
import { adminClient, requireUser, errorStatus } from '../_shared/auth.ts'
import { gateUser, gateFailure } from '../_shared/gate.ts'
import { findOrCreateCustomer, onlyDigits, parseCpfCnpj } from '../_shared/asaas.ts'

interface Body {
  cpfCnpj?: string
  mobilePhone?: string
  fullName?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  try {
    // [GATE] metodo -> origem -> rate limit por IP -> JWT -> cota do usuario.
    // cria cliente no gateway: 10/h por usuario cobre retentativa de checkout e barra a criacao em massa de customers.
    const user = await gateUser(req, {
      bucket: 'asaas-create-customer',
      ipLimit: 30,
      userLimit: 10,
      windowSeconds: 3600,
      strict: true,
    })
    const supabase = adminClient()
    const body: Body = await req.json().catch(() => ({}))

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, email, full_name, asaas_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) throw profileError

    const email = profile?.email || user.email
    if (!email) throw new Error('E-mail do usuário não encontrado')

    const customer = await findOrCreateCustomer({
      asaasCustomerId: profile?.asaas_customer_id,
      name: body.fullName || profile?.full_name || email,
      email,
      cpfCnpj: parseCpfCnpj(body.cpfCnpj),
      mobilePhone: onlyDigits(body.mobilePhone),
      externalReference: user.id,
    })

    if (customer.id !== profile?.asaas_customer_id) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ asaas_customer_id: customer.id })
        .eq('user_id', user.id)

      if (updateError) throw updateError
    }

    return jsonFor(req, { success: true, customer_id: customer.id })
  } catch (error) {
    return gateFailure(req, error, 'asaas-create-customer', true)
  }
})
