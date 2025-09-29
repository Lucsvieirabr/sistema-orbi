import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Menu,
  User,
  LogOut,
  PieChart
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMonthlyTransactions } from "@/hooks/use-monthly-transactions";
import { supabase } from "@/integrations/supabase/client";

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const { toast } = useToast();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [currentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const {
    transactions,
    indicators,
    isLoading: transactionsLoading
  } = useMonthlyTransactions(year, month);

  // Calculate category expenses for chart
  const categoryExpenses = useMemo(() => {
    const expensesByCategory: Record<string, number> = {};

    transactions
      .filter(t => t.type === 'expense' && t.status === 'PAID')
      .forEach(transaction => {
        const categoryName = transaction.categories?.name || 'Sem Categoria';
        expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + transaction.value;
      });

    return Object.entries(expensesByCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5); // Top 5 categories
  }, [transactions]);

  // Get recent transactions (last 5)
  const recentTransactions = useMemo(() => {
    return transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions]);

  // Get upcoming transactions (pending for next 7 days)
  const upcomingTransactions = useMemo(() => {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return transactions
      .filter(t => t.status === 'PENDING' && new Date(t.date) >= today && new Date(t.date) <= nextWeek)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [transactions]);

  const handleLogout = () => {
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    onLogout();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo Atual
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(indicators.netBalance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Saldo líquido do mês atual
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ganhos do Mês
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {formatCurrency(indicators.incomeReceived)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Recebidos este mês
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gastos do Mês
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(indicators.expensesPaid)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pagos este mês
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expense Chart */}
          <Card className="bg-gradient-card shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Gastos por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : categoryExpenses.length === 0 ? (
                <div className="flex items-center justify-center h-48 bg-muted/20 rounded-lg">
                  <div className="text-center">
                    <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Nenhum gasto categorizado este mês</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {categoryExpenses.map((item, index) => {
                    const percentage = (item.amount / categoryExpenses.reduce((sum, cat) => sum + cat.amount, 0)) * 100;
                    const colors = [
                      'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
                      'bg-red-500', 'bg-purple-500', 'bg-pink-500'
                    ];
                    const colorClass = colors[index % colors.length];

                    return (
                      <div key={item.category} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${colorClass}`} />
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-foreground">
                              {item.category}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatCurrency(item.amount)}
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
              )}
            </CardContent>
          </Card>

          {/* Upcoming Transactions */}
          <Card className="bg-gradient-card shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Próximos Lançamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : upcomingTransactions.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <p>Nenhum lançamento pendente para os próximos 7 dias</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(transaction.date)}
                          {transaction.installment_number && transaction.installments && transaction.installments > 1 && (
                            <span className="ml-1">• Parcela {transaction.installment_number}/{transaction.installments}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.value))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="bg-gradient-card shadow-md">
          <CardHeader>
            <CardTitle>Últimas Transações</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>Nenhuma transação encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-8 rounded-full ${transaction.type === 'income' ? 'bg-success' : 'bg-destructive'}`} />
                      <div>
                        <p className="font-medium text-foreground">{transaction.description}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatDate(transaction.date)}</span>
                          {transaction.categories?.name && (
                            <Badge variant="outline" className="text-xs">
                              {transaction.categories.name}
                            </Badge>
                          )}
                          {transaction.installment_number && transaction.installments && transaction.installments > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              {transaction.installment_number}/{transaction.installments}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.value))}
                      </p>
                      <Badge
                        variant={transaction.status === 'PAID' ? 'default' : 'secondary'}
                        className={`text-xs mt-1 ${transaction.status === 'PAID' ? 'bg-primary/10 text-primary' : 'bg-yellow-100 text-yellow-800'}`}
                      >
                        {transaction.status === 'PAID'
                          ? (transaction.type === 'income' ? 'Recebido' : 'Pago')
                          : 'Pendente'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}