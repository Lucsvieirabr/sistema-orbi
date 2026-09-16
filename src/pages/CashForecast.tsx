import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import {
  CalendarClock,
  CircleCheck,
  FlaskConical,
  Ghost,
  Plus,
  RotateCw,
  Telescope,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";

import { ViewModeToggle } from "@/components/family/ViewModeToggle";
import { LedgerStrip, type LedgerTone } from "@/components/planning/LedgerStrip";
import {
  describePlanningError,
  formatDateMedium,
  formatDayMonth,
  formatMoney,
  formatSignedMoney,
  plural,
} from "@/components/planning/planning-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { IconRenderer } from "@/components/ui/icon-renderer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { EmptyState, PageBody, PageHeader, PageToolbar, SectionHeader, ToolbarSpacer } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCashForecast, type CashForecastData, type ForecastHorizon } from "@/hooks/use-cash-forecast";
import { useChartPalette } from "@/lib/chart-colors";
import {
  addDays,
  buildProjection,
  expandGhost,
  type ForecastEvent,
  type GhostEvent,
  type Projection,
  type ProjectionPoint,
} from "@/lib/forecast";
import { cn, roundCurrency } from "@/lib/utils";

/**
 * Motor Preditivo (Pro/Casal). Gate de plano na rota (PremiumRoute).
 *
 * Saldo real + agendados (RPC) − ralo diário, dia a dia, até o horizonte.
 * Os Eventos Fantasmas do modo simulação vivem só neste estado: sair da tela
 * (ou desligar a simulação) devolve a curva ao real.
 */

const HORIZONS: Array<{ value: ForecastHorizon; label: string }> = [
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 365, label: "365 dias" },
];

const KIND_LABEL: Record<ForecastEvent["kind"], string> = {
  scheduled: "Agendado",
  invoice: "Fatura",
  recurring: "Recorrente",
  ghost: "Simulado",
};

const compactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ghost-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function CashForecast() {
  const [horizon, setHorizon] = useState<ForecastHorizon>(90);
  const [simulating, setSimulating] = useState(false);
  const [ghosts, setGhosts] = useState<GhostEvent[]>([]);
  const { forecast, isLoading, isFetching, error, refetch } = useCashForecast(horizon);

  const activeGhosts = useMemo(() => (simulating ? ghosts : []), [simulating, ghosts]);
  const hasScenario = activeGhosts.some((ghost) => ghost.enabled);

  const projection = useMemo(() => {
    if (!forecast) return null;
    return buildProjection({
      today: forecast.asOf,
      horizonDays: horizon,
      startBalance: forecast.currentBalance,
      dailyDrain: forecast.burn.daily,
      events: forecast.events,
      ghosts: activeGhosts,
    });
  }, [forecast, horizon, activeGhosts]);

  const exitSimulation = () => setSimulating(false);

  return (
    <PageBody>
      <PageHeader
        eyebrow="Planejamento"
        icon={Telescope}
        title="Projeção de caixa"
        description="Saldo de hoje, compromissos agendados e o ralo dos gastos do dia a dia, projetados dia a dia."
        actions={
          <Button
            variant={simulating ? "secondary" : "outline"}
            aria-pressed={simulating}
            onClick={() => setSimulating((value) => !value)}
            className="w-full sm:w-auto"
          >
            {simulating ? <X aria-hidden /> : <FlaskConical aria-hidden />}
            {simulating ? "Sair da simulação" : "Modo simulação"}
          </Button>
        }
      />

      <PageToolbar>
        <ToggleGroup
          type="single"
          value={String(horizon)}
          onValueChange={(value) => value && setHorizon(Number(value) as ForecastHorizon)}
          aria-label="Horizonte da projeção"
          className="w-full justify-start rounded-xl border border-border-subtle bg-surface-sunken p-1 sm:w-auto"
        >
          {HORIZONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={String(option.value)}
              className="h-10 flex-1 rounded-lg border border-transparent px-4 data-[state=on]:border-border sm:flex-none md:h-8"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {isFetching && !isLoading && (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Atualizando…
          </span>
        )}
        <ToolbarSpacer />
        <ViewModeToggle />
      </PageToolbar>

      {isLoading ? (
        <div className="space-y-5" aria-busy="true">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : error || !forecast || !projection ? (
        <EmptyState
          icon={Telescope}
          title="Não deu para projetar o caixa"
          description={describePlanningError(error).message}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCw aria-hidden />
              Tentar de novo
            </Button>
          }
        />
      ) : (
        <>
          <RuptureBanner projection={projection} horizon={horizon} simulating={hasScenario} />

          <LedgerStrip
            cells={[
              {
                label: "Saldo real hoje",
                value: formatMoney(forecast.currentBalance),
                tone: forecast.currentBalance < 0 ? "negative" : "neutral",
                hint: `Soma das suas contas em ${formatDayMonth(forecast.asOf)}.`,
              },
              {
                label: "Ralo diário",
                value: `${formatMoney(forecast.burn.daily)}/dia`,
                hint:
                  forecast.burn.transactions > 0
                    ? `Média de ${plural(forecast.burn.transactions, "gasto variável", "gastos variáveis")} nos últimos ${forecast.burn.windowDays} dias.`
                    : "Sem gastos variáveis nos últimos 90 dias.",
              },
              {
                label: `Saldo em ${formatDayMonth(projection.end.date)}`,
                value: formatMoney(projection.end.balance),
                tone: endTone(projection),
                hint: hasScenario
                  ? `Sem a simulação: ${formatMoney(projection.end.baseline)}.`
                  : `Já descontado ${formatMoney(projection.drainTotal)} de ralo no período.`,
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-6">
            <ProjectionChartCard projection={projection} horizon={horizon} simulating={hasScenario} />

            <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
              {simulating && (
                <SimulationCard
                  today={forecast.asOf}
                  ghosts={ghosts}
                  projection={projection}
                  onAdd={(ghost) => setGhosts((prev) => [...prev, ghost])}
                  onToggle={(id, enabled) =>
                    setGhosts((prev) => prev.map((ghost) => (ghost.id === id ? { ...ghost, enabled } : ghost)))
                  }
                  onRemove={(id) => setGhosts((prev) => prev.filter((ghost) => ghost.id !== id))}
                  onExit={exitSimulation}
                />
              )}
              <UpcomingCard forecast={forecast} ghosts={activeGhosts} horizon={horizon} />
              <DrainCard forecast={forecast} />
            </div>
          </div>
        </>
      )}
    </PageBody>
  );
}

function endTone(projection: Projection): LedgerTone {
  if (projection.end.balance < 0) return "negative";
  if (projection.rupture) return "warning";
  return "neutral";
}

function RuptureBanner({
  projection,
  horizon,
  simulating,
}: {
  projection: Projection;
  horizon: number;
  simulating: boolean;
}) {
  const { rupture, lowest } = projection;

  if (rupture) {
    const shortfall = Math.abs(Math.min(lowest.balance, rupture.balance));
    const inDays =
      rupture.day === 0 ? "hoje" : rupture.day === 1 ? "amanhã" : `em ${plural(rupture.day, "dia", "dias")}`;
    return (
      <Alert variant="destructive" className="animate-fade-in">
        <TriangleAlert aria-hidden />
        <AlertTitle className="leading-snug">
          Atenção: Projeção indica ruptura de caixa no dia {formatDateMedium(rupture.date)}.
        </AlertTitle>
        <AlertDescription>
          <p>
            Faltarão <strong className="font-semibold tabular">{formatMoney(shortfall)}</strong> para cobrir os
            compromissos previstos ({inDays}
            {lowest.date !== rupture.date ? `; o ponto mais baixo é ${formatDayMonth(lowest.date)}` : ""}).
            {simulating && projection.baselineRupture === null && " Sem os eventos simulados, o caixa não rompe."}
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="success" className="animate-fade-in">
      <CircleCheck aria-hidden />
      <AlertTitle className="leading-snug">
        Sem ruptura prevista nos próximos {horizon} dias{simulating ? " com a simulação" : ""}.
      </AlertTitle>
      <AlertDescription>
        <p>
          O menor saldo projetado é <strong className="font-semibold tabular">{formatMoney(lowest.balance)}</strong>, em{" "}
          {formatDateMedium(lowest.date)}.
        </p>
      </AlertDescription>
    </Alert>
  );
}

function ProjectionChartCard({
  projection,
  horizon,
  simulating,
}: {
  projection: Projection;
  horizon: number;
  simulating: boolean;
}) {
  const { semantic } = useChartPalette();
  const data = projection.points;

  const values = data.flatMap((point) => [point.balance, point.baseline]);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const pad = Math.max((maxValue - minValue) * 0.08, 50);
  const tickEvery = horizon <= 30 ? 5 : horizon <= 90 ? 15 : 60;
  const ticks = data.filter((point) => point.day % tickEvery === 0).map((point) => point.date);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <SectionHeader
          title="Linha do tempo do saldo"
          description={`Hoje até ${formatDateMedium(projection.end.date)}. A linha desce um pouco todo dia: é o ralo.`}
          actions={
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: semantic.primary }} />
                {simulating ? "Com simulação" : "Projeção"}
              </li>
              {simulating && (
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="h-0 w-4 border-t border-dashed" style={{ borderColor: semantic.muted }} />
                  Só o real
                </li>
              )}
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-0 w-4 border-t border-dashed" style={{ borderColor: semantic.destructive }} />
                Zero
              </li>
            </ul>
          }
        />
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full md:h-80" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke={semantic.border} strokeOpacity={0.5} />
              {minValue < 0 && (
                <ReferenceArea y1={minValue - pad} y2={0} fill={semantic.destructive} fillOpacity={0.06} ifOverflow="extendDomain" />
              )}
              <XAxis
                dataKey="date"
                ticks={ticks}
                tickLine={false}
                axisLine={{ stroke: semantic.border }}
                tick={{ fill: semantic.muted, fontSize: 12 }}
                tickFormatter={(value: string) => formatDayMonth(value)}
                minTickGap={16}
              />
              <YAxis
                width={68}
                tickLine={false}
                axisLine={false}
                domain={[minValue - pad, maxValue + pad]}
                tick={{ fill: semantic.muted, fontSize: 11 }}
                tickFormatter={(value: number) => compactMoney.format(value)}
              />
              <Tooltip
                cursor={{ stroke: semantic.border, strokeWidth: 1 }}
                content={<ProjectionTooltip simulating={simulating} />}
              />
              <ReferenceLine y={0} stroke={semantic.destructive} strokeDasharray="4 4" strokeOpacity={0.8} />
              {simulating && (
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke={semantic.muted}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="balance"
                stroke={semantic.primary}
                strokeWidth={2}
                fill={semantic.primary}
                fillOpacity={0.07}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                animationDuration={450}
              />
              {projection.rupture && (
                <ReferenceDot
                  x={projection.rupture.date}
                  y={projection.rupture.balance}
                  r={5}
                  fill={semantic.destructive}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <table className="sr-only">
          <caption>Saldo projetado por semana</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Saldo projetado</th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter((point) => point.day % 7 === 0 || point.day === data.length - 1)
              .map((point) => (
                <tr key={point.date}>
                  <td>{formatDateMedium(point.date)}</td>
                  <td>{formatMoney(point.balance)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ProjectionTooltip({ active, payload, simulating }: TooltipProps<number, string> & { simulating: boolean }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as ProjectionPoint;

  return (
    <div className="min-w-[12rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">
        {formatDateMedium(point.date)}
        <span className="font-normal text-muted-foreground"> · dia {point.day}</span>
      </p>
      <dl className="space-y-1 tabular">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Saldo</dt>
          <dd className={cn("font-medium", point.balance < 0 ? "text-destructive" : "text-foreground")}>
            {formatMoney(point.balance)}
          </dd>
        </div>
        {simulating && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Só o real</dt>
            <dd className="text-foreground">{formatMoney(point.baseline)}</dd>
          </div>
        )}
        {point.scheduled !== 0 && (
          <div className="flex justify-between gap-4 border-t border-border-subtle pt-1">
            <dt className="text-muted-foreground">Agendados</dt>
            <dd className={point.scheduled > 0 ? "text-success" : "text-foreground"}>{formatSignedMoney(point.scheduled)}</dd>
          </div>
        )}
        {point.ghosts !== 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Simulados</dt>
            <dd className="text-foreground">{formatSignedMoney(point.ghosts)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function SimulationCard({
  today,
  ghosts,
  projection,
  onAdd,
  onToggle,
  onRemove,
  onExit,
}: {
  today: string;
  ghosts: GhostEvent[];
  projection: Projection;
  onAdd: (ghost: GhostEvent) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
  onExit: () => void;
}) {
  const [name, setName] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [installments, setInstallments] = useState("1");
  const [firstDate, setFirstDate] = useState(addDays(today, 1));
  const [direction, setDirection] = useState<GhostEvent["direction"]>("expense");
  const [errors, setErrors] = useState<{ name?: string; total?: string; installments?: string; date?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const totalRef = useRef<HTMLInputElement>(null);

  const count = Number(installments);
  const preview = total && total > 0 && count >= 1 ? roundCurrency(total / Math.min(Math.max(Math.trunc(count), 1), 120)) : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Dê um nome ao evento.";
    if (!total || total <= 0) next.total = "Informe o valor total.";
    if (!Number.isInteger(count) || count < 1 || count > 120) next.installments = "De 1 a 120 parcelas.";
    if (!firstDate || firstDate < today) next.date = "Hoje ou uma data futura.";
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.total) return totalRef.current?.focus();
    if (next.installments || next.date) return;

    onAdd({
      id: newId(),
      name: name.trim().slice(0, 80),
      total: total!,
      installments: count,
      firstDate,
      direction,
      enabled: true,
    });
    setName("");
    setTotal(null);
    setInstallments("1");
  };

  const lowestDelta = roundCurrency(projection.lowest.balance - projection.baselineLowest.balance);
  const enabledCount = ghosts.filter((ghost) => ghost.enabled).length;

  return (
    <Card className="relative isolate overflow-hidden animate-rise">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-warning" />
      <CardHeader>
        <SectionHeader
          eyebrow="Modo simulação"
          title="Cenários hipotéticos"
          description="Eventos fantasmas mudam só a curva. Nada vai para o extrato."
          actions={
            <Button variant="ghost" size="icon-sm" onClick={onExit} aria-label="Sair da simulação">
              <X aria-hidden />
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ghost-name">Evento</Label>
            <Input
              id="ghost-name"
              ref={nameRef}
              value={name}
              maxLength={80}
              autoComplete="off"
              placeholder="Aliança de noivado…"
              onChange={(event) => {
                setName(event.target.value);
                setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "ghost-name-error" : undefined}
            />
            {errors.name && (
              <p id="ghost-name-error" className="text-xs text-destructive">
                {errors.name}
              </p>
            )}
          </div>

          <ToggleGroup
            type="single"
            value={direction}
            onValueChange={(value) => value && setDirection(value as GhostEvent["direction"])}
            aria-label="Tipo do evento"
            className="grid grid-cols-2 gap-1 rounded-xl border border-border-subtle bg-surface-sunken p-1"
          >
            <ToggleGroupItem value="expense" className="h-10 rounded-lg border border-transparent data-[state=on]:border-border md:h-8">
              Gasto
            </ToggleGroupItem>
            <ToggleGroupItem value="income" className="h-10 rounded-lg border border-transparent data-[state=on]:border-border md:h-8">
              Entrada
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ghost-total">Valor total</Label>
              <NumericInput
                id="ghost-total"
                ref={totalRef}
                currency
                inputMode="decimal"
                autoComplete="off"
                value={total}
                onChange={(value) => {
                  setTotal(value);
                  setErrors((prev) => ({ ...prev, total: undefined }));
                }}
                placeholder="R$ 0,00"
                aria-invalid={Boolean(errors.total)}
                aria-describedby={errors.total ? "ghost-total-error" : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ghost-installments">Parcelas</Label>
              <Input
                id="ghost-installments"
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                value={installments}
                onChange={(event) => {
                  setInstallments(event.target.value);
                  setErrors((prev) => ({ ...prev, installments: undefined }));
                }}
                aria-invalid={Boolean(errors.installments)}
                className="tabular"
              />
            </div>
          </div>
          {(errors.total || errors.installments) && (
            <p id="ghost-total-error" className="text-xs text-destructive">
              {errors.total ?? errors.installments}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ghost-date">{count > 1 ? "1ª parcela em" : "Data"}</Label>
            <Input
              id="ghost-date"
              type="date"
              value={firstDate}
              min={today}
              max="2100-12-31"
              onChange={(event) => {
                setFirstDate(event.target.value);
                setErrors((prev) => ({ ...prev, date: undefined }));
              }}
              aria-invalid={Boolean(errors.date)}
            />
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
          </div>

          <Button type="submit" variant="outline" className="w-full">
            <Plus aria-hidden />
            {preview && count > 1 ? `Simular ${count}x de ${formatMoney(preview)}` : "Adicionar à simulação"}
          </Button>
        </form>

        {ghosts.length > 0 ? (
          <div className="border-t border-border-subtle pt-4">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {enabledCount === 0
                ? "Todos os eventos estão desligados: a curva mostra só o real."
                : lowestDelta === 0
                  ? "Os eventos ligados não mudam o ponto mais baixo do período."
                  : `Com ${plural(enabledCount, "evento ligado", "eventos ligados")}, o menor saldo muda em ${formatSignedMoney(lowestDelta)}.`}
            </p>
            <ul className="mt-3 divide-y divide-border-subtle">
              {ghosts.map((ghost) => {
                const parts = expandGhost(ghost);
                const each = Math.abs(parts[0]?.amount ?? 0);
                const switchId = `ghost-toggle-${ghost.id}`;
                return (
                  <li key={ghost.id} className="flex items-center gap-3 py-2.5">
                    <Switch
                      id={switchId}
                      checked={ghost.enabled}
                      onCheckedChange={(checked) => onToggle(ghost.id, checked)}
                      aria-label={`${ghost.enabled ? "Desligar" : "Ligar"} ${ghost.name}`}
                    />
                    <label htmlFor={switchId} className={cn("min-w-0 flex-1 cursor-pointer", !ghost.enabled && "opacity-60")}>
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                        <Ghost className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{ghost.name}</span>
                      </span>
                      <span className="block truncate text-xs tabular text-muted-foreground">
                        {ghost.direction === "income" ? "+" : "−"}
                        {formatMoney(ghost.total)}
                        {ghost.installments > 1 ? ` em ${ghost.installments}x de ${formatMoney(each)}` : " à vista"} ·{" "}
                        {formatDayMonth(ghost.firstDate)}
                      </span>
                    </label>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemove(ghost.id)}
                      aria-label={`Remover ${ghost.name}`}
                      className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="border-t border-border-subtle pt-4 text-xs leading-relaxed text-muted-foreground">
            Compare cenários criando duas versões do mesmo gasto (à vista e parcelado) e ligue uma de cada vez.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingCard({
  forecast,
  ghosts,
  horizon,
}: {
  forecast: CashForecastData;
  ghosts: GhostEvent[];
  horizon: number;
}) {
  const upcoming = useMemo(() => {
    const limit = addDays(forecast.asOf, horizon);
    const ghostEvents = ghosts.filter((ghost) => ghost.enabled).flatMap(expandGhost);
    return [...forecast.events, ...ghostEvents]
      .filter((event) => event.date >= forecast.asOf && event.date <= limit)
      .sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);
  }, [forecast, ghosts, horizon]);

  const inflow = upcoming.filter((event) => event.amount > 0).reduce((sum, event) => sum + event.amount, 0);
  const outflow = upcoming.filter((event) => event.amount < 0).reduce((sum, event) => sum + event.amount, 0);

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Próximos compromissos"
          description={
            upcoming.length > 0
              ? `${formatSignedMoney(roundCurrency(inflow))} e ${formatSignedMoney(roundCurrency(outflow))} previstos.`
              : "Nada agendado no período."
          }
        />
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" aria-hidden />
            Faturas, parcelas e contas fixas aparecem aqui.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {upcoming.slice(0, 7).map((event, index) => (
              <li key={`${event.date}-${event.description}-${index}`} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span className="w-11 shrink-0 text-xs font-medium tabular text-muted-foreground">
                  {formatDayMonth(event.date)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground" title={event.description}>
                    {event.description}
                  </span>
                  <span className="text-2xs uppercase tracking-eyebrow text-muted-foreground">{KIND_LABEL[event.kind]}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm tabular",
                    event.amount > 0 ? "text-success" : "text-foreground",
                    event.kind === "ghost" && "italic",
                  )}
                >
                  {formatSignedMoney(event.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {upcoming.length > 7 && (
          <p className="mt-3 border-t border-border-subtle pt-3 text-xs text-muted-foreground">
            E mais {plural(upcoming.length - 7, "compromisso", "compromissos")} até {formatDayMonth(addDays(forecast.asOf, horizon))}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DrainCard({ forecast }: { forecast: CashForecastData }) {
  const { series } = useChartPalette();
  const categories = forecast.burn.topCategories;
  const max = Math.max(...categories.map((category) => category.daily), 0);

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Para onde vai o ralo"
          description={`Gastos variáveis dos últimos ${forecast.burn.windowDays} dias, sem fixos nem parcelas.`}
          actions={<Badge variant="outline">{formatMoney(forecast.burn.total)}</Badge>}
        />
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem gastos variáveis no período: a projeção usa só os agendados.</p>
        ) : (
          <ol className="space-y-3">
            {categories.map((category, index) => (
              <li key={category.category_id ?? `none-${index}`}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-sunken">
                    <IconRenderer iconName={category.icon ?? "circle"} className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{category.name}</span>
                  <span className="shrink-0 text-sm tabular text-foreground">
                    {formatMoney(category.daily)}
                    <span className="text-xs text-muted-foreground">/dia</span>
                  </span>
                </div>
                <div className="ml-[2.375rem] mt-1.5 h-px w-[calc(100%-2.375rem)] bg-border-subtle">
                  <div
                    className="h-px origin-left transition-transform duration-500 ease-swift motion-reduce:transition-none"
                    style={{ backgroundColor: series[index % series.length], transform: `scaleX(${max > 0 ? category.daily / max : 0})` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
