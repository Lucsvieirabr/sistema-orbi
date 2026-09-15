/**
 * SEO do Orbi — fonte única de metadados por rota.
 *
 * - `SITE_URL` vem de `VITE_SITE_URL` (sem barra final). O mesmo valor é usado
 *   pelo `seoPlugin` do `vite.config.ts` para reescrever index.html, robots.txt,
 *   sitemap.xml e llms.txt no build.
 * - `resolveRouteSeo(pathname)` devolve o bloco de <head> de cada rota. Rota
 *   pública nova => adicionar em `PUBLIC_ROUTES` E em `public/sitemap.xml`.
 * - Área autenticada (/sistema, /admin, /billing) e 404 são `noindex` DE
 *   PROPÓSITO (dados privados / soft-404 de SPA). Qualquer outra rota é
 *   indexável por padrão — não existe noindex implícito.
 */

const RAW_SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) || "https://orbi.com.br";

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");
export const SITE_NAME = "Orbi";
export const SITE_LOCALE = "pt_BR";
export const SITE_LANGUAGE = "pt-BR";
export const TWITTER_HANDLE = "@orbi_finance";

export const DEFAULT_TITLE = "Orbi · Gestão financeira com IA: importe o extrato e organize suas finanças";
export const DEFAULT_DESCRIPTION =
  "Importe o extrato do banco e a IA do Orbi categoriza cada lançamento. Saldo real, saldo projetado, faturas, parcelas e Plano Casal em um só lugar. Comece grátis.";

export const OG_IMAGE = {
  path: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Orbi: importe o extrato e o Orbi organiza suas finanças",
};

export const ROBOTS_INDEX = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
export const ROBOTS_NOINDEX = "noindex, nofollow";

export type JsonLd = Record<string, unknown>;

export interface SeoConfig {
  title: string;
  description: string;
  /** Caminho canônico (sem query/hash). `null` = sem canonical (páginas noindex). */
  canonicalPath: string | null;
  robots: string;
  ogType?: "website" | "article";
  image?: string;
  imageAlt?: string;
  /** JSON-LD específico da rota (o grafo base Organization/WebSite/SoftwareApplication fica no index.html). */
  jsonLd?: JsonLd | JsonLd[];
}

export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Remove barra final (exceto na raiz) para o canonical não duplicar /pricing e /pricing/. */
export const normalizePath = (pathname: string) => {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
};

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

function webPage(path: string, name: string, description: string, type = "WebPage"): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name,
    description,
    inLanguage: SITE_LANGUAGE,
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORGANIZATION_ID },
    primaryImageOfPage: { "@type": "ImageObject", url: absoluteUrl(OG_IMAGE.path) },
  };
}

function breadcrumb(items: Array<{ name: string; path: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

const HOME_TITLE = "Orbi · Importe o extrato, a IA organiza suas finanças";
const PRICING_TITLE = "Planos e preços · Orbi";
const PRICING_DESCRIPTION =
  "Compare os planos do Orbi: Free para sempre, Pro com IA classificadora de extratos e Casal com dois acessos. Mensal ou anual, pagamento por Pix, boleto ou cartão.";
const LOGIN_TITLE = "Entrar ou criar conta · Orbi";
const LOGIN_DESCRIPTION =
  "Acesse o Orbi ou crie sua conta grátis com e-mail e senha. O plano Free libera contas, cartões e o extrato do mês sem pedir cartão.";
const TERMS_TITLE = "Termos de Uso · Orbi";
const TERMS_DESCRIPTION = "Termos de Uso do Orbi: regras de uso da plataforma, assinatura, cancelamento e responsabilidades.";
const PRIVACY_TITLE = "Política de Privacidade · Orbi";
const PRIVACY_DESCRIPTION =
  "Política de Privacidade do Orbi: quais dados coletamos, como tratamos e protegemos, e seus direitos pela LGPD.";

const PUBLIC_ROUTES: Record<string, SeoConfig> = {
  "/": {
    title: HOME_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: "/",
    robots: ROBOTS_INDEX,
    jsonLd: webPage("/", HOME_TITLE, DEFAULT_DESCRIPTION),
  },
  "/pricing": {
    title: PRICING_TITLE,
    description: PRICING_DESCRIPTION,
    canonicalPath: "/pricing",
    robots: ROBOTS_INDEX,
    jsonLd: [
      webPage("/pricing", PRICING_TITLE, PRICING_DESCRIPTION),
      breadcrumb([
        { name: "Início", path: "/" },
        { name: "Planos e preços", path: "/pricing" },
      ]),
    ],
  },
  "/login": {
    title: LOGIN_TITLE,
    description: LOGIN_DESCRIPTION,
    canonicalPath: "/login",
    robots: ROBOTS_INDEX,
    jsonLd: webPage("/login", LOGIN_TITLE, LOGIN_DESCRIPTION),
  },
  "/legal/termos-de-uso": {
    title: TERMS_TITLE,
    description: TERMS_DESCRIPTION,
    canonicalPath: "/legal/termos-de-uso",
    robots: ROBOTS_INDEX,
    ogType: "article",
    jsonLd: [
      webPage("/legal/termos-de-uso", TERMS_TITLE, TERMS_DESCRIPTION),
      breadcrumb([
        { name: "Início", path: "/" },
        { name: "Termos de Uso", path: "/legal/termos-de-uso" },
      ]),
    ],
  },
  "/legal/politica-de-privacidade": {
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    canonicalPath: "/legal/politica-de-privacidade",
    robots: ROBOTS_INDEX,
    ogType: "article",
    jsonLd: [
      webPage("/legal/politica-de-privacidade", PRIVACY_TITLE, PRIVACY_DESCRIPTION),
      breadcrumb([
        { name: "Início", path: "/" },
        { name: "Política de Privacidade", path: "/legal/politica-de-privacidade" },
      ]),
    ],
  },
};

/** Aliases que redirecionam (App.tsx) — canonical aponta para o destino. */
const ALIASES: Record<string, string> = {
  "/termos-de-uso": "/legal/termos-de-uso",
  "/politica-de-privacidade": "/legal/politica-de-privacidade",
};

const PRIVATE_TITLES: Array<[RegExp, string]> = [
  [/^\/sistema\/statement/, "Extrato mensal"],
  [/^\/sistema\/categories/, "Categorias"],
  [/^\/sistema\/accounts/, "Contas"],
  [/^\/sistema\/cards\/[^/]+\/statements/, "Faturas do cartão"],
  [/^\/sistema\/cards/, "Cartões"],
  [/^\/sistema\/people/, "Pessoas"],
  [/^\/sistema\/my-ai/, "Minha IA"],
  [/^\/sistema\/notes/, "Notas"],
  [/^\/sistema\/settings/, "Configurações"],
  [/^\/sistema\/budgets/, "Orçamentos"],
  [/^\/sistema\/goals/, "Metas"],
  [/^\/sistema\/analytics/, "Fechamento do mês"],
  [/^\/sistema\/legal\/termos-de-uso/, "Termos de Uso"],
  [/^\/sistema\/legal\/politica-de-privacidade/, "Política de Privacidade"],
  [/^\/sistema\/?$/, "Painel"],
  [/^\/admin/, "Admin"],
  [/^\/billing/, "Assinatura pendente"],
];

const PRIVATE_PREFIXES = ["/sistema", "/admin", "/billing"];

export function resolveRouteSeo(pathname: string): SeoConfig {
  const path = normalizePath(pathname);
  const target = ALIASES[path] ?? path;

  const publicConfig = PUBLIC_ROUTES[target];
  if (publicConfig) return publicConfig;

  const isPrivate = PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (isPrivate) {
    const label = PRIVATE_TITLES.find(([pattern]) => pattern.test(path))?.[1];
    return {
      title: label ? `${label} · Orbi` : "Orbi",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: null,
      robots: ROBOTS_NOINDEX,
    };
  }

  // Qualquer outra URL cai no <NotFound /> do App.tsx: soft-404 → noindex.
  return {
    title: "Página não encontrada · Orbi",
    description: DEFAULT_DESCRIPTION,
    canonicalPath: null,
    robots: ROBOTS_NOINDEX,
  };
}
