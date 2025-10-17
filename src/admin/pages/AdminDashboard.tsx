import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CreditCard, DollarSign, TrendingUp, UserPlus, Activity, PieChart, List, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
      color: "text-blue-500",
    },
    {
      title: "Assinaturas Ativas",
      value: metrics?.active_subscriptions || 0,
      icon: CreditCard,
      description: "Assinaturas pagas",
      color: "text-green-500",
    },
    {
      title: "Usuários em Trial",
      value: metrics?.trial_users || 0,
      icon: UserPlus,
      description: "Período de teste",
      color: "text-yellow-500",
    },
    {
      title: "MRR",
      value: `R$ ${(metrics?.mrr || 0).toFixed(2)}`,
      icon: DollarSign,
      description: "Receita recorrente mensal",
      color: "text-emerald-500",
    },
    {
      title: "Novos Usuários",
      value: metrics?.new_users_this_month || 0,
      icon: TrendingUp,
      description: "Este mês",
      color: "text-purple-500",
    },
    {
      title: "Transações Hoje",
      value: metrics?.total_transactions_today || 0,
      icon: Activity,
      description: "Atividade do sistema",
      color: "text-orange-500",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    <div className="space-y-6">
      {/* Métricas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color}`}>
                  {card.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Distribuição de Planos */}
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Distribuição de Planos
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={planViewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPlanViewMode('list')}
                className="h-8 px-3"
              >
                <List className="h-4 w-4 mr-1" />
                Lista
              </Button>
              <Button
                variant={planViewMode === 'chart' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPlanViewMode('chart')}
                className="h-8 px-3"
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Gráfico
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : planViewMode === 'list' ? (
            planDistributionData.length > 0 ? (
              <div className="space-y-3">
                {planDistributionData.map((item, index) => {
                  const total = planDistributionData.reduce((sum, p) => sum + p.count, 0);
                  const percentage = (item.count / total) * 100;
                  const colors = [
                    'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
                    'bg-red-500', 'bg-purple-500', 'bg-pink-500'
                  ];
                  const colorClass = colors[index % colors.length];

                  return (
                    <div key={item.plan} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${colorClass}`} />
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {item.plan}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {item.count} {item.count === 1 ? 'usuário' : 'usuários'}
                          </span>
                        </div>
                        <div className="w-full bg-muted/30 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${colorClass}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 bg-muted/20 rounded-lg">
                <div className="text-center">
                  <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Nenhuma assinatura ativa</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Quando houver assinaturas ativas, a distribuição aparecerá aqui
                  </p>
                </div>
              </div>
            )
          ) : planDistributionData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={planDistributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="count"
                    nameKey="plan"
                    label={({ plan, percent }) => `${plan} ${(percent * 100).toFixed(0)}%`}
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
            <div className="flex items-center justify-center h-[300px] bg-muted/20 rounded-lg">
              <div className="text-center">
                <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhuma assinatura ativa</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Quando houver assinaturas ativas, o gráfico aparecerá aqui
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


