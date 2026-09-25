import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import {
  Delta,
  STATUS_META,
  STATUS_ORDER,
  formatBRL,
  formatDate,
  formatInt,
  formatPct,
  formatRelative,
} from "@/admin/lib/admin-ui";

interface Pair { now: number; prev: number }

// Classes estáticas: o Tailwind não enxerga `bg-chart-${n}` montado em runtime.
const CHART_BG = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"];

export interface DashboardMetrics {
  generated_at: string;
  mrr: Pair;
  paying: Pair;
  churn: { churned: number; base: number; rate: number };
  users: { now: number; prev: number; new_30d: number; new_prev: number };
  active: Pair;
  status: Partial<Record<string, number>>;
  at_risk: number;
  blocked: number;
  plans: { slug: string; name: string; users: number; mrr: number }[];
  signups: { week: string; count: number }[];
}

export default function AdminDashboard() {
  const { data: m, isLoading, isFetching, refetch } = useQuery<DashboardMetrics>({
    queryKey: ["admin-dashboard-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_metrics");
      if (error) throw error;
      return data as unknown as DashboardMetrics;
    },
    refetchInterval: 60_000,
  });

  const totalPlanUsers = m?.plans.reduce((s, p) => s + p.users, 0) ?? 0;
  const arpu = m && m.paying.now > 0 ? m.mrr.now / m.paying.now : 0;

  return (
    <div className="min-w-0 space-y-6 md:space-y-8">
      <PageHeader
        eyebrow="Administração"
        icon={Activity}
        title="Painel"
        description="Receita, base e retenção do Orbi numa janela móvel de 30 dias."
        actions={
          <div className="flex items-center gap-3">
            {m && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Atualizado {formatRelative(m.generated_at)}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="press">
              <RefreshCw className={cn("h-4 w-4", isFetching && "motion-safe:animate-spin")} aria-hidden />
              Atualizar
            </Button>
          </div>
        }
      />

      {/* KPIs — as quatro perguntas de um SaaS: quanto entra, quem paga, quem sai, quem usa. */}
      <section aria-label="Indicadores principais" className="grid grid-cols-1 gap-3 xs:grid-cols-2 md:gap-4 xl:grid-cols-4">
        <StatCard
          label="MRR"
          tone="accent"
          loading={isLoading}
          value={formatBRL(m?.mrr.now)}
          hint={m && (
            <span className="flex flex-wrap items-center gap-2">
              <Delta now={m.mrr.now} prev={m.mrr.prev} />
              <span>ARPU {formatBRL(arpu)}</span>
            </span>
          )}
          className="animate-rise"
        />
        <StatCard
          label="Assinantes pagantes"
          loading={isLoading}
          value={formatInt(m?.paying.now)}
          hint={m && (
            <span className="flex flex-wrap items-center gap-2">
              <Delta now={m.paying.now} prev={m.paying.prev} />
              <span>vs. 30 dias atrás</span>
            </span>
          )}
          className="animate-rise [animation-delay:45ms]"
        />
        <StatCard
          label="Churn (30 dias)"
          tone={m && m.churn.rate > 0.05 ? "negative" : "neutral"}
          loading={isLoading}
          value={formatPct(m?.churn.rate)}
          hint={m && (
            <span>
              {m.churn.base > 0
                ? `${formatInt(m.churn.churned)} de ${formatInt(m.churn.base)} pagantes de 30 dias atrás saíram`
                : "Sem base pagante há 30 dias para comparar"}
            </span>
          )}
          className="animate-rise [animation-delay:90ms]"
        />
        <StatCard
          label="Usuários ativos (30 dias)"
          loading={isLoading}
          value={formatInt(m?.active.now)}
          hint={m && (
            <span className="flex flex-wrap items-center gap-2">
              <Delta now={m.active.now} prev={m.active.prev} />
              <span>
                {m.users.now > 0 ? `${formatPct(m.active.now / m.users.now)} da base` : "lançaram algo no período"}
              </span>
            </span>
          )}
          className="animate-rise [animation-delay:135ms]"
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        {/* Crescimento */}
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader className="space-y-0 pb-2">
            <SectionHeader
              eyebrow="Crescimento"
              title="Novos cadastros por semana"
              description={
                m ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="tabular">{formatInt(m.users.new_30d)} nos últimos 30 dias</span>
                    <Delta now={m.users.new_30d} prev={m.users.new_prev} />
                  </span>
                ) : undefined
              }
              actions={
                m ? (
                  <div className="text-right">
                    <p className="label-eyebrow">Base total</p>
                    <p className="figure-md tabular">{formatInt(m.users.now)}</p>
                  </div>
                ) : undefined
              }
            />
          </CardHeader>
          <CardContent>
            {isLoading || !m ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div className="h-56 w-full md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={m.signups} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border-subtle))" />
                    <XAxis
                      dataKey="week"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                      tickFormatter={(v) => formatDate(v, "dd MMM")}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ stroke: "hsl(var(--ring))", strokeWidth: 1, strokeDasharray: "3 3" }}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 10,
                        fontSize: 12,
                        color: "hsl(var(--popover-foreground))",
                      }}
                      labelFormatter={(v) => `Semana de ${formatDate(String(v), "dd 'de' MMM")}`}
                      formatter={(v: number) => [formatInt(v), "Cadastros"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      fill="hsl(var(--chart-1))"
                      fillOpacity={0.08}
                      activeDot={{ r: 4, strokeWidth: 0, fill: "hsl(var(--chart-1))" }}
                      animationDuration={600}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composição */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="space-y-0 pb-2">
            <SectionHeader eyebrow="Composição" title="Base por plano" description="Assinatura vigente de cada conta." />
          </CardHeader>
          <CardContent>
            {isLoading || !m ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <ul className="space-y-4">
                {m.plans.map((p, i) => {
                  const share = totalPlanUsers > 0 ? p.users / totalPlanUsers : 0;
                  return (
                    <li key={p.slug} className="group">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={cn("min-w-0 truncate text-sm font-medium", p.slug === "none" ? "text-muted-foreground" : "text-foreground")}>
                          {p.name}
                        </span>
                        <span className="shrink-0 text-xs tabular text-muted-foreground">
                          <span className="font-medium text-foreground">{formatInt(p.users)}</span>
                          {" · "}
                          {formatPct(share)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className={cn("h-full rounded-full transition-[width] duration-700 ease-swift", CHART_BG[i % CHART_BG.length])}
                          style={{ width: `${Math.max(share * 100, p.users > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-2xs tabular text-muted-foreground">
                        {p.mrr > 0 ? `${formatBRL(p.mrr)} de MRR` : "Sem receita recorrente"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Saúde das assinaturas */}
      <section aria-label="Saúde das assinaturas" className="surface p-4 md:p-6">
        <SectionHeader eyebrow="Saúde" title="Assinaturas vigentes por status" />
        {isLoading || !m ? (
          <Skeleton className="mt-4 h-14 w-full" />
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-8">
            {STATUS_ORDER.map((s) => (
              <div key={s} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[s].dot)} />
                  {STATUS_META[s].label}
                </dt>
                <dd className="figure-md mt-1 tabular">{formatInt(m.status[s] ?? 0)}</dd>
              </div>
            ))}
            <div className="min-w-0 lg:border-l lg:border-border-subtle lg:pl-6">
              <dt className="text-xs text-muted-foreground">Em risco</dt>
              <dd className={cn("figure-md mt-1 tabular", m.at_risk > 0 && "text-warning")}>{formatInt(m.at_risk)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Bloqueados</dt>
              <dd className={cn("figure-md mt-1 tabular", m.blocked > 0 && "text-destructive")}>{formatInt(m.blocked)}</dd>
            </div>
          </dl>
        )}
      </section>
    </div>
  );
}
