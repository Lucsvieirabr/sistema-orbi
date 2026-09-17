import { useRef, useState } from "react";

import type { TurnstileHandle, TurnstileStatus } from "@/components/auth/TurnstileField";
import { isTurnstileEnabled } from "@/lib/auth/turnstile";

/**
 * Estado do captcha para um formulário.
 *
 * - `blocking`: ainda carregando/verificando — segura o envio por alguns
 *   instantes para não gastar uma tentativa que o Supabase recusaria.
 * - Em `error` o envio NÃO é bloqueado no cliente: se o captcha estiver ligado
 *   no Supabase, o servidor recusa com `captcha_failed` (mensagem clara); se
 *   não estiver, a pessoa não fica presa por um bloqueador de anúncio.
 */
export function useTurnstile() {
  const ref = useRef<TurnstileHandle>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<TurnstileStatus>(isTurnstileEnabled ? "loading" : "disabled");

  const blocking = isTurnstileEnabled && !token && (status === "loading" || status === "ready");

  return {
    ref,
    token,
    status,
    blocking,
    /** Passar para o supabase-js: `options.captchaToken`. */
    captchaToken: token ?? undefined,
    reset: () => ref.current?.reset(),
    fieldProps: { ref, onToken: setToken, onStatusChange: setStatus },
  };
}
