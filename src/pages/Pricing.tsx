import { useState, useEffect, useCallback } from "react";
import { useSubscriptionPlans, SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import orbiLogo from "@/assets/orbi-logo_white.png";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePayment } from "@/hooks/use-payment";
import { PaymentDialog } from "@/components/payment";

/**
 * Página de Pricing simplificada
 * 
 * Casos de uso:
 * - C6: Usuário não autenticado pode visualizar planos
 * - C7: Usuário não autenticado clica em plano → /login (salva plano)
 * - C1: Usuário autenticado sem plano ativo → pode selecionar plano
 * - C3: Usuário autenticado com plano inativo → pode renovar/mudar
 */
export default function Pricing() {
  const { data: plans, isLoading } = useSubscriptionPlans();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userActivePlan, setUserActivePlan] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createPayment, paymentData, isLoading: isPaymentLoading } = usePayment();

  // Formatar preço
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  // Calcular economia anual
  const calculateYearlySavings = (monthly: number, yearly: number) => {
    const yearlyCost = monthly * 12;
    const savings = yearlyCost - yearly;
    const percentage = Math.round((savings / yearlyCost) * 100);
    const freeMonths = savings / monthly;
    const freeMonthsRounded = Math.floor(freeMonths);
    const freeMonthsDecimal = freeMonths - freeMonthsRounded;
    
    return { 
      savings, 
      percentage, 
      freeMonths: freeMonthsRounded,
      isAlmost: freeMonthsDecimal > 0.5
    };
  };

  // Maior economia entre planos
  const getMaxSavingsPercentage = () => {
    if (!plans || plans.length === 0) return 0;
    
    let maxPercentage = 0;
    plans.forEach(plan => {
      if (plan.price_monthly > 0 && plan.price_yearly > 0) {
        const { percentage } = calculateYearlySavings(plan.price_monthly, plan.price_yearly);
        if (percentage > maxPercentage) {
          maxPercentage = percentage;
        }
      }
    });
    
    return maxPercentage;
  };

  // Features simplificadas
  const getSimplifiedFeatures = (features: Record<string, boolean>) => {
    const allPossibleFeatures = [
      { key: 'extrato', label: 'Extrato', icon: '📝' },
      { key: 'contas', label: 'Contas', icon: '🏦' },
      { key: 'categorias', label: 'Categorias', icon: '📂' },
      { key: 'cartoes', label: 'Cartões', icon: '💳' },
      { key: 'pessoas', label: 'Pessoas', icon: '👥' },
      { key: 'ia_classificador', label: 'IA Classificador', icon: '🤖' },
      { key: 'transacoes_importar_csv', label: 'Importar CSV', icon: '📤' },
      { key: 'ia_classificacao_automatica', label: 'Classificação Automática', icon: '✨' },
      { key: 'ia_deteccao_logos', label: 'Detecção de Assinaturas', icon: '🔄' },
    ];

    return allPossibleFeatures.map(feature => ({
      ...feature,
      enabled: features[feature.key] === true,
    }));
  };

  /**
   * Ativa plano gratuito via RPC validada no servidor (price=0 checado no backend).
   */
  const activateFreePlan = useCallback(async (planId: string) => {
    const { error } = await supabase.rpc('activate_free_plan', { p_plan_id: planId });
    if (error) throw new Error(error.message);
  }, []);

  /**
   * Manipula seleção de plano
   * 
   * Fluxo:
   * 1. Se não autenticado → salvar plano e redirecionar para /login (C7)
   * 2. Se autenticado e já tem plano ativo → avisar
   * 3. Se autenticado sem plano → ativar plano (gratuito) ou redirecionar para pagamento (pago)
   */
  const handleSelectPlan = useCallback(async (planId: string, planSlug: string, isFree: boolean) => {
    setIsProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        localStorage.setItem('orbi_selected_plan', JSON.stringify({
          planId,
          planSlug,
          billingCycle,
          isFree,
          timestamp: Date.now()
        }));

        toast({
          title: "Login necessário",
          description: isFree
            ? "Faça login ou crie uma conta para ativar seu plano gratuito."
            : "Faça login ou crie uma conta para continuar com a assinatura.",
        });

        navigate('/login');
        return;
      }

      if (userActivePlan === planId) {
        toast({
          title: "Você já tem este plano ativo",
          description: "Este é o seu plano atual.",
          variant: "destructive",
        });
        return;
      }

      if (isFree) {
        await activateFreePlan(planId);
        await queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });

        toast({
          title: "Plano ativado com sucesso!",
          description: "Bem-vindo ao Orbi!",
        });

        setUserActivePlan(planId);
        navigate('/sistema', { replace: true });
        return;
      }

      // Plano pago: toda a mudança (upgrade/downgrade, criação e sincronização
      // da assinatura no Asaas) acontece no backend. O cliente não escreve
      // em user_subscriptions.
      const result = await createPayment({ planId, billingCycle });

      if (result.success && result.free_plan) {
        await queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
        navigate('/sistema', { replace: true });
        return;
      }

      if (result.success && result.payment) {
        setShowPaymentDialog(true);
        await queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao processar",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [billingCycle, queryClient, toast, navigate, activateFreePlan, createPayment, userActivePlan]);

  /**
   * Verificar estado do usuário ao carregar a página
   */
  useEffect(() => {
    const checkUserState = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setIsAuthenticated(true);

      const { data, error } = await supabase.rpc('get_my_subscription_status');
      if (error) return;

      const status = data as any;
      if (status?.access === 'allowed' && status?.plan_id) {
        setUserActivePlan(status.plan_id);
      }
    };

    checkUserState();
  }, []);

  /**
   * Processar plano salvo após login
   * Se usuário veio do login e tinha selecionado um plano, processar automaticamente
   */
  useEffect(() => {
    const processStoredPlan = async () => {
      if (!isAuthenticated || !plans) return;

      const storedPlanJson = localStorage.getItem('orbi_selected_plan');
      if (!storedPlanJson) return;

      try {
        const storedPlan = JSON.parse(storedPlanJson);
        
        // Validar se não expirou (1 hora)
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - storedPlan.timestamp > oneHour) {
          localStorage.removeItem('orbi_selected_plan');
          return;
        }

        const selectedPlan = plans.find(p => p.id === storedPlan.planId);
        if (!selectedPlan) {
          localStorage.removeItem('orbi_selected_plan');
          return;
        }

        // Configurar ciclo de cobrança
        if (storedPlan.billingCycle) {
          setBillingCycle(storedPlan.billingCycle);
        }

        // Limpar plano salvo
        localStorage.removeItem('orbi_selected_plan');

        // Processar plano
        setTimeout(() => {
          handleSelectPlan(selectedPlan.id, selectedPlan.slug, storedPlan.isFree);
        }, 500);
      } catch (error) {
        console.error('Erro ao processar plano salvo:', error);
        localStorage.removeItem('orbi_selected_plan');
      }
    };

    processStoredPlan();
  }, [isAuthenticated, plans, handleSelectPlan]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const sortedPlans = [...(plans || [])].sort((a, b) => a.display_order - b.display_order);
  const maxSavingsPercentage = getMaxSavingsPercentage();

  return (
    <>
      {/* Dialog de Pagamento */}
      <PaymentDialog 
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        paymentData={paymentData}
      />

      <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={orbiLogo} alt="Orbi" className="h-7 w-7" />
            <span className="text-lg font-bold">Orbi</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated ? (
              userActivePlan ? (
                <Button variant="default" size="sm" onClick={() => navigate('/sistema')}>
                  Ir para Sistema
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate('/sistema')}>
                  Minha Conta
                </Button>
              )
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
                Entrar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-3 text-center">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
          Escolha o Plano Ideal
        </h1>
        <p className="text-base text-muted-foreground mb-4 max-w-2xl mx-auto">
          Gerencie suas finanças de forma inteligente com IA e visualizações poderosas
        </p>

        {/* Toggle de ciclo de cobrança */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <ToggleGroup 
            type="single" 
            value={billingCycle} 
            onValueChange={(value) => value && setBillingCycle(value as 'monthly' | 'yearly')}
            className="border-2 rounded-lg p-1 bg-background/50 shadow-lg"
          >
            <ToggleGroupItem value="monthly" className="px-4 py-2 data-[state=on]:bg-muted">
              Mensal
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="yearly" 
              className="px-4 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground font-medium relative"
            >
              Anual
              {maxSavingsPercentage > 0 && (
                <Badge className="ml-2 absolute -top-3 -right-3 text-xs font-bold px-2 py-0.5 shadow-lg bg-success hover:bg-success text-white">
                  -{maxSavingsPercentage}%
                </Badge>
              )}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Planos */}
      <div className="container mx-auto px-4 pb-8">
        <div className="flex flex-wrap justify-center gap-4 max-w-6xl mx-auto">
          {sortedPlans.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
            const monthlyPrice = billingCycle === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly;
            const savings = billingCycle === 'yearly' && plan.price_yearly > 0 
              ? calculateYearlySavings(plan.price_monthly, plan.price_yearly) 
              : null;
            const isUserCurrentPlan = userActivePlan === plan.id;
            const isFree = plan.price_monthly === 0 && plan.price_yearly === 0;
            
            // Determinar se é upgrade ou downgrade
            const currentPlan = sortedPlans.find(p => p.id === userActivePlan);
            const currentPlanPrice = currentPlan 
              ? (billingCycle === 'yearly' ? currentPlan.price_yearly : currentPlan.price_monthly)
              : 0;
            const thisPlanPrice = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
            const isUpgrade = userActivePlan && !isUserCurrentPlan && thisPlanPrice > currentPlanPrice;
            const isDowngrade = userActivePlan && !isUserCurrentPlan && thisPlanPrice < currentPlanPrice;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col w-full md:w-96 ${
                  isUserCurrentPlan
                    ? 'border-success/30 shadow-xl scale-[1.02] ring-2 ring-success/50'
                    : plan.is_featured
                    ? 'border-primary shadow-xl scale-[1.02]'
                    : ''
                } transition-all`}
              >
                {isUserCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-success hover:bg-success text-white text-xs font-bold">
                      ✓ Seu Plano Atual
                    </Badge>
                  </div>
                )}
                {!isUserCurrentPlan && plan.is_featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-primary text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="text-sm">{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pb-4 flex-grow">
                  {/* Preço */}
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">
                        {monthlyPrice === 0 ? 'Gratuito' : formatPrice(monthlyPrice)}
                      </span>
                      {monthlyPrice > 0 && (
                        <span className="text-sm text-muted-foreground">/mês</span>
                      )}
                    </div>
                    {billingCycle === 'yearly' && price > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatPrice(price)} cobrado anualmente
                      </div>
                    )}
                    {savings && savings.freeMonths > 0 && (
                      <div className="mt-2 text-center">
                        <div className="text-sm font-bold text-success dark:text-success" style={{ textShadow: '0 0 20px rgba(34, 197, 94, 0.6)' }}>
                          🎁 {savings.isAlmost ? 'Quase ' : ''}{savings.isAlmost ? savings.freeMonths + 1 : savings.freeMonths} {(savings.isAlmost ? savings.freeMonths + 1 : savings.freeMonths) === 1 ? 'mês grátis' : 'meses grátis'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                    {getSimplifiedFeatures(plan.features).map((feature) => (
                      <div key={feature.key} className="flex items-center gap-1.5">
                        {feature.enabled ? (
                          <Check className="h-3.5 w-3.5 text-success flex-shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                        )}
                        <span className={`text-xs ${feature.enabled ? 'text-foreground' : 'text-muted-foreground opacity-60'}`}>
                          {feature.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Limites */}
                  <div className="pt-3 border-t">
                    <div className="text-xs font-semibold mb-2 text-muted-foreground">
                      Limites:
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {plan.limits.max_contas !== undefined && (
                        <div>
                          • Contas: {plan.limits.max_contas === -1 ? 'Ilimitado' : plan.limits.max_contas}
                        </div>
                      )}
                      {plan.limits.max_cartoes !== undefined && (
                        <div>
                          • Cartões: {plan.limits.max_cartoes === -1 ? 'Ilimitado' : plan.limits.max_cartoes}
                        </div>
                      )}
                      {plan.limits.max_transacoes_mes !== undefined && (
                        <div>
                          • Transações/mês: {plan.limits.max_transacoes_mes === -1 ? 'Ilimitado' : plan.limits.max_transacoes_mes}
                        </div>
                      )}
                      {plan.limits.max_pessoas !== undefined && (
                        <div>
                          • Pessoas: {plan.limits.max_pessoas === -1 ? 'Ilimitado' : plan.limits.max_pessoas}
                        </div>
                      )}
                      {plan.limits.max_categorias !== undefined && (
                        <div>
                          • Categorias: {plan.limits.max_categorias === -1 ? 'Ilimitado' : plan.limits.max_categorias}
                        </div>
                      )}
                      {plan.limits.retencao_dados_meses !== undefined && (
                        <div>
                          • Retenção: {plan.limits.retencao_dados_meses === -1 ? 'Ilimitado' : `${plan.limits.retencao_dados_meses} meses`}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-4">
                  <Button
                    className="w-full"
                    variant={isUserCurrentPlan ? 'secondary' : isUpgrade ? 'default' : plan.is_featured ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(plan.id, plan.slug, isFree)}
                    disabled={isProcessing || isUserCurrentPlan || isPaymentLoading}
                  >
                    {isUserCurrentPlan 
                      ? '✓ Plano Atual' 
                      : (isProcessing || isPaymentLoading)
                      ? 'Processando...' 
                      : isUpgrade
                      ? 'Fazer Upgrade'
                      : isDowngrade
                      ? 'Mudar Plano'
                      : (isFree ? 'Começar Grátis' : 'Assinar Agora')
                    }
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Aviso se não houver planos */}
        {(!plans || plans.length === 0) && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Nenhum plano disponível no momento. Por favor, tente novamente mais tarde.
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
