/** Acesso ao bucket privado `avatars` (regras puras em `@/lib/avatar`). */
import { supabase } from "@/integrations/supabase/client";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  AVATAR_SIGNED_URL_TTL,
  AvatarFileError,
  MIME_TO_EXT,
  isAvatarPath,
  type AvatarMime,
} from "@/lib/avatar";

function randomHex(bytes = 16): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Sobe a foto já normalizada; devolve o caminho gravado no bucket. */
export async function uploadAvatar(userId: string, blob: Blob, mime: AvatarMime): Promise<string> {
  if (blob.size > AVATAR_MAX_BYTES) throw new AvatarFileError("A foto pode ter no máximo 2 MB.");
  const path = `${userId}/${randomHex()}.${MIME_TO_EXT[mime]}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: mime,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function removeAvatarObject(path?: string | null): Promise<void> {
  if (!isAvatarPath(path)) return;
  await supabase.storage.from(AVATAR_BUCKET).remove([path]);
}

/** Signed URL (1 h). `null` se o caminho for inválido ou a policy negar. */
export async function signAvatarPath(path?: string | null): Promise<string | null> {
  if (!isAvatarPath(path)) return null;
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, AVATAR_SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
