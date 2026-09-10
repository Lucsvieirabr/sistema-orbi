-- ============================================================================
-- REMOÇÃO DO SISTEMA DE LOGOS (logo.dev)
-- ----------------------------------------------------------------------------
-- Motivo: era a única dependência de API paga de terceiros fora do gateway de
-- pagamento, com dois tokens no servidor (LOGO_DEV_TOKEN e
-- LOGO_DEV_TOKEN_IMAGES), cota consumível por qualquer usuário autenticado e
-- um bucket público de Storage escrito por `authenticated` (qualquer conta
-- podia gravar objetos arbitrários em `company-logos`).
--
-- Removidos junto com esta migration:
--   * Edge Functions  supabase/functions/search-logo, .../get-company-logo
--   * Scripts         scripts/setup-logo-integration.sh, scripts/start-logo-function.sh
--   * Migrations      20251009000002_add_logo_url_to_series.sql
--                     20251010000001_create_logos_storage_bucket.sql
--   * Feature de plano `ia_deteccao_logos`
--
-- Idempotente: roda tanto num banco que já tinha o sistema quanto num banco
-- novo em que as migrations removidas nunca existiram.
-- ============================================================================

BEGIN;

-- ------------------------------------------------------------ series.logo_url
DROP INDEX IF EXISTS public.idx_series_logo_url;
-- A constraint orbi_series_logo_url_safe (20260910000001) cai junto com a coluna.
ALTER TABLE public.series DROP CONSTRAINT IF EXISTS orbi_series_logo_url_safe;
ALTER TABLE public.series DROP COLUMN IF EXISTS logo_url;

-- --------------------------------------------------- Storage: company-logos
DO $storage_cleanup$
BEGIN
  -- storage.objects/buckets só existem quando a extensão Storage está provisionada.
  -- Sem esta guarda, um banco recém-criado aborta a migration inteira aqui.
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Public read access to company logos"        ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can update company logos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;
    -- Policies reescritas por 20260910000000_zero_trust_rls_force.
    DROP POLICY IF EXISTS "orbi_logos_insert_own" ON storage.objects;
    DROP POLICY IF EXISTS "orbi_logos_update_own" ON storage.objects;
    DROP POLICY IF EXISTS "orbi_logos_delete_own" ON storage.objects;
    DROP POLICY IF EXISTS "orbi_logos_select_public" ON storage.objects;

    DELETE FROM storage.objects WHERE bucket_id = 'company-logos';
  END IF;
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    DELETE FROM storage.buckets WHERE id = 'company-logos';
  END IF;
END
$storage_cleanup$;

-- ------------------------------------------- Feature de plano correspondente
UPDATE public.subscription_plans
   SET features = features - 'ia_deteccao_logos',
       updated_at = NOW()
 WHERE features ? 'ia_deteccao_logos';

-- --------------------------------- Contadores de rate limit órfãos dos logos
DELETE FROM public.rate_limit_counters
 WHERE bucket IN ('search-logo', 'get-company-logo');

NOTIFY pgrst, 'reload schema';

COMMIT;
