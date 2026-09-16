-- ============================================================================
-- CANCELAMENTO NO FIM DO PERÍODO (cancel_at_period_end)
-- ============================================================================
-- Contexto: a tela Configurações → Assinatura passou a cancelar pela Edge
-- Function asaas-manage-subscription. Com período pago em curso, ela grava
-- `cancel_at_period_end = true`, mantém `status = 'active'` e remove a
-- assinatura no Asaas (sem novas cobranças).
--
-- Sem esta migration, quando o período termina:
--   1. get_my_subscription_status tratava a linha como renovação atrasada:
--      5 dias de `past_due_grace` e depois `expired` → access = 'blocked' →
--      /billing com "Assinatura irregular". Quem cancelou não é inadimplente;
--      o destino correto é access = 'no_plan' → /pricing.
--   2. orbi_active_plan_limits / orbi_active_plan_features (usadas pelos
--      triggers de cota) continuavam liberando os limites do plano pago para
--      sempre, porque só olham `status IN ('trial','active')`.
--
-- Esta migration só ACRESCENTA a regra do cancelamento agendado; o restante
-- da lógica é idêntico à versão vigente (20260909140000 e 20260910120001).
-- Idempotente.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) RPC autoritativa de status
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_subscription_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_sub         record;
  v_effective   text;
  v_now         timestamptz := NOW();
  v_grace       timestamptz;
  v_default_gap interval := INTERVAL '5 days';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('access', 'unauthenticated', 'status', NULL, 'has_subscription', false);
  END IF;

  SELECT us.*, sp.slug AS plan_slug, sp.name AS plan_name,
         sp.features, sp.limits, sp.price_monthly, sp.price_yearly
  INTO v_sub
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status <> 'canceled'
    -- Cancelamento agendado cujo período já acabou não é mais "a assinatura".
    AND NOT (
      COALESCE(us.cancel_at_period_end, false)
      AND us.status IN ('active', 'trial')
      AND us.current_period_end IS NOT NULL
      AND us.current_period_end < v_now
    )
  ORDER BY
    CASE us.status
      WHEN 'active'   THEN 1
      WHEN 'trial'    THEN 2
      WHEN 'past_due' THEN 3
      WHEN 'pending'  THEN 4
      ELSE 5
    END,
    us.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('access', 'no_plan', 'status', NULL, 'has_subscription', false);
  END IF;

  v_effective := v_sub.status;
  v_grace := COALESCE(v_sub.grace_period_end, v_sub.current_period_end + v_default_gap);

  IF v_effective IN ('active', 'trial')
     AND v_sub.current_period_end IS NOT NULL
     AND v_sub.current_period_end < v_now
  THEN
    v_effective := CASE WHEN v_grace >= v_now THEN 'past_due_grace' ELSE 'expired' END;
  END IF;

  IF v_effective = 'past_due'
     AND v_sub.grace_period_end IS NOT NULL
     AND v_sub.grace_period_end >= v_now
  THEN
    v_effective := 'past_due_grace';
  END IF;

  RETURN jsonb_build_object(
    'access', CASE
      WHEN v_effective IN ('active', 'trial', 'past_due_grace') THEN 'allowed'
      WHEN v_effective IN ('past_due', 'expired') THEN 'blocked'
      WHEN v_effective = 'pending' THEN 'pending_payment'
      ELSE 'no_plan'
    END,
    'has_subscription', true,
    'subscription_id', v_sub.id,
    'status', v_effective,
    'raw_status', v_sub.status,
    'plan_id', v_sub.plan_id,
    'plan_slug', v_sub.plan_slug,
    'plan_name', v_sub.plan_name,
    'billing_cycle', v_sub.billing_cycle,
    'features', COALESCE(v_sub.features, '{}'::jsonb),
    'limits', COALESCE(v_sub.limits, '{}'::jsonb),
    'current_period_end', v_sub.current_period_end,
    'grace_period_end', v_sub.grace_period_end,
    'next_due_date', v_sub.next_due_date,
    'trial_end', v_sub.trial_end,
    'blocked_reason', v_sub.blocked_reason,
    'cancel_at_period_end', COALESCE(v_sub.cancel_at_period_end, false)
  );
END;
$$;

COMMENT ON FUNCTION public.get_my_subscription_status() IS
  'Fonte da verdade do status de assinatura. Carência de 5 dias para renovação; cancelamento agendado encerra em current_period_end (no_plan).';

REVOKE ALL ON FUNCTION public.get_my_subscription_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_subscription_status() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2) Plano vigente para os triggers de cota
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orbi_active_plan_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sp.limits, '{}'::jsonb)
    FROM public.user_subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
   WHERE s.user_id = p_user_id
     AND s.status IN ('trial', 'active')
     AND NOT (
       COALESCE(s.cancel_at_period_end, false)
       AND s.current_period_end IS NOT NULL
       AND s.current_period_end < NOW()
     )
   ORDER BY s.created_at DESC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.orbi_active_plan_features(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sp.features, '{}'::jsonb)
    FROM public.user_subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
   WHERE s.user_id = p_user_id
     AND s.status IN ('trial', 'active')
     AND NOT (
       COALESCE(s.cancel_at_period_end, false)
       AND s.current_period_end IS NOT NULL
       AND s.current_period_end < NOW()
     )
   ORDER BY s.created_at DESC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.orbi_active_plan_limits(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.orbi_active_plan_features(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
