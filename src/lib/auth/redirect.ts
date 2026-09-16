/**
 * URLs de retorno dos e-mails do Supabase Auth.
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
} as const;

const FALLBACK_ORIGIN = ((import.meta.env.VITE_SITE_URL as string | undefined) || "https://orbi.com.br").replace(
  /\/+$/,
  "",
);

export function authRedirectUrl(path: string): string {
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : FALLBACK_ORIGIN;
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return `${origin}${safePath}`;
}

/** Destino pós-verificação em duas etapas. Enum fechado — nunca URL livre. */
export type MfaDestination = "app" | "admin";

export function parseMfaDestination(value: string | null): MfaDestination {
  return value === "admin" ? "admin" : "app";
}

export function mfaChallengePath(destination: MfaDestination = "app"): string {
  return destination === "admin" ? `${AUTH_ROUTES.mfaChallenge}?destino=admin` : AUTH_ROUTES.mfaChallenge;
}
