import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { adminClient, requireUser, errorStatus } from '../_shared/auth.ts'
import { findOrCreateCustomer, onlyDigits } from '../_shared/asaas.ts'

interface Body {
  cpfCnpj?: string
  mobilePhone?: string
  fullName?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = await requireUser(req)
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
      cpfCnpj: onlyDigits(body.cpfCnpj),
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

    return jsonResponse({ success: true, customer_id: customer.id })
  } catch (error) {
    console.error('asaas-create-customer:', error)
    return jsonResponse({ success: false, error: (error as Error).message }, errorStatus(error))
  }
})
