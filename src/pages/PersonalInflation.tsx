import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, RefreshCw, RotateCw, ShoppingBasket, Store } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import { BudgetInflationAlerts } from "@/components/inflation/BudgetInflationAlerts";
import {
  BASIS_OPTIONS,
  basisComparison,
  headlineSentence,
  inflationTone,
  toneText,
} from "@/components/inflation/inflation-meta";
import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import {
  describePlanningError,
  formatMonthAbbr,
  formatMonthLong,
  formatMonthName,
  formatMoney,
  formatPct,
  plural,
} from "@/components/planning/planning-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { IconRenderer } from "@/components/ui/icon-renderer";
import { EmptyState, PageBody, PageHeader, SectionHeader } from "@/components/ui/page";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  usePersonalInflation,
  type InflationBasis,
  type InflationCategory,
  type PersonalInflation as Inflation,
} from "@/hooks/use-personal-inflation";
import { useChartPalette } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";

const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const parseBasis = (value: string | null): InflationBasis | null => {
  const n = Number(value);
  return n === 3 || n === 6 || n === 12 ? n : null;
};

export default function PersonalInflation() {
  const { inflation, isLoading, isFetching, error, refetch, refresh } = usePersonalInflation();
  const [params, setParams] = useSearchParams();
  const [refreshing, setRefreshing] = useState(false);

  const available = useMemo(
    () => (inflation ? BASIS_OPTIONS.filter((option) => inflation.idx[option.value] !== null).map((option) => option.value) : []),
    [inflation],
  );
  const requested = parseBasis(params.get("base"));
  const basis: InflationBasis =
    requested && available.includes(requested) ? requested : inflation?.headlineBasis ?? available[0] ?? 3;
  const focus = params.get("categoria");

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      notifyPlanningSuccess("Índice recalculado", "Lançamentos importados ou reclassificados já entram na conta.");
    } catch (err) {
      notifyPlanningError("Não foi possível recalcular", err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Planejamento"
        icon={ShoppingBasket}
        title="Inflação pessoal"
        description="O seu poder de compra medido nas suas próprias compras recorrentes, sem índice de mercado: o mesmo estabelecimento comparado com ele mesmo."
        actions={
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing || isLoading} className="w-full sm:w-auto">
            {refreshing ? <Spinner className="h-4 w-4" /> : <RefreshCw aria-hidden />}
            Recalcular
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-5 md:space-y-7" aria-busy="true">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : error || !inflation ? (
        <EmptyState
          icon={ShoppingBasket}
          title="Não deu para calcular a inflação pessoal"
          description={error ? describePlanningError(error).message : "Tente de novo em instantes."}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCw aria-hidden />
              Tentar de novo
            </Button>
          }
        />
      ) : inflation.headlinePct === null ? (
        <div className="space-y-5 md:space-y-7">
          <EmptyState
            icon={ShoppingBasket}
            title="Ainda falta histórico para comparar"
            description={`O índice compara a média de ${formatMonthLong(inflation.windowStart)} a ${formatMonthLong(inflation.referenceMonth)} com pelo menos o trimestre anterior. Importe extratos antigos de mercado, farmácia, combustível e assinaturas para liberar a comparação.`}
            action={
              <Button asChild>
                <Link to="/sistema/statement">Importar extratos</Link>
              </Button>
            }
          />
          <Methodology inflation={inflation} />
        </div>
      ) : (
        <InflationReport
          inflation={inflation}
          basis={basis}
          available={available}
          focus={focus}
          fetching={isFetching}
          onBasis={(value) => setParam("base", value === inflation.headlineBasis ? null : String(value))}
          onFocus={(id) => setParam("categoria", id)}
        />
      )}
    </PageBody>
  );
}

function InflationReport({
  inflation,
  basis,
  available,
  focus,
  fetching,
  onBasis,
  onFocus,
}: {
  inflation: Inflation;
  basis: InflationBasis;
  available: InflationBasis[];
  focus: string | null;
  fetching: boolean;
  onBasis: (basis: InflationBasis) => void;
  onFocus: (id: string | null) => void;
}) {
  const pct = inflation.idx[basis] ?? 0;
  const tone = inflationTone(pct);
  const sentence = headlineSentence(pct, basis);

  const ranked = useMemo(
    () =>
      [...inflation.categories]
        .filter((category) => category.idx[basis] !== null)
        .sort((a, b) => (b.idx[basis] ?? 0) - (a.idx[basis] ?? 0)),
    [inflation.categories, basis],
  );
  const silent = inflation.categories.filter((category) => category.idx[basis] === null);

  return (
    <>
      <section
        aria-labelledby="inflation-headline"
        className="relative isolate overflow-hidden rounded-xl border border-border bg-card"
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-0.5 transition-colors duration-300 ease-swift",
            tone === "negative" ? "bg-destructive" : tone === "warning" ? "bg-warning" : tone === "positive" ? "bg-success" : "bg-border",
          )}
        />
        <div className="grid gap-6 px-4 py-5 md:px-6 md:py-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                {capitalizeFirst(formatMonthName(inflation.windowStart))} a {formatMonthLong(inflation.referenceMonth)}{" "}
                {basisComparison(basis)}
              </p>
              <ToggleGroup
                type="single"
                value={String(basis)}
                onValueChange={(value) => value && onBasis(Number(value) as InflationBasis)}
                aria-label="Base de comparação"
                className="rounded-xl border border-border-subtle bg-surface-sunken p-1"
              >
                {BASIS_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={String(option.value)}
                    disabled={!available.includes(option.value)}
                    className="h-10 rounded-lg border border-transparent px-3 text-xs data-[state=on]:border-border data-[state=on]:bg-card md:h-8"
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <p
              id="inflation-headline"
              aria-live="polite"
              className={cn("mt-4 font-display text-[2.75rem] font-semibold leading-none tracking-[-0.035em] tabular md:text-[3.5rem]", toneText[tone])}
            >
              <span key={`${basis}-${pct}`} className="inline-block animate-rise">
                {formatPct(pct, { signed: true })}
              </span>
            </p>
            <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-foreground text-pretty">
              <span className="font-medium">{sentence.lead}</span> {sentence.tail}
            </p>
          </div>

          <dl className="grid grid-cols-2 content-end gap-x-4 gap-y-4 border-t border-border-subtle pt-5 text-sm lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div>
              <dt className="text-xs text-muted-foreground">Custo essencial por mês</dt>
              <dd className="figure-md mt-1 tabular text-foreground">{formatMoney(inflation.essentialMonthly)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Estabelecimentos pareados</dt>
              <dd className="figure-md mt-1 tabular text-foreground">{inflation.matchedMerchants}</dd>
            </div>
            <div className="col-span-2 lg:col-span-1">
              <dt className="text-xs text-muted-foreground">Lançamentos analisados</dt>
              <dd className="mt-1 flex items-center gap-2 tabular text-foreground">
                {plural(inflation.sampleSize, "lançamento", "lançamentos")}
                {fetching && <Spinner className="h-3.5 w-3.5" />}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <BudgetInflationAlerts alerts={inflation.alerts} />

      <TrendCard inflation={inflation} basis={basis} ranked={ranked} focus={focus} onFocus={onFocus} />

      <Card>
        <CardHeader>
          <SectionHeader
            title="Onde a inflação bateu"
            description="Categorias essenciais do seu extrato. Abra uma para ver os estabelecimentos que mais mudaram de preço."
          />
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border-subtle">
            {ranked.map((category) => (
              <CategoryRow
                key={category.categoryId}
                category={category}
                basis={basis}
                open={focus === category.categoryId}
                onToggle={() => onFocus(focus === category.categoryId ? null : category.categoryId)}
              />
            ))}
          </ul>
          {silent.length > 0 && (
            <p className="mt-4 border-t border-border-subtle pt-3 text-xs text-muted-foreground">
              Sem base de comparação em {BASIS_OPTIONS.find((option) => option.value === basis)?.label}:{" "}
              {silent.map((category) => category.name).join(", ")}.
            </p>
          )}
        </CardContent>
      </Card>

      <Methodology inflation={inflation} />
    </>
  );
}

function TrendCard({
  inflation,
  basis,
  ranked,
  focus,
  onFocus,
}: {
  inflation: Inflation;
  basis: InflationBasis;
  ranked: InflationCategory[];
  focus: string | null;
  onFocus: (id: string | null) => void;
}) {
  const { series, semantic } = useChartPalette();
  const lines = ranked.slice(0, 4);
  if (focus && !lines.some((category) => category.categoryId === focus)) {
    const focused = ranked.find((category) => category.categoryId === focus);
    if (focused) lines[lines.length === 4 ? 3 : lines.length] = focused;
  }

  const data = useMemo(
    () =>
      inflation.history
        .filter((point) => point.idx[basis] !== null)
        .map((point) => {
          const row: Record<string, number | string | null> = {
            label: capitalizeFirst(formatMonthAbbr(point.month)),
            month: point.month,
            total: point.idx[basis],
          };
          point.categories.forEach((category) => {
            row[category.categoryId] = category.idx[basis];
          });
          return row;
        }),
    [inflation.history, basis],
  );

  if (data.length < 2) return null;

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Evolução do índice"
          description="Cada ponto é um fechamento mensal. A linha grossa é a sua inflação pessoal; as finas, as categorias que mais pesaram."
        />
      </CardHeader>
      <CardContent>
        <ul className="mb-4 flex flex-wrap gap-2" aria-label="Destacar categoria no gráfico">
          <li>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground">
              <span aria-hidden className="h-0.5 w-4 rounded-full bg-foreground" />
              Inflação pessoal
            </span>
          </li>
          {lines.map((category, index) => {
            const active = focus === category.categoryId;
            return (
              <li key={category.categoryId}>
                <button
                  type="button"
                  onClick={() => onFocus(active ? null : category.categoryId)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors duration-200 ease-swift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:active:scale-[0.98]",
                    active ? "border-border bg-card text-foreground" : "border-transparent bg-surface-sunken text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: series[(index + 1) % series.length] }} />
                  {category.name}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="h-64 w-full md:h-72" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={semantic.border} strokeOpacity={0.5} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: semantic.border }} tick={{ fill: semantic.muted, fontSize: 12 }} />
              <YAxis
                width={48}
                tickLine={false}
                axisLine={false}
                tick={{ fill: semantic.muted, fontSize: 11 }}
                tickFormatter={(value: number) => `${Math.round(value)}%`}
              />
              <ReferenceLine y={0} stroke={semantic.muted} strokeDasharray="4 4" />
              <Tooltip content={<TrendTooltip names={Object.fromEntries(lines.map((category) => [category.categoryId, category.name]))} />} />
              {lines.map((category, index) => {
                const dim = focus !== null && focus !== category.categoryId;
                return (
                  <Line
                    key={category.categoryId}
                    type="monotone"
                    dataKey={category.categoryId}
                    stroke={series[(index + 1) % series.length]}
                    strokeWidth={focus === category.categoryId ? 2.5 : 1.5}
                    strokeOpacity={dim ? 0.25 : 1}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                );
              })}
              <Line
                type="monotone"
                dataKey="total"
                name="Inflação pessoal"
                stroke={semantic.primary}
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 0, fill: semantic.primary }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <table className="sr-only">
          <caption>Inflação pessoal por mês</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Inflação pessoal</th>
              {lines.map((category) => (
                <th key={category.categoryId} scope="col">
                  {category.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={String(row.month)}>
                <th scope="row">{formatMonthLong(String(row.month))}</th>
                <td>{formatPct(row.total as number | null, { signed: true })}</td>
                {lines.map((category) => (
                  <td key={category.categoryId}>{formatPct(row[category.categoryId] as number | null, { signed: true })}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function TrendTooltip({ active, payload, label, names }: TooltipProps<number, string> & { names: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[11rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      {payload
        .filter((entry) => entry.value !== null && entry.value !== undefined)
        .sort((a, b) => (a.dataKey === "total" ? -1 : b.dataKey === "total" ? 1 : Number(b.value) - Number(a.value)))
        .map((entry) => (
          <p key={String(entry.dataKey)} className="mt-0.5 flex justify-between gap-4 tabular text-muted-foreground">
            <span className={entry.dataKey === "total" ? "text-foreground" : undefined}>
              {entry.dataKey === "total" ? "Inflação pessoal" : names[String(entry.dataKey)] ?? ""}
            </span>
            <span className="text-foreground">{formatPct(Number(entry.value), { signed: true })}</span>
          </p>
        ))}
    </div>
  );
}

function CategoryRow({
  category,
  basis,
  open,
  onToggle,
}: {
  category: InflationCategory;
  basis: InflationBasis;
  open: boolean;
  onToggle: () => void;
}) {
  const pct = category.idx[basis];
  const tone = inflationTone(pct);
  const movers = category.movers.filter((mover) => mover.baseTicket > 0);
  const panelId = `inflation-category-${category.categoryId}`;
  const width = Math.min(Math.abs(pct ?? 0), 40) / 40;

  return (
    <li className="py-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="group flex min-h-14 w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors duration-200 ease-swift hover:bg-surface-sunken/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-sunken">
          <IconRenderer iconName={category.icon ?? "circle"} className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{category.name}</span>
            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
              {category.method === "merchant" ? `${category.paired} ${category.paired === 1 ? "lugar pareado" : "lugares pareados"}` : "média da categoria"}
            </Badge>
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <span className="relative h-1 w-full max-w-[14rem] overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
              <span
                className={cn(
                  "absolute inset-0 origin-left rounded-full transition-transform duration-500 ease-swift motion-reduce:transition-none",
                  tone === "negative" ? "bg-destructive" : tone === "warning" ? "bg-warning" : tone === "positive" ? "bg-success" : "bg-muted-foreground",
                )}
                style={{ transform: `scaleX(${width})` }}
              />
            </span>
            <span className="shrink-0 text-xs tabular text-muted-foreground">{formatMoney(category.monthlySpend)}/mês</span>
          </span>
        </span>
        <span className={cn("shrink-0 text-base font-semibold tabular", toneText[tone])}>{formatPct(pct, { signed: true })}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-swift motion-reduce:transition-none", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div id={panelId} className="animate-fade-in pb-3 pl-12 pr-1">
          {movers.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Nenhum estabelecimento aparece nos dois períodos. O índice desta categoria usa a média de gasto mensal, que também reflete quanto você comprou.
            </p>
          ) : (
            <ul className="space-y-2">
              {movers.map((mover) => {
                const moverTone = inflationTone(mover.changePct);
                return (
                  <li key={`${mover.merchant}-${mover.basis}`} className="flex items-center gap-3 rounded-lg border border-border-subtle px-3 py-2.5">
                    <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground" translate="no">
                        {mover.merchant}
                      </span>
                      <span className="block text-xs tabular text-muted-foreground">
                        Compra típica {formatMoney(mover.baseTicket)} → {formatMoney(mover.curTicket)} em {mover.basis} meses
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-sm font-medium tabular", toneText[moverTone])}>
                      {formatPct(mover.changePct, { signed: true })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function Methodology({ inflation }: { inflation: Inflation }) {
  return (
    <section aria-labelledby="inflation-method" className="rounded-xl border border-dashed border-border px-4 py-4 md:px-5">
      <h2 id="inflation-method" className="text-sm font-medium text-foreground">
        Como o índice é calculado
      </h2>
      <ul className="mt-2 grid gap-1.5 text-xs leading-relaxed text-muted-foreground md:grid-cols-2 md:gap-x-8">
        <li>Entram só despesas essenciais: mercado, alimentação, farmácia e saúde, combustível e transporte, casa e assinaturas.</li>
        <li>Parcelamentos, projetos de vida e lançamentos cancelados ficam de fora. Rateios contam pelo valor líquido.</li>
        <li>O mesmo estabelecimento é comparado com ele mesmo pela compra típica (mediana), para medir preço e não volume.</li>
        <li>
          Quanto melhor o importador limpa o nome do estabelecimento, mais pares aparecem. O fechamento de cada mês é gravado no dia 1
          {inflation.computedAt ? " e pode ser recalculado a qualquer momento" : ""}.
        </li>
      </ul>
    </section>
  );
}
