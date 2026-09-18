import { useEffect } from "react";
import { CheckCircle2, Loader2, MailCheck, Send } from "lucide-react";

import { EnvelopeBeacon } from "@/components/auth/EnvelopeBeacon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useResendConfirmation } from "@/hooks/use-resend-confirmation";

interface EmailNotConfirmedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** E-mail digitado no login — já normalizado. */
  email: string;
  /** Token Turnstile do formulário de login, se o captcha estiver ligado. */
  captchaToken?: string;
}

/**
 * Login recusado por `email_not_confirmed`.
 *
 * O toast genérico ("Falha no login") era o pior desfecho possível: a senha
 * estava certa, e a pessoa ficava tentando de novo. Aqui a tela diz exatamente
 * o que falta, mostra para qual endereço o link foi, e resolve no mesmo lugar —
 * o botão de reenvio, com o relógio de 60 s que o GoTrue impõe.
 */
export function EmailNotConfirmedDialog({ open, onOpenChange, email, captchaToken }: EmailNotConfirmedDialogProps) {
  const { resend, reset, error, secondsLeft, isSending, hasSent, countdown } = useResendConfirmation();

  // Cada abertura começa limpa: mensagem de erro antiga não sobrevive ao fechar.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="min-w-0 items-center text-center sm:text-center">
          <EnvelopeBeacon tone={hasSent ? "success" : "waiting"} className="mb-1" />
          <DialogTitle className="pr-0">
            {hasSent ? "Link reenviado" : "Confirme seu e-mail para entrar"}
          </DialogTitle>
          <DialogDescription className="min-w-0 max-w-full text-pretty leading-relaxed [overflow-wrap:anywhere]">
            {hasSent ? (
              <>
                Enviamos um novo link para{" "}
                <span className="inline-block max-w-full break-all align-bottom font-medium text-foreground">
                  {email}
                </span>
                . Ele vale por 1 hora e só funciona uma vez.
              </>
            ) : (
              <>
                Sua senha está correta, mas a conta{" "}
                <span className="inline-block max-w-full break-all align-bottom font-medium text-foreground">
                  {email}
                </span>{" "}
                ainda não foi ativada. Abra o link que enviamos por e-mail para liberar o acesso.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg bg-surface-sunken p-3.5 text-sm text-muted-foreground">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            <p className="leading-relaxed">
              Não encontrou? Procure por <span className="font-medium text-foreground">Orbi</span> na caixa de spam ou
              na aba de promoções antes de pedir outro.
            </p>
          </div>

          {hasSent && (
            <p className="flex items-center gap-2 text-sm text-success motion-safe:animate-fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              Novo link a caminho.
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive motion-safe:animate-fade-in">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            className="tabular-nums"
            disabled={isSending || secondsLeft > 0}
            onClick={() => void resend(email, captchaToken)}
          >
            {isSending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {isSending
              ? "Enviando…"
              : secondsLeft > 0
                ? `Reenviar em ${countdown}`
                : "Reenviar e-mail de confirmação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
