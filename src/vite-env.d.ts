/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SITE_URL?: string;
  /** Site key PÚBLICA do Cloudflare Turnstile. O secret nunca entra em VITE_*. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}
