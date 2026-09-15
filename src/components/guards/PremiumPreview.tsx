import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { UsageBar, usageTone, type LedgerTone } from "@/components/planning/LedgerStrip";
import { formatMoney, formatPct } from "@/components/planning/planning-utils";
import type { PremiumModuleKey } from "@/lib/features/premium-modules";
import { cn } from "@/lib/utils";

/**
 * Prévias da tela de upgrade. Mesmo vocabulário visual dos módulos reais
 * (barra de consumo, régua de cor, linhas de DRE) com valores de exemplo —
 * a pessoa vê a tela que vai ganhar, não uma ilustração genérica.
 */
export function PremiumPreview({ module }: { module: PremiumModuleKey }) {
  if (module === "budgets") return <BudgetsPreview />;
  if (module === "goals") return <GoalsPreview />;
  return <ClosingPreview />;
}

const toneText: Record<LedgerTone, string> = {
  neutral: "text-muted-foreground",
  positive: "text-muted-foreground",
  warning: "text-warning",
  negative: "text-destructive",
};

const SAMPLE_BUDGETS = [
  { name: "Lazer", spent: 690, limit: 600 },
  { name: "Alimentação", spent: 1180, limit: 1400 },
  { name: "Transporte", spent: 320, limit: 600 },
  { name: "Assinaturas", spent: 112.9, limit: 150 },
];

function BudgetsPreview() {
  return (
    <ul className="divide-y divide-border-subtle">
      {SAMPLE_BUDGETS.map((row) => {
        const tone = usageTone(row.spent, row.limit);
        const diff = row.limit - row.spent;
        const status =
          tone === "negative"
            ? `Passou ${formatMoney(Math.abs(diff))}`
            : tone === "warning"
              ? `Restam ${formatMoney(diff)}`
              : `Cabe mais ${formatMoney(diff)}`;
        return (
          <li key={row.name} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
              <span className="shrink-0 text-sm tabular text-foreground">
                {formatMoney(row.spent)}
                <span className="text-muted-foreground"> de {formatMoney(row.limit)}</span>
              </span>
            </div>
            <UsageBar
              className="mt-2"
              value={row.spent}
              max={row.limit}
              tone={tone === "positive" ? "neutral" : tone}
              label={`Consumo de ${row.name}`}
              valueText={`${formatPct((row.spent / row.limit) * 100, { digits: 0 })} do orçamento`}
            />
            <p className={cn("mt-1.5 text-xs tabular", toneText[tone])}>
              {formatPct((row.spent / row.limit) * 100, { digits: 0 })} · {status}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

const SAMPLE_GOALS = [
  { name: "Reserva de emergência", saved: 7800, target: 15000, color: "#3b82f6", note: "Guarde R$ 1.028,57/mês até mar. 2027" },
  { name: "Viagem para Lisboa", saved: 4200, target: 6000, color: "#14b8a6", note: "Guarde R$ 450,00/mês até dez. 2026" },
];

function GoalsPreview() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {SAMPLE_GOALS.map((goal) => (
        <li key={goal.name} className="relative isolate overflow-hidden rounded-xl border border-border bg-card p-4">
          <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: goal.color }} />
          <p className="truncate text-sm font-medium text-foreground">{goal.name}</p>
          <p className="figure-md mt-3 tabular text-foreground">{formatMoney(goal.saved)}</p>
          <p className="text-xs tabular text-muted-foreground">de {formatMoney(goal.target)}</p>
          <UsageBar
            className="mt-3"
            value={goal.saved}
            max={goal.target}
            color={goal.color}
            label={`Progresso de ${goal.name}`}
            valueText={`${formatPct((goal.saved / goal.target) * 100, { digits: 0 })} da meta`}
          />
          <p className="mt-2 text-xs tabular text-muted-foreground">{goal.note}</p>
        </li>
      ))}
    </ul>
  );
}

const SAMPLE_DRE = [
  { label: "Receitas", value: 8400, variation: 3.1, kind: "total" as const },
  { label: "(−) Despesas fixas", value: 3150, variation: 0, kind: "line" as const },
  { label: "(−) Parcelamentos", value: 640, variation: -12.3, kind: "line" as const },
  { label: "(−) Despesas variáveis", value: 2310, variation: 8.4, kind: "line" as const },
  { label: "= Resultado do mês", value: 2300, variation: -2.5, kind: "result" as const },
];

function ClosingPreview() {
  return (
    <div>
      <table className="w-full text-sm">
        <caption className="sr-only">Exemplo de demonstrativo do resultado do mês</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="pb-2 font-medium">Linha</th>
            <th scope="col" className="pb-2 text-right font-medium">Setembro</th>
            <th scope="col" className="pb-2 text-right font-medium">vs agosto</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_DRE.map((row) => {
            const isExpense = row.kind === "line";
            const good = isExpense ? row.variation <= 0 : row.variation >= 0;
            const Arrow = row.variation >= 0 ? ArrowUpRight : ArrowDownRight;
            return (
              <tr
                key={row.label}
                className={cn(
                  "border-t border-border-subtle",
                  row.kind === "result" && "border-border font-semibold",
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "py-2.5 text-left",
                    row.kind === "line" ? "font-normal text-muted-foreground" : "font-medium text-foreground",
                  )}
                >
                  {row.label}
                </th>
                <td className={cn("py-2.5 text-right tabular", row.kind === "result" ? "text-success" : "text-foreground")}>
                  {formatMoney(row.value)}
                </td>
                <td className="py-2.5 text-right">
                  {row.variation === 0 ? (
                    <span className="text-xs tabular text-muted-foreground">estável</span>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-xs tabular",
                        good ? "text-success" : "text-destructive",
                      )}
                    >
                      <Arrow className="h-3 w-3" aria-hidden />
                      {formatPct(row.variation, { signed: true })}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-4 border-t border-border-subtle pt-3 text-xs text-muted-foreground">
        Taxa de poupança <span className="font-medium tabular text-foreground">27,4%</span> · Maior despesa{" "}
        <span className="font-medium text-foreground">Aluguel, {formatMoney(2200)}</span>
      </p>
    </div>
  );
}
