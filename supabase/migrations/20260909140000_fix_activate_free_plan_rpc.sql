-- ============================================================================
-- FIX PGRST202: public.activate_free_plan(p_plan_id) ausente do schema cache
-- ============================================================================
-- Diagnóstico (confirmado ao rodar em produção):
--   1. A migration 20260908000000_asaas_security_hardening.sql NUNCA foi
--      aplicada no banco de produção. Logo, nem `activate_free_plan(uuid)` nem
--      `get_my_subscription_status()` existem lá — o PostgREST não acha a
--      função no schema cache e devolve PGRST202 ao cliente.
--   2. Em ambientes onde a hardening FOI aplicada, a 20260909000000 (§9) fez
--        REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC/anon
--      reconcedendo EXECUTE apenas para 4 RPCs de séries. Função sem EXECUTE
--      some do schema cache do PostgREST — mesmo PGRST202, outra causa.
--
-- Este script é AUTOSSUFICIENTE e IDEMPOTENTE: cria as colunas de cobrança,
-- (re)cria as duas RPCs com assinatura canônica, reconcede EXECUTE e recarrega
-- o schema cache. Pode ser executado com ou sem a 20260908000000 aplicada.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0) Pré-requisitos de schema (vindos da 20260908000000, que pode não ter sido
--    aplicada). get_my_subscription_status referencia estas colunas.
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS last_payment_at  timestamptz,
  ADD COLUMN IF NOT EXISTS next_due_date    date,
  ADD COLUMN IF NOT EXISTS blocked_reason   text;

-- ----------------------------------------------------------------------------
-- 1) Assinatura única e canônica para activate_free_plan
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.activate_free_plan(text);
DROP FUNCTION IF EXISTS public.activate_free_plan(uuid, text);
DROP FUNCTION IF EXISTS public.activate_free_plan();

CREATE OR REPLACE FUNCTION public.activate_free_plan(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_plan     record;
  v_current  record;
  v_sub_id   uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'p_plan_id é obrigatório' USING ERRCODE = '22004';
  END IF;

  SELECT sp.* INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.id = p_plan_id
    AND COALESCE(sp.is_active, true) = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado ou inativo' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_plan.price_monthly, 0) > 0 OR COALESCE(v_plan.price_yearly, 0) > 0 THEN
    RAISE EXCEPTION 'Plano pago exige checkout no gateway de pagamento'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotência: assinatura vigente DESTE plano não é recriada.
  SELECT us.* INTO v_current
  FROM public.user_subscriptions us
  WHERE us.user_id = v_user_id
    AND us.plan_id = p_plan_id
    AND us.status IN ('trial', 'active')
    AND (us.current_period_end IS NULL OR us.current_period_end >= NOW())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_active', true,
      'subscription_id', v_current.id,
      'plan_id', p_plan_id,
      'status', v_current.status
    );
  END IF;

  BEGIN
    -- Caminho sancionado do guard_subscription_writes() (no-op se o trigger
    -- ainda não existir neste banco).
    PERFORM set_config('app.bypass_subscription_guard', 'on', true);

    UPDATE public.user_subscriptions
    SET status               = 'canceled',
        cancel_at_period_end = false,
        updated_at           = NOW()
    WHERE user_id = v_user_id
      AND status IN ('pending', 'trial', 'active', 'past_due');

    INSERT INTO public.user_subscriptions (
      user_id, plan_id, status, billing_cycle,
      current_period_start, current_period_end,
      grace_period_end, blocked_reason, cancel_at_period_end
    ) VALUES (
      v_user_id, p_plan_id, 'active', 'yearly',
      NOW(), NOW() + INTERVAL '1 year',
      NULL, NULL, false
    )
    RETURNING id INTO v_sub_id;

    PERFORM set_config('app.bypass_subscription_guard', 'off', true);
  EXCEPTION WHEN OTHERS THEN
    -- Nunca deixar o bypass ligado pendurado na transação do cliente
    PERFORM set_config('app.bypass_subscription_guard', 'off', true);
    RAISE;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'already_active', false,
    'subscription_id', v_sub_id,
    'plan_id', p_plan_id,
    'plan_slug', v_plan.slug,
    'status', 'active'
  );
END;
$$;

COMMENT ON FUNCTION public.activate_free_plan(uuid) IS
  'Ativa plano gratuito validando price=0 no servidor. Idempotente. Assinatura canônica: (p_plan_id uuid).';

-- ----------------------------------------------------------------------------
-- 2) RPC autoritativa de status — fonte da verdade dos guards de rota
-- ----------------------------------------------------------------------------
-- Correção do bloqueio de contas Pro: antes, `active` com current_period_end no
-- passado virava `expired` (access='blocked') no mesmo instante, mesmo com a
-- renovação do Asaas ainda em processamento. Agora há carência padrão de 5 dias.
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
  'Fonte da verdade do status de assinatura para guards de UI e roteamento. Carência de 5 dias antes de expirar.';

-- ----------------------------------------------------------------------------
-- 3) Privilégios — sem EXECUTE a função some do schema cache do PostgREST
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.activate_free_plan(uuid)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_subscription_status()    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.activate_free_plan(uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_subscription_status() TO authenticated, service_role;

-- Opcional: só concede se a função existir neste banco (vem da 20260908000000).
DO $$
BEGIN
  IF to_regprocedure('public.user_active_plan_limits(uuid)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.user_active_plan_limits(uuid) TO authenticated, service_role';
  END IF;
END;
$$;

COMMIT;

-- ============================================================================
-- RECARGA DO SCHEMA CACHE DO POSTGREST (obrigatório após mudar assinatura/GRANT)
-- Diretiva canônica: NOTIFY pgrst, reload_schema  →  sintaxe SQL válida abaixo.
-- ============================================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
