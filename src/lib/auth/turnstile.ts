/**
 * ============================================================================
 * CLOUDFLARE TURNSTILE — carregamento e configuração (lado do navegador)
 * ============================================================================
 * Quem valida o token é o Supabase Auth (GoTrue), não este código: com
 * "Enable Captcha protection" ligado no painel, `/auth/v1/signup`, `/token`
 * (senha) e `/recover` exigem `captchaToken` e chamam o siteverify da
 * Cloudflare com o SECRET guardado no próprio Supabase.
 *
 *   navegador → captchaToken → Supabase Auth → siteverify (Cloudflare)
 *
 * O SECRET nunca passa por aqui: não existe em `VITE_*`, `.env`, código ou log.
 * Só a SITE KEY (pública por definição) entra no bundle, via
 * `VITE_TURNSTILE_SITE_KEY`. O `vite.config.ts` derruba o build se alguém colar
 * o secret nessa variável (o formato do secret é mais longo).
 *
 * Token é de uso único: todo envio (sucesso OU erro) chama `reset()` do widget.
 * ============================================================================
 */

const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const LOAD_TIMEOUT_MS = 15_000;

/**
 * Site key: `0x`/`1x`/`2x`/`3x` + 20–26 chars. Secret key tem ~33 chars depois
 * do prefixo — fica de fora deste formato de propósito.
 * Espelhado em `vite.config.ts` (guarda de build).
 */
export const TURNSTILE_SITE_KEY_PATTERN = /^[0-3]x[A-Za-z0-9_-]{20,26}$/;

/** Ações por superfície (aparecem no painel Turnstile Analytics). `[a-z0-9_-]{1,32}`. */
export type TurnstileAction = "login" | "signup" | "password_reset" | "admin_login";

export interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  language?: string;
  size?: "normal" | "flexible" | "compact";
  appearance?: "always" | "execute" | "interaction-only";
  retry?: "auto" | "never";
  "refresh-expired"?: "auto" | "manual" | "never";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  "error-callback"?: (code: string) => boolean | void;
  "before-interactive-callback"?: () => void;
  "after-interactive-callback"?: () => void;
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function readSiteKey(): string | null {
  const raw = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? "";
  return TURNSTILE_SITE_KEY_PATTERN.test(raw) ? raw : null;
}

/** `null` = Turnstile desligado neste build (variável ausente ou inválida). */
export const TURNSTILE_SITE_KEY = readSiteKey();
export const isTurnstileEnabled = TURNSTILE_SITE_KEY !== null;

let loader: Promise<TurnstileApi> | null = null;

/**
 * Injeta o `api.js` uma única vez (sem script inline — compatível com a CSP
 * `script-src 'self' https://challenges.cloudflare.com`). Falha (bloqueador,
 * rede, CSP) libera nova tentativa na próxima chamada.
 */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("turnstile_unavailable"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loader) return loader;

  loader = new Promise<TurnstileApi>((resolve, reject) => {
    const fail = (reason: string) => {
      loader = null;
      document.getElementById(SCRIPT_ID)?.remove();
      reject(new Error(reason));
    };

    const timer = window.setTimeout(() => fail("turnstile_load_timeout"), LOAD_TIMEOUT_MS);

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.referrerPolicy = "strict-origin";
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else fail("turnstile_missing_global");
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      fail("turnstile_load_error");
    };

    document.head.appendChild(script);
  });

  return loader;
}
