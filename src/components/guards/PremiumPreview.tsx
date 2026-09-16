import { ArrowDownRight, ArrowUpRight, Flag, Store, TriangleAlert } from "lucide-react";

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
  if (module === "forecast") return <ForecastPreview />;
  if (module === "ledgers") return <LedgersPreview />;
  if (module === "projects") return <ProjectsPreview />;
  if (module === "inflation") return <InflationPreview />;
  return <ClosingPreview />;
}

/** Curva de exemplo: desce com o ralo, sobe no salário e cruza o zero na fatura. */
const FORECAST_PATH = "M0 34 L40 40 L62 44 L70 22 L120 30 L150 36 L162 70 L210 78 L240 84 L252 60 L300 66";

function ForecastPreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg bg-destructive-soft px-3.5 py-3 text-sm text-destructive">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="text-pretty">
          <span className="font-semibold">Atenção: Projeção indica ruptura de caixa no dia 14/11.</span> Faltarão{" "}
          <span className="font-semibold tabular">{formatMoney(612.4)}</span> para cobrir os compromissos previstos.
        </p>
      </div>
      <svg viewBox="0 0 300 100" className="h-32 w-full" role="img" aria-label="Exemplo de linha do saldo cruzando o zero">
        <line x1="0" y1="62" x2="300" y2="62" className="stroke-destructive" strokeDasharray="4 4" strokeWidth="1" />
        <rect x="0" y="62" width="300" height="38" className="fill-destructive" opacity="0.05" />
        <path d={FORECAST_PATH} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" />
        <path d="M0 34 L40 40 L62 44 L70 30 L120 38 L150 44 L162 58 L210 62 L240 60 L252 44 L300 48" fill="none" className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="5 4" />
        <circle cx="159" cy="62" r="4.5" className="fill-destructive stroke-card" strokeWidth="2" />
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border-subtle pt-3 text-xs text-muted-foreground">
        <li>
          Ralo diário <span className="font-medium tabular text-foreground">{formatMoney(86.4)}</span>
        </li>
        <li>
          Simulando <span className="font-medium text-foreground">Aliança · 10x de {formatMoney(400)}</span>
        </li>
      </ul>
    </div>
  );
}

function LedgersPreview() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="label-eyebrow">Viagem Argentina · extrato de fechamento</p>
        <p className="mt-2 text-[0.9375rem] text-foreground">
          <span className="font-medium">João</span> deve <span className="figure-sm font-semibold tabular">{formatMoney(350)}</span>{" "}
          para <span className="font-medium">você</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">15 gastos miúdos viram um único PIX Copia e Cola.</p>
      </div>
      <ul className="divide-y divide-border-subtle">
        {[
          { category: "Pets", person: "Ana", mine: 50 },
          { category: "Casa e mercado", person: "Ana", mine: 60 },
        ].map((row) => (
          <li key={row.category} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{row.category}</span>
              <span className="text-xs tabular text-muted-foreground">
                Você {row.mine}% · {row.person} {100 - row.mine}%
              </span>
            </div>
            <div aria-hidden className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
              <span className="h-full rounded-full bg-primary" style={{ flexGrow: row.mine }} />
              <span className="h-full rounded-full bg-chart-3" style={{ flexGrow: 100 - row.mine }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
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

const SAMPLE_PROJECTS = [
  { name: "Casamento 2027", note: "Veio da meta · R$ 12.000,00 guardados", cost: 7000, budget: 15000, time: 38, color: "#b45309" },
  { name: "Enxoval do filhote", note: "Arquivado", cost: 2450, budget: 2784, time: 100, color: "#0f766e", archived: true },
];

function ProjectsPreview() {
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SAMPLE_PROJECTS.map((project) => {
          const pct = (project.cost / project.budget) * 100;
          return (
            <li key={project.name} className="relative isolate overflow-hidden rounded-xl border border-border bg-card p-4">
              <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: project.color }} />
              <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
              <p className="text-xs text-muted-foreground">{project.note}</p>
              {project.archived ? (
                <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-foreground">
                  <Flag className="mt-1 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                  <span>
                    O Enxoval do filhote custou <span className="font-semibold tabular">{formatMoney(project.cost)}</span>, 12% abaixo do
                    orçamento previsto.
                  </span>
                </p>
              ) : (
                <>
                  <p className="figure-md mt-3 tabular text-foreground">{formatMoney(project.cost)}</p>
                  <p className="text-xs tabular text-muted-foreground">de {formatMoney(project.budget)} orçados</p>
                  <div aria-hidden className="relative mt-3 h-1.5 w-full rounded-full bg-surface-sunken">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: project.color }} />
                    <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${project.time}%` }} />
                  </div>
                  <p className="mt-2 text-xs tabular text-muted-foreground">
                    {formatPct(pct, { digits: 0 })} do orçamento com {project.time}% do prazo
                  </p>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border-subtle pt-3 text-xs text-muted-foreground">
        O anel de ouro 18k de <span className="font-medium tabular text-foreground">{formatMoney(5000)}</span> fica no projeto: o
        fechamento do mês e os orçamentos seguem mostrando a sua rotina.
      </p>
    </div>
  );
}

const SAMPLE_INFLATION = [
  { name: "Assinaturas e streaming", pct: 15.2, mover: "Netflix", from: 44.9, to: 55.9 },
  { name: "Mercado", pct: 10.4, mover: "Supermercado Bom Preço", from: 312, to: 344.45 },
  { name: "Refeição fora de casa", pct: 5.1, mover: "Padaria Central", from: 38, to: 40 },
];

function InflationPreview() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="font-display text-4xl font-semibold leading-none tracking-[-0.03em] tabular text-warning">+8,5%</p>
        <p className="max-w-xs text-sm text-foreground text-pretty">
          Sua inflação pessoal nos últimos 6 meses é de 8,5%. O custo de manutenção do seu estilo de vida subiu.
        </p>
      </div>
      <ul className="divide-y divide-border-subtle border-t border-border-subtle">
        {SAMPLE_INFLATION.map((row) => (
          <li key={row.name} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{row.name}</span>
              <span className="flex items-center gap-1.5 text-xs tabular text-muted-foreground">
                <Store className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">
                  {row.mover}: {formatMoney(row.from)} → {formatMoney(row.to)}
                </span>
              </span>
            </span>
            <span className={cn("shrink-0 text-sm font-semibold tabular", row.pct >= 10 ? "text-destructive" : "text-warning")}>
              {formatPct(row.pct, { signed: true })}
            </span>
          </li>
        ))}
      </ul>
      <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-foreground">
        Mercado subiu mais de 10%: reajuste o teto de R$ 1.400,00 para R$ 1.545,60 antes de ele estourar na segunda semana.
      </p>
    </div>
  );
}
