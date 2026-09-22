import { useMemo, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, CalendarClock, FolderKanban, Minus, RotateCw, ScrollText } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import { InflationAlertCard } from "@/components/inflation/InflationAlertCard";
import { CoupleSplitCard } from "@/components/family/CoupleSplitCard";
import { LedgerStrip, type LedgerTone } from "@/components/planning/LedgerStrip";
import { MonthSwitcher, useMonthParam } from "@/components/planning/MonthSwitcher";
import {
  describePlanningError,
  formatDayMonth,
  formatMoney,
  formatMonthAbbr,
  formatMonthName,
  formatPct,
  formatPoints,
  formatSignedMoney,
  monthParamFromKey,
  plural,
} from "@/components/planning/planning-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFeature } from "@/hooks/use-feature";
import { IconRenderer } from "@/components/ui/icon-renderer";
import { EmptyState, PageBody, PageHeader, PageToolbar, SectionHeader, ToolbarSpacer } from "@/components/ui/page";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { useMonthlyClosing, type MonthlyClosing as Closing } from "@/hooks/use-monthly-closing";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

/**
 * Fechamento do mês — DRE pessoal (Pro/Casal). Gate de plano na rota.
 * Todo número desta tela vem agregado da RPC `orbi_monthly_closing`; o cliente
 * só faz a divisão final entre dois valores já somados (variação, % da receita).
 */

type Direction = "up-good" | "up-bad" | "neutral";

interface DreLine {
  key: string;
  label: string;
  operator: "" | "(−)" | "(=)";
  kind: "group" | "detail" | "line" | "result";
  current: number;
  previous: number | null;
  direction: Direction;
}

const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const pctChange = (current: number, previous: number | null): number | null => {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
};

export default function MonthlyClosing() {
  const [month, setMonth] = useMonthParam();
  const [params, setParams] = useSearchParams();
  const { hasFeature: hasProjects } = useFeature("projetos_vida");
  const includeProjects = hasProjects && params.get("projetos") === "incluir";
  const { data, isLoading, isFetching, error, refetch } = useMonthlyClosing(month, !includeProjects);

  const toggleProjects = (checked: boolean) => {
    const next = new URLSearchParams(params);
    if (checked) next.set("projetos", "incluir");
    else next.delete("projetos");
    setParams(next, { replace: true });
  };

  const monthName = formatMonthName(month);

  return (
    <PageBody>
      <PageHeader
        eyebrow="Planejamento"
        icon={ScrollText}
        title="Fechamento do mês"
        description="O demonstrativo do seu mês: o que entrou, para onde foi e quanto sobrou, comparado ao mês anterior."
      />

      <PageToolbar>
        <MonthSwitcher month={month} onChange={setMonth} />
        <ToolbarSpacer />
        <div className="flex flex-wrap items-center gap-3">
          {isFetching && !isLoading && <Spinner className="h-4 w-4" />}
          {hasProjects && (
            <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-sunken px-3 py-2">
              <Switch id="closing-include-projects" checked={includeProjects} onCheckedChange={toggleProjects} />
              <Label htmlFor="closing-include-projects" className="cursor-pointer text-xs font-medium">
                Incluir projetos de vida
              </Label>
            </div>
          )}
        </div>
      </PageToolbar>

      {isLoading ? (
        <ClosingSkeleton />
      ) : error || !data ? (
        <EmptyState
          icon={ScrollText}
          title="Não deu para montar o fechamento"
          description={error ? describePlanningError(error).message : "Tente de novo em instantes. Nenhum dado foi alterado."}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCw aria-hidden />
              Tentar de novo
            </Button>
          }
        />
      ) : !data.hasData ? (
        <div className="space-y-5 md:space-y-7">
          <EmptyState
            icon={ScrollText}
            title={`Nenhum lançamento em ${monthName}`}
            description="O fechamento aparece assim que houver receitas ou despesas com data neste mês."
            action={
              <Button asChild variant="outline">
                <Link to="/sistema/statement">Ir para o extrato</Link>
              </Button>
            }
          />
          {data.trend.some((point) => point.income > 0 || point.expenses > 0) && <TrendCard closing={data} />}
        </div>
      ) : (
        <ClosingReport
          closing={data}
          insight={<CoupleSplitCard month={month} excludeProjects={!includeProjects} />}
        />
      )}
    </PageBody>
  );
}

function ClosingSkeleton() {
  return (
    <div className="space-y-5 md:space-y-7" aria-busy="true">
      <Skeleton className="h-[7.5rem] w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-6">
        <Skeleton className="h-[26rem] w-full rounded-xl" />
        <Skeleton className="h-[26rem] w-full rounded-xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

function ClosingReport({ closing, insight }: { closing: Closing; insight?: ReactNode }) {
  const { current, previous, variation, largestExpense } = closing;
  const monthName = formatMonthName(closing.month);
  const previousName = formatMonthName(closing.previousMonth);

  const resultTone: LedgerTone = current.result >= 0 ? "positive" : "negative";

  const resultHint = closing.hasPrevious ? (
    <span className="tabular">
      <VariationText value={variation.resultPct} direction="up-good" /> vs {previousName} ({formatSignedMoney(previous.result)})
    </span>
  ) : (
    `Sem lançamentos em ${previousName} para comparar`
  );

  const savingsHint =
    current.savingsRate === null ? (
      "Sem receitas no mês — não há taxa a calcular"
    ) : variation.savingsRatePp !== null ? (
      <span className="tabular">
        <PointsText value={variation.savingsRatePp} /> vs {previousName} · parte da receita que sobrou
      </span>
    ) : (
      "Parte da receita que sobrou no mês"
    );

  return (
    <>
      <LedgerStrip
        aria-label={`Resumo do fechamento de ${monthName}`}
        cells={[
          {
            label: "Resultado do mês",
            value: formatSignedMoney(current.result),
            tone: resultTone,
            hint: resultHint,
          },
          {
            label: "Taxa de poupança",
            value: current.savingsRate === null ? "—" : formatPct(current.savingsRate),
            tone: current.savingsRate === null ? "neutral" : current.savingsRate >= 0 ? "neutral" : "negative",
            hint: savingsHint,
          },
          {
            label: "Maior despesa",
            value: largestExpense ? formatMoney(largestExpense.amount) : "—",
            hint: largestExpense ? (
              <span className="line-clamp-2">
                <span className="font-medium text-foreground">{largestExpense.description}</span> · {largestExpense.category} ·{" "}
                <span className="tabular">{formatDayMonth(largestExpense.date)}</span>
                {largestExpense.status === "PENDING" && " · agendada"}
              </span>
            ) : (
              "Nenhuma despesa no mês"
            ),
          },
        ]}
      />

      {insight}

      <InflationAlertCard teaser={false} />

      <ProjectsIsolationNote closing={closing} />

      {current.pendingCount > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-sunken px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <span className="font-medium text-foreground">
                {plural(current.pendingCount, "lançamento pendente", "lançamentos pendentes")}
              </span>{" "}
              neste mês
              <span className="tabular">
                {current.expensesPending > 0 && ` · ${formatMoney(current.expensesPending)} a pagar`}
                {current.incomePending > 0 && ` · ${formatMoney(current.incomePending)} a receber`}
              </span>
              . O fechamento já conta com eles.
            </span>
          </p>
          <Button asChild variant="ghost" size="sm" className="shrink-0 self-start sm:self-auto">
            <Link to="/sistema/statement">Revisar no extrato</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-6">
        <DreCard closing={closing} />
        <div className="space-y-4 lg:space-y-6">
          <CategoriesCard closing={closing} />
          {closing.incomeCategories.length > 0 && <IncomeCard closing={closing} />}
        </div>
      </div>

      <TrendCard closing={closing} />
    </>
  );
}

/* ------------------------------------------------------------------ DRE -- */

function DreCard({ closing }: { closing: Closing }) {
  const { current, previous, hasPrevious } = closing;
  const monthName = formatMonthName(closing.month);
  const previousName = formatMonthName(closing.previousMonth);
  const prev = (value: number) => (hasPrevious ? value : null);

  const lines: DreLine[] = [
    { key: "income", label: "Receitas", operator: "", kind: "group", current: current.income, previous: prev(previous.income), direction: "up-good" },
    { key: "received", label: "Recebidas", operator: "", kind: "detail", current: current.incomeReceived, previous: null, direction: "neutral" },
    { key: "pending", label: "A receber", operator: "", kind: "detail", current: current.incomePending, previous: null, direction: "neutral" },
    { key: "fixed", label: "Despesas fixas", operator: "(−)", kind: "line", current: current.fixed, previous: prev(previous.fixed), direction: "up-bad" },
    { key: "installments", label: "Parcelamentos", operator: "(−)", kind: "line", current: current.installments, previous: prev(previous.installments), direction: "up-bad" },
    { key: "variable", label: "Despesas variáveis", operator: "(−)", kind: "line", current: current.variable, previous: prev(previous.variable), direction: "up-bad" },
    { key: "result", label: "Resultado do mês", operator: "(=)", kind: "result", current: current.result, previous: prev(previous.result), direction: "up-good" },
    { key: "goals", label: "Aportes em metas", operator: "(−)", kind: "line", current: current.goalContributions, previous: prev(previous.goalContributions), direction: "neutral" },
    { key: "free", label: "Sobra livre", operator: "(=)", kind: "result", current: current.freeCash, previous: prev(previous.freeCash), direction: "up-good" },
  ];

  const share = (value: number) => (current.income > 0 ? (value / current.income) * 100 : null);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <SectionHeader
          title="Demonstrativo do resultado"
          description="Pela data de cada lançamento. Cancelados ficam fora; rateios entram pelo valor que é seu."
        />
      </CardHeader>

      {/* Desktop: tabela de verdade. */}
      <div className="hidden border-t border-border-subtle md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Demonstrativo do resultado de {monthName} comparado a {previousName}
          </caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="px-5 py-2.5 text-left font-medium lg:px-6">
                Linha
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium capitalize">
                {monthName}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium capitalize">
                {previousName}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Variação
              </th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium lg:px-6">
                % receita
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr
                key={line.key}
                className={cn(
                  "border-t transition-colors duration-200 ease-swift hover:bg-accent/40",
                  line.kind === "result" ? "border-border bg-surface-sunken/60" : "border-border-subtle",
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "px-5 py-2.5 text-left lg:px-6",
                    line.kind === "detail" && "pl-10 font-normal text-muted-foreground lg:pl-11",
                    line.kind === "line" && "font-normal text-foreground",
                    (line.kind === "group" || line.kind === "result") && "font-semibold text-foreground",
                  )}
                >
                  {line.operator && (
                    <span aria-hidden className="mr-1.5 inline-block w-7 text-muted-foreground">
                      {line.operator}
                    </span>
                  )}
                  {!line.operator && line.kind !== "detail" && <span aria-hidden className="mr-1.5 inline-block w-7" />}
                  {line.label}
                </th>
                <td
                  className={cn(
                    "whitespace-nowrap px-3 py-2.5 text-right tabular",
                    line.kind === "detail" ? "text-muted-foreground" : "text-foreground",
                    line.kind === "result" && (line.current >= 0 ? "font-semibold text-success" : "font-semibold text-destructive"),
                  )}
                >
                  {line.kind === "result" ? formatSignedMoney(line.current) : formatMoney(line.current)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular text-muted-foreground">
                  {line.previous === null
                    ? "—"
                    : line.kind === "result"
                      ? formatSignedMoney(line.previous)
                      : formatMoney(line.previous)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {line.previous === null ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <VariationText value={pctChange(line.current, line.previous)} direction={line.direction} withIcon />
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-2.5 text-right text-xs tabular text-muted-foreground lg:px-6">
                  {line.key === "income" || line.kind === "detail" ? "" : formatPct(share(line.current))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Telefone: linhas empilhadas, sem rolagem lateral. */}
      <ul className="divide-y divide-border-subtle border-t border-border-subtle md:hidden">
        {lines
          .filter((line) => line.kind !== "detail")
          .map((line) => (
            <li
              key={line.key}
              className={cn("px-4 py-3", line.kind === "result" && "bg-surface-sunken/60")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn("text-sm", line.kind === "line" ? "text-foreground" : "font-semibold text-foreground")}>
                  {line.operator && <span className="mr-1 text-muted-foreground">{line.operator}</span>}
                  {line.label}
                </p>
                <p
                  className={cn(
                    "shrink-0 text-sm tabular",
                    line.kind === "result"
                      ? line.current >= 0
                        ? "font-semibold text-success"
                        : "font-semibold text-destructive"
                      : "text-foreground",
                  )}
                >
                  {line.kind === "result" ? formatSignedMoney(line.current) : formatMoney(line.current)}
                </p>
              </div>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs tabular text-muted-foreground">
                {line.previous !== null ? (
                  <span>
                    <VariationText value={pctChange(line.current, line.previous)} direction={line.direction} /> vs {previousName}
                  </span>
                ) : (
                  <span>Sem base em {previousName}</span>
                )}
                {line.key !== "income" && share(line.current) !== null && <span>{formatPct(share(line.current))} da receita</span>}
                {line.key === "income" && current.incomePending > 0 && <span>{formatMoney(current.incomePending)} a receber</span>}
              </p>
            </li>
          ))}
      </ul>
    </Card>
  );
}

function VariationText({
  value,
  direction,
  withIcon = false,
}: {
  value: number | null;
  direction: Direction;
  withIcon?: boolean;
}) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        {withIcon && <Minus className="h-3 w-3" aria-hidden />}
        estável
      </span>
    );
  }

  const up = value > 0;
  const good = direction === "neutral" ? null : direction === "up-good" ? up : !up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular",
        withIcon && "text-xs",
        good === null ? "text-muted-foreground" : good ? "text-success" : "text-destructive",
      )}
    >
      {withIcon && <Icon className="h-3 w-3" aria-hidden />}
      {formatPct(value, { signed: true })}
      <span className="sr-only">{up ? " (aumento)" : " (queda)"}</span>
    </span>
  );
}

function PointsText({ value }: { value: number }) {
  return (
    <span className={cn("font-medium", value > 0 ? "text-success" : value < 0 ? "text-destructive" : "text-muted-foreground")}>
      {formatPoints(value)}
    </span>
  );
}

/* ----------------------------------------------------------- CATEGORIAS -- */

function CategoriesCard({ closing }: { closing: Closing }) {
  const expenseCategories = closing.expenseCategories;
  const expenses = closing.current.expenses;
  const previousName = formatMonthName(closing.previousMonth);
  const hidden = Math.max(0, closing.expenseCategoriesCount - expenseCategories.length);

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Para onde foi"
          description="Despesas por categoria, da maior para a menor."
          actions={
            closing.budgets.count > 0 ? (
              <Button asChild variant="ghost" size="sm">
                <Link to={`/sistema/budgets?mes=${monthParamFromKey(closing.month)}`}>Orçamentos</Link>
              </Button>
            ) : undefined
          }
        />
      </CardHeader>
      <CardContent>
        {expenseCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma despesa categorizada neste mês.</p>
        ) : (
          <ol className="space-y-4">
            {expenseCategories.map((category) => {
              const sharePct = expenses > 0 ? (category.amount / expenses) * 100 : 0;
              const overBudget = category.budgetLimit !== null && category.amount > category.budgetLimit;
              return (
                <li key={category.categoryId ?? "none"}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <IconRenderer iconName={category.icon} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" fallbackIcon={ScrollText} />
                      <span className="truncate text-sm text-foreground" title={category.name}>
                        {category.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular text-foreground">{formatMoney(category.amount)}</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn("h-full origin-left rounded-full", overBudget ? "bg-destructive" : "bg-primary")}
                      style={{ width: `${Math.max(sharePct, 1)}%` }}
                    />
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-2.5 text-xs tabular text-muted-foreground">
                    <span>{formatPct(sharePct, { digits: 0 })} das despesas</span>
                    {category.previousAmount > 0 ? (
                      <span>
                        <VariationText value={category.variationPct} direction="up-bad" /> vs {previousName}
                      </span>
                    ) : (
                      <span>nova em relação a {previousName}</span>
                    )}
                    {category.budgetLimit !== null && (
                      <span className={cn(overBudget && "font-medium text-destructive")}>
                        teto {formatMoney(category.budgetLimit)}
                        {overBudget && " · acima"}
                      </span>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
        {hidden > 0 && (
          <p className="mt-4 border-t border-border-subtle pt-3 text-xs text-muted-foreground">
            E mais {plural(hidden, "categoria", "categorias")} com valores menores.
          </p>
        )}
        {closing.budgets.count > 0 && (
          <p className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-3 text-xs text-muted-foreground">
            {closing.budgets.over > 0 ? (
              <Badge variant="destructive">
                {plural(closing.budgets.over, "orçamento estourado", "orçamentos estourados")}
              </Badge>
            ) : (
              <Badge variant="success">Orçamentos dentro do teto</Badge>
            )}
            <span className="tabular">
              {formatMoney(closing.budgets.spent)} de {formatMoney(closing.budgets.limit)} orçados
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function IncomeCard({ closing }: { closing: Closing }) {
  return (
    <Card>
      <CardHeader>
        <SectionHeader title="De onde veio" description="Receitas por categoria." />
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border-subtle">
          {closing.incomeCategories.map((category) => (
            <li key={category.categoryId ?? "none"} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="flex min-w-0 items-center gap-2">
                <IconRenderer iconName={category.icon} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" fallbackIcon={ScrollText} />
                <span className="truncate text-sm text-foreground" title={category.name}>
                  {category.name}
                </span>
              </span>
              <span className="shrink-0 text-sm tabular text-foreground">{formatMoney(category.amount)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------ TENDÊNCIA -- */

/**
 * Par validado com o validador de paleta do dataviz (CVD ΔE ≥ 21 nos dois
 * temas, banda de luminosidade e contraste ≥ 3:1 contra o card). Verde e
 * vermelho semânticos falhavam em protanopia/deuteranopia (ΔE 6,5 / 5,9).
 */
const TREND_COLORS = {
  light: { income: "#3775bb", expenses: "#b6702b" },
  dark: { income: "#4a8ae8", expenses: "#c07a22" },
} as const;

const compactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

function TrendCard({ closing }: { closing: Closing }) {
  const { theme } = useTheme();
  const colors = TREND_COLORS[theme === "dark" ? "dark" : "light"];

  const data = useMemo(
    () =>
      closing.trend.map((point) => ({
        ...point,
        label: capitalizeFirst(formatMonthAbbr(point.month)),
        isCurrent: point.month === closing.month,
      })),
    [closing.trend, closing.month],
  );

  const monthsWithData = data.filter((point) => point.income > 0 || point.expenses > 0);
  const averageResult =
    monthsWithData.length > 0 ? monthsWithData.reduce((sum, point) => sum + point.result, 0) / monthsWithData.length : 0;

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Últimos 6 meses"
          description={
            monthsWithData.length > 1
              ? `Resultado médio de ${formatSignedMoney(averageResult)} por mês com lançamentos.`
              : "Receitas e despesas mês a mês."
          }
          actions={
            <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Legenda">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors.income }} />
                Receitas
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors.expenses }} />
                Despesas
              </li>
            </ul>
          }
        />
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full md:h-64" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border-subtle))" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                width={64}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(value: number) => compactMoney.format(value)}
              />
              <Tooltip cursor={{ fill: "hsl(var(--accent))", opacity: 0.5 }} content={<TrendTooltip />} />
              <Bar dataKey="income" name="Receitas" fill={colors.income} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="expenses" name="Despesas" fill={colors.expenses} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Linha de resultado: a leitura em números do gráfico. */}
        <ul aria-hidden className="mt-3 grid grid-cols-6 gap-1 border-t border-border-subtle pt-3 text-center text-xs">
          {data.map((point) => {
            const empty = point.income === 0 && point.expenses === 0;
            return (
              <li key={point.month} className="min-w-0">
                <p className={cn("font-medium", point.isCurrent ? "text-foreground" : "text-muted-foreground")}>
                  {point.label}
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate tabular",
                    empty ? "text-muted-foreground" : point.result >= 0 ? "text-success" : "text-destructive",
                    point.isCurrent && "font-semibold",
                  )}
                >
                  {empty ? "—" : compactMoney.format(point.result)}
                </p>
              </li>
            );
          })}
        </ul>

        <table className="sr-only">
          <caption>Receitas, despesas e resultado dos últimos 6 meses</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Receitas</th>
              <th scope="col">Despesas</th>
              <th scope="col">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.month}>
                <th scope="row">{formatMonthName(point.month)}</th>
                <td>{formatMoney(point.income)}</td>
                <td>{formatMoney(point.expenses)}</td>
                <td>{formatSignedMoney(point.result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function TrendTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as { month: string; income: number; expenses: number; result: number };

  return (
    <div className="min-w-[11rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium capitalize text-foreground">{formatMonthName(point.month)}</p>
      <dl className="space-y-1 tabular">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Receitas</dt>
          <dd className="text-foreground">{formatMoney(point.income)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Despesas</dt>
          <dd className="text-foreground">{formatMoney(point.expenses)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border-subtle pt-1">
          <dt className="text-muted-foreground">Resultado</dt>
          <dd className={cn("font-medium", point.result >= 0 ? "text-success" : "text-destructive")}>
            {formatSignedMoney(point.result)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ProjectsIsolationNote({ closing }: { closing: Closing }) {
  const { projects } = closing;
  if (projects.items.length === 0) return null;
  const monthName = formatMonthName(closing.month);

  return (
    <section
      aria-label="Projetos de vida no mês"
      className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-sunken px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex min-w-0 items-start gap-2.5 text-sm text-muted-foreground">
        <FolderKanban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="text-pretty">
          {projects.excluded ? (
            <>
              <span className="font-medium tabular text-foreground">{formatMoney(projects.expenses)}</span> de gastos em{" "}
              {projects.items.map((item) => item.name).join(", ")} ficaram fora deste fechamento de {monthName}: compras atípicas
              não entram na média nem nos orçamentos.
            </>
          ) : (
            <>
              Este fechamento inclui <span className="font-medium tabular text-foreground">{formatMoney(projects.expenses)}</span> de
              projetos de vida ({projects.items.map((item) => item.name).join(", ")}).
            </>
          )}
        </span>
      </p>
      <Button asChild variant="ghost" size="sm" className="shrink-0 self-start sm:self-auto">
        <Link to={projects.items.length === 1 ? `/sistema/projects?projeto=${projects.items[0].id}` : "/sistema/projects"}>
          {projects.items.length === 1 ? "Abrir projeto" : "Ver projetos"}
        </Link>
      </Button>
    </section>
  );
}
