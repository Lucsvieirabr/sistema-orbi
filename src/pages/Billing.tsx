import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Clock, ExternalLink, LogOut, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SUBSCRIPTION_QUERY_KEY, useSubscription } from "@/hooks/use-subscription";
import { syncSubscriptionStatus, usePayment } from "@/hooks/use-payment";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import orbiLogo from "@/assets/orbi-logo_white.png";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : null;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

/**
 * Tela de bloqueio por inadimplência / pagamento pendente.
 * Não expõe nenhum dado do sistema — apenas regularização da cobrança.
 */
export default function Billing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { status, access, isLoading, blockedReason } = useSubscription();
  const { fetchOpenInvoice, paymentData, isLoading: isPaymentLoading } = usePayment();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (access === "allowed") navigate("/sistema", { replace: true });
    if (access === "no_plan") navigate("/pricing", { replace: true });
    if (access === "unauthenticated") navigate("/login", { replace: true });
  }, [access, isLoading, navigate]);

  useEffect(() => {
    if (access === "blocked" || access === "pending_payment") {
      fetchOpenInvoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  const handleRefresh = async () => {
    setIsSyncing(true);
    await syncSubscriptionStatus();
    await queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    setIsSyncing(false);
    toast({ title: "Status atualizado", description: "Consultamos o gateway de pagamento." });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate("/pricing", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="sr-only">Verificando sua assinatura…</span>
      </div>
    );
  }

  const isPending = access === "pending_payment";
  const periodEnd = formatDate(status.current_period_end);
  const nextDue = formatDate(status.next_due_date);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-subtle">
        <div className="mx-auto flex h-header max-w-[64rem] items-center justify-between px-4 md:px-6 lg:h-header-lg">
          <div className="flex items-center gap-2.5">
            <img src={orbiLogo} alt="Logotipo do Orbi" width={28} height={28} decoding="async" className="h-7 w-7" />
            <span className="font-display text-base font-semibold tracking-tight">Orbi</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[40rem] px-4 py-10 md:px-6 md:py-16">
        {/* Cabeçalho editorial: o estado da cobrança é a manchete, não um
            ícone gigante dentro de um círculo colorido. */}
        <div className="animate-rise">
          <p
            className={cn(
              "label-eyebrow flex items-center gap-1.5",
              isPending ? "text-warning" : "text-destructive",
            )}
          >
            {isPending ? <Clock className="h-3 w-3" aria-hidden /> : <AlertTriangle className="h-3 w-3" aria-hidden />}
            {isPending ? "Pagamento em processamento" : "Assinatura irregular"}
          </p>
          <h1 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-balance md:text-3xl">
            {isPending ? "Estamos aguardando a confirmação do seu pagamento." : "Seu acesso ao Orbi está pausado."}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">
            {isPending
              ? "Assim que o gateway confirmar, o acesso volta sozinho — você não precisa fazer mais nada."
              : blockedReason || "A cobrança da sua assinatura não foi concluída. Regularize abaixo para voltar de onde parou."}
          </p>
        </div>

        {/* Situação da assinatura: lista de definição com hairline. */}
        <dl className="mt-8 border-t border-border-subtle">
          <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5">
            <dt className="text-sm text-muted-foreground">Plano</dt>
            <dd className="text-sm font-medium text-foreground">{status.plan_name ?? "—"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5">
            <dt className="text-sm text-muted-foreground">Situação</dt>
            <dd>
              <Badge variant={isPending ? "warning" : "destructive"}>{status.status ?? "—"}</Badge>
            </dd>
          </div>
          {periodEnd && (
            <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5">
              <dt className="text-sm text-muted-foreground">Válido até</dt>
              <dd className="text-sm font-medium tabular text-foreground">{periodEnd}</dd>
            </div>
          )}
          {nextDue && (
            <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5">
              <dt className="text-sm text-muted-foreground">Próximo vencimento</dt>
              <dd className="text-sm font-medium tabular text-foreground">{nextDue}</dd>
            </div>
          )}
        </dl>

        <div className="mt-8 space-y-4">
          {paymentData?.url ? (
            <>
              <Button
                className="w-full"
                size="lg"
                onClick={() => window.open(paymentData.url, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-4 w-4" />
                Pagar {formatCurrency(paymentData.value)}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                PIX, boleto ou cartão. A liberação é automática após a confirmação.
              </p>
            </>
          ) : (
            <Alert variant="info">
              <AlertTitle>Nenhuma cobrança em aberto</AlertTitle>
              <AlertDescription>
                Atualize o status abaixo ou escolha um plano para gerar uma nova cobrança.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={handleRefresh} disabled={isSyncing || isPaymentLoading}>
              <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              Já paguei, atualizar
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => navigate("/pricing")}>
              <Sparkles className="h-4 w-4" />
              Ver planos
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
