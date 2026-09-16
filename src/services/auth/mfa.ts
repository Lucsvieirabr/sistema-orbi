import type { Factor } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { AuthFlowError, describeAuthError } from "@/lib/auth/auth-errors";
import { assuranceFromSession, type SessionAssurance } from "@/lib/auth/assurance";

/**
 * ============================================================================
 * VERIFICAÇÃO EM DUAS ETAPAS (MFA · TOTP)
 * ============================================================================
 * Setup:  getMfaStatus → startTotpEnrollment (QR + chave) → confirmTotpEnrollment(código)
 * Login:  signInWithPassword (aal1) → needsChallenge? → verifyLoginCode(código) → aal2
 * Remover: disableTotp(código) — exige aal2 e um código novo.
 *
 * Um único TOTP verificado por conta (a UI não oferece o segundo). Fatores
 * `unverified` são sobras de configurações abandonadas: são limpos antes de uma
 * nova inscrição para não bater em `mfa_factor_name_conflict` nem no teto.
 *
 * O cliente decide a TELA; o banco decide o ACESSO (RLS com `auth.jwt()->>'aal'`).
 * ============================================================================
 */

export const TOTP_CODE_LENGTH = 6;
const TOTP_CODE = /^\d{6}$/;

export interface MfaStatus {
  enabled: boolean;
  factor: Pick<Factor, "id" | "friendly_name" | "created_at"> | null;
  assurance: SessionAssurance;
}

export interface TotpEnrollment {
  factorId: string;
  /** SVG em data URI, gerado pelo GoTrue. Seguro em `<img src>` (sem script). */
  qrCode: string;
  /** Chave em base32 para digitar à mão no aplicativo. */
  secret: string;
}

function fail(error: { code?: string; status?: number } | null | undefined, fallbackCode = "unexpected_failure"): never {
  throw new AuthFlowError(error?.code ?? fallbackCode, describeAuthError(error, "mfa"), error?.status);
}

/**
 * O GoTrue devolve o QR como SVG cru ou já como `data:image/svg+xml;utf-8,<svg…>`
 * (varia por versão). Normaliza para data URI com o SVG percent-encoded — `#` e
 * espaços crus quebram a URI. Aceita SÓ SVG: nada de URL remota em `<img src>`.
 */
function toSvgDataUri(raw: string): string | null {
  const value = raw.trim();
  const markup = /^data:image\/svg\+xml/i.test(value) ? safeDecode(value.slice(value.indexOf(",") + 1)) : value;
  if (!markup || !/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(markup)) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeTotpCode(raw: string): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, TOTP_CODE_LENGTH);
}

function assertTotpCode(code: string): string {
  const normalized = normalizeTotpCode(code);
  if (!TOTP_CODE.test(normalized)) {
    throw new AuthFlowError("invalid_code_format", "Digite os 6 dígitos que aparecem no aplicativo.");
  }
  return normalized;
}

export async function getAssurance(): Promise<SessionAssurance> {
  const { data } = await supabase.auth.getSession();
  return assuranceFromSession(data.session);
}

async function listTotpFactors(): Promise<{ verified: Factor[]; unverified: Factor[] }> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) fail(error);

  const totp = (data?.all ?? []).filter((factor) => factor.factor_type === "totp");
  return {
    verified: totp.filter((factor) => factor.status === "verified"),
    unverified: totp.filter((factor) => factor.status !== "verified"),
  };
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const [{ verified }, assurance] = await Promise.all([listTotpFactors(), getAssurance()]);
  const factor = verified[0] ?? null;

  return {
    enabled: Boolean(factor),
    factor: factor ? { id: factor.id, friendly_name: factor.friendly_name, created_at: factor.created_at } : null,
    assurance,
  };
}

export async function startTotpEnrollment(): Promise<TotpEnrollment> {
  const { verified, unverified } = await listTotpFactors();
  if (verified.length > 0) {
    throw new AuthFlowError("mfa_already_enabled", "A verificação em duas etapas já está ativa nesta conta.");
  }

  // Descarta inscrições abandonadas. Falha aqui não bloqueia: o enroll abaixo
  // usa nome único e o GoTrue ainda aceita.
  await Promise.allSettled(unverified.map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })));

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Orbi",
    friendlyName: `Autenticador ${new Date().toISOString().slice(0, 19)}`,
  });
  if (error || !data) fail(error);

  const qrCode = toSvgDataUri(data.totp?.qr_code ?? "");
  const secret = (data.totp?.secret ?? "").replace(/\s/g, "");

  if (!qrCode || !/^[A-Z2-7]+=*$/i.test(secret)) {
    await supabase.auth.mfa.unenroll({ factorId: data.id }).catch(() => undefined);
    throw new AuthFlowError("invalid_enrollment", "Não foi possível gerar o QR code. Tente de novo.");
  }

  return { factorId: data.id, qrCode, secret };
}

/**
 * Desafia e verifica em uma chamada. Sucesso = sessão promovida para aal2 (o
 * supabase-js grava a nova sessão e dispara `MFA_CHALLENGE_VERIFIED`).
 */
async function challengeAndVerify(factorId: string, code: string): Promise<void> {
  const normalized = assertTotpCode(code);
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: normalized });
  if (error) fail(error);
}

/** Primeiro código do aplicativo: marca o fator como verificado e já sobe para aal2. */
export async function confirmTotpEnrollment(factorId: string, code: string): Promise<void> {
  await challengeAndVerify(factorId, code);
}

export async function cancelTotpEnrollment(factorId: string): Promise<void> {
  await supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
}

/** Tela de código pós-login (e passo extra da redefinição de senha). */
export async function verifyLoginCode(code: string): Promise<void> {
  const { verified } = await listTotpFactors();
  const factor = verified[0];
  if (!factor) {
    throw new AuthFlowError("mfa_factor_not_found", describeAuthError({ code: "mfa_factor_not_found" }, "mfa"));
  }
  await challengeAndVerify(factor.id, code);
}

/**
 * Desativa o TOTP. Pede um código NOVO mesmo com a sessão já em aal2: quem
 * pegou um notebook destravado não desliga a proteção sem o celular.
 */
export async function disableTotp(factorId: string, code: string): Promise<void> {
  await challengeAndVerify(factorId, code);

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) fail(error);

  // O JWT atual ainda carrega o fator; renovar evita tela de código indevida.
  await supabase.auth.refreshSession().catch(() => undefined);
}
