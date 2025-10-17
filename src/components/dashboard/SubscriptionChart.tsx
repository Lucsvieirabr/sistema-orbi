import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscriptions, searchCompanyLogo, updateSeriesLogo } from "@/hooks/use-subscriptions";
import { Smartphone, Building2, Captions, Loader2, ExternalLink, Lock, Sparkles } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFeature } from "@/hooks/use-feature";
import { useNavigate } from "react-router-dom";

interface SubscriptionChartProps {
  className?: string;
}

export function SubscriptionChart({ className }: SubscriptionChartProps) {
  const { data: subscriptions, isLoading, refetch } = useSubscriptions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fetchingLogos, setFetchingLogos] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasFeature: hasLogoDetection, isLoading: isLoadingFeature } = useFeature('ia_deteccao_logos');
  const processedSubscriptionsRef = useRef<Set<string>>(new Set()); // Track processed subscriptions

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  // Buscar logos faltantes automaticamente
  useEffect(() => {
    if (!subscriptions || !hasLogoDetection) return;

    const fetchMissingLogos = async () => {
      const subsWithoutLogo = subscriptions.filter(
        sub => !sub.logo_url && 
               !fetchingLogos.has(sub.id) && 
               !processedSubscriptionsRef.current.has(sub.id)
      );

      if (subsWithoutLogo.length === 0) return;

      for (const sub of subsWithoutLogo) {
        // Marcar como processado imediatamente para evitar duplicatas
        processedSubscriptionsRef.current.add(sub.id);
        setFetchingLogos(prev => new Set(prev).add(sub.id));

        try {
          // Buscar logo com query em minúsculo
          const result = await searchCompanyLogo(sub.description.toLowerCase());
          if (result.logo_url) {
            await updateSeriesLogo(sub.id, result.logo_url);
            refetch();
          }
        } catch (error) {
          console.warn(`Failed to fetch logo for ${sub.description}:`, error);
        } finally {
          setFetchingLogos(prev => {
            const newSet = new Set(prev);
            newSet.delete(sub.id);
            return newSet;
          });
        }
      }
    };

    fetchMissingLogos();
  }, [subscriptions, hasLogoDetection]); // Removido fetchingLogos e refetch das dependências

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
      return <Smartphone className="h-8 w-8 text-primary" />;
    }
    if (desc.includes('energia') || desc.includes('água') || desc.includes('internet')) {
      return <Building2 className="h-8 w-8 text-primary" />;
    }
    return <Captions className="h-8 w-8 text-primary" />;
  };

  // Limitar a 2 assinaturas na visualização inicial
  const visibleSubscriptions = subscriptions?.slice(0, 2) || [];
  const hasMore = (subscriptions?.length || 0) > 2;

  // Verificar se está carregando a feature
  if (isLoadingFeature || isLoading) {
    return (
      <Card className={`bg-gradient-card shadow-md h-full flex flex-col ${className}`}>
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Captions className="h-4 w-4 text-primary" />
            Assinaturas Ativas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Se não tem a feature, mostrar card de upgrade
  if (!hasLogoDetection) {
    return (
      <Card className={`bg-gradient-card shadow-md h-full flex flex-col border-primary/20 ${className}`}>
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Captions className="h-4 w-4 text-primary" />
            Assinaturas Ativas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Feature Premium</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Acompanhe suas assinaturas com detecção automática de logos e organização inteligente.
          </p>
          <Button 
            size="sm" 
            onClick={() => navigate('/pricing')}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Fazer Upgrade
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    return (
      <Card className={`bg-gradient-card shadow-md h-full flex flex-col ${className}`}>
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Captions className="h-4 w-4 text-primary" />
            Assinaturas Ativas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-center">
          <Captions className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Nenhuma assinatura encontrada</p>
          <p className="text-xs text-muted-foreground mt-2">
            Crie transações recorrentes com a categoria "Assinaturas" para vê-las aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  const SubscriptionItem = ({ subscription }: { subscription: any }) => (
    <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors border border-border/50">
      {/* Logo or Icon */}
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-transparent rounded-full overflow-hidden">
        {subscription.logo_url ? (
          <img
            src={subscription.logo_url}
            alt={subscription.description}
            className="w-10 h-10 object-cover rounded-full"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const defaultIcon = document.createElement('div');
                defaultIcon.className = 'flex items-center justify-center bg-transparent';
                defaultIcon.innerHTML = '<svg class="h-6 w-6 text-primary bg-transparent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>';
                parent.appendChild(defaultIcon);
              }
            }}
          />
        ) : (
          getDefaultIcon(subscription.description)
        )}
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
        <p className="text-sm font-semibold text-foreground">
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
      <Card className={`bg-gradient-card shadow-md h-full flex flex-col ${className}`}>
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Captions className="h-4 w-4 text-primary" />
              Assinaturas Ativas
            </div>
            <div className="text-xs font-normal text-muted-foreground">
              {subscriptions.length} {subscriptions.length === 1 ? 'assinatura' : 'assinaturas'}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">
          <div className="space-y-2 flex flex-col h-full">
            {/* Total Monthly Cost */}
            <p className="text-xl font-bold text-primary flex-shrink-0">
              {formatCurrency(totalMonthlyCost)} / mês
            </p>

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
                className="w-full mt-2 text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Ver todas ({subscriptions.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

       {/* Dialog com todas as assinaturas */}
       <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
         <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
           <DialogHeader className="flex-shrink-0">
             <DialogTitle className="flex items-center gap-2">
               <Captions className="h-5 w-5 text-primary" />
               Todas as Assinaturas Ativas
             </DialogTitle>
           </DialogHeader>
           <div className="flex-1 overflow-hidden flex flex-col gap-4">
             {/* Total */}
             <div className="flex-shrink-0 p-4 bg-primary/5 rounded-lg border border-primary/10">
               <p className="text-sm text-muted-foreground mb-1">Total Mensal</p>
               <p className="text-2xl font-bold text-primary">
                 {formatCurrency(totalMonthlyCost)} / mês
               </p>
               <p className="text-xs text-muted-foreground mt-1">
                 {subscriptions.length} {subscriptions.length === 1 ? 'assinatura ativa' : 'assinaturas ativas'}
               </p>
             </div>
 
             {/* Lista completa com scroll interno */}
             <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
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

