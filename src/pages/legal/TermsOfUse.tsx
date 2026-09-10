import { TERMS_OF_USE } from "@/lib/legal";

import { LegalPage } from "./LegalPage";

/** Rota pública `/legal/termos-de-uso`. */
export default function TermsOfUsePage() {
  return <LegalPage document={TERMS_OF_USE} variant="public" />;
}

/** Mesma leitura dentro do sistema autenticado. */
export function TermsOfUseAppPage() {
  return <LegalPage document={TERMS_OF_USE} variant="app" />;
}
