import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Clock, ExternalLink, LogOut, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SUBSCRIPTION_QUERY_KEY, useSubscription } from "@/hooks/use-subscription";
import { syncSubscriptionStatus, usePayment } from "@/hooks/use-payment";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import orbiLogo from "@/assets/orbi-logo_white.png";

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const isPending = access === "pending_payment";
  const periodEnd = formatDate(status.current_period_end);
  const nextDue = formatDate(status.next_due_date);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={orbiLogo} alt="Orbi" className="h-7 w-7" />
          <span className="text-lg font-semibold">Orbi</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>

      <div className="container mx-auto flex justify-center px-4 py-6 md:py-10">
        <Card className="w-full max-w-2xl border-destructive/30 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              {isPending ? (
                <Clock className="h-8 w-8 text-primary" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-destructive" />
              )}
            </div>
            <CardTitle className="text-xl md:text-2xl">
              {isPending ? "Aguardando confirmação do pagamento" : "Acesso bloqueado"}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {isPending
                ? "Assim que o gateway confirmar o pagamento, seu acesso é liberado automaticamente."
                : blockedReason || "Sua assinatura está inadimplente ou expirada."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plano</span>
                <span className="font-medium">{status.plan_name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Situação</span>
                <span className="font-medium uppercase">{status.status ?? "—"}</span>
              </div>
              {periodEnd && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Válido até</span>
                  <span className="font-medium">{periodEnd}</span>
                </div>
              )}
              {nextDue && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Próximo vencimento</span>
                  <span className="font-medium">{nextDue}</span>
                </div>
              )}
            </div>

            {paymentData?.url ? (
              <div className="space-y-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => window.open(paymentData.url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="mr-2 h-5 w-5" />
                  Pagar {formatCurrency(paymentData.value)}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  PIX, boleto ou cartão. A liberação é automática após a confirmação.
                </p>
              </div>
            ) : (
              <Alert>
                <AlertTitle>Nenhuma cobrança em aberto localizada</AlertTitle>
                <AlertDescription>
                  Atualize o status ou escolha um plano para gerar uma nova cobrança.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleRefresh}
                disabled={isSyncing || isPaymentLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                Já paguei, atualizar
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => navigate("/pricing")}>
                <Sparkles className="mr-2 h-4 w-4" />
                Ver planos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
