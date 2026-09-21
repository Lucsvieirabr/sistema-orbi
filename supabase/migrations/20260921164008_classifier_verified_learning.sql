BEGIN;

-- Learn only from a persisted, owned transaction. Direction is part of the
-- key so an incoming/outgoing PIX with the same description cannot overwrite
-- the other example. No speculative labels or imported history are promoted.
CREATE OR REPLACE FUNCTION public.learn_transaction_classification(p_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user_id uuid := auth.uid();
  v_transaction record;
  v_description text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.orbi_require_mfa_session();

  SELECT t.description, t.type, t.category_id, c.name AS category
    INTO v_transaction
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
   WHERE t.id = p_transaction_id AND t.user_id = v_user_id
     AND t.type IN ('income', 'expense') AND t.type = c.category_type
     AND (c.user_id = v_user_id OR (c.is_system = true AND c.user_id IS NULL));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento ou categoria inválida para aprendizado.' USING ERRCODE = '42501';
  END IF;

  v_description := btrim(regexp_replace(v_transaction.description, '[[:cntrl:]]', ' ', 'g'));
  IF v_description IS NULL OR length(v_description) < 2 OR length(v_description) > 300 THEN
    RAISE EXCEPTION 'Descrição inválida para aprendizado.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_learned_patterns AS learned (
    user_id, description, normalized_description, category, subcategory,
    confidence, usage_count, last_used_at, is_active, source_type, metadata
  ) VALUES (
    v_user_id, v_description,
    'v3:' || v_transaction.type || ':' || md5(lower(regexp_replace(v_description, '\s+', ' ', 'g'))),
    v_transaction.category, NULL, 90, 1, clock_timestamp(), true, 'user_correction',
    jsonb_build_object('transaction_type', v_transaction.type, 'category_id', v_transaction.category_id,
                      'last_transaction_id', p_transaction_id)
  )
  ON CONFLICT (user_id, normalized_description) DO UPDATE SET
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    subcategory = NULL,
    -- Changing the label resets confidence; repeating a request is idempotent.
    confidence = CASE WHEN learned.category = EXCLUDED.category THEN learned.confidence ELSE 90 END,
    usage_count = CASE
      WHEN learned.metadata->>'last_transaction_id' = p_transaction_id::text THEN learned.usage_count
      ELSE LEAST(learned.usage_count + 1, 1000000) END,
    last_used_at = EXCLUDED.last_used_at,
    is_active = true,
    source_type = 'user_correction',
    metadata = EXCLUDED.metadata;
END;
$fn$;

REVOKE ALL ON FUNCTION public.learn_transaction_classification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.learn_transaction_classification(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.learn_transaction_classification(uuid) IS
  'Aprende uma correção explícita a partir de um lançamento salvo do próprio usuário, isolando receita/despesa.';

-- Matches the active/recent, paginated classifier read without scanning disabled rules.
CREATE INDEX IF NOT EXISTS user_learned_patterns_active_recent_idx
  ON public.user_learned_patterns (user_id, last_used_at DESC, id) WHERE is_active = true;

COMMIT;
