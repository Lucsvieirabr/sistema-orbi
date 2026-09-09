import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

/**
 * Guard global de acesso. A decisão vem da RPC get_my_subscription_status
 * (SECURITY DEFINER), não de linhas graváveis pelo cliente.
 *
 * allowed          → libera
 * blocked          → /billing (inadimplente / expirado)
 * pending_payment  → /billing (aguardando confirmação)
 * no_plan          → /pricing
 *
 * ⚠ Falha de rede/RPC (ex.: PGRST202, 5xx, offline) NÃO é "sem plano".
 * Tratar erro como no_plan derrubava contas Pro ativas para /pricing e as
 * prendia na tela de ativação. Em erro, o guard mostra estado de falha com
 * retry explícito e não redireciona.
 */
export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { access, isLoading, error, refetch } = useSubscription();

  useEffect(() => {
    if (isLoading || error) return;

    if (access === "allowed") return;

    const target = access === "blocked" || access === "pending_payment" ? "/billing" : "/pricing";

    if (location.pathname !== target) {
      navigate(target, { replace: true, state: { from: location.pathname } });
    }
  }, [access, isLoading, error, navigate, location.pathname]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-muted-foreground max-w-md">
            Não foi possível verificar sua assinatura agora. Seu acesso não foi alterado.
          </p>
          <Button onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  if (isLoading || access !== "allowed") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-muted-foreground">
            {isLoading ? "Verificando assinatura..." : "Redirecionando..."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
