import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

/**
 * Guard que verifica se o usuário tem um plano ativo.
 * Se não tiver, redireciona para a página de pricing com um toast personalizado.
 */
export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasActivePlan, isLoading, hasAnyPlan } = useSubscription();

  useEffect(() => {
    const checkSubscription = async () => {
      // Aguarda o carregamento dos dados
      if (isLoading) return;

      // Verifica se usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }

      // Se não tem plano ativo, redireciona para pricing
      if (!hasActivePlan) {
        // Mensagem personalizada baseada no status
        let toastMessage = "Você precisa escolher um plano para acessar o sistema.";
        let toastDescription = "Escolha o plano ideal para suas necessidades.";

        if (hasAnyPlan) {
          // Usuário já teve um plano, mas expirou
          toastMessage = "Seu plano não está mais ativo.";
          toastDescription = "Renove sua assinatura para continuar usando o Orbi.";
        }

        toast({
          title: toastMessage,
          description: toastDescription,
          variant: "default",
          duration: 5000,
        });

        navigate('/pricing', { replace: true });
      }
    };

    checkSubscription();
  }, [hasActivePlan, hasAnyPlan, isLoading, navigate, toast]);

  // Mostra loading enquanto verifica a assinatura
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-muted-foreground">Verificando assinatura...</p>
        </div>
      </div>
    );
  }

  // Se não tem plano ativo, não renderiza nada (está redirecionando)
  if (!hasActivePlan) {
    return null;
  }

  // Tudo OK, renderiza os children
  return <>{children}</>;
}

