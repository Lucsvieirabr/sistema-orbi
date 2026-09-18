import { useState, useEffect, useCallback } from "react";
import { useSubscriptionPlans, SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Minus, Sparkles } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import orbiLogo from "@/assets/orbi-logo_white.png";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { usePayment } from "@/hooks/use-payment";
import { PaymentDialog } from "@/components/payment";
import { LegalLinksInline, SubscriptionConsentDialog } from "@/components/legal";
import { recordLegalConsent } from "@/lib/legal";
import { AUTH_ROUTES, loginPath } from "@/lib/auth/redirect";
import { requireSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

/**
 * Pagina de Planos.
 *
 * Casos de uso:
 * - C6: Usuario nao autenticado pode visualizar planos
 * - C7: Usuario nao autenticado clica em plano -> /login?next=/pricing (salva plano)
 * - C1: Usuario autenticado sem plano ativo -> pode selecionar plano
 * - C3: Usuario autenticado com plano inativo -> pode renovar/mudar
 *
 * ROTA HIBRIDA. Esta e a unica tela publica que tambem e usada por quem ja
 * esta logado, e o bug de roteamento nascia exatamente dai: a selecao de plano
 * decidia "tem sessao?" com um unico `supabase.auth.getSession()`. Esse metodo
 * devolve `null` em situacoes transitorias (token expirando, refresh em voo,
 * Web Lock `orbi-auth` ocupado por uma chamada anterior de `auth.updateUser` —
 * que e justamente o que `recordLegalConsent` faz um passo antes da cobranca).
 * O `null` virava `navigate('/login')`; o App via a sessao viva e mandava para
 * `/sistema`; o SubscriptionGuard, sem plano, mandava de volta para `/pricing`.
 * Tres rotas piscando com o dialogo de checkout aberto.
 *
 * Agora: a sessao e lida por `requireSession()` (getSession -> refreshSession ->
 * getUser), a autenticacao da tela acompanha `onAuthStateChange` em vez de uma
 * unica leitura na montagem, e o meio do checkout NUNCA ejeta para o login —
 * na pior hipotese explica o que houve e mantem a pessoa aqui.
 *
 * Design: uma coluna editorial de cabecalho + trilha de cartoes. O plano em
 * destaque e marcado por uma regua de 1px e um rotulo — nao por escala e
 * sombra, que empurravam o cartao para fora do alinhamento da grade.
 *
 * Contraste: todo fundo de tom solido usa o `-foreground` do proprio tom.
 * O rotulo de destaque usava `bg-gradient-primary` sobre `text-secondary-
 * foreground`; no tema claro as duas cores eram o mesmo navy e o texto
 * simplesmente desaparecia. Nao ha mais gradiente nesta tela.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FEATURE_ROWS = [
  { key: "extrato", label: "Extrato" },
  { key: "contas", label: "Contas" },
  { key: "categorias", label: "Categorias" },
  { key: "cartoes", label: "Cartões" },
  { key: "pessoas", label: "Pessoas" },
  { key: "ia_classificador", label: "IA classificadora" },
  { key: "transacoes_importar_csv", label: "Importar CSV" },
  { key: "ia_classificacao_automatica", label: "Classificação automática" },
  { key: "dashboard_assinaturas", label: "Painel de assinaturas" },
  { key: "orcamentos", label: "Orçamentos Inteligentes" },
  { key: "metas", label: "Metas Financeiras" },
  { key: "dre_pessoal", label: "DRE Pessoal Avançado" },
  { key: "motor_preditivo", label: "Motor Preditivo e Cenários Hipotéticos" },
  { key: "contratos_rateio", label: "Contratos de Rateio e Acertos de Viagem" },
  { key: "projetos_vida", label: "Projetos de Vida com mini-DRE" },
  { key: "inflacao_pessoal", label: "Inflação Pessoal por categoria" },
  { key: "familia_compartilhada", label: "2 acessos (Plano Casal)" },
] as const;

const LIMIT_ROWS = [
  { key: "max_contas", label: "Contas" },
  { key: "max_cartoes", label: "Cartões" },
  { key: "max_transacoes_mes", label: "Transações / mês" },
  { key: "max_pessoas", label: "Pessoas" },
  { key: "max_categorias", label: "Categorias" },
  { key: "retencao_dados_meses", label: "Retenção", suffix: "meses" },
  { key: "max_membros_familia", label: "Acessos extras" },
] as const;

export default function Pricing() {
  const { data: plans, isLoading } = useSubscriptionPlans();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userActivePlan, setUserActivePlan] = useState<string | null>(null);
  /**
   * Ciclo da assinatura ativa (`billing_cycle` de get_my_subscription_status).
   * Sem ele, "plano atual" era só o id do plano e o botão ficava desabilitado
   * para quem queria trocar mensal <-> anual do mesmo plano.
   */
  const [userBillingCycle, setUserBillingCycle] = useState<'monthly' | 'yearly' | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  /** `requireSession()` pode ir à rede (refresh/getUser): o botão diz isso. */
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  /**
   * Plano pago aguardando confirmacao + aceite legal. Nenhuma cobranca e
   * criada antes do opt-in explicito no dialogo (LGPD/CDC).
   */
  const [pendingPlan, setPendingPlan] = useState<{
    id: string;
    slug: string;
    name: string;
    price: number;
  } | null>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createPayment, paymentData, isLoading: isPaymentLoading } = usePayment();

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  /**
   * Guarda a intencao de assinatura enquanto a pessoa passa pelo login.
   * Um lugar so: era duplicado em `requestPlan` e `handleSelectPlan`, e os dois
   * podiam divergir no ciclo de cobranca gravado.
   */
  const rememberSelectedPlan = useCallback(
    ({ planId, planSlug, isFree }: { planId: string; planSlug: string; isFree: boolean }) => {
      try {
        localStorage.setItem(
          'orbi_selected_plan',
          JSON.stringify({ planId, planSlug, billingCycle, isFree, timestamp: Date.now() }),
        );
      } catch {
        /* storage bloqueado: a pessoa so precisa reescolher o plano depois do login */
      }
    },
    [billingCycle],
  );

  /**
   * Plano atual = mesmo plano E mesmo ciclo de faturamento. Plano gratuito não
   * tem ciclo (preço 0 nos dois), então o id basta; assinatura sem ciclo
   * conhecido também cai nesse caso para não travar o botão.
   */
  const isCurrentPlanAndCycle = useCallback(
    (planId: string, planIsFree: boolean) =>
      userActivePlan === planId &&
      (planIsFree || !userBillingCycle || userBillingCycle === billingCycle),
    [userActivePlan, userBillingCycle, billingCycle],
  );

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
      isAlmost: freeMonthsDecimal > 0.5,
    };
  };

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

  /**
   * Ativa plano gratuito via RPC validada no servidor (price=0 checado no backend).
   *
   * Contrato da RPC (migration 20260909140000):
   *   public.activate_free_plan(p_plan_id uuid) RETURNS jsonb
   * O PostgREST resolve a funcao por NOME + NOMES dos parametros do payload,
   * entao a key precisa ser exatamente `p_plan_id` e o valor um UUID valido.
   */
  const activateFreePlan = useCallback(async (planId: string) => {
    if (!UUID_RE.test(planId)) {
      throw new Error('Plano inválido: identificador fora do formato esperado.');
    }

    const args: Database['public']['Functions']['activate_free_plan']['Args'] = {
      p_plan_id: planId,
    };

    const { data, error } = await supabase.rpc('activate_free_plan', args);

    if (error) {
      if (error.code === 'PGRST202') {
        throw new Error(
          'Ativação indisponível no servidor (RPC activate_free_plan ausente do schema cache). ' +
          'Aplique a migration 20260909140000 e recarregue o cache do PostgREST.'
        );
      }
      throw new Error(error.message);
    }

    const result = data as { success?: boolean; subscription_id?: string } | null;
    if (!result?.success) {
      throw new Error('O servidor não confirmou a ativação do plano gratuito.');
    }

    return result;
  }, []);

  /**
   * Manipula selecao de plano
   *
   * Fluxo:
   * 1. Sessao expirada no meio do aceite -> guarda o plano e avisa AQUI; nunca
   *    navega para /login com o dialogo aberto (era a origem do loop de rotas)
   * 2. Se ja tem esse plano ativo -> avisa
   * 3. Caso contrario -> ativa o gratuito ou abre a cobranca no Asaas
   */
  const handleSelectPlan = useCallback(async (
    planId: string,
    planSlug: string,
    isFree: boolean,
    cpfCnpj?: string,
  ) => {
    setIsProcessing(true);

    try {
      // `requestPlan` ja garantiu a sessao antes de abrir o dialogo. Aqui a
      // leitura e so para confirmar que ela seguiu viva durante o aceite — e,
      // se realmente expirou, a saida NAO e ejetar no meio do checkout: o plano
      // fica guardado e a pessoa recebe uma instrucao clara, nesta mesma tela.
      const session = await requireSession();

      if (!session) {
        rememberSelectedPlan({ planId, planSlug, isFree });

        toast({
          title: "Sua sessão expirou",
          description: "Entre de novo — guardamos o plano escolhido e voltamos para cá.",
          variant: "destructive",
        });

        setShowConsentDialog(false);
        return;
      }

      if (isCurrentPlanAndCycle(planId, isFree)) {
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
        setUserBillingCycle(null); // gratuito não tem ciclo de cobrança
        navigate(AUTH_ROUTES.app, { replace: true });
        return;
      }

      // Plano pago: toda a mudanca (upgrade/downgrade, criacao e sincronizacao
      // da assinatura no Asaas) acontece no backend. O cliente nao escreve
      // em user_subscriptions.
      const result = await createPayment({ planId, billingCycle, cpfCnpj });

      if (result.success && result.free_plan) {
        await queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
        navigate(AUTH_ROUTES.app, { replace: true });
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
  }, [billingCycle, queryClient, toast, navigate, activateFreePlan, createPayment, isCurrentPlanAndCycle, rememberSelectedPlan]);

  /**
   * Porta de entrada da selecao de plano.
   *
   * Plano gratuito segue direto (nao ha cobranca a autorizar; o aceite dos
   * documentos ja ocorreu no cadastro). Plano pago passa obrigatoriamente
   * pelo dialogo de confirmacao com aceite legal.
   */
  const requestPlan = useCallback(async (
    plan: { id: string; slug: string; name: string },
    isFree: boolean,
    price: number,
  ) => {
    setIsCheckingSession(true);
    let session;
    try {
      session = await requireSession();
    } finally {
      setIsCheckingSession(false);
    }

    if (!session) {
      rememberSelectedPlan({ planId: plan.id, planSlug: plan.slug, isFree });

      toast({
        title: "Login necessário",
        description: isFree
          ? "Faça login ou crie uma conta para ativar seu plano gratuito."
          : "Faça login ou crie uma conta para continuar com a assinatura.",
      });

      // `next=/pricing`: depois do login a pessoa volta para cá, e o plano
      // guardado reabre o dialogo sozinho. Nunca `/login` pelado, que devolvia
      // todo mundo para `/sistema` e disparava o pingue-pongue de rotas.
      navigate(loginPath(AUTH_ROUTES.pricing));
      return;
    }

    if (isCurrentPlanAndCycle(plan.id, isFree)) {
      toast({
        title: "Você já tem este plano ativo",
        description: "Este é o seu plano atual.",
        variant: "destructive",
      });
      return;
    }

    if (isFree) {
      await handleSelectPlan(plan.id, plan.slug, true);
      return;
    }

    setPendingPlan({ id: plan.id, slug: plan.slug, name: plan.name, price });
    setShowConsentDialog(true);
  }, [handleSelectPlan, navigate, toast, isCurrentPlanAndCycle, rememberSelectedPlan]);

  /** Aceite confirmado: registra a prova do consentimento e cobra. */
  const handleConfirmSubscription = useCallback(async ({ cpfCnpj }: { cpfCnpj: string }) => {
    if (!pendingPlan) return;

    await recordLegalConsent({
      context: 'subscription',
      planId: pendingPlan.id,
      billingCycle,
    });

    setShowConsentDialog(false);
    await handleSelectPlan(pendingPlan.id, pendingPlan.slug, false, cpfCnpj);
    setPendingPlan(null);
  }, [pendingPlan, billingCycle, handleSelectPlan]);

  /**
   * Estado do usuario na tela.
   *
   * Uma leitura unica na montagem envelhecia: logar em outra aba, renovar o
   * token ou sair deixava esta tela mostrando o cabecalho errado e decidindo
   * por um `isAuthenticated` de minutos atras. Agora a fonte e o proprio fluxo
   * de eventos do supabase-js, com `requireSession()` para o primeiro valor.
   */
  useEffect(() => {
    let active = true;

    const loadActivePlan = async () => {
      const { data, error } = await supabase.rpc('get_my_subscription_status');
      if (!active || error) return;

      const status = data as any;
      const allowed = status?.access === 'allowed' && status?.plan_id;
      setUserActivePlan(allowed ? status.plan_id : null);
      // 'annual' é aceito pelo backend como sinônimo de 'yearly'; null = sem ciclo.
      setUserBillingCycle(
        allowed && status?.billing_cycle
          ? (status.billing_cycle === 'monthly' ? 'monthly' : 'yearly')
          : null,
      );
    };

    void requireSession().then((session) => {
      if (!active) return;
      setIsAuthenticated(Boolean(session));
      if (session) void loadActivePlan();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setIsAuthenticated(Boolean(session));

      if (!session) {
        setUserActivePlan(null);
        setUserBillingCycle(null);
        return;
      }

      // Fora do callback: qualquer chamada ao supabase-js aqui dentro disputa
      // o Web Lock interno de auth e pode travar a propria renovacao do token.
      window.setTimeout(() => {
        if (active) void loadActivePlan();
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  /** Processar plano salvo apos login */
  useEffect(() => {
    const processStoredPlan = async () => {
      if (!isAuthenticated || !plans) return;

      const storedPlanJson = localStorage.getItem('orbi_selected_plan');
      if (!storedPlanJson) return;

      try {
        const storedPlan = JSON.parse(storedPlanJson);

        // Validar se nao expirou (1 hora)
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

        if (storedPlan.billingCycle) {
          setBillingCycle(storedPlan.billingCycle);
        }

        localStorage.removeItem('orbi_selected_plan');

        const cycle = storedPlan.billingCycle === 'monthly' ? 'monthly' : 'yearly';
        const storedPrice = cycle === 'yearly' ? selectedPlan.price_yearly : selectedPlan.price_monthly;

        setTimeout(() => {
          // Passa pela mesma porta: plano pago volta do login direto para o
          // dialogo de confirmacao com aceite, nunca para a cobranca.
          requestPlan(
            { id: selectedPlan.id, slug: selectedPlan.slug, name: selectedPlan.name },
            storedPlan.isFree,
            storedPrice,
          );
        }, 500);
      } catch (error) {
        console.error('Erro ao processar plano salvo:', error);
        localStorage.removeItem('orbi_selected_plan');
      }
    };

    processStoredPlan();
  }, [isAuthenticated, plans, requestPlan]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border border-border border-t-primary" />
        <span className="sr-only">Carregando planos…</span>
      </div>
    );
  }

  const sortedPlans = [...(plans || [])].sort((a, b) => a.display_order - b.display_order);
  const maxSavingsPercentage = getMaxSavingsPercentage();

  return (
    <>
      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        paymentData={paymentData}
      />

      <SubscriptionConsentDialog
        open={showConsentDialog}
        onOpenChange={(open) => {
          setShowConsentDialog(open);
          if (!open) setPendingPlan(null);
        }}
        planName={pendingPlan?.name ?? ''}
        price={pendingPlan?.price ?? 0}
        billingCycle={billingCycle}
        isProcessing={isProcessing || isPaymentLoading}
        onConfirm={handleConfirmSubscription}
      />

      <div className="min-h-screen bg-background">
        {/* Barra superior: hairline, sem sombra. */}
        <header className="sticky top-0 z-30 border-b border-border-subtle bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-header max-w-[76rem] items-center justify-between px-4 md:px-6 lg:h-header-lg lg:px-8">
            <div className="flex items-center gap-2.5">
              <img src={orbiLogo} alt="Logotipo do Orbi" width={28} height={28} decoding="async" className="h-7 w-7" />
              <span className="font-display text-base font-semibold tracking-tight">Orbi</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {isAuthenticated ? (
                userActivePlan ? (
                  <Button size="sm" onClick={() => navigate(AUTH_ROUTES.app)}>
                    Acessar Sistema
                  </Button>
                ) : (
                  // Sem plano, "Minha conta" apontava para /sistema — e o
                  // SubscriptionGuard devolvia para cá na hora. Botão que só
                  // pisca a tela não é botão.
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void supabase.auth.signOut();
                    }}
                  >
                    Sair
                  </Button>
                )
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate(loginPath(AUTH_ROUTES.pricing))}>
                  Entrar
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[76rem] px-4 pb-16 pt-10 md:px-6 md:pt-14 lg:px-8 lg:pb-24 lg:pt-20">
          {/* Cabecalho editorial: alinhado a esquerda, com a escolha de ciclo
              ancorada a direita no desktop. Nada centralizado por inercia. */}
          <div className="flex flex-col gap-8 border-b border-border-subtle pb-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16 lg:pb-10">
            <div className="max-w-xl">
              <p className="label-eyebrow">Planos e assinatura</p>
              <h1 className="mt-3 text-balance">Escolha como o Orbi vai trabalhar para você.</h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                Todos os planos incluem extrato, contas e categorias. O que muda é o quanto
                a inteligência do Orbi classifica por você, quantos registros cabem e se você
                planeja o mês com orçamentos, metas e DRE.
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
              <span className="label-eyebrow">Ciclo de cobrança</span>
              <div className="flex items-center gap-3">
                <ToggleGroup
                  type="single"
                  value={billingCycle}
                  onValueChange={(value) => value && setBillingCycle(value as 'monthly' | 'yearly')}
                  aria-label="Ciclo de cobrança"
                  className="rounded-lg border border-border bg-surface-sunken p-1"
                >
                  <ToggleGroupItem value="monthly" className="h-9 px-4">
                    Mensal
                  </ToggleGroupItem>
                  <ToggleGroupItem value="yearly" className="h-9 px-4">
                    Anual
                  </ToggleGroupItem>
                </ToggleGroup>
                {maxSavingsPercentage > 0 && (
                  <Badge variant="success" className="whitespace-nowrap">
                    Economize até {maxSavingsPercentage}%
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Trilha de planos */}
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:mt-10 lg:grid-cols-3 lg:gap-5">
            {sortedPlans.map((plan, index) => {
              const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
              const monthlyPrice = billingCycle === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly;
              const savings = billingCycle === 'yearly' && plan.price_yearly > 0
                ? calculateYearlySavings(plan.price_monthly, plan.price_yearly)
                : null;
              const isFree = plan.price_monthly === 0 && plan.price_yearly === 0;
              // Mesmo plano + mesmo ciclo. Mesmo plano em ciclo diferente vira
              // troca de ciclo (botão habilitado), não "plano atual".
              const isUserCurrentPlan = isCurrentPlanAndCycle(plan.id, isFree);
              const isCycleSwitch = userActivePlan === plan.id && !isUserCurrentPlan;

              const currentPlan = sortedPlans.find(p => p.id === userActivePlan);
              const currentPlanPrice = currentPlan
                ? (billingCycle === 'yearly' ? currentPlan.price_yearly : currentPlan.price_monthly)
                : 0;
              const thisPlanPrice = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
              const isUpgrade = userActivePlan && !isUserCurrentPlan && !isCycleSwitch && thisPlanPrice > currentPlanPrice;
              const isDowngrade = userActivePlan && !isUserCurrentPlan && !isCycleSwitch && thisPlanPrice < currentPlanPrice;

              const featured = !isUserCurrentPlan && plan.is_featured;
              const freeMonths = savings
                ? (savings.isAlmost ? savings.freeMonths + 1 : savings.freeMonths)
                : 0;

              return (
                <Card
                  key={plan.id}
                  interactive
                  className={cn(
                    "flex animate-rise flex-col overflow-hidden",
                    isUserCurrentPlan && "border-success/45",
                    featured && "border-primary/45",
                  )}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  {/* Regua de acento de 1px: marca o plano sem deslocar a grade. */}
                  <div
                    aria-hidden
                    className={cn(
                      "h-px w-full",
                      isUserCurrentPlan ? "bg-success" : featured ? "bg-primary" : "bg-transparent",
                    )}
                  />

                  <CardHeader className="gap-0 space-y-0">
                    <div className="flex min-h-6 items-center justify-between gap-3">
                      <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
                        {plan.name}
                      </h2>
                      {isUserCurrentPlan ? (
                        <Badge variant="success-solid">
                          <Check className="h-3 w-3" />
                          Plano atual
                        </Badge>
                      ) : featured ? (
                        <Badge variant="primary">
                          <Sparkles className="h-3 w-3" />
                          Mais popular
                        </Badge>
                      ) : null}
                    </div>
                    {plan.description && (
                      <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
                        {plan.description}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="flex flex-grow flex-col gap-6">
                    {/* Preco: o dado protagonista da tela. */}
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="figure-xl text-foreground">
                          {monthlyPrice === 0 ? 'Gratuito' : formatPrice(monthlyPrice)}
                        </span>
                        {monthlyPrice > 0 && (
                          <span className="text-sm text-muted-foreground">/mês</span>
                        )}
                      </div>
                      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-2">
                        {billingCycle === 'yearly' && price > 0 && (
                          <span className="text-xs tabular text-muted-foreground">
                            {formatPrice(price)} por ano
                          </span>
                        )}
                        {freeMonths > 0 && (
                          <Badge variant="success">
                            {savings?.isAlmost ? 'Quase ' : ''}
                            {freeMonths} {freeMonths === 1 ? 'mês grátis' : 'meses grátis'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Recursos: incluido em tinta cheia, ausente em muted.
                        Sem X vermelho — ausencia nao e erro. */}
                    <div>
                      <p className="label-eyebrow">Recursos</p>
                      <ul className="mt-3 grid grid-cols-1 gap-y-2 xs:grid-cols-2 xs:gap-x-4">
                        {FEATURE_ROWS.map(({ key, label }) => {
                          const enabled = plan.features?.[key] === true;
                          return (
                            <li key={key} className="flex items-start gap-2">
                              {enabled ? (
                                <Check className="mt-[0.1875rem] h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                              ) : (
                                <Minus className="mt-[0.1875rem] h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                              )}
                              <span
                                className={cn(
                                  "min-w-0 text-xs leading-[1.35]",
                                  enabled ? "text-foreground" : "text-muted-foreground",
                                )}
                              >
                                {label}
                              </span>
                              <span className="sr-only">{enabled ? "incluído" : "não incluído"}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Limites: lista de definicao com hairline entre linhas. */}
                    <div className="mt-auto">
                      <p className="label-eyebrow">Limites</p>
                      <dl className="mt-2">
                        {LIMIT_ROWS.map(({ key, label, ...rest }) => {
                          const value = (plan.limits as Record<string, number | undefined>)?.[key];
                          if (value === undefined) return null;
                          const suffix = 'suffix' in rest ? ` ${(rest as { suffix: string }).suffix}` : '';
                          return (
                            <div
                              key={key}
                              className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-1.5 last:border-b-0"
                            >
                              <dt className="text-xs text-muted-foreground">{label}</dt>
                              <dd className="text-xs font-medium tabular text-foreground">
                                {value === -1 ? 'Ilimitado' : `${value}${suffix}`}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      size="lg"
                      variant={
                        isUserCurrentPlan ? 'secondary' : (isUpgrade || featured) ? 'default' : 'outline'
                      }
                      onClick={() => requestPlan(
                        { id: plan.id, slug: plan.slug, name: plan.name },
                        isFree,
                        price,
                      )}
                      disabled={isProcessing || isUserCurrentPlan || isPaymentLoading || isCheckingSession}
                    >
                      {isUserCurrentPlan
                        ? 'Plano atual'
                        : isCheckingSession
                        ? 'Só um instante…'
                        : (isProcessing || isPaymentLoading)
                        ? 'Processando…'
                        : isCycleSwitch
                        ? `Mudar para o ${billingCycle === 'yearly' ? 'anual' : 'mensal'}`
                        : isUpgrade
                        ? `Fazer upgrade para ${plan.name}`
                        : isDowngrade
                        ? `Mudar para ${plan.name}`
                        : (isFree ? 'Começar grátis' : `Assinar ${plan.name}`)}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {(!plans || plans.length === 0) && (
            <div className="mt-10 rounded-xl border border-dashed border-border px-6 py-16 text-center">
              <p className="font-display text-base font-semibold text-foreground">
                Nenhum plano disponível agora
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Estamos atualizando as assinaturas. Tente de novo em alguns minutos.
              </p>
            </div>
          )}

          <div className="mt-10 flex flex-col gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Você pode trocar ou cancelar seu plano quando quiser. Cobrança em reais, sem fidelidade.
            </p>
            <LegalLinksInline className="text-xs" />
          </div>
        </main>
      </div>
    </>
  );
}
