import { useState } from "react";
import { useSubscriptionPlans } from "@/hooks/use-subscription";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import orbiLogo from "@/assets/orbi-logo_white.png";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Pricing() {
  const { data: plans, isLoading } = useSubscriptionPlans();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const navigate = useNavigate();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

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

  // Calcula a maior economia entre todos os planos
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

  // Organizar planos por display_order
  const sortedPlans = [...(plans || [])].sort((a, b) => a.display_order - b.display_order);

  // Obter lista de features simplificadas
  const getSimplifiedFeatures = (features: Record<string, boolean>) => {
    // Definir todas as features possíveis do sistema
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

    // Retornar features com status (tem ou não tem)
    return allPossibleFeatures.map(feature => ({
      ...feature,
      enabled: features[feature.key] === true,
    }));
  };

  const handleSelectPlan = (planSlug: string) => {
    // Por enquanto, apenas redireciona para login
    // Futuramente, poderá ir direto para pagamento
    navigate(`/login?plan=${planSlug}&billing=${billingCycle}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const maxSavingsPercentage = getMaxSavingsPercentage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      {/* Header */}
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={orbiLogo} alt="Orbi" className="h-7 w-7" />
            <span className="text-lg font-bold">Orbi</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
              Entrar
            </Button>
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
              className="px-4 py-2 data-[state=on]:bg-gradient-to-r data-[state=on]:from-primary data-[state=on]:to-primary/80 data-[state=on]:text-primary-foreground font-bold relative"
            >
              Anual
              {maxSavingsPercentage > 0 && (
                <Badge className="ml-2 absolute -top-3 -right-3 text-xs font-bold px-2 py-0.5 shadow-lg bg-green-600 hover:bg-green-600 text-white">
                  -{maxSavingsPercentage}%
                </Badge>
              )}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Planos */}
      <div className="container mx-auto px-4 pb-8">
        <div className="grid md:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {sortedPlans.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
            const monthlyPrice = billingCycle === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly;
            const savings = billingCycle === 'yearly' && plan.price_yearly > 0 
              ? calculateYearlySavings(plan.price_monthly, plan.price_yearly) 
              : null;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  plan.is_featured
                    ? 'border-primary shadow-xl scale-[1.02]'
                    : 'hover:shadow-lg'
                } transition-all`}
              >
                {plan.is_featured && (
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
                        {formatPrice(monthlyPrice)}
                      </span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    {billingCycle === 'yearly' && price > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatPrice(price)} cobrado anualmente
                      </div>
                    )}
                    {savings && savings.freeMonths > 0 && (
                      <div className="mt-2 text-center">
                        <div className="text-sm font-bold text-green-600 dark:text-green-400" style={{ textShadow: '0 0 20px rgba(34, 197, 94, 0.6)' }}>
                          🎁 {savings.isAlmost ? 'Quase ' : ''}{savings.isAlmost ? savings.freeMonths + 1 : savings.freeMonths} {(savings.isAlmost ? savings.freeMonths + 1 : savings.freeMonths) === 1 ? 'mês grátis' : 'meses grátis'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Features Simplificadas */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                    {getSimplifiedFeatures(plan.features).map((feature) => (
                      <div key={feature.key} className="flex items-center gap-1.5">
                        {feature.enabled ? (
                          <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                        )}
                        <span className={`text-xs ${feature.enabled ? 'text-foreground' : 'text-muted-foreground opacity-60'}`}>
                          {feature.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Limites principais */}
                  <div className="pt-3 border-t text-xs text-muted-foreground space-y-0.5">
                    <div className="font-semibold mb-1">
                      Limites:
                    </div>
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
                        • Retenção de dados: {plan.limits.retencao_dados_meses === -1 ? 'Ilimitado' : `${plan.limits.retencao_dados_meses} meses`}
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="pt-4">
                  <Button
                    className="w-full"
                    variant={plan.is_featured ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(plan.slug)}
                  >
                    {plan.price_monthly === 0 ? 'Começar Grátis' : 'Assinar Agora'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Aviso de planos não encontrados */}
        {(!plans || plans.length === 0) && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Nenhum plano disponível no momento. Por favor, tente novamente mais tarde.
            </p>
          </div>
        )}
      </div>

      {/* FAQ ou informações adicionais podem ser adicionadas aqui */}
    </div>
  );
}


