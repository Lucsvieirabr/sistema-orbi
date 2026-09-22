import { ArrowRight, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMfaStatus } from "@/hooks/use-mfa-status";

const SECURITY_SETTINGS_PATH = "/sistema/settings?secao=seguranca#verificacao-em-duas-etapas";

/**
 * Aviso não bloqueante do shell autenticado.
 *
 * A dispensa vive somente na montagem atual do AppLayout. Assim, o aviso não
 * persegue a pessoa durante a sessão, mas volta no próximo login enquanto o
 * TOTP continuar desativado.
 */
export function MfaSecurityReminder() {
  const { data: user } = useCurrentUser();
  const { data: status } = useMfaStatus();
  const [dismissed, setDismissed] = useState(false);

  // A sessão já traz os fatores e evita esperar uma chamada de rede para
  // decidir o primeiro frame. A consulta compartilhada confirma o estado e
  // também reage imediatamente quando a ativação termina em Configurações.
  const sessionHasMfa = (user?.factors ?? []).some(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );
  const isEnabled = status?.enabled ?? sessionHasMfa;

  if (!user || isEnabled || dismissed) return null;

  return (
    <aside
      aria-labelledby="mfa-security-reminder-title"
      aria-live="polite"
      className="border-b border-warning/20 bg-warning-soft/80 px-4 py-3 motion-safe:animate-fade-in md:px-6 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-[88rem] items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-warning/20 bg-background/65 text-warning shadow-sm"
        >
          <ShieldAlert className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div className="min-w-0">
            <p id="mfa-security-reminder-title" className="text-sm font-semibold text-foreground">
              Reforce a segurança da sua conta
            </p>
            <p className="mt-0.5 max-w-[68ch] text-xs leading-relaxed text-warning sm:text-sm">
              Ative a verificação em duas etapas para exigir um código do celular além da senha em cada login.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-3 w-full shrink-0 border-warning/25 bg-background/70 text-foreground hover:border-warning/45 hover:bg-background sm:mt-0 sm:w-auto"
          >
            <Link to={SECURITY_SETTINGS_PATH}>
              Ativar agora
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setDismissed(true)}
          aria-label="Dispensar lembrete até o próximo login"
          title="Dispensar até o próximo login"
          className="-mr-2 -mt-1 shrink-0 text-warning hover:bg-warning/10 hover:text-foreground"
        >
          <X aria-hidden />
        </Button>
      </div>
    </aside>
  );
}
