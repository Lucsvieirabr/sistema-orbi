/// <reference types="vite/client" />

/** Injetados pelo vite.config.ts no build. */
declare const __BUILD_COMMIT__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SITE_URL?: string;
  /** Site key PÚBLICA do Cloudflare Turnstile. O secret nunca entra em VITE_*. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}
