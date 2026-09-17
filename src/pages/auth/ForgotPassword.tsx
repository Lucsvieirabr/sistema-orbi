import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { useTurnstile } from "@/hooks/use-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeAuthError } from "@/lib/auth/auth-errors";
import { AUTH_ROUTES } from "@/lib/auth/redirect";
import { recoveryEmailSchema, requestPasswordReset } from "@/services/auth/password-recovery";

/** O GoTrue aceita 1 e-mail de recuperação por minuto por usuário. */
const RESEND_COOLDOWN_SECONDS = 60;

function useCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  return { secondsLeft, start: () => setSecondsLeft(RESEND_COOLDOWN_SECONDS) };
}

const formatCountdown = (seconds: number) => `0:${String(seconds).padStart(2, "0")}`;

/**
 * Passo 1 da recuperação: pede o e-mail e dispara `resetPasswordForEmail`.
 * A confirmação é a mesma com ou sem conta cadastrada (anti-enumeração).
 */
export default function ForgotPassword() {
  const location = useLocation();
  const initialEmail = typeof location.state?.email === "string" ? location.state.email.slice(0, 254) : "";

  const emailId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { secondsLeft, start } = useCountdown();
  const captcha = useTurnstile();

  const send = async (target: string) => {
    if (isSending || captcha.blocking) return;
    setError(null);
    setIsSending(true);
    try {
      await requestPasswordReset(target, captcha.captchaToken);
      setSentTo(recoveryEmailSchema.parse(target));
      start();
    } catch (err) {
      setError(describeAuthError(err, "reset_request"));
      inputRef.current?.focus();
    } finally {
      // Token Turnstile é de uso único: o próximo envio (ou reenvio) pede outro.
      captcha.reset();
      setIsSending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = recoveryEmailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Digite um e-mail válido.");
      inputRef.current?.focus();
      return;
    }
    void send(parsed.data);
  };

  const backToLogin = (
    <Button asChild variant="subtle" size="sm">
      <Link to={AUTH_ROUTES.login}>
        <ArrowLeft aria-hidden />
        Voltar para o login
      </Link>
    </Button>
  );

  if (sentTo) {
    return (
      <AuthShell
        title="Confira seu e-mail"
        description={
          <>
            Se houver uma conta Orbi com <span className="break-all font-medium text-foreground">{sentTo}</span>,
            enviamos um link para você criar uma nova senha.
          </>
        }
        aside={backToLogin}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg bg-surface-sunken p-3.5 text-sm text-muted-foreground">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            <p className="leading-relaxed">
              O link vale por 1 hora e só pode ser usado uma vez. Não chegou? Olhe a caixa de spam ou promoções.
            </p>
          </div>

          <TurnstileField {...captcha.fieldProps} action="password_reset" />

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full tabular-nums"
              disabled={isSending || secondsLeft > 0 || captcha.blocking}
              onClick={() => void send(sentTo)}
            >
              {isSending && <Loader2 className="animate-spin" aria-hidden />}
              {secondsLeft > 0 ? `Reenviar em ${formatCountdown(secondsLeft)}` : "Reenviar e-mail"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setSentTo(null);
                setError(null);
                window.setTimeout(() => inputRef.current?.focus(), 0);
              }}
            >
              Usar outro e-mail
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Esqueceu sua senha?"
      description="Digite o e-mail da sua conta. Enviamos um link para você criar uma nova senha."
      aside={backToLogin}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Recuperar senha">
        <div className="space-y-2">
          <Label htmlFor={emailId}>E-mail</Label>
          <Input
            ref={inputRef}
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            maxLength={254}
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            disabled={isSending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${emailId}-error` : undefined}
          />
          {error && (
            <p id={`${emailId}-error`} role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <TurnstileField {...captcha.fieldProps} action="password_reset" />

        <Button type="submit" className="w-full" disabled={isSending || captcha.blocking}>
          {isSending && <Loader2 className="animate-spin" aria-hidden />}
          {isSending ? "Enviando…" : captcha.blocking ? "Verificando conexão…" : "Enviar link de redefinição"}
        </Button>
      </form>
    </AuthShell>
  );
}
