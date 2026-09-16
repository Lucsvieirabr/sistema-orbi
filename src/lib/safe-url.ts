export const PAYMENT_URL_HOSTS = ["asaas.com"] as const;

const DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;

function parseUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hostAllowed(host: string, suffixes: readonly string[]): boolean {
  const normalized = host.toLowerCase();
  return suffixes.some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
}

export function safeHttpsUrl(value: unknown, allowedHostSuffixes?: readonly string[]): string | null {
  const url = parseUrl(value);
  if (!url || url.protocol !== "https:" || url.username || url.password) return null;
  if (allowedHostSuffixes && !hostAllowed(url.hostname, allowedHostSuffixes)) return null;
  return url.toString();
}

export function safePaymentUrl(value: unknown): string | null {
  return safeHttpsUrl(value, PAYMENT_URL_HOSTS);
}

export function safeImageSrc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (DATA_IMAGE.test(value) && value.length <= 1_500_000) return value;
  return safeHttpsUrl(value);
}

export function openExternalUrl(value: unknown, allowedHostSuffixes: readonly string[] = PAYMENT_URL_HOSTS): boolean {
  const url = safeHttpsUrl(value, allowedHostSuffixes);
  if (!url) return false;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
  return true;
}
