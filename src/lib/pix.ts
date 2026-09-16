/**
 * PIX Copia e Cola — BR Code estático (EMV® QRCPS-MPM, Manual de Padrões para
 * Iniciação do PIX do BCB). Geração 100% local: nenhuma chave sai do navegador.
 *
 * Estrutura: ID (2) + tamanho (2) + valor, terminando no CRC16-CCITT (0x1021,
 * semente 0xFFFF) calculado sobre todo o payload + "6304".
 */

export type PixKeyKind = "email" | "cpf" | "cnpj" | "phone" | "evp" | "unknown";

const EVP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normaliza a chave para o formato que o DICT espera. */
export function normalizePixKey(raw: string): { key: string; kind: PixKeyKind } {
  const value = (raw ?? "").trim();
  if (!value) return { key: "", kind: "unknown" };
  if (EVP.test(value)) return { key: value.toLowerCase(), kind: "evp" };
  if (EMAIL.test(value)) return { key: value.toLowerCase(), kind: "email" };

  if (value.startsWith("+")) {
    const digits = value.replace(/\D/g, "");
    return { key: `+${digits}`, kind: digits.length >= 12 ? "phone" : "unknown" };
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && /^[\d.\-\s]+$/.test(value)) return { key: digits, kind: "cpf" };
  if (digits.length === 14 && /^[\d./\-\s]+$/.test(value)) return { key: digits, kind: "cnpj" };
  if (/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/.test(value)) return { key: `+55${digits}`, kind: "phone" };
  return { key: value, kind: "unknown" };
}

/** Maiúsculas, sem acento e só caracteres aceitos pelo padrão. */
function sanitizeField(value: string, max: number, fallback: string): string {
  const clean = (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
  return clean || fallback;
}

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixPayloadInput {
  key: string;
  name: string;
  city?: string;
  amount?: number;
  /** Aparece no app do pagador (máx. ~40). */
  description?: string;
  txid?: string;
}

export function buildPixPayload({ key, name, city = "BRASIL", amount, description, txid }: PixPayloadInput): string {
  const { key: normalizedKey } = normalizePixKey(key);
  if (!normalizedKey) throw new Error("Informe uma chave PIX.");

  const info = description ? sanitizeField(description, 40, "") : "";
  const account =
    tlv("00", "br.gov.bcb.pix") + tlv("01", normalizedKey) + (info ? tlv("02", info) : "");
  if (account.length > 99) throw new Error("Chave PIX longa demais para o código.");

  const reference = (txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  let payload =
    tlv("00", "01") +
    tlv("26", account) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (amount && amount > 0 ? tlv("54", (Math.round(amount * 100) / 100).toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", sanitizeField(name, 25, "RECEBEDOR")) +
    tlv("60", sanitizeField(city, 15, "BRASIL")) +
    tlv("62", tlv("05", reference));

  payload += "6304";
  return payload + crc16(payload);
}
