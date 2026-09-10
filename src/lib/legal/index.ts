import { supabase } from "@/integrations/supabase/client";

import { PRIVACY_POLICY } from "./privacy-policy";
import { TERMS_OF_USE } from "./terms-of-use";
import type { LegalConsentContext, LegalDocument, LegalDocumentSlug } from "./legal-types";

export * from "./legal-types";
export { PRIVACY_POLICY } from "./privacy-policy";
export { TERMS_OF_USE } from "./terms-of-use";

export const LEGAL_DOCUMENTS: Record<LegalDocumentSlug, LegalDocument> = {
  "terms-of-use": TERMS_OF_USE,
  "privacy-policy": PRIVACY_POLICY,
};

export const LEGAL_DOCUMENT_LIST: LegalDocument[] = [TERMS_OF_USE, PRIVACY_POLICY];

/**
 * Assinatura do par de documentos vigente no momento do aceite.
 * Gravada junto do consentimento — é o que permite provar, depois, QUAL texto
 * o usuário aceitou (LGPD art. 8º, §1º).
 */
export function getLegalVersionStamp() {
  return {
    terms_version: TERMS_OF_USE.version,
    terms_updated_at: TERMS_OF_USE.updatedAt,
    privacy_version: PRIVACY_POLICY.version,
    privacy_updated_at: PRIVACY_POLICY.updatedAt,
  };
}

/** Data legível `10/09/2026` sem o bug de fuso de `new Date('YYYY-MM-DD')`. */
export function formatLegalDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export interface LegalConsentPayload {
  context: LegalConsentContext;
  /** Identificador do plano, quando o aceite ocorre na contratação. */
  planId?: string;
  billingCycle?: string;
}

/**
 * Registra o aceite no metadata do usuário autenticado.
 *
 * Escolha deliberada por `auth.updateUser({ data })` em vez de escrever em
 * `user_profiles`: não exige migration, não corre risco de sobrescrever o
 * `metadata` jsonb do perfil e o dado fica no mesmo lugar em que o aceite do
 * cadastro é gravado (`signUp options.data`), mantendo uma trilha única.
 *
 * Falha aqui NUNCA bloqueia o fluxo do usuário — o aceite já ocorreu na
 * interface; a gravação é registro complementar.
 */
export async function recordLegalConsent(payload: LegalConsentPayload): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const previous = Array.isArray((user.user_metadata as any)?.legal_consents)
      ? ((user.user_metadata as any).legal_consents as unknown[])
      : [];

    const entry = {
      context: payload.context,
      accepted_at: new Date().toISOString(),
      plan_id: payload.planId ?? null,
      billing_cycle: payload.billingCycle ?? null,
      ...getLegalVersionStamp(),
    };

    const { error } = await supabase.auth.updateUser({
      data: {
        legal_consents: [...previous.slice(-19), entry],
        legal_terms_accepted_at: entry.accepted_at,
        ...getLegalVersionStamp(),
      },
    });

    if (error) console.warn("[legal] não foi possível registrar o aceite:", error.message);
  } catch (error) {
    console.warn("[legal] falha ao registrar aceite:", error);
  }
}

/** Metadata anexado ao `signUp` — o aceite existe desde a criação da conta. */
export function buildSignupConsentMetadata() {
  const acceptedAt = new Date().toISOString();
  return {
    legal_terms_accepted_at: acceptedAt,
    ...getLegalVersionStamp(),
    legal_consents: [
      {
        context: "signup" as LegalConsentContext,
        accepted_at: acceptedAt,
        plan_id: null,
        billing_cycle: null,
        ...getLegalVersionStamp(),
      },
    ],
  };
}
