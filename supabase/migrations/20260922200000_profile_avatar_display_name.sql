-- ============================================================================
-- Plano Casal humanizado: apelido + foto de perfil.
--
-- Segurança:
--   * Bucket `avatars` PRIVADO. Nada de URL pública: a UI só enxerga a imagem
--     por signed URL (token JWT assinado, expira em 1 h) emitida pelo Storage
--     depois de passar pela policy SELECT abaixo. Ter o caminho não basta.
--   * Caminho = `<user_id>/<128 bits aleatórios>.<ext>` — imprevisível, e a
--     1ª pasta amarra o arquivo ao dono (INSERT/DELETE só na própria pasta).
--   * Leitura: dono + membros do grupo Casal ativo (`orbi_family_user_ids`).
--   * Limites no próprio bucket: 2 MB, só image/jpeg|png|webp.
--   * `user_profiles.avatar_path` guarda o CAMINHO (não URL) e a CHECK exige
--     que ele comece pelo user_id da linha — ninguém aponta a foto de outro.
-- ============================================================================

-- 1. Colunas ---------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_path text;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS orbi_profile_display_name_safe,
  ADD CONSTRAINT orbi_profile_display_name_safe CHECK (
    display_name IS NULL
    OR (orbi_is_safe_text(display_name, 40) AND length(btrim(display_name)) BETWEEN 1 AND 40
        AND display_name = btrim(display_name))
  );

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS orbi_profile_avatar_path_owner,
  ADD CONSTRAINT orbi_profile_avatar_path_owner CHECK (
    avatar_path IS NULL
    OR avatar_path ~ ('^' || user_id::text || '/[0-9a-f]{32}\.(webp|png|jpg)$')
  );

COMMENT ON COLUMN public.user_profiles.display_name IS 'Apelido exibido ao parceiro no Plano Casal (1-40, uma linha).';
COMMENT ON COLUMN public.user_profiles.avatar_path IS 'Caminho no bucket privado avatars (<user_id>/<hex32>.<ext>). Lido só via signed URL.';

-- 2. Bucket privado ----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Quem pode ler a pasta de um usuário ------------------------------------
CREATE OR REPLACE FUNCTION public.orbi_can_read_avatar(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       split_part(p_object_name, '/', 1) = auth.uid()::text
       OR split_part(p_object_name, '/', 1) = ANY (
            SELECT u::text FROM unnest(public.orbi_family_user_ids()) AS u
          )
     );
$$;
REVOKE ALL ON FUNCTION public.orbi_can_read_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_can_read_avatar(text) TO authenticated;

-- 4. Policies do Storage -------------------------------------------------------
DROP POLICY IF EXISTS orbi_avatars_select ON storage.objects;
DROP POLICY IF EXISTS orbi_avatars_insert_own ON storage.objects;
DROP POLICY IF EXISTS orbi_avatars_delete_own ON storage.objects;

CREATE POLICY orbi_avatars_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND public.orbi_can_read_avatar(name));

CREATE POLICY orbi_avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND name ~ ('^' || auth.uid()::text || '/[0-9a-f]{32}\.(webp|png|jpg)$')
  );

-- Sem UPDATE: cada foto nova é um objeto novo (nome aleatório); sem upsert.
CREATE POLICY orbi_avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND split_part(name, '/', 1) = auth.uid()::text);

-- Resto da integração logo.dev (bucket já removido).
DROP POLICY IF EXISTS orbi_logos_insert_own ON storage.objects;
DROP POLICY IF EXISTS orbi_logos_update_own ON storage.objects;
DROP POLICY IF EXISTS orbi_logos_delete_own ON storage.objects;

-- 5. Diretório do casal: apelido + caminho da foto ---------------------------
-- `name`: apelido escolhido (inteiro) ou 1º nome do cadastro.
CREATE OR REPLACE FUNCTION public.orbi_family_directory()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id', ids.uid,
        'is_self', ids.uid = auth.uid(),
        'name', NULLIF(
                  left(
                    COALESCE(
                      NULLIF(btrim(p.display_name), ''),
                      split_part(
                        btrim(COALESCE(
                          NULLIF(btrim(p.full_name), ''),
                          NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                          ''
                        )),
                        ' ', 1
                      )
                    ),
                    40
                  ),
                  ''
                ),
        'avatar_path', p.avatar_path
      )
      ORDER BY (ids.uid = auth.uid()) DESC, ids.uid
    ),
    '[]'::jsonb
  )
  FROM unnest(public.orbi_family_user_ids()) AS ids(uid)
  LEFT JOIN LATERAL (
    SELECT up.full_name, up.display_name, up.avatar_path
      FROM public.user_profiles up
     WHERE up.user_id = ids.uid
     LIMIT 1
  ) p ON true
  LEFT JOIN auth.users u ON u.id = ids.uid
  WHERE auth.uid() IS NOT NULL
    AND ids.uid IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.orbi_family_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_family_directory() TO authenticated;
