-- ============================================================================
-- HARDENING DA INTEGRAÇÃO ASAAS + BLINDAGEM DE ASSINATURAS
-- ============================================================================
-- 1. Remove capacidade do cliente de criar/alterar assinaturas (bypass de pagamento)
-- 2. Ledger de idempotência para webhooks do Asaas
-- 3. RPC autoritativa de status de plano (fonte da verdade para guards)
-- 4. Ativação de plano gratuito server-side validada
-- ============================================================================

-- ============================================================================
-- 1. REVOGAR ESCRITA DIRETA EM user_subscriptions
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Usuários podem criar suas próprias assinaturas" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias assinaturas" ON public.user_subscriptions;

REVOKE INSERT, UPDATE, DELETE ON public.user_subscriptions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_subscriptions FROM anon;
GRANT SELECT ON public.user_subscriptions TO authenticated;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.payment_history FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_history FROM anon;
GRANT SELECT ON public.payment_history TO authenticated;

DROP POLICY IF EXISTS "Usuários veem seu próprio histórico de pagamentos" ON public.payment_history;
CREATE POLICY "Usuários veem seu próprio histórico de pagamentos"
  ON public.payment_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Defesa em profundidade: mesmo que uma policy futura reabra escrita,
-- só service_role (Edge Functions / webhook) pode mutar assinatura.
CREATE OR REPLACE FUNCTION public.guard_subscription_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caminhos sancionados: RPCs SECURITY DEFINER e painel administrativo.
  IF COALESCE(current_setting('app.bypass_subscription_guard', true), 'off') = 'on'
     OR public.is_admin()
  THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF COALESCE(
       NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
       ''
     ) = 'authenticated'
  THEN
    RAISE EXCEPTION 'Assinaturas só podem ser alteradas pelo backend de pagamentos';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_user_subscriptions_writes ON public.user_subscriptions;
CREATE TRIGGER guard_user_subscriptions_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_subscription_writes();

-- ============================================================================
-- 2. COLUNAS DE CONTROLE DE COBRANÇA
-- ============================================================================

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_due_date date,
  ADD COLUMN IF NOT EXISTS blocked_reason text;

-- Índices totais (NULLs são distintos no Postgres) para permitir inferência
-- de ON CONFLICT nos upserts do webhook.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_asaas_subscription
  ON public.user_subscriptions(asaas_subscription_id);

-- Deduplicar cobranças antes de aplicar a constraint
DELETE FROM public.payment_history a
USING public.payment_history b
WHERE a.asaas_payment_id IS NOT NULL
  AND a.asaas_payment_id = b.asaas_payment_id
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_history_asaas_payment
  ON public.payment_history(asaas_payment_id);

-- ============================================================================
-- 3. LEDGER DE IDEMPOTÊNCIA DE WEBHOOKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id text PRIMARY KEY,
  event text NOT NULL,
  asaas_payment_id text,
  asaas_subscription_id text,
  asaas_customer_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  process_error text,
  received_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_event ON public.asaas_webhook_events(event);
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_payment ON public.asaas_webhook_events(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_received ON public.asaas_webhook_events(received_at);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Apenas admins veem eventos de webhook" ON public.asaas_webhook_events;
CREATE POLICY "Apenas admins veem eventos de webhook"
  ON public.asaas_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.asaas_webhook_events FROM anon, authenticated;
GRANT SELECT ON public.asaas_webhook_events TO authenticated;

-- ============================================================================
-- 4. RPC AUTORITATIVA DE STATUS (fonte da verdade dos guards)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_subscription_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sub record;
  v_effective text;
  v_now timestamptz := NOW();
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
  ORDER BY
    CASE us.status
      WHEN 'active' THEN 1
      WHEN 'trial' THEN 2
      WHEN 'past_due' THEN 3
      WHEN 'pending' THEN 4
      ELSE 5
    END,
    us.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('access', 'no_plan', 'status', NULL, 'has_subscription', false);
  END IF;

  v_effective := v_sub.status;

  -- Expiração real avaliada no servidor, nunca no cliente
  IF v_effective IN ('active', 'trial')
     AND v_sub.current_period_end IS NOT NULL
     AND v_sub.current_period_end < v_now
     AND COALESCE(v_sub.grace_period_end, v_sub.current_period_end) < v_now
  THEN
    v_effective := 'expired';
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

REVOKE ALL ON FUNCTION public.get_my_subscription_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_subscription_status() TO authenticated;

-- ============================================================================
-- 5. ATIVAÇÃO DE PLANO GRATUITO (validada server-side)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activate_free_plan(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan record;
  v_sub_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = p_plan_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado ou inativo';
  END IF;

  IF COALESCE(v_plan.price_monthly, 0) > 0 OR COALESCE(v_plan.price_yearly, 0) > 0 THEN
    RAISE EXCEPTION 'Plano pago exige checkout no gateway de pagamento';
  END IF;

  PERFORM set_config('app.bypass_subscription_guard', 'on', true);

  UPDATE public.user_subscriptions
  SET status = 'canceled', cancel_at_period_end = false, updated_at = NOW()
  WHERE user_id = v_user_id
    AND status IN ('pending', 'trial', 'active', 'past_due');

  INSERT INTO public.user_subscriptions (
    user_id, plan_id, status, billing_cycle,
    current_period_start, current_period_end
  ) VALUES (
    v_user_id, p_plan_id, 'active', 'yearly',
    NOW(), NOW() + INTERVAL '1 year'
  )
  RETURNING id INTO v_sub_id;

  PERFORM set_config('app.bypass_subscription_guard', 'off', true);

  RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id);
END;
$$;

REVOKE ALL ON FUNCTION public.activate_free_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_free_plan(uuid) TO authenticated;

-- ============================================================================
-- 6. RPC REMOVIDA: initiate_payment expunha dados sem necessidade
-- ============================================================================

DROP FUNCTION IF EXISTS public.initiate_payment(uuid, text);

-- ============================================================================
-- 7. TRIGGERS DE LIMITE: bloquear inadimplente sem quebrar carência
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_active_plan_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.limits
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND (
      us.status IN ('trial', 'active')
      OR (us.status = 'past_due' AND us.grace_period_end IS NOT NULL AND us.grace_period_end >= NOW())
    )
  ORDER BY us.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.user_active_plan_limits(uuid) TO authenticated, service_role;

COMMENT ON TABLE public.asaas_webhook_events IS 'Ledger de idempotência dos webhooks do Asaas (PK = event id do Asaas)';
COMMENT ON FUNCTION public.get_my_subscription_status() IS 'Fonte da verdade do status de assinatura para guards de UI e roteamento';
COMMENT ON FUNCTION public.activate_free_plan(uuid) IS 'Ativa plano gratuito validando price=0 no servidor';
