-- Fix: deleting the last installment of a series (or "Excluir todas as parcelas")
-- failed with 23514. The AFTER trigger recalculated the parent series to
-- total_installments = 0 / total_value = 0, which violates
-- orbi_series_installments_range (total_installments >= 1). The error rolled back
-- the DELETE, so the installment stayed and the credit card could not be deleted.
--
-- New behaviour: when a series has no transactions left, delete the series row.
-- Also recalculates the OLD series when a transaction moves to another series.

CREATE OR REPLACE FUNCTION public.update_series_total_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_series_id UUID;
  v_user_id   UUID;
  v_total     NUMERIC;
  v_count     INTEGER;
BEGIN
  FOR v_series_id, v_user_id IN
    SELECT DISTINCT s, u FROM (VALUES
      (CASE WHEN TG_OP <> 'DELETE' THEN NEW.series_id END, CASE WHEN TG_OP <> 'DELETE' THEN NEW.user_id END),
      (CASE WHEN TG_OP <> 'INSERT' THEN OLD.series_id END, CASE WHEN TG_OP <> 'INSERT' THEN OLD.user_id END)
    ) AS x(s, u)
    WHERE s IS NOT NULL
  LOOP
    SELECT COALESCE(SUM(value), 0), COUNT(*)
      INTO v_total, v_count
      FROM public.transactions
     WHERE series_id = v_series_id AND user_id = v_user_id;

    IF v_count = 0 THEN
      DELETE FROM public.series WHERE id = v_series_id AND user_id = v_user_id;
    ELSE
      UPDATE public.series
         SET total_value = v_total,
             total_installments = v_count,
             updated_at = NOW()
       WHERE id = v_series_id AND user_id = v_user_id;
    END IF;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
