import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, DollarSign, TrendingUp, UserPlus, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardMetrics {
  total_users: number;
  active_subscriptions: number;
  trial_users: number;
  mrr: number;
  new_users_this_month: number;
  total_transactions_today: number;
}

export default function AdminDashboard() {
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

      {/* Gráficos e tabelas podem ser adicionados aqui */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Implementação de gráficos e listas será adicionada em breve
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Planos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Gráfico de pizza mostrando distribuição será adicionado
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


