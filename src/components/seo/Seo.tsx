import { useEffect } from "react";

import {
  OG_IMAGE,
  SITE_LOCALE,
  SITE_NAME,
  TWITTER_HANDLE,
  absoluteUrl,
  type SeoConfig,
} from "@/lib/seo";

/**
 * Gerenciador de <head> sem dependência externa (sem react-helmet).
 *
 * Faz upsert das tags pelo seletor — nunca duplica meta/link a cada navegação
 * — e troca o bloco JSON-LD da rota (`#seo-jsonld-page`). O grafo base
 * (Organization/WebSite/SoftwareApplication) é estático no index.html.
 *
 * JSON-LD é inserido como data block (`type="application/ld+json"`): não é
 * executado, então não esbarra na CSP `script-src 'self'`.
 */

type Attr = "name" | "property";

function upsertMeta(attr: Attr, key: string, content: string | null) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (content == null || content === "") {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(selector: string, attrs: Record<string, string> | null) {
  const existing = Array.from(document.head.querySelectorAll<HTMLLinkElement>(selector));
  if (!attrs) {
    existing.forEach((el) => el.remove());
    return;
  }
  const [el, ...duplicates] = existing.length ? existing : [document.createElement("link")];
  duplicates.forEach((dup) => dup.remove());
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  if (!el.isConnected) document.head.appendChild(el);
}

function upsertJsonLd(id: string, data: SeoConfig["jsonLd"]) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function applySeo(config: SeoConfig) {
  const image = absoluteUrl(config.image ?? OG_IMAGE.path);
  const imageAlt = config.imageAlt ?? OG_IMAGE.alt;
  const canonical = config.canonicalPath != null ? absoluteUrl(config.canonicalPath) : null;

  document.title = config.title;
  document.documentElement.lang = "pt-BR";

  upsertMeta("name", "description", config.description);
  upsertMeta("name", "robots", config.robots);
  upsertMeta("name", "googlebot", config.robots);

  upsertLink('link[rel="canonical"]', canonical ? { rel: "canonical", href: canonical } : null);
  upsertLink(
    'link[rel="alternate"][hreflang="pt-BR"]',
    canonical ? { rel: "alternate", hreflang: "pt-BR", href: canonical } : null,
  );
  upsertLink(
    'link[rel="alternate"][hreflang="x-default"]',
    canonical ? { rel: "alternate", hreflang: "x-default", href: canonical } : null,
  );

  upsertMeta("property", "og:type", config.ogType ?? "website");
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:locale", SITE_LOCALE);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:title", config.title);
  upsertMeta("property", "og:description", config.description);
  upsertMeta("property", "og:image", image);
  upsertMeta("property", "og:image:secure_url", image);
  upsertMeta("property", "og:image:width", config.image ? null : String(OG_IMAGE.width));
  upsertMeta("property", "og:image:height", config.image ? null : String(OG_IMAGE.height));
  upsertMeta("property", "og:image:alt", imageAlt);

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:site", TWITTER_HANDLE);
  upsertMeta("name", "twitter:title", config.title);
  upsertMeta("name", "twitter:description", config.description);
  upsertMeta("name", "twitter:image", image);
  upsertMeta("name", "twitter:image:alt", imageAlt);

  upsertJsonLd("seo-jsonld-page", config.jsonLd);
}

/** Uso pontual numa página que precisa de metadados próprios (sobrescreve o RouteSeo). */
export function Seo(props: SeoConfig) {
  const key = JSON.stringify(props);
  useEffect(() => {
    applySeo(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
