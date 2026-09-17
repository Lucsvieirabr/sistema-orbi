/**
 * Tipos e configuração compartilhada dos documentos legais do Orbi.
 *
 * Os textos vivem como dado estruturado (não como JSX solto) para que o mesmo
 * conteúdo possa ser renderizado em três superfícies sem duplicação:
 *   1. página pública (`/legal/*`), lida sem login;
 *   2. página interna (`/sistema/legal/*`), lida por quem já usa o sistema;
 *   3. modal de leitura acionado pelos checkboxes de consentimento.
 *
 * Regra de versionamento: qualquer alteração material de texto exige subir
 * `version` e `updatedAt`. A versão aceita é gravada junto do consentimento
 * (ver `recordLegalConsent`), o que é a prova de aceite exigida pela LGPD
 * (art. 8º, §1º — ônus da prova do consentimento é do controlador).
 */

export type LegalBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "callout"; text: string };

export interface LegalSection {
  /** Âncora estável (`#coleta-de-dados`) — não renomear sem necessidade. */
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  slug: LegalDocumentSlug;
  /** Rota pública canônica do documento. */
  path: string;
  /** Rota de leitura dentro do app autenticado. */
  appPath: string;
  title: string;
  /** Rótulo curto usado em links inline ("Termos de Uso"). */
  shortTitle: string;
  eyebrow: string;
  version: string;
  /** ISO `YYYY-MM-DD`. Nunca instanciar com `new Date(str)` puro (fuso). */
  updatedAt: string;
  summary: string;
  sections: LegalSection[];
}

export type LegalDocumentSlug = "terms-of-use" | "privacy-policy";

/**
 * Identificação do controlador e canais de contato exigidos pela LGPD
 * (art. 9º, I e III; art. 41, §1º). Ponto único de alteração — se o CNPJ,
 * a razão social ou o e-mail do Encarregado mudarem, muda-se só aqui.
 */
export const LEGAL_CONTROLLER = {
  productName: "Orbi",
  legalName: "Orbi Tecnologia e Gestão Financeira",
  supportEmail: "suporte@meuorbi.com",
  privacyEmail: "privacidade@meuorbi.com",
  dpoName: "Encarregado de Proteção de Dados do Orbi",
  jurisdiction: "República Federativa do Brasil",
} as const;

/** Contexto em que o consentimento foi coletado (auditoria). */
export type LegalConsentContext = "signup" | "subscription";
