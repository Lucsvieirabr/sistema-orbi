import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SubscriptionPlan } from "@/hooks/use-subscription";
import { usePayment } from "@/hooks/use-payment";
import { cn } from "@/lib/utils";

import { buildCancellationImpact, formatLongDate, formatShortDate, summarizeLoss, type ImpactRow } from "./plan-impact";

type Step = "impact" | "confirm";

const joinPhrases = (parts: string[]) =>
  parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;

export interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  features?: Record<string, boolean>;
  limits?: Record<string, number>;
  plans?: SubscriptionPlan[];
  usage?: Record<string, number | undefined>;
  /** Fim do período pago (timestamptz). */
  accessUntil?: string | null;
  /**
   * true quando não há período pago a preservar (cobrança pendente ou em
   * atraso): o backend encerra na hora. Espelha a regra da Edge Function.
   */
  immediate: boolean;
}

/**
 * Livro-razão da perda: cada linha é algo que o usuário tem hoje e deixa de ter.
 * A coluna "Depois" é a manchete; a coluna "Hoje" fica em tinta secundária.
 */
function ImpactLedger({ rows, planName, afterLabel }: { rows: ImpactRow[]; planName: string; afterLabel: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">O que muda na sua conta depois do cancelamento</caption>
        <thead className="bg-surface-sunken">
          <tr className="text-left">
            <th scope="col" className="label-eyebrow px-2.5 py-2 sm:px-3 font-medium">
              Recurso
            </th>
            <th scope="col" className="label-eyebrow whitespace-nowrap px-2.5 py-2 sm:px-3 text-right font-medium">
              Hoje · {planName}
            </th>
            <th scope="col" className="label-eyebrow whitespace-nowrap px-2.5 py-2 sm:px-3 text-right font-medium">
              {afterLabel}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <tr key={row.key} className="align-top">
              <th scope="row" className="px-2.5 py-2.5 sm:px-3 text-left font-normal text-foreground">
                {row.label}
                {row.overLimit && (
                  <span className="mt-0.5 block text-xs tabular text-destructive">
                    Você tem {new Intl.NumberFormat("pt-BR").format(row.usage ?? 0)} hoje
                  </span>
                )}
              </th>
              <td className="whitespace-nowrap px-2.5 py-2.5 sm:px-3 text-right tabular text-muted-foreground">
                {row.kind === "feature" ? (
                  <span className="inline-flex items-center justify-end">
                    <Check className="h-4 w-4 text-success" aria-hidden />
                    <span className="sr-only">{row.now}</span>
                  </span>
                ) : (
                  row.now
                )}
              </td>
              <td
                className={cn(
                  "whitespace-nowrap px-2.5 py-2.5 sm:px-3 text-right font-medium tabular",
                  row.overLimit ? "text-destructive" : "text-foreground",
                )}
              >
                {row.kind === "feature" ? (
                  <span className="inline-flex items-center justify-end">
                    <X className="h-4 w-4 text-destructive" aria-hidden />
                    <span className="sr-only">{row.after}</span>
                  </span>
                ) : (
                  row.after
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Cancelamento em duas etapas, nunca num clique:
 *
 *   1. Impacto — o que o usuário perde, com números da própria conta.
 *      A ação principal (e o foco inicial) é "Manter meu plano".
 *   2. Confirmação — resumo do que acontece no gateway + aceite explícito.
 *      O botão destrutivo só habilita com o aceite marcado.
 *
 * Enquanto a chamada ao backend corre, o diálogo não fecha (Esc, clique fora).
 */
export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  planName,
  features,
  limits,
  plans,
  usage,
  accessUntil,
  immediate,
}: CancelSubscriptionDialogProps) {
  const navigate = useNavigate();
  const { cancelSubscription, isLoading } = usePayment();
  const ackId = useId();

  const [step, setStep] = useState<Step>("impact");
  const [acknowledged, setAcknowledged] = useState(false);

  const keepButtonRef = useRef<HTMLButtonElement>(null);
  const ackRef = useRef<HTMLButtonElement>(null);

  const impact = useMemo(
    () => buildCancellationImpact({ features, limits }, plans, usage),
    [features, limits, plans, usage],
  );

  const longDate = formatLongDate(accessUntil);
  const shortDate = formatShortDate(accessUntil);
  const afterLabel = impact.fallbackPlan ? `Depois · ${impact.fallbackPlan.name}` : "Depois";
  const overLimitRows = impact.rows.filter((row) => row.overLimit);
  const loss = summarizeLoss(impact.rows, planName);

  // Estado limpo a cada abertura.
  useEffect(() => {
    if (!open) {
      setStep("impact");
      setAcknowledged(false);
    }
  }, [open]);

  // O botão focado desmonta na troca de etapa: o foco vai para o controle-chave da nova.
  useEffect(() => {
    if (!open) return;
    const target = step === "impact" ? keepButtonRef.current : ackRef.current;
    target?.focus();
  }, [step, open]);

  const requestClose = (next: boolean) => {
    if (isLoading) return;
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!acknowledged || isLoading) return;
    const result = await cancelSubscription();
    if (result) onOpenChange(false);
  };

  const intro = immediate
    ? "Como a cobrança atual ainda não foi paga, o plano deixa de valer assim que você confirmar."
    : longDate
      ? `Nada muda até ${longDate}. A partir desse dia, sua conta fica assim:`
      : "Nada muda até o fim do período já pago. Depois disso, sua conta fica assim:";

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent
        className="sm:max-w-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepButtonRef.current?.focus();
        }}
        onEscapeKeyDown={(event) => isLoading && event.preventDefault()}
        onInteractOutside={(event) => isLoading && event.preventDefault()}
      >
        {step === "impact" ? (
          <div key="impact" className="grid gap-5 motion-safe:animate-rise">
            <DialogHeader className="text-left">
              <p className="label-eyebrow">Cancelar assinatura</p>
              <DialogTitle>Antes de sair do plano {planName}</DialogTitle>
              <DialogDescription className="text-pretty">{intro}</DialogDescription>
            </DialogHeader>

            {impact.rows.length > 0 ? (
              <ImpactLedger rows={impact.rows} planName={planName} afterLabel={afterLabel} />
            ) : (
              <p className="rounded-lg border border-border-subtle bg-surface-sunken px-2.5 py-2.5 sm:px-3 text-sm text-muted-foreground">
                Os recursos do plano {planName} deixam de valer
                {immediate ? " agora" : shortDate ? ` em ${shortDate}` : " no fim do período"}.
              </p>
            )}

            {overLimitRows.length > 0 && impact.fallbackPlan && (
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
                Seus dados continuam salvos, mas no {impact.fallbackPlan.name} você não consegue cadastrar mais{" "}
                {joinPhrases(overLimitRows.map((row) => row.phrase))} enquanto estiver acima do limite.
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              Se o valor pesa,{" "}
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/pricing");
                }}
                className="rounded-sm font-medium text-foreground underline underline-offset-4 transition-colors duration-200 ease-swift hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                troque de plano
              </button>{" "}
              em vez de cancelar.
            </p>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("confirm")}>
                Continuar cancelamento
              </Button>
              <Button ref={keepButtonRef} onClick={() => onOpenChange(false)}>
                Manter meu plano
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div key="confirm" className="grid gap-5 motion-safe:animate-rise">
            <DialogHeader className="text-left">
              <p className="label-eyebrow">Última etapa</p>
              <DialogTitle>Confirmar cancelamento</DialogTitle>
              <DialogDescription className="text-pretty">
                {immediate
                  ? "A cobrança recorrente é encerrada no gateway de pagamento e o plano deixa de valer agora."
                  : "A renovação automática é desligada no gateway de pagamento. Nenhuma nova cobrança será feita."}
              </DialogDescription>
            </DialogHeader>

            <dl className="border-t border-border-subtle text-sm">
              <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5">
                <dt className="text-muted-foreground">Plano</dt>
                <dd className="font-medium text-foreground">{planName}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5">
                <dt className="text-muted-foreground">Vale até</dt>
                <dd className="font-medium tabular text-foreground">
                  {immediate ? "Encerra agora" : (shortDate ?? "Fim do período pago")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5">
                <dt className="text-muted-foreground">Próxima cobrança</dt>
                <dd className="font-medium text-foreground">Nenhuma</dd>
              </div>
            </dl>

            <label
              htmlFor={ackId}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-200 ease-swift",
                acknowledged ? "border-ring/60 bg-surface-sunken" : "border-border hover:border-ring/45",
              )}
            >
              <Checkbox
                ref={ackRef}
                id={ackId}
                checked={acknowledged}
                onCheckedChange={(value) => setAcknowledged(value === true)}
                disabled={isLoading}
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed text-pretty text-foreground">
                Entendo que {immediate ? "perco agora" : longDate ? `a partir de ${longDate} perco` : "no fim do período perco"}{" "}
                {loss}.
              </span>
            </label>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("impact")} disabled={isLoading}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={!acknowledged || isLoading}>
                {isLoading && <Loader2 className="animate-spin" aria-hidden />}
                {isLoading ? "Cancelando…" : "Cancelar assinatura"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
