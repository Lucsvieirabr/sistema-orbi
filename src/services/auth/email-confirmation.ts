import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { AuthFlowError, describeAuthError } from "@/lib/auth/auth-errors";
import { authRedirectUrl, AUTH_ROUTES } from "@/lib/auth/redirect";

/**
 * ============================================================================
 * CONFIRMAÇÃO DE E-MAIL DO CADASTRO
 * ============================================================================
 * Com "Confirm email" ligado no Supabase, `signUp` devolve `user` SEM `session`
 * e a conta só entra depois que a pessoa abre o link. Este módulo concentra as
 * três operações desse pedaço do fluxo: reenviar o e-mail, ler o link de volta
 * e trocar o código por sessão.
 *
 * Anti-enumeração: o reenvio responde igual para e-mail cadastrado ou não — o
 * GoTrue já se comporta assim e a UI não acrescenta pista nenhuma.
 * ============================================================================
 */

/** O GoTrue aceita 1 e-mail por minuto por usuário (`auth.email.max_frequency`). */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Para onde o link do e-mail devolve a pessoa. Precisa estar na allowlist de Redirect URLs. */
export const confirmationRedirectUrl = () => authRedirectUrl(AUTH_ROUTES.verifyEmail);

/** Guarda o e-mail em voo para a tela de espera sobreviver a um F5. */
const PENDING_KEY = "orbi_pending_confirmation";

export function rememberPendingEmail(email: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, email);
  } catch {
    /* modo privativo / storage bloqueado — a tela apenas fica genérica */
  }
}

export function readPendingEmail(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function forgetPendingEmail() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* nada a limpar */
  }
}

/** Reenvia o e-mail de confirmação. Lança `AuthFlowError` já traduzido. */
export async function resendConfirmationEmail(email: string, captchaToken?: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: confirmationRedirectUrl(), captchaToken },
  });

  if (error) {
    throw new AuthFlowError(error.code ?? "resend_failed", describeAuthError(error, "reset_request"), error.status);
  }
}

// ---------------------------------------------------------------------------
// Leitura do link de volta
// ---------------------------------------------------------------------------

export type ConfirmationLink =
  | { kind: "code"; code: string }
  | { kind: "token_hash"; tokenHash: string }
  | { kind: "error"; code: string }
  | { kind: "none" };

/**
 * Identifica o que o link do e-mail trouxe.
 *
 * PKCE entrega `?code=`; templates customizados entregam `?token_hash=&type=`;
 * link expirado ou já usado volta com `error`/`error_code` (query ou fragmento).
 */
export function readConfirmationLink(location: Location): ConfirmationLink {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : location.hash);

  const errorCode = query.get("error_code") ?? query.get("error") ?? hash.get("error_code") ?? hash.get("error");
  if (errorCode) return { kind: "error", code: errorCode };

  const tokenHash = query.get("token_hash") ?? hash.get("token_hash");
  if (tokenHash) return { kind: "token_hash", tokenHash };

  const code = query.get("code") ?? hash.get("code");
  if (code) return { kind: "code", code };

  return { kind: "none" };
}

/** Tira `code`/`token_hash` da barra de endereço: fora do histórico e do Referer. */
export function scrubConfirmationUrl() {
  window.history.replaceState(window.history.state, "", window.location.pathname);
}

/**
 * `detectSessionInUrl: true` faz a troca PKCE sozinho, mas de forma assíncrona.
 * Espera o `SIGNED_IN` (ou a sessão aparecer) por alguns instantes.
 */
export function awaitConfirmedSession(timeoutMs = 8000): Promise<Session | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: number | undefined;
    let unsubscribe: (() => void) | undefined;

    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      unsubscribe?.();
      resolve(session);
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
    });
    unsubscribe = () => data.subscription.unsubscribe();

    timer = window.setTimeout(() => finish(null), timeoutMs);

    // `getSession()` fora do callback: dentro dele a chamada disputaria o Web
    // Lock interno de auth com a própria troca PKCE em andamento.
    window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data: current }) => {
        if (current.session) finish(current.session);
      });
    }, 0);
  });
}

/** Consome um `token_hash` de cadastro e devolve a sessão criada. */
export async function verifyConfirmationToken(tokenHash: string): Promise<Session | null> {
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "signup" });

  if (error) {
    throw new AuthFlowError(error.code ?? "otp_expired", describeAuthError(error, "reset_link"), error.status);
  }

  return data.session ?? null;
}
