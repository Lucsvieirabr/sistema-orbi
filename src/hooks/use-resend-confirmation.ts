import { useCallback, useEffect, useState } from "react";

import { describeAuthError } from "@/lib/auth/auth-errors";
import { RESEND_COOLDOWN_SECONDS, resendConfirmationEmail } from "@/services/auth/email-confirmation";

type Phase = "idle" | "sending" | "sent" | "error";

/**
 * Reenvio do e-mail de confirmação com contagem regressiva.
 *
 * O GoTrue recusa um segundo e-mail dentro de 60 s (`over_email_send_rate_limit`).
 * Em vez de deixar a pessoa levar o erro na cara, o botão fica desabilitado
 * com o relógio visível — o mesmo contrato já usado na recuperação de senha.
 */
export function useResendConfirmation() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const resend = useCallback(
    async (email: string, captchaToken?: string) => {
      if (!email || phase === "sending" || secondsLeft > 0) return false;

      setPhase("sending");
      setError(null);

      try {
        await resendConfirmationEmail(email, captchaToken);
        setPhase("sent");
        setSecondsLeft(RESEND_COOLDOWN_SECONDS);
        return true;
      } catch (err) {
        setPhase("error");
        setError(describeAuthError(err, "reset_request"));
        // Limite do servidor também abre o relógio: insistir só gera outro 429.
        if ((err as { status?: number })?.status === 429) setSecondsLeft(RESEND_COOLDOWN_SECONDS);
        return false;
      }
    },
    [phase, secondsLeft],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
  }, []);

  return {
    resend,
    reset,
    error,
    secondsLeft,
    isSending: phase === "sending",
    hasSent: phase === "sent",
    /** `0:42` — formato curto, tabular, sem pular largura. */
    countdown: `0:${String(secondsLeft).padStart(2, "0")}`,
  };
}
