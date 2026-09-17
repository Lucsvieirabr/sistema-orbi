/**
 * ============================================================================
 * ERROS DO SUPABASE AUTH (GoTrue) → MENSAGEM PT-BR
 * ============================================================================
 * `error.code` é estável entre versões do GoTrue; `error.message` não é (e vem
 * em inglês). Toda tela de autenticação traduz por aqui — nunca exibe a
 * mensagem crua do servidor.
 *
 * Anti-enumeração: nenhum texto daqui confirma se um e-mail tem conta.
 * ============================================================================
 */

export type AuthErrorContext = "login" | "signup" | "reset_request" | "reset_link" | "password_update" | "mfa";

export interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
  name?: string;
  /** `AuthWeakPasswordError.reasons`: `length` | `characters` | `pwned`. */
  reasons?: string[];
}

/** Erro já traduzido, lançado pelos serviços de `src/services/auth`. */
export class AuthFlowError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "AuthFlowError";
    this.code = code;
    this.status = status;
  }
}

const RATE_LIMIT = "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
const NETWORK = "Sem conexão com o servidor. Verifique sua internet e tente de novo.";

const FALLBACK: Record<AuthErrorContext, string> = {
  login: "Não foi possível entrar agora. Tente de novo em instantes.",
  signup: "Não foi possível criar a conta agora. Tente de novo em instantes.",
  reset_request: "Não foi possível enviar o e-mail agora. Tente de novo em instantes.",
  reset_link: "Este link de redefinição não é mais válido. Peça um novo.",
  password_update: "Não foi possível salvar a nova senha. Tente de novo.",
  mfa: "Não foi possível validar o código. Tente de novo.",
};

/** Links de e-mail: expirado, já usado, aberto em outro navegador (PKCE). */
const LINK_CODES = new Set([
  "otp_expired",
  "otp_disabled",
  "flow_state_expired",
  "flow_state_not_found",
  "bad_code_verifier",
  "bad_oauth_state",
  "access_denied",
]);

export function isInvalidLinkError(error: AuthErrorLike | null | undefined): boolean {
  return Boolean(error?.code && LINK_CODES.has(error.code));
}

export function hasAuthErrorCode(error: unknown, code: string): boolean {
  return (error as AuthErrorLike | null)?.code === code;
}

function describeWeakPassword(reasons: string[] | undefined): string {
  if (reasons?.includes("pwned")) {
    return "Essa senha já apareceu em vazamentos públicos. Escolha outra que você não use em lugar nenhum.";
  }
  if (reasons?.includes("length")) return "A senha precisa de pelo menos 8 caracteres.";
  if (reasons?.includes("characters")) return "Combine letras e números na senha.";
  return "Essa senha não atende aos critérios de segurança. Use uma combinação mais longa e variada.";
}

export function describeAuthError(error: unknown, context: AuthErrorContext): string {
  if (error instanceof AuthFlowError) return error.message;

  const e = (error ?? {}) as AuthErrorLike;

  // AuthRetryableFetchError: fetch falhou antes de chegar ao GoTrue.
  if (e.name === "AuthRetryableFetchError" || e.status === 0) return NETWORK;
  if (e.status === 429) return RATE_LIMIT;

  switch (e.code) {
    // ---- Login -----------------------------------------------------------
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com este e-mail. Entre ou use “Esqueci minha senha”.";
    case "signup_disabled":
      return "Novos cadastros estão temporariamente desativados.";
    case "user_banned":
      return "Esta conta está suspensa. Fale com o suporte.";

    // ---- Captcha (Turnstile, validado pelo Supabase Auth) --------------
    case "captcha_failed":
      return "Não conseguimos confirmar a verificação de segurança. Aguarde um instante e tente de novo.";

    // ---- Envio de e-mail / limites -------------------------------------
    case "over_email_send_rate_limit":
      return "Já enviamos um e-mail há pouco. Aguarde um minuto antes de pedir outro.";
    case "over_request_rate_limit":
      return RATE_LIMIT;
    case "email_address_invalid":
    case "validation_failed":
      return "Digite um e-mail válido.";

    // ---- Senha -----------------------------------------------------------
    case "weak_password":
      return describeWeakPassword(e.reasons);
    case "same_password":
      return "A nova senha precisa ser diferente da atual.";
    case "reauthentication_needed":
      return "Por segurança, saia e entre de novo na sua conta antes de trocar a senha.";
    case "insufficient_aal":
      return "Confirme o código do seu aplicativo autenticador para continuar.";

    // ---- Sessão ------------------------------------------------------------
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
      return context === "reset_link" || context === "password_update"
        ? "Sua sessão de redefinição expirou. Peça um novo link."
        : "Sua sessão expirou. Entre de novo.";

    // ---- MFA ---------------------------------------------------------------
    case "mfa_verification_failed":
    case "mfa_verification_rejected":
      return "Código incorreto. Confira o aplicativo e digite o código atual.";
    case "mfa_challenge_expired":
      return "O código expirou. Digite o código que aparece agora no aplicativo.";
    case "mfa_factor_not_found":
      return "O autenticador não foi encontrado. Recarregue a página e tente de novo.";
    case "mfa_totp_enroll_not_enabled":
    case "mfa_totp_verify_not_enabled":
      return "A verificação em duas etapas está indisponível no momento.";
    case "too_many_enrolled_mfa_factors":
      return "Você atingiu o limite de autenticadores cadastrados.";
    case "mfa_factor_name_conflict":
      return "Já existe uma configuração em andamento. Recarregue a página e tente de novo.";
  }

  if (isInvalidLinkError(e)) {
    return e.code === "bad_code_verifier" || e.code === "flow_state_not_found"
      ? "Abra o link no mesmo navegador em que você pediu a redefinição, ou peça um novo."
      : FALLBACK.reset_link;
  }

  return FALLBACK[context];
}
