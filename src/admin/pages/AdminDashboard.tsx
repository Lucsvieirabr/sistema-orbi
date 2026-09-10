import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CreditCard, DollarSign, TrendingUp, UserPlus, Activity, PieChart, List, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader, SectionHeader } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Pie, Tooltip, Legend } from "recharts";

interface DashboardMetrics {
  total_users: number;
  active_subscriptions: number;
  trial_users: number;
  mrr: number;
  new_users_this_month: number;
  total_transactions_today: number;
}

export default function AdminDashboard() {
  const [planViewMode, setPlanViewMode] = useState<'list' | 'chart'>('list');

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['admin-dashboard-metrics'],
    queryFn: async () => {
      // Buscar métricas do banco
      const [
        usersResult,
        subscriptionsResult,
        paymentsResult
      ] = await Promise.all([
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_subscriptions').select('*'),
        supabase.from('payment_history').select('amount, created_at').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      ]);

      const totalUsers = usersResult.count || 0;
      const subscriptions = subscriptionsResult.data || [];
      
      const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
      const trialUsers = subscriptions.filter(s => s.status === 'trial').length;
      
      // Calcular MRR (Monthly Recurring Revenue)
      const payments = paymentsResult.data || [];
      const mrr = payments
        .filter(p => p.created_at >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // Novos usuários este mês
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const newUsersThisMonth = subscriptions.filter(s => 
        new Date(s.created_at) >= firstDayOfMonth
      ).length;

      return {
        total_users: totalUsers,
        active_subscriptions: activeSubscriptions,
        trial_users: trialUsers,
        mrr: mrr,
        new_users_this_month: newUsersThisMonth,
        total_transactions_today: 0, // Pode ser implementado depois
      };
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // Buscar distribuição de planos
  const { data: planDistribution } = useQuery({
    queryKey: ['admin-plan-distribution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('plan_id, subscription_plans(name)')
        .in('status', ['trial', 'active', 'past_due']);

      if (error) throw error;

      // Agrupar por plano
      const distribution: Record<string, number> = {};
      data?.forEach((sub: any) => {
        const planName = sub.subscription_plans?.name || 'Sem Plano';
        distribution[planName] = (distribution[planName] || 0) + 1;
      });

      return Object.entries(distribution)
        .map(([plan, count]) => ({ plan, count }))
        .sort((a, b) => b.count - a.count);
    },
    refetchInterval: 30000,
  });

  const planDistributionData = useMemo(() => {
    return planDistribution || [];
  }, [planDistribution]);

  const metricCards = [
    {
      title: "Total de Usuários",
      value: metrics?.total_users || 0,
      icon: Users,
      description: "Usuários cadastrados",
      color: "text-primary",
    },
    {
      title: "Assinaturas Ativas",
      value: metrics?.active_subscriptions || 0,
      icon: CreditCard,
      description: "Assinaturas pagas",
      color: "text-success",
    },
    {
      title: "Usuários em Trial",
      value: metrics?.trial_users || 0,
      icon: UserPlus,
      description: "Período de teste",
      color: "text-warning",
    },
    {
      title: "MRR",
      value: `R$ ${(metrics?.mrr || 0).toFixed(2)}`,
      icon: DollarSign,
      description: "Receita recorrente mensal",
      color: "text-success",
    },
    {
      title: "Novos Usuários",
      value: metrics?.new_users_this_month || 0,
      icon: TrendingUp,
      description: "Este mês",
      color: "text-chart-6",
    },
    {
      title: "Transações Hoje",
      value: metrics?.total_transactions_today || 0,
      icon: Activity,
      description: "Atividade do sistema",
      color: "text-warning",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 md:space-y-7">
      <PageHeader
        eyebrow="Administração"
        icon={Activity}
        title="Painel"
        description="Como o Orbi está indo: contas, assinaturas e receita, no estado atual."
      />

      {/* Métricas principais — ledger tiles do design system, não cards soltos. */}
      <section aria-label="Métricas" className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {metricCards.map((card) => (
          <StatCard
            key={card.title}
            label={card.title}
            value={<span className="tabular">{card.value}</span>}
            hint={card.description}
            icon={card.icon}
          />
        ))}
      </section>

      {/* Distribuição de Planos */}
      <Card>
        <CardHeader className="gap-0 space-y-0">
          <SectionHeader
            eyebrow="Composição"
            title="Distribuição de planos"
            actions={
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-sunken p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPlanViewMode('list')}
                aria-pressed={planViewMode === 'list'}
                className={cn("h-8", planViewMode === 'list' && "bg-card text-foreground shadow-sm")}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Lista</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPlanViewMode('chart')}
                aria-pressed={planViewMode === 'chart'}
                className={cn("h-8", planViewMode === 'chart' && "bg-card text-foreground shadow-sm")}
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Gráfico</span>
              </Button>
            </div>
            }
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : planViewMode === 'list' ? (
            planDistributionData.length > 0 ? (
              <div className="space-y-3">
                {planDistributionData.map((item, index) => {
                  const total = planDistributionData.reduce((sum, p) => sum + p.count, 0);
                  const percentage = total > 0 ? (item.count / total) * 100 : 0;
                  const colorClass = `bg-chart-${(index % 6) + 1}`;

                  return (
                    <div key={item.plan} className="grid gap-1.5">
                      <div>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium text-foreground">
                            {item.plan}
                          </span>
                          <span className="shrink-0 text-xs tabular text-muted-foreground">
                            {item.count} {item.count === 1 ? 'usuário' : 'usuários'}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                          <div
                            className={cn("h-1 rounded-full transition-[width] duration-500 ease-swift", colorClass)}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma assinatura ativa ainda. A distribuição aparece assim que a primeira for confirmada.
              </p>
            )
          ) : planDistributionData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={planDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={100}
                    paddingAngle={1}
                    dataKey="count"
                    nameKey="plan"
                  >
                    {planDistributionData.map((entry, index) => {
                      const colors = [
                        '#3b82f6', '#10b981', '#f59e0b',
                        '#ef4444', '#8b5cf6', '#ec4899'
                      ];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [value, 'Usuários']}
                    labelFormatter={(label) => `Plano: ${label}`}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma assinatura ativa ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


