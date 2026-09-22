import { useMemo, useState } from "react";
import { Check, CreditCard, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { buildPlanHighlights } from "@/components/landing/plan-highlights";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { usePayment } from "@/hooks/use-payment";
import { useQuota } from "@/hooks/use-quota";
import { useSubscription, useSubscriptionPlans } from "@/hooks/use-subscription";
import { formatCurrencyBRL } from "@/lib/utils";
import { openExternalUrl } from "@/lib/safe-url";

import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { formatLongDate, formatShortDate, parseBackendDate } from "./plan-impact";

const FREE_SLUGS = ["free", "basic"];

type Tone = NonNullable<BadgeProps["variant"]>;

function LedgerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium tabular text-foreground">{children}</dd>
    </div>
  );
}

function SubscriptionSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Carregando assinatura">
      <CardHeader className="gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </CardContent>
    </Card>
  );
}

/**
 * Seção "Assinatura" de Configurações.
 *
 * Mostra o plano como um extrato (plano, ciclo, próxima cobrança) e mantém o
 * cancelamento como ação secundária no rodapé: ghost que só ganha tom
 * destrutivo no hover. O peso da decisão fica no diálogo de duas etapas.
 *
 * Com cancelamento agendado, a ação de destaque vira "Retomar assinatura".
 */
export function SubscriptionSettings() {
  const navigate = useNavigate();
  const { status, isLoading } = useSubscription();
  const { data: plans = [] } = useSubscriptionPlans();
  const { usage } = useQuota();
  const { reactivateSubscription, fetchOpenInvoice, isLoading: isPaymentBusy } = usePayment();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"reactivate" | "invoice" | null>(null);

  const plan = useMemo(() => plans.find((candidate) => candidate.id === status.plan_id) ?? null, [plans, status.plan_id]);

  const highlights = useMemo(() => {
    if (!plan) return null;
    const { lead, lines } = buildPlanHighlights(plan, plans);
    return { lead, lines: lines.filter((line) => line.included) };
  }, [plan, plans]);

  if (isLoading) return <SubscriptionSkeleton />;

  if (!status.has_subscription) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Nenhuma assinatura ativa"
        description="Escolha um plano para continuar usando o Orbi."
        action={<Button onClick={() => navigate("/pricing")}>Ver planos</Button>}
      />
    );
  }

  // Plano Casal: parceiro vinculado usa a assinatura do dono. Sem cobrança,
  // troca ou cancelamento aqui — o backend nem devolve os dados de cobrança.
  if (status.inherited) {
    const sharedUntil = status.cancel_at_period_end ? formatShortDate(status.current_period_end) : null;

    return (
      <Card>
        <CardHeader className="gap-3 space-y-0">
          <p className="label-eyebrow">Plano atual</p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">
              {status.plan_name ?? "Casal"}
            </h2>
            <Badge variant="info">Compartilhado</Badge>
          </div>
          <p className="max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
            Você usa este plano pelo Plano Casal. Cobrança, troca de plano e cancelamento ficam com quem assina.
          </p>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          {sharedUntil && (
            <dl className="border-t border-border-subtle">
              <LedgerRow label="Compartilhado até">{sharedUntil}</LedgerRow>
            </dl>
          )}

          {highlights && highlights.lines.length > 0 && (
            <section aria-labelledby="plan-includes-shared">
              <h3 id="plan-includes-shared" className="label-eyebrow">
                Incluído no plano
              </h3>
              <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {highlights.lines.map((line) => (
                  <li key={line.text} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    {line.text}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </CardContent>
      </Card>
    );
  }

  const planName = status.plan_name ?? "atual";
  const isYearly = status.billing_cycle === "yearly" || (status.billing_cycle as string) === "annual";
  const price = plan ? Number(isYearly ? plan.price_yearly : plan.price_monthly) : null;
  const isPaid = price !== null ? price > 0 : !FREE_SLUGS.includes(status.plan_slug ?? "");

  const cancelScheduled = status.cancel_at_period_end === true;
  const isTrial = status.status === "trial";
  const isGrace = status.status === "past_due_grace";
  const accessUntil = isTrial ? (status.trial_end ?? status.current_period_end) : status.current_period_end;
  const accessUntilDate = parseBackendDate(accessUntil);
  const periodIsOpen = accessUntilDate ? accessUntilDate.getTime() > Date.now() : false;

  // Mesma regra da Edge Function: sem período pago em curso, cancela na hora.
  const immediate = status.raw_status === "past_due" || status.raw_status === "pending" || !periodIsOpen;
  const canCancel =
    isPaid && !cancelScheduled && ["active", "trial", "past_due_grace"].includes(status.status ?? "");

  const badge: { tone: Tone; label: string } = cancelScheduled
    ? { tone: "warning", label: "Cancelamento agendado" }
    : isGrace
      ? { tone: "warning", label: "Pagamento em atraso" }
      : isTrial
        ? { tone: "info", label: "Período de teste" }
        : { tone: "success", label: "Ativa" };

  const handleReactivate = async () => {
    setPendingAction("reactivate");
    await reactivateSubscription();
    setPendingAction(null);
  };

  const handleOpenInvoice = async () => {
    setPendingAction("invoice");
    const invoice = await fetchOpenInvoice();
    setPendingAction(null);
    if (invoice?.url) openExternalUrl(invoice.url);
  };

  return (
    <>
      <Card className="relative isolate overflow-hidden">
        {cancelScheduled && (
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-warning" />
        )}

        <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="label-eyebrow">Plano atual</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h2 className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">
                {planName}
              </h2>
              <Badge variant={badge.tone}>{badge.label}</Badge>
            </div>
            {plan?.description && (
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
                {plan.description}
              </p>
            )}
          </div>

          {price !== null && (
            <p className="shrink-0 sm:pt-5 sm:text-right">
              {price > 0 ? (
                <>
                  <span className="figure-lg text-foreground">{formatCurrencyBRL(price)}</span>
                  <span className="ml-1 text-sm text-muted-foreground">/{isYearly ? "ano" : "mês"}</span>
                </>
              ) : (
                <span className="figure-lg text-foreground">Grátis</span>
              )}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          {(isPaid || isTrial) && (
            <dl className="border-t border-border-subtle">
              {isPaid && <LedgerRow label="Ciclo">{isYearly ? "Anual" : "Mensal"}</LedgerRow>}

              {cancelScheduled ? (
                <>
                  <LedgerRow label="Acesso ao plano até">{formatShortDate(accessUntil) ?? "—"}</LedgerRow>
                  <LedgerRow label="Próxima cobrança">Nenhuma</LedgerRow>
                </>
              ) : isTrial ? (
                <LedgerRow label="Teste termina em">{formatShortDate(accessUntil) ?? "—"}</LedgerRow>
              ) : isGrace ? (
                status.grace_period_end ? (
                  <LedgerRow label="Regularize até">
                    <span className="text-warning">{formatShortDate(status.grace_period_end)}</span>
                  </LedgerRow>
                ) : (
                  <LedgerRow label="Vencimento">
                    <span className="text-warning">
                      {formatShortDate(status.next_due_date ?? status.current_period_end) ?? "—"}
                    </span>
                  </LedgerRow>
                )
              ) : isPaid ? (
                <LedgerRow label="Próxima cobrança">
                  {formatShortDate(status.next_due_date ?? status.current_period_end) ?? "—"}
                </LedgerRow>
              ) : null}
            </dl>
          )}

          {highlights && highlights.lines.length > 0 && (
            <section aria-labelledby="plan-includes">
              <h3 id="plan-includes" className="label-eyebrow">
                Incluído no seu plano
              </h3>
              {highlights.lead && <p className="mt-2 text-sm text-muted-foreground">{highlights.lead}</p>}
              <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {highlights.lines.map((line) => (
                  <li key={line.text} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    {line.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {cancelScheduled && (
            <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-sunken p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Seu plano {planName} continua valendo até {formatLongDate(accessUntil) ?? "o fim do período pago"}.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mudou de ideia? Retome agora e nada é cobrado antes dessa data.
                </p>
              </div>
              <Button onClick={handleReactivate} disabled={isPaymentBusy} className="shrink-0">
                {pendingAction === "reactivate" ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <RotateCcw aria-hidden />
                )}
                {pendingAction === "reactivate" ? "Retomando…" : "Retomar assinatura"}
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter>
          {!isPaid ? (
            <>
              <p className="text-sm text-muted-foreground sm:mr-auto">
                Importe extratos e deixe a IA classificar seus lançamentos com um plano pago.
              </p>
              <Button onClick={() => navigate("/pricing")}>Ver planos</Button>
            </>
          ) : (
            <>
              {isGrace && (
                <Button variant="outline" onClick={handleOpenInvoice} disabled={isPaymentBusy}>
                  {pendingAction === "invoice" ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <ExternalLink aria-hidden />
                  )}
                  Pagar fatura em aberto
                </Button>
              )}
              <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row sm:items-center">
                {canCancel && (
                  <Button
                    variant="ghost"
                    onClick={() => setCancelOpen(true)}
                    className="hover:bg-destructive-soft hover:text-destructive"
                  >
                    Cancelar assinatura
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate("/pricing")}>
                  Trocar de plano
                </Button>
              </div>
            </>
          )}
        </CardFooter>
      </Card>

      {isPaid && (
        <CancelSubscriptionDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          planName={planName}
          features={status.features}
          limits={status.limits}
          plans={plans}
          usage={usage}
          accessUntil={accessUntil}
          immediate={immediate}
        />
      )}
    </>
  );
}
