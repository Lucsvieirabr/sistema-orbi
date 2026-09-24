import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { RotateCw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import {
  isTurnstileEnabled,
  loadTurnstile,
  TURNSTILE_SITE_KEY,
  type TurnstileAction,
  type TurnstileApi,
} from "@/lib/auth/turnstile";
import { cn } from "@/lib/utils";

export type TurnstileStatus = "disabled" | "loading" | "ready" | "verified" | "error";

export interface TurnstileHandle {
  /** Descarta o token atual e pede outro. Chamar depois de TODO envio. */
  reset: () => void;
}

interface TurnstileFieldProps {
  action: TurnstileAction;
  onToken: (token: string | null) => void;
  onStatusChange?: (status: TurnstileStatus) => void;
  className?: string;
}

/**
 * Widget Turnstile em modo `interaction-only`: invisível para a maioria das
 * pessoas (o token chega sozinho em ~1 s); só aparece a caixa quando a
 * Cloudflare decide pedir interação. Sem site key no build, não renderiza nada.
 */
export const TurnstileField = forwardRef<TurnstileHandle, TurnstileFieldProps>(function TurnstileField(
  { action, onToken, onStatusChange, className },
  ref,
) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<TurnstileStatus>(isTurnstileEnabled ? "loading" : "disabled");
  const [interactive, setInteractive] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Callbacks mais recentes sem re-renderizar o widget a cada render do pai.
  const onTokenRef = useRef(onToken);
  const onStatusRef = useRef(onStatusChange);
  onTokenRef.current = onToken;
  onStatusRef.current = onStatusChange;

  const updateStatus = useCallback((next: TurnstileStatus) => {
    setStatus(next);
    onStatusRef.current?.(next);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        onTokenRef.current(null);
        if (apiRef.current && widgetIdRef.current) {
          updateStatus("ready");
          apiRef.current.reset(widgetIdRef.current);
        }
      },
    }),
    [updateStatus],
  );

  useEffect(() => {
    if (!isTurnstileEnabled || !TURNSTILE_SITE_KEY) {
      onStatusRef.current?.("disabled");
      return;
    }

    let cancelled = false;
    updateStatus("loading");
    onTokenRef.current(null);

    loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        apiRef.current = api;
        widgetIdRef.current =
          api.render(containerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            action,
            theme: theme === "dark" ? "dark" : "light",
            language: "pt-br",
            size: "flexible",
            appearance: "interaction-only",
            // Sem retry automático: em falha o widget recriava o iframe em laço; o
            // "Tentar de novo" abaixo é o caminho (1 widget por tela).
            retry: "never",
            "refresh-expired": "auto",
            callback: (token) => {
              onTokenRef.current(token);
              updateStatus("verified");
            },
            "expired-callback": () => {
              onTokenRef.current(null);
              updateStatus("ready");
            },
            "timeout-callback": () => {
              onTokenRef.current(null);
              updateStatus("ready");
            },
            "error-callback": () => {
              onTokenRef.current(null);
              updateStatus("error");
              // true = tratado aqui; o código de erro não vai para o console.
              return true;
            },
            "before-interactive-callback": () => setInteractive(true),
            "after-interactive-callback": () => setInteractive(false),
          }) ?? null;
        if (!widgetIdRef.current) updateStatus("error");
        else updateStatus("ready");
      })
      .catch(() => {
        if (!cancelled) updateStatus("error");
      });

    return () => {
      cancelled = true;
      onTokenRef.current(null);
      if (apiRef.current && widgetIdRef.current) {
        try {
          apiRef.current.remove(widgetIdRef.current);
        } catch {
          /* widget já removido */
        }
      }
      widgetIdRef.current = null;
      setInteractive(false);
    };
    // Tema e ação mudam a aparência/telemetria: widget novo, token novo.
  }, [action, theme, attempt, updateStatus]);

  if (status === "disabled") return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={containerRef}
        className={cn(
          "overflow-hidden transition-[min-height] duration-200 ease-swift",
          interactive ? "min-h-[65px]" : "min-h-0",
        )}
      />

      {status === "error" ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-warning-soft p-3 text-xs text-warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="flex-1 space-y-1.5">
            <p className="leading-relaxed">
              A verificação de segurança não carregou. Desative bloqueadores de anúncio para este site ou tente de novo.
            </p>
            <Button
              type="button"
              variant="subtle"
              size="sm"
              className="-ml-3 h-8 text-warning hover:text-warning md:h-8"
              onClick={() => setAttempt((n) => n + 1)}
            >
              <RotateCw aria-hidden />
              Tentar de novo
            </Button>
          </div>
        </div>
      ) : (
        <p className="sr-only" aria-live="polite">
          {status === "verified" ? "Verificação de segurança concluída." : "Verificando a conexão…"}
        </p>
      )}
    </div>
  );
});
