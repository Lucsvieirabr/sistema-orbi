import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AuthFlowError, describeAuthError, isInvalidLinkError } from "@/lib/auth/auth-errors";
import { AUTH_ROUTES, authRedirectUrl } from "@/lib/auth/redirect";

/**
 * ============================================================================
 * RECUPERAÇÃO DE SENHA
 * ============================================================================
 * 1. `requestPasswordReset(email)` → GoTrue envia o e-mail com link para
 *    `/redefinir-senha`.
 * 2. `/redefinir-senha` lê o link com `readRecoveryLink()`. Dois formatos:
 *    - `?token_hash=…&type=recovery` (template `supabase/templates/recovery.html`):
 *      funciona em qualquer navegador/dispositivo. O token só é consumido quando
 *      o usuário ENVIA a nova senha (`verifyRecoveryToken`) — antivírus de
 *      e-mail que abrem o link antes não queimam o token.
 *    - `?code=…` (template padrão + PKCE): o supabase-js troca o código sozinho
 *      (`detectSessionInUrl`). Só funciona no navegador que pediu o e-mail.
 * 3. `updatePassword(nova)` troca a senha na sessão de recuperação e encerra as
 *    outras sessões. Com MFA ativo o GoTrue exige aal2 antes (`insufficient_aal`).
 *
 * Anti-enumeração: pedir redefinição para e-mail sem conta tem a MESMA resposta
 * de sucesso. O teto de envios é o `[auth.rate_limit] email_sent`.
 * ============================================================================
 */

export const recoveryEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Digite seu e-mail.")
  .max(254, "E-mail longo demais.")
  .email("Digite um e-mail válido.");

/** Espelha o formato do GoTrue (hash hex de 56 chars hoje); teto folgado. */
const tokenHashSchema = z.string().regex(/^[A-Za-z0-9_-]{16,256}$/);

/**
 * @param captchaToken token Turnstile de uso único (obrigatório quando o
 *   captcha está ligado no Supabase Auth; ignorado quando não está).
 */
export async function requestPasswordReset(rawEmail: string, captchaToken?: string): Promise<void> {
  const parsed = recoveryEmailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    throw new AuthFlowError("validation_failed", parsed.error.issues[0]?.message ?? "Digite um e-mail válido.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: authRedirectUrl(AUTH_ROUTES.resetPassword),
    captchaToken,
  });

  if (!error) return;

  // Só erros que não revelam nada sobre a conta chegam ao usuário. Qualquer
  // outro (inclusive "usuário não existe" em versões antigas do GoTrue) é
  // tratado como sucesso para não virar oráculo de e-mails cadastrados.
  const code = (error as { code?: string }).code;
  const exposable =
    error.status === 429 ||
    error.status === 0 ||
    error.name === "AuthRetryableFetchError" ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    code === "email_address_invalid" ||
    code === "captcha_failed" ||
    (error.status !== undefined && error.status >= 500);

  if (exposable) {
    throw new AuthFlowError(code ?? "unexpected_failure", describeAuthError(error, "reset_request"), error.status);
  }
}

export type RecoveryLink =
  | { kind: "token_hash"; tokenHash: string }
  | { kind: "code" }
  | { kind: "error"; code: string }
  | { kind: "none" };

/**
 * Lê o link sem consumir nada. Erros do GoTrue chegam na query (PKCE) ou no
 * fragmento (fluxo implícito): `error_code=otp_expired`.
 */
export function readRecoveryLink(location: Pick<Location, "search" | "hash">): RecoveryLink {
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));

  const errorCode = query.get("error_code") ?? fragment.get("error_code") ?? query.get("error") ?? fragment.get("error");
  if (errorCode) return { kind: "error", code: errorCode.slice(0, 64) };

  const tokenHash = query.get("token_hash");
  if (tokenHash) {
    const type = query.get("type");
    const valid = tokenHashSchema.safeParse(tokenHash);
    if (type !== "recovery" || !valid.success) return { kind: "error", code: "otp_expired" };
    return { kind: "token_hash", tokenHash: valid.data };
  }

  if (query.get("code")) return { kind: "code" };
  return { kind: "none" };
}

/**
 * Aguarda a troca automática `?code=` → sessão. `initialize()` devolve o
 * resultado memorizado da inicialização do cliente (inclusive o erro da troca).
 */
export async function awaitRecoveryCodeExchange(): Promise<void> {
  const { error } = await supabase.auth.initialize();
  if (error) {
    const code = (error as { code?: string }).code ?? "flow_state_not_found";
    throw new AuthFlowError(code, describeAuthError(error, "reset_link"), error.status);
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new AuthFlowError("flow_state_not_found", describeAuthError({ code: "flow_state_not_found" }, "reset_link"));
  }
}

/** Consome o `token_hash` do e-mail e abre a sessão de recuperação (aal1). */
export async function verifyRecoveryToken(tokenHash: string): Promise<{ email: string }> {
  const valid = tokenHashSchema.safeParse(tokenHash);
  if (!valid.success) {
    throw new AuthFlowError("otp_expired", describeAuthError({ code: "otp_expired" }, "reset_link"));
  }

  const { data, error } = await supabase.auth.verifyOtp({ token_hash: valid.data, type: "recovery" });

  if (error || !data.session) {
    const code = (error as { code?: string } | null)?.code ?? "otp_expired";
    // 403/400 do verify = token inválido, expirado ou já usado.
    const normalized = isInvalidLinkError({ code }) || error?.status === 403 ? "otp_expired" : code;
    throw new AuthFlowError(normalized, describeAuthError({ ...error, code: normalized }, "reset_link"), error?.status);
  }

  return { email: data.session.user?.email ?? "" };
}

/** Sessão local (sem rede). Usada quando a página abre sem parâmetros de link. */
export async function getRecoverySession(): Promise<{ active: boolean; email: string }> {
  const { data } = await supabase.auth.getSession();
  return { active: Boolean(data.session), email: data.session?.user?.email ?? "" };
}

/**
 * Troca a senha na sessão atual. Depois encerra as OUTRAS sessões: quem
 * recupera senha pode estar reagindo a um acesso indevido.
 *
 * @returns `true` se as outras sessões foram encerradas.
 */
export async function updatePassword(password: string): Promise<boolean> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const code = (error as { code?: string }).code ?? "unexpected_failure";
    throw new AuthFlowError(code, describeAuthError(error, "password_update"), error.status);
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  return !signOutError;
}
