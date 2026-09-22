/**
 * Perfil do usuário logado: apelido (`display_name`) e foto (`avatar_path`).
 *
 * A linha em `user_profiles` pode não existir (contas antigas): o upsert por
 * `user_id` cria ou atualiza. O trigger `guard_user_profile_writes` fixa
 * `user_id`/e-mail pelo JWT; as CHECKs do banco repetem os limites daqui.
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { getCachedAuthUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import {
  AvatarFileError,
  assertValidAvatarFile,
  isAvatarPath,
  normalizeAvatar,
} from "@/lib/avatar";
import { removeAvatarObject, uploadAvatar } from "@/lib/avatar-storage";
import { parseOrThrow, sanitizeSingleLine } from "@/lib/validation/schemas";

export const PROFILE_QUERY_KEY = ["profile"] as const;
const FAMILY_GROUP_QUERY_KEY = ["family-group"] as const;

/** Espelho de `orbi_profile_display_name_safe` (1–40, uma linha). */
export const displayNameSchema = z.preprocess(
  (value) => {
    const clean = sanitizeSingleLine(value);
    return clean === "" ? null : clean;
  },
  z.string().max(40, "Máximo de 40 caracteres").nullable(),
);

export interface OwnProfile {
  userId: string;
  displayName: string | null;
  fullName: string | null;
  avatarPath: string | null;
}

async function fetchProfile(): Promise<OwnProfile | null> {
  const { data: { user } } = await getCachedAuthUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("display_name, full_name, avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  const metaName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  return {
    userId: user.id,
    displayName: data?.display_name ?? null,
    fullName: data?.full_name ?? metaName,
    avatarPath: isAvatarPath(data?.avatar_path) ? data.avatar_path : null,
  };
}

export function useProfile() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: fetchProfile, staleTime: 5 * 60 * 1000 });

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: FAMILY_GROUP_QUERY_KEY }),
    ]);
  }, [queryClient]);

  const writeProfile = async (patch: { display_name?: string | null; avatar_path?: string | null }) => {
    const { data: { user } } = await getCachedAuthUser();
    if (!user) throw new Error("Sessão expirada. Entre novamente.");
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
    if (error) throw error;
    return user.id;
  };

  const updateDisplayName = async (value: string) => {
    const displayName = parseOrThrow(displayNameSchema, value);
    await writeProfile({ display_name: displayName });
    queryClient.setQueryData<OwnProfile | null>(PROFILE_QUERY_KEY, (old) => (old ? { ...old, displayName } : old));
    await refresh();
    return displayName;
  };

  /** Valida → normaliza → sobe → grava o caminho → apaga a foto antiga. */
  const changeAvatar = async (file: File) => {
    await assertValidAvatarFile(file);
    const { blob, mime } = await normalizeAvatar(file);
    const { data: { user } } = await getCachedAuthUser();
    if (!user) throw new Error("Sessão expirada. Entre novamente.");

    const previous = query.data?.avatarPath ?? null;
    const path = await uploadAvatar(user.id, blob, mime);
    try {
      await writeProfile({ avatar_path: path });
    } catch (error) {
      await removeAvatarObject(path); // rollback: sem arquivo órfão
      throw error;
    }
    queryClient.setQueryData<OwnProfile | null>(PROFILE_QUERY_KEY, (old) => (old ? { ...old, avatarPath: path } : old));
    if (previous && previous !== path) void removeAvatarObject(previous);
    await refresh();
    return path;
  };

  const removeAvatar = async () => {
    const previous = query.data?.avatarPath ?? null;
    await writeProfile({ avatar_path: null });
    queryClient.setQueryData<OwnProfile | null>(PROFILE_QUERY_KEY, (old) => (old ? { ...old, avatarPath: null } : old));
    await removeAvatarObject(previous);
    await refresh();
  };

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    updateDisplayName,
    changeAvatar,
    removeAvatar,
  };
}

export { AvatarFileError };
