/**
 * URLs de retorno dos e-mails do Supabase Auth e rotas do fluxo de conta.
 *
 * Usa a origem ATUAL do navegador, não `VITE_SITE_URL`: com PKCE o
 * `code_verifier` fica no localStorage da origem que pediu o e-mail — mandar o
 * link de um preview (`*.pages.dev`) para produção quebraria a troca do código.
 *
 * Não abre redirecionamento arbitrário: o GoTrue só aceita `redirectTo` que
 * esteja na allowlist "Redirect URLs" do painel. Fora dela, cai no Site URL.
 */

export const AUTH_ROUTES = {
  login: "/login",
  forgotPassword: "/esqueci-senha",
  resetPassword: "/redefinir-senha",
  mfaChallenge: "/login/verificacao",
  /** Tela de espera da confirmação de e-mail e destino do link do e-mail de cadastro. */
  verifyEmail: "/verificar-email",
  pricing: "/pricing",
  app: "/sistema",
  billing: "/billing",
} as const;

const FALLBACK_ORIGIN = ((import.meta.env.VITE_SITE_URL as string | undefined) || "https://app.meuorbi.com").replace(
  /\/+$/,
  "",
);

export function authRedirectUrl(path: string): string {
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : FALLBACK_ORIGIN;
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return `${origin}${safePath}`;
}

/**
 * Saneia um destino pós-login vindo da URL (`?next=`).
 *
 * Aceita SÓ caminho interno: começa com uma barra, não com duas (que o
 * navegador leria como `//host` = outro domínio) e sem barra invertida
 * (normalizada para barra por alguns navegadores). Rotas do próprio fluxo de
 * autenticação são recusadas — apontar `next` para `/login` cria laço.
 */
const FORBIDDEN_NEXT_PREFIXES = [
  AUTH_ROUTES.login,
  AUTH_ROUTES.forgotPassword,
  AUTH_ROUTES.resetPassword,
  AUTH_ROUTES.verifyEmail,
];

export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if (FORBIDDEN_NEXT_PREFIXES.some((prefix) => raw === prefix || raw.startsWith(`${prefix}/`) || raw.startsWith(`${prefix}?`))) {
    return null;
  }
  return raw;
}

/** `/login` carregando para onde voltar. Nunca `/login` puro em fluxo interrompido. */
export function loginPath(next?: string | null): string {
  const safe = safeInternalPath(next);
  return safe ? `${AUTH_ROUTES.login}?next=${encodeURIComponent(safe)}` : AUTH_ROUTES.login;
}

/** Lê `?next=` da URL atual já saneado. */
export function readNextParam(search?: string): string | null {
  const source = search ?? (typeof window !== "undefined" ? window.location.search : "");
  if (!source) return null;
  return safeInternalPath(new URLSearchParams(source).get("next"));
}

/** Destino pós-verificação em duas etapas. Enum fechado — nunca URL livre. */
export type MfaDestination = "app" | "admin";

export function parseMfaDestination(value: string | null): MfaDestination {
  return value === "admin" ? "admin" : "app";
}

export function mfaChallengePath(destination: MfaDestination = "app"): string {
  return destination === "admin" ? `${AUTH_ROUTES.mfaChallenge}?destino=admin` : AUTH_ROUTES.mfaChallenge;
}
