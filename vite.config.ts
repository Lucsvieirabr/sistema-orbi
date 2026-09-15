import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * SEO no build:
 *  - troca a URL base placeholder (https://orbi.com.br) pela URL pública real
 *    (ver `resolveSiteUrl`) em index.html, robots.txt, sitemap.xml e llms.txt;
 *  - injeta a mesma URL em `import.meta.env.VITE_SITE_URL` (src/lib/seo.ts) para
 *    o <head> de runtime não divergir do HTML estático;
 *  - atualiza <lastmod> do sitemap para a data do build;
 *  - injeta as metas de verificação do Google Search Console / Bing se as
 *    variáveis existirem (VITE_GOOGLE_SITE_VERIFICATION / VITE_BING_SITE_VERIFICATION).
 */
const PLACEHOLDER_SITE_URL = "https://orbi.com.br";
const SEO_TEXT_FILES = ["robots.txt", "sitemap.xml", "llms.txt"];

/**
 * URL pública usada em og:image, og:url, canonical, sitemap etc.
 *
 * Crawlers de preview (WhatsApp, Facebook, LinkedIn, X, Slack, Telegram) NÃO
 * executam JS: leem só o HTML estático e baixam a imagem pela URL ABSOLUTA do
 * og:image. Se o domínio não resolver, o link é compartilhado sem imagem — e o
 * Facebook ainda segue og:url para raspar a página "canônica".
 *
 * Ordem: domínio de produção informado pela plataforma no build (é o domínio
 * que de fato está no ar, e muda sozinho quando um domínio próprio é ligado)
 * → VITE_SITE_URL → placeholder (só dev local).
 *  - Vercel: VERCEL_PROJECT_PRODUCTION_URL (host sem protocolo).
 *  - Netlify: URL (URL principal do site, com protocolo).
 */
function resolveSiteUrl(env: Record<string, string>): string {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const netlifyUrl = process.env.NETLIFY === "true" ? process.env.URL : undefined;
  const raw =
    (vercelHost && `https://${vercelHost.replace(/^https?:\/\//, "")}`) ||
    netlifyUrl ||
    env.VITE_SITE_URL ||
    PLACEHOLDER_SITE_URL;
  return raw.trim().replace(/^http:\/\//, "https://").replace(/\/+$/, "");
}

function seoPlugin(siteUrl: string, env: Record<string, string>): Plugin {
  const buildDate = new Date().toISOString().slice(0, 10);
  let outDir = "dist";

  const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  return {
    name: "orbi-seo",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      let out = html.split(PLACEHOLDER_SITE_URL).join(siteUrl);
      const verifications: string[] = [];
      if (env.VITE_GOOGLE_SITE_VERIFICATION) {
        verifications.push(
          `<meta name="google-site-verification" content="${escapeAttr(env.VITE_GOOGLE_SITE_VERIFICATION)}" />`,
        );
      }
      if (env.VITE_BING_SITE_VERIFICATION) {
        verifications.push(`<meta name="msvalidate.01" content="${escapeAttr(env.VITE_BING_SITE_VERIFICATION)}" />`);
      }
      if (verifications.length) {
        out = out.replace("</head>", `    ${verifications.join("\n    ")}\n  </head>`);
      }
      return out;
    },
    writeBundle() {
      for (const file of SEO_TEXT_FILES) {
        const target = path.join(outDir, file);
        if (!fs.existsSync(target)) continue;
        let content = fs.readFileSync(target, "utf8").split(PLACEHOLDER_SITE_URL).join(siteUrl);
        if (file === "sitemap.xml") {
          content = content.replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${buildDate}</lastmod>`);
        }
        fs.writeFileSync(target, content);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const siteUrl = resolveSiteUrl(env);

  return {
    define: {
      "import.meta.env.VITE_SITE_URL": JSON.stringify(siteUrl),
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), seoPlugin(siteUrl, env), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
