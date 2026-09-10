import { PRIVACY_POLICY } from "@/lib/legal";

import { LegalPage } from "./LegalPage";

/** Rota pública `/legal/politica-de-privacidade`. */
export default function PrivacyPolicyPage() {
  return <LegalPage document={PRIVACY_POLICY} variant="public" />;
}

/** Mesma leitura dentro do sistema autenticado. */
export function PrivacyPolicyAppPage() {
  return <LegalPage document={PRIVACY_POLICY} variant="app" />;
}
