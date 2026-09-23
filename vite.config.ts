import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Commit do build, exibido no rodapé do login (src/components/auth/AuthForm.tsx).
 * Usa o SHA que a plataforma de CI expõe; em build local, cai no git.
 */
function resolveBuildCommit(): string {
  const fromCi =
    process.env.WORKERS_CI_COMMIT_SHA || // Cloudflare Workers Builds
    process.env.CF_PAGES_COMMIT_SHA || // Cloudflare Pages
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_REF; // Netlify
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
}

/**
 * SEO no build:
 *  - troca a URL base placeholder (https://app.meuorbi.com) pela URL pública real
 *    (ver `resolveSiteUrl`) em index.html, robots.txt, sitemap.xml e llms.txt;
 *  - injeta a mesma URL em `import.meta.env.VITE_SITE_URL` (src/lib/seo.ts) para
 *    o <head> de runtime não divergir do HTML estático;
 *  - atualiza <lastmod> do sitemap para a data do build;
 *  - injeta as metas de verificação do Google Search Console / Bing se as
 *    variáveis existirem (VITE_GOOGLE_SITE_VERIFICATION / VITE_BING_SITE_VERIFICATION).
 */
const PLACEHOLDER_SITE_URL = "https://app.meuorbi.com";
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

/**
 * Guarda de segredo: tudo que começa com `VITE_` vai para o bundle público.
 *  - nome com cara de segredo (SECRET/SERVICE_ROLE/PRIVATE/PASSWORD) → build falha;
 *  - `VITE_TURNSTILE_SITE_KEY` fora do formato de SITE key → build falha. O
 *    secret do Turnstile tem o mesmo prefixo `0x4AAAAAAA` e é mais longo: colado
 *    no lugar errado, ele iria para qualquer visitante e permitiria forjar o
 *    siteverify. O secret vive só no painel do Supabase (Auth → Attack Protection).
 * Mesmo padrão de src/lib/auth/turnstile.ts.
 */
const TURNSTILE_SITE_KEY_PATTERN = /^[0-3]x[A-Za-z0-9_-]{20,26}$/;
const SECRET_LIKE_ENV = /(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|WEBHOOK_TOKEN)/i;

function assertNoSecretsInClientEnv(env: Record<string, string>) {
  const leaked = Object.keys(env).filter((key) => key.startsWith("VITE_") && SECRET_LIKE_ENV.test(key));
  if (leaked.length > 0) {
    throw new Error(
      `[env] Variáveis com cara de segredo não podem usar o prefixo VITE_ (vão para o bundle público): ${leaked.join(", ")}`,
    );
  }

  const siteKey = env.VITE_TURNSTILE_SITE_KEY?.trim();
  if (siteKey && !TURNSTILE_SITE_KEY_PATTERN.test(siteKey)) {
    // Nunca ecoa o valor: pode ser justamente o secret.
    throw new Error(
      "[env] VITE_TURNSTILE_SITE_KEY não tem formato de SITE key do Turnstile. Se você colou o SECRET key, remova-o daqui e revogue-o (Cloudflare → Turnstile → Rotate secret).",
    );
  }
}

/**
 * Guarda de endpoint: `VITE_SUPABASE_URL` precisa apontar para o projeto Supabase
 * (https://<ref>.supabase.co) — ou Supabase local em dev. Se apontar para o próprio
 * site (ex.: https://app.meuorbi.com), o login faz POST em /auth/v1/token no Cloudflare
 * Workers static assets, que responde 405 Method Not Allowed. A CSP (connect-src) também
 * só libera *.supabase.co, então qualquer outro host quebraria em produção de todo jeito.
 */
const SUPABASE_URL_PATTERN = /^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/;
const LOCAL_SUPABASE_URL_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+\/?$/;

function assertSupabaseUrl(env: Record<string, string>, mode: string) {
  const url = env.VITE_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("[env] VITE_SUPABASE_URL ausente. Defina https://<ref>.supabase.co nas variáveis de build.");
  }
  if (SUPABASE_URL_PATTERN.test(url)) return;
  if (mode !== "production" && LOCAL_SUPABASE_URL_PATTERN.test(url)) return;
  throw new Error(
    `[env] VITE_SUPABASE_URL inválida (${url}). Deve ser a URL do projeto Supabase (https://<ref>.supabase.co), não o domínio do site.`,
  );
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  assertNoSecretsInClientEnv(env);
  assertSupabaseUrl(env, mode);
  const siteUrl = resolveSiteUrl(env);

  return {
    define: {
      "import.meta.env.VITE_SITE_URL": JSON.stringify(siteUrl),
      __BUILD_COMMIT__: JSON.stringify(resolveBuildCommit()),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
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
