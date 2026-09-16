import { useState } from "react";
import { TrendingUp } from "lucide-react";

import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import { formatMoney, formatPct } from "@/components/planning/planning-utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { useApplyInflationAlert, type BudgetInflationAlert } from "@/hooks/use-personal-inflation";
import { cn } from "@/lib/utils";

export function BudgetInflationAlerts({ alerts, className }: { alerts: BudgetInflationAlert[]; className?: string }) {
  const { apply, dismiss } = useApplyInflationAlert();
  const [busy, setBusy] = useState<string | null>(null);
  const actionable = alerts.filter((alert) => alert.budgetId && alert.suggestedLimit > 0);

  if (actionable.length === 0) return null;

  const run = async (alert: BudgetInflationAlert, mode: "apply" | "dismiss") => {
    setBusy(`${alert.id}:${mode}`);
    try {
      if (mode === "apply") {
        await apply(alert);
        notifyPlanningSuccess("Teto reajustado", `${alert.categoryName} agora vai até ${formatMoney(alert.suggestedLimit)} neste mês.`);
      } else {
        await dismiss(alert.id);
      }
    } catch (err) {
      notifyPlanningError(mode === "apply" ? "Não foi possível reajustar o teto" : "Não foi possível dispensar o aviso", err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Sugestões de reajuste pela inflação pessoal" className={cn("space-y-2", className)}>
      {actionable.map((alert) => (
        <div
          key={alert.id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-warning-soft/60 px-4 py-3 animate-fade-in sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex min-w-0 items-start gap-2.5 text-sm text-foreground">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span className="text-pretty">
              Os preços de <span className="font-medium">{alert.categoryName}</span> subiram{" "}
              <span className="font-semibold tabular text-warning">{formatPct(alert.inflationPct)}</span> no seu histórico. O teto de{" "}
              <span className="tabular">{formatMoney(alert.currentLimit)}</span> pode estourar na segunda semana.
            </span>
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => run(alert, "dismiss")} disabled={busy !== null}>
              {busy === `${alert.id}:dismiss` && <Spinner className="h-3.5 w-3.5" />}
              Manter teto
            </Button>
            <Button size="sm" onClick={() => run(alert, "apply")} disabled={busy !== null}>
              {busy === `${alert.id}:apply` && <Spinner className="h-3.5 w-3.5 text-primary-foreground" />}
              Reajustar para {formatMoney(alert.suggestedLimit)}
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
