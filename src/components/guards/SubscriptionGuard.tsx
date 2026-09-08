import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSubscription } from "@/hooks/use-subscription";

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
 */
export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { access, isLoading, error } = useSubscription();

  useEffect(() => {
    if (isLoading) return;

    if (error) {
      navigate("/pricing", { replace: true });
      return;
    }

    if (access === "allowed") return;

    const target = access === "blocked" || access === "pending_payment" ? "/billing" : "/pricing";

    if (location.pathname !== target) {
      navigate(target, { replace: true, state: { from: location.pathname } });
    }
  }, [access, isLoading, error, navigate, location.pathname]);

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
