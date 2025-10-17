import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

/**
 * Guard simplificado que verifica se o usuário tem um plano ativo
 * 
 * Casos de uso:
 * - C4: Usuário autenticado com plano ativo → permite acesso
 * - C5: Usuário autenticado sem plano ativo → redireciona para /pricing
 */
export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasActivePlan, isLoading, hasAnyPlan } = useSubscription();

  useEffect(() => {
    // Aguarda carregamento
    if (isLoading) return;

    // Se não tem plano ativo, redireciona para pricing (C5)
    if (!hasActivePlan) {
      const message = hasAnyPlan
        ? "Seu plano não está mais ativo. Renove para continuar."
        : "Você precisa escolher um plano para acessar o sistema.";

      toast({
        title: "Plano necessário",
        description: message,
        variant: "default",
        duration: 5000,
      });

      navigate('/pricing', { replace: true });
    }
  }, [hasActivePlan, hasAnyPlan, isLoading, navigate, toast]);

  // Loading
  if (isLoading || !hasActivePlan) {
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

  // Plano ativo, renderiza conteúdo (C4)
  return <>{children}</>;
}

