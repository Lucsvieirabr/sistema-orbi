-- ============================================================================
-- PLANO CASAL — edição mútua de transações + "Pagador" + divisão de gastos
-- ----------------------------------------------------------------------------
-- 1. `transactions.paid_by_user_id`: quem PAGOU (NULL = o próprio dono da
--    linha). Informativo p/ acertos de caixa e analytics — o saldo continua
--    sendo da conta/cartão da linha.
-- 2. Policy UPDATE aditiva: o parceiro vinculado (orbi_family_user_ids, que já
--    corta o grupo no downgrade do dono) pode EDITAR transações do outro.
--    INSERT e DELETE seguem restritos ao dono.
-- 3. Trigger de guarda: edição do parceiro só mexe em descrição, valor, data,
--    categoria, status e pagador. Dono, conta, cartão, pessoa, série, par de
--    rateio, evento e projeto são imutáveis para quem não é o dono.
-- 4. RPC `orbi_couple_expense_split(mês)`: quem gastou o quê no mês (DRE Casal).
-- ============================================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paid_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.transactions.paid_by_user_id IS
  'Plano Casal: quem pagou (NULL = dono da linha). Informativo; não entra no cálculo de saldo.';

CREATE INDEX IF NOT EXISTS idx_transactions_paid_by
  ON public.transactions (paid_by_user_id)
  WHERE paid_by_user_id IS NOT NULL;

-- ------------------------------------------------------------ GUARDA -------
CREATE OR REPLACE FUNCTION public.orbi_transactions_family_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok  boolean;
BEGIN
  -- service_role / cron / RPC DEFINER sem sessão: sem restrição extra.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Pagador: sempre alguém do grupo; o próprio dono normaliza para NULL.
  IF NEW.paid_by_user_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.paid_by_user_id IS DISTINCT FROM OLD.paid_by_user_id)
  THEN
    IF NEW.paid_by_user_id = NEW.user_id THEN
      NEW.paid_by_user_id := NULL;
    ELSIF NOT (NEW.paid_by_user_id = ANY (public.orbi_family_user_ids()))
       OR NOT (NEW.user_id = ANY (public.orbi_family_user_ids()))
    THEN
      RAISE EXCEPTION 'O pagador precisa fazer parte do seu Plano Casal.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP <> 'UPDATE' OR OLD.user_id = v_uid THEN
    RETURN NEW;
  END IF;

  -- A partir daqui: parceiro editando linha do outro.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'O dono da transação não pode ser alterado.' USING ERRCODE = '42501';
  END IF;

  IF NEW.account_id          IS DISTINCT FROM OLD.account_id
  OR NEW.credit_card_id      IS DISTINCT FROM OLD.credit_card_id
  OR NEW.person_id           IS DISTINCT FROM OLD.person_id
  OR NEW.series_id           IS DISTINCT FROM OLD.series_id
  OR NEW.linked_txn_id       IS DISTINCT FROM OLD.linked_txn_id
  OR NEW.ledger_id           IS DISTINCT FROM OLD.ledger_id
  OR NEW.project_id          IS DISTINCT FROM OLD.project_id
  OR NEW.type                IS DISTINCT FROM OLD.type
  OR NEW.payment_method      IS DISTINCT FROM OLD.payment_method
  OR NEW.is_shared           IS DISTINCT FROM OLD.is_shared
  OR NEW.is_fixed            IS DISTINCT FROM OLD.is_fixed
  OR NEW.compensation_value  IS DISTINCT FROM OLD.compensation_value
  OR NEW.installment_number  IS DISTINCT FROM OLD.installment_number
  OR NEW.composition_details IS DISTINCT FROM OLD.composition_details
  THEN
    RAISE EXCEPTION 'No modo Casal você pode ajustar descrição, valor, data, categoria, status e pagador. Conta, cartão, rateio e vínculos ficam com quem lançou.'
      USING ERRCODE = '42501';
  END IF;

  -- Categoria nova: do sistema ou do DONO da linha (nunca de terceiro).
  IF NEW.category_id IS NOT NULL AND NEW.category_id IS DISTINCT FROM OLD.category_id THEN
    SELECT (c.is_system OR c.user_id = OLD.user_id) INTO v_ok
      FROM public.categories c
     WHERE c.id = NEW.category_id;
    IF NOT COALESCE(v_ok, false) THEN
      RAISE EXCEPTION 'Use uma categoria do sistema ou de quem lançou a transação.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.orbi_transactions_family_guard() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS orbi_transactions_family_guard ON public.transactions;
CREATE TRIGGER orbi_transactions_family_guard
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.orbi_transactions_family_guard();

-- ------------------------------------------------ EDIÇÃO MÚTUA (ADITIVA) ---
DROP POLICY IF EXISTS "family_update_transactions" ON public.transactions;
CREATE POLICY "family_update_transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (user_id <> auth.uid() AND user_id = ANY (public.orbi_family_user_ids()))
  WITH CHECK (user_id = ANY (public.orbi_family_user_ids()));

-- ---------------------------------------------- DRE CASAL: QUEM GASTOU -----
-- Despesa líquida de rateio (value − compensation_value), não cancelada,
-- competência no mês, atribuída ao PAGADOR (fallback: dono da linha).
-- Linha B de rateio é income → fora por construção.
CREATE OR REPLACE FUNCTION public.orbi_couple_expense_split(
  p_month date,
  p_exclude_projects boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_ids   uuid[];
  v_start date;
  v_end   date;
  v_total numeric;
  v_people jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '42501';
  END IF;
  IF p_month IS NULL THEN
    RAISE EXCEPTION 'Mês obrigatório.' USING ERRCODE = '22023';
  END IF;

  PERFORM public.orbi_require_feature(v_uid, 'dre_pessoal', 'Fechamento do mês');

  v_ids := public.orbi_family_user_ids();
  IF COALESCE(array_length(v_ids, 1), 0) < 2 THEN
    RETURN jsonb_build_object('linked', false, 'total', 0, 'people', '[]'::jsonb);
  END IF;

  v_start := date_trunc('month', p_month)::date;
  v_end   := (date_trunc('month', p_month) + interval '1 month')::date;

  WITH dir AS (
    SELECT (e ->> 'user_id')::uuid AS uid,
           COALESCE((e ->> 'is_self')::boolean, false) AS is_self,
           e ->> 'name' AS name
      FROM jsonb_array_elements(public.orbi_family_directory()) e
  ),
  spend AS (
    SELECT CASE WHEN t.paid_by_user_id = ANY (v_ids) THEN t.paid_by_user_id ELSE t.user_id END AS uid,
           SUM(t.value - COALESCE(t.compensation_value, 0)) AS total,
           COUNT(*) AS n
      FROM public.transactions t
     WHERE t.user_id = ANY (v_ids)
       AND t.type = 'expense'
       AND t.status <> 'CANCELED'
       AND t.date >= v_start
       AND t.date <  v_end
       AND (NOT p_exclude_projects OR t.project_id IS NULL)
     GROUP BY 1
  ),
  joined AS (
    SELECT d.uid, d.is_self, d.name,
           ROUND(COALESCE(s.total, 0), 2) AS total,
           COALESCE(s.n, 0) AS n
      FROM dir d
      LEFT JOIN spend s ON s.uid = d.uid
  )
  SELECT COALESCE(SUM(GREATEST(total, 0)), 0),
         COALESCE(jsonb_agg(jsonb_build_object(
           'user_id', uid, 'is_self', is_self, 'name', name,
           'total', total, 'count', n
         ) ORDER BY is_self DESC, uid), '[]'::jsonb)
    INTO v_total, v_people
    FROM joined;

  RETURN jsonb_build_object(
    'linked', true,
    'month', v_start,
    'total', ROUND(v_total, 2),
    'people', v_people
  );
END;
$$;

REVOKE ALL ON FUNCTION public.orbi_couple_expense_split(date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_couple_expense_split(date, boolean) TO authenticated;
