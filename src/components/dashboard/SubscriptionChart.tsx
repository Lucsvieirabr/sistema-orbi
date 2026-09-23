import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { Smartphone, Building2, Captions, Loader2, ExternalLink, Lock, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFeature } from "@/hooks/use-feature";
import { useNavigate } from "react-router-dom";

interface SubscriptionChartProps {
  className?: string;
}

export function SubscriptionChart({ className }: SubscriptionChartProps) {
  const { data: subscriptions, isLoading } = useSubscriptions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  // O gate era 'ia_deteccao_logos', feature removida junto com a integracao
  // logo.dev. O painel de assinaturas nao dependia de logo nenhum — passa a
  // ser gated pela propria feature de acompanhamento de assinaturas.
  const { hasFeature: hasSubscriptionsPanel, isLoading: isLoadingFeature } =
    useFeature('dashboard_assinaturas');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  // Calculate total monthly cost
  const totalMonthlyCost = useMemo(() => {
    if (!subscriptions) return 0;
    return subscriptions.reduce((sum, sub) => {
      // O total_value em series é a SOMA de todas as transações
      // Para obter o valor mensal, sempre dividir pelo número de parcelas
      const monthlyValue = sub.total_value / sub.total_installments;
      return sum + monthlyValue;
    }, 0);
  }, [subscriptions]);

  // Get icon for subscription if no logo
  const getDefaultIcon = (description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('youtube')) {
      return <Smartphone className="h-5 w-5 text-muted-foreground" aria-hidden />;
    }
    if (desc.includes('energia') || desc.includes('água') || desc.includes('internet')) {
      return <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />;
    }
    return <Captions className="h-5 w-5 text-muted-foreground" aria-hidden />;
  };

  // Limitar a 2 assinaturas na visualização inicial
  const visibleSubscriptions = subscriptions?.slice(0, 2) || [];
  const hasMore = (subscriptions?.length || 0) > 2;

  // Verificar se está carregando a feature
  if (isLoadingFeature || isLoading) {
    return (
      <Card className={`h-full flex flex-col ${className ?? ""}`}>
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            <Captions className="h-4 w-4 text-muted-foreground" aria-hidden />
            Assinaturas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </CardContent>
      </Card>
    );
  }

  // Se não tem a feature, mostrar card de upgrade
  if (!hasSubscriptionsPanel) {
    return (
      <Card className={`h-full flex flex-col ${className ?? ""}`}>
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            <Captions className="h-4 w-4 text-muted-foreground" aria-hidden />
            Assinaturas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="mb-4 h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
            <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <h3 className="font-display text-base font-semibold mb-2">Recurso do plano superior</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Acompanhe todas as suas assinaturas recorrentes em um só lugar, com o total mensal sempre à vista.
          </p>
          <Button 
            size="sm" 
            onClick={() => navigate('/pricing')}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Ver planos
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    return (
      <Card className={`h-full flex flex-col ${className ?? ""}`}>
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            <Captions className="h-4 w-4 text-muted-foreground" aria-hidden />
            Assinaturas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-center">
          <Captions className="h-6 w-6 text-muted-foreground/50 mb-3" aria-hidden />
          <p className="text-sm font-medium text-foreground">Nenhuma assinatura ativa</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-[16rem] leading-5">
            Crie transações recorrentes na categoria &ldquo;Assinaturas&rdquo; para acompanhá-las aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  const SubscriptionItem = ({ subscription }: { subscription: any }) => (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200 ease-swift hover:bg-accent">
      {/* Icone derivado da descricao (o <img> de logo.dev foi removido) */}
      <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken overflow-hidden">
        {getDefaultIcon(subscription.description)}
      </div>

      {/* Subscription Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {subscription.description}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {subscription.categories?.name && (
            <>
              <span>{subscription.categories.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="text-right">
        <p className="figure-sm tabular text-foreground">
          {formatCurrency(subscription.total_value / subscription.total_installments)}
        </p>
        <p className="text-xs text-muted-foreground">
          {subscription.is_fixed 
            ? `/${subscription.frequency === 'monthly' ? 'mês' : subscription.frequency}`
            : `${subscription.total_installments}x`
          }
        </p>
      </div>
    </div>
  );

  return (
    <>
      <Card className={`h-full flex flex-col ${className ?? ""}`}>
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Captions className="h-4 w-4 text-muted-foreground" aria-hidden />
              Assinaturas
            </span>
            <span className="text-2xs font-normal text-muted-foreground tabular">
              {subscriptions.length} {subscriptions.length === 1 ? 'ativa' : 'ativas'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">
          <div className="space-y-2 flex flex-col h-full">
            {/* Total Monthly Cost */}
            <div className="flex-shrink-0 pb-1">
              <p className="label-eyebrow">Custo mensal</p>
              <p className="figure-lg tabular mt-1 text-foreground">{formatCurrency(totalMonthlyCost)}</p>
            </div>

            {/* Subscription List (máximo 2) */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-2">
              {visibleSubscriptions.map((subscription) => (
                <SubscriptionItem key={subscription.id} subscription={subscription} />
              ))}
            </div>

            {/* Ver mais button */}
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="w-full mt-2"
              >
                <ExternalLink className="h-3 w-3" />
                Ver todas ({subscriptions.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

       {/* Dialog com todas as assinaturas */}
       <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
         <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col p-4 lg:p-6">
           <DialogHeader className="flex-shrink-0">
             <DialogTitle className="flex items-center gap-2 font-display text-base lg:text-lg">
               <Captions className="h-4 w-4 text-muted-foreground" aria-hidden />
               Todas as assinaturas
             </DialogTitle>
             <DialogDescription className="sr-only">Lista de assinaturas ativas e total mensal.</DialogDescription>
           </DialogHeader>
           <div className="flex-1 overflow-hidden flex flex-col gap-3 lg:gap-4">
             {/* Total */}
             <div className="flex-shrink-0 rounded-xl border border-border p-4">
               <p className="label-eyebrow">Total mensal</p>
               <p className="figure-lg tabular mt-1.5 text-foreground">
                 {formatCurrency(totalMonthlyCost)}
               </p>
               <p className="text-xs text-muted-foreground mt-1">
                 {subscriptions.length} {subscriptions.length === 1 ? 'assinatura ativa' : 'assinaturas ativas'}
               </p>
             </div>
 
             {/* Lista completa com scroll interno */}
             <div className="flex-1 overflow-y-auto pr-1 -mx-1">
               {subscriptions.map((subscription) => (
                 <SubscriptionItem key={subscription.id} subscription={subscription} />
               ))}
             </div>
           </div>
         </DialogContent>
       </Dialog>
    </>
  );
}

