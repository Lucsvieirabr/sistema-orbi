import type { Session } from "@supabase/supabase-js";

/**
 * ============================================================================
 * NÍVEL DE GARANTIA DA SESSÃO (AAL) — leitura síncrona
 * ============================================================================
 * aal1 = entrou só com senha (ou link de e-mail).
 * aal2 = além disso, validou um fator TOTP nesta sessão.
 *
 * Mesma regra de `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`, mas
 * síncrona: aquela chamada disputa o lock interno do supabase-js e trava se for
 * feita DENTRO de `onAuthStateChange`. Aqui só se lê o claim `aal` do JWT já
 * recebido e os fatores do usuário da sessão.
 *
 * Isto decide ROTA, não autorização. A autoridade é o Postgres: policies RLS
 * leem `auth.jwt()->>'aal'` do token assinado (migration
 * `20260916165204_mfa_assurance_helpers.sql`). Um cliente adulterado que pule a
 * tela de código continua sem dados protegidos.
 * ============================================================================
 */

export type AssuranceLevel = "aal1" | "aal2";

export interface SessionAssurance {
  current: AssuranceLevel | null;
  next: AssuranceLevel | null;
  /** Tem TOTP verificado e ainda não validou o código nesta sessão. */
  needsChallenge: boolean;
}

export type SessionStage = "anonymous" | "mfa_required" | "authenticated";

function readAalClaim(accessToken: string | undefined): AssuranceLevel | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const claims = JSON.parse(atob(padded)) as { aal?: unknown };
    return claims.aal === "aal2" ? "aal2" : claims.aal === "aal1" ? "aal1" : null;
  } catch {
    return null;
  }
}

export function assuranceFromSession(session: Session | null | undefined): SessionAssurance {
  if (!session) return { current: null, next: null, needsChallenge: false };

  const current = readAalClaim(session.access_token) ?? "aal1";
  const hasVerifiedFactor = (session.user?.factors ?? []).some((factor) => factor.status === "verified");
  const next: AssuranceLevel = hasVerifiedFactor ? "aal2" : current;

  return { current, next, needsChallenge: next === "aal2" && current !== "aal2" };
}

export function stageFromSession(session: Session | null | undefined): SessionStage {
  if (!session) return "anonymous";
  return assuranceFromSession(session).needsChallenge ? "mfa_required" : "authenticated";
}
