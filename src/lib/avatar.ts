/**
 * Foto de perfil — regras puras + acesso ao bucket privado `avatars`.
 *
 * Segurança (espelho da migration `20260922200000_profile_avatar_display_name`):
 *  - Bucket PRIVADO: a imagem só abre por signed URL (token assinado, 1 h),
 *    emitida depois da policy SELECT (dono + parceiro do Casal ativo).
 *  - Caminho `<user_id>/<128 bits aleatórios>.webp|png|jpg` — imprevisível.
 *  - Validação dupla no cliente: extensão/MIME declarado E assinatura binária
 *    (magic bytes). Depois a imagem é redesenhada em canvas: sai sem EXIF/GPS
 *    e sem payload embutido (polyglot), já no tamanho de avatar.
 */
export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
export const AVATAR_SIGNED_URL_TTL = 60 * 60; // segundos
const AVATAR_OUTPUT_SIZE = 512;

export const MIME_TO_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type AvatarMime = keyof typeof MIME_TO_EXT;
const EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const PATH_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f]{32}\.(webp|png|jpg)$/;

export class AvatarFileError extends Error {}

/** "João Silva" → "JS"; "ana" → "A"; vazio → "". */
export function initialsOf(name?: string | null): string {
  const words = (name ?? "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] ?? "" : "";
  return (first + last).toLocaleUpperCase("pt-BR");
}

export function isAvatarPath(value: unknown): value is string {
  return typeof value === "string" && PATH_PATTERN.test(value);
}

function sniffMime(bytes: Uint8Array): AvatarMime | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = String.fromCharCode(...bytes.slice(0, 4)) + String.fromCharCode(...bytes.slice(8, 12));
  if (ascii === "RIFFWEBP") return "image/webp";
  return null;
}

/** Barreira de entrada: tamanho, extensão, MIME declarado e magic bytes. */
export async function assertValidAvatarFile(file: File): Promise<void> {
  if (!file || file.size === 0) throw new AvatarFileError("Arquivo vazio.");
  if (file.size > AVATAR_MAX_BYTES) throw new AvatarFileError("A foto pode ter no máximo 2 MB.");
  if (!EXTENSIONS.test(file.name) || !(file.type in MIME_TO_EXT)) {
    throw new AvatarFileError("Use uma imagem JPG, PNG ou WebP.");
  }
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (sniffMime(head) !== file.type) {
    throw new AvatarFileError("O conteúdo do arquivo não corresponde a uma imagem válida.");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.86));
}

/**
 * Recorta ao centro (quadrado), reduz para 512 px e re-encoda.
 * WebP quando o navegador suporta; senão PNG (Safari antigo).
 */
export async function normalizeAvatar(file: File): Promise<{ blob: Blob; mime: AvatarMime }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarFileError("Não foi possível ler esta imagem.");
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    if (side < 32) throw new AvatarFileError("Imagem pequena demais (mínimo 32 px).");
    const out = Math.min(AVATAR_OUTPUT_SIZE, side);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new AvatarFileError("Seu navegador não conseguiu processar a imagem.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);

    const webp = await canvasToBlob(canvas, "image/webp");
    if (webp?.type === "image/webp") return { blob: webp, mime: "image/webp" };
    const png = await canvasToBlob(canvas, "image/png");
    if (!png) throw new AvatarFileError("Seu navegador não conseguiu processar a imagem.");
    return { blob: png, mime: "image/png" };
  } finally {
    bitmap.close();
  }
}

