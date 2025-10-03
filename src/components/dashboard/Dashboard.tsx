import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusSelector, TransactionStatus } from "@/components/ui/status-selector";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Menu,
  User,
  LogOut,
  PieChart,
  List,
  BarChart3,
  Plus,
  CreditCard,
  ArrowUpCircle,
  ArrowDownCircle,
  BanknoteXIcon,
  CheckCircle,
  Edit,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMonthlyTransactions } from "@/hooks/use-monthly-transactions";
import { useDebtStats } from "@/hooks/use-debts";
import { useStatusSync } from "@/hooks/use-status-sync";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { useAccounts } from "@/hooks/use-accounts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditCardForm } from "@/components/ui/credit-card-form";
import { SelectWithAddButton } from "@/components/ui/select-with-add-button";
import { SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Pie, Tooltip, Legend } from "recharts";

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const { toast } = useToast();
  const { syncStatus } = useStatusSync();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [currentDate] = useState(new Date());
  const [categoryViewMode, setCategoryViewMode] = useState<'list' | 'chart'>('list');
  const [upcomingPeriod, setUpcomingPeriod] = useState<7 | 15 | 30>(7);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<string | null>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const {
    transactions,
    indicators,
    isLoading: transactionsLoading
  } = useMonthlyTransactions(year, month);

  const { data: debtStats } = useDebtStats();
  const { creditCards, isLoading: cardsLoading } = useCreditCards();
  const { accountsWithBalance } = useAccounts();

  // Calculate category expenses for chart
  const categoryExpenses = useMemo(() => {
    // Check if we have real data
    const expensesByCategory: Record<string, number> = {};
    
    // Filtrar apenas transações de despesa pagas
    const paidExpenses = transactions.filter(t => t.type === 'expense' && t.status === 'PAID');
    
    console.log('=== DEBUG GASTOS POR CATEGORIA ===');
    console.log('Total de transações de despesa pagas:', paidExpenses.length);
    
    // Debug: mostrar ganhos reais vs reembolsos
    const realIncome = transactions.filter(t => t.type === 'income' && t.status === 'PAID' && 
                                               !t.description.includes('Parte') && 
                                               !t.description.includes('A receber'));
    const reimbursements = transactions.filter(t => t.type === 'income' && t.status === 'PAID' && 
                                                   (t.description.includes('Parte') || t.description.includes('A receber')));
    console.log('Ganhos reais (sem reembolsos):', realIncome.length, 'transações');
    console.log('Reembolsos:', reimbursements.length, 'transações');
    
    paidExpenses.forEach((transaction, index) => {
      const categoryName = transaction.categories?.name || 'Sem Categoria';
      
      console.log(`\nTransação ${index + 1}:`);
      console.log('- Descrição:', transaction.description);
      console.log('- Categoria:', categoryName);
      console.log('- Valor bruto:', transaction.value);
      console.log('- is_shared:', transaction.is_shared);
      console.log('- compensation_value:', transaction.compensation_value);
      
      // Calcular valor líquido baseado no tipo de transação
      let realValue = transaction.value;
      
      // Se há compensation_value, é uma transação compartilhada (mesmo que is_shared seja undefined)
      if (transaction.compensation_value && transaction.compensation_value > 0) {
        realValue = transaction.value - transaction.compensation_value;
        console.log('- Valor líquido calculado (compartilhado):', realValue);
      } else {
        console.log('- Valor líquido (não compartilhado):', realValue);
      }
      
      // Garantir que o valor não seja negativo
      realValue = Math.max(0, realValue);
      console.log('- Valor final usado:', realValue);
      
      expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + realValue;
      console.log('- Total acumulado para categoria:', expensesByCategory[categoryName]);
    });

    const result = Object.entries(expensesByCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    
    console.log('\n=== RESULTADO FINAL ===');
    console.log('Gastos por categoria (líquidos):', result);
    console.log('=====================================\n');
    
    return result;
  }, [transactions]);

  // Get recent transactions (last 5)
  const recentTransactions = useMemo(() => {
    return transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions]);

  // Get upcoming transactions (pending for selected period)
  const upcomingTransactions = useMemo(() => {
    const today = new Date();
    const futureDate = new Date(today.getTime() + upcomingPeriod * 24 * 60 * 60 * 1000);

    return transactions
      .filter(t => t.status === 'PENDING' && new Date(t.date) >= today && new Date(t.date) <= futureDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10); // Aumentei para 10 para mostrar mais transações quando o período for maior
  }, [transactions, upcomingPeriod]);

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

  const handleStatusChange = async (transactionId: string, newStatus: TransactionStatus) => {
    setUpdatingStatus(transactionId);
    const loadingToast = toast({
      title: "Atualizando status...",
      description: "Sincronizando transações relacionadas",
      duration: 2000
    });

    try {
      // Obter o usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      await syncStatus(transactionId, newStatus);
      loadingToast.update({
        id: loadingToast.id,
        title: "Status atualizado!",
        description: "Transações sincronizadas com sucesso",
        duration: 2000
      });
      
      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions", year, month] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    } catch (error: any) {
      loadingToast.update({
        id: loadingToast.id,
        title: "Erro ao atualizar status",
        description: error.message || "Não foi possível atualizar o status",
        duration: 3000,
        variant: "destructive"
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getTransactionIcon = (transaction: any) => {
    if (transaction.type === 'transfer') {
      return <ArrowUpCircle className="h-4 w-4 text-blue-500" />;
    }
    return transaction.type === 'income' ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getAccountName = (transaction: any) => {
    if (transaction.account_id && transaction.accounts?.name) {
      return transaction.accounts.name;
    }
    if (transaction.credit_card_id && transaction.credit_cards?.name) {
      return transaction.credit_cards.name;
    }
    return 'N/A';
  };

  const markAsPaid = async (transactionId: string) => {
    const toastInstance = toast({ title: "Atualizando...", description: "Aguarde", duration: 2000 });
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ 
          status: 'PAID',
          liquidation_date: new Date().toISOString()
        })
        .eq("id", transactionId);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Transação marcada como paga", duration: 2000 });
      
      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions", year, month] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível atualizar",
        duration: 3000,
        variant: "destructive" as any
      });
    }
  };

  const markAsPending = async (transactionId: string) => {
    const toastInstance = toast({ title: "Atualizando...", description: "Aguarde", duration: 2000 });
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ 
          status: 'PENDING',
          liquidation_date: null
        })
        .eq("id", transactionId);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Status alterado para pendente", duration: 2000 });
      
      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions", year, month] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível atualizar",
        duration: 3000,
        variant: "destructive" as any
      });
    }
  };

  const deleteTransaction = async (transactionId: string) => {
    setDeletingTransaction(transactionId);
    const toastInstance = toast({ title: "Excluindo...", description: "Aguarde", duration: 2000 });
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Transação excluída", duration: 2000 });
      
      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions", year, month] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível excluir",
        duration: 3000,
        variant: "destructive" as any
      });
    } finally {
      setDeletingTransaction(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-4 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo Atual
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${indicators.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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

          <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo de Dívidas
              </CardTitle>
              <DollarSign className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${debtStats && debtStats.totalToPay > debtStats.totalToReceive ? 'text-red-600' : 'text-purple-600'}`}>
                {formatCurrency(debtStats?.netBalance || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                A receber: <span className="text-green-600 font-medium">{formatCurrency(debtStats?.totalToReceive || 0)}</span> | A pagar: <span className="text-red-600 font-medium">{formatCurrency(debtStats?.totalToPay || 0)}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expense Chart */}
          <Card className="bg-gradient-card shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Gastos por Categoria
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={categoryViewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategoryViewMode('list')}
                    className="h-8 px-3"
                  >
                    <List className="h-4 w-4 mr-1" />
                    Lista
                  </Button>
                  <Button
                    variant={categoryViewMode === 'chart' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategoryViewMode('chart')}
                    className="h-8 px-3"
                  >
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Gráfico
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : categoryViewMode === 'list' ? (
                categoryExpenses.length > 0 ? (
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
                ) : (
                  <div className="flex items-center justify-center h-48 bg-muted/20 rounded-lg">
                    <div className="text-center">
                      <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">Nenhum gasto categorizado este mês</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Adicione categorias às suas transações para visualizar os gastos por categoria
                      </p>
                    </div>
                  </div>
                )
              ) : categoryExpenses.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={categoryExpenses}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="amount"
                        nameKey="category"
                        label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                      >
                        {categoryExpenses.map((entry, index) => {
                          const colors = [
                            '#3b82f6', '#10b981', '#f59e0b',
                            '#ef4444', '#8b5cf6', '#ec4899'
                          ];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Valor']}
                        labelFormatter={(label) => `Categoria: ${label}`}
                      />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] bg-muted/20 rounded-lg">
                  <div className="text-center">
                    <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Nenhum gasto categorizado este mês</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Adicione categorias às suas transações para visualizar o gráfico
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Transactions */}
          <Card className="bg-gradient-card shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Próximos Lançamentos
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={upcomingPeriod === 7 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUpcomingPeriod(7)}
                    className="h-8 px-3"
                  >
                    7d
                  </Button>
                  <Button
                    variant={upcomingPeriod === 15 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUpcomingPeriod(15)}
                    className="h-8 px-3"
                  >
                    15d
                  </Button>
                  <Button
                    variant={upcomingPeriod === 30 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUpcomingPeriod(30)}
                    className="h-8 px-3"
                  >
                    30d
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : upcomingTransactions.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <p>Nenhum lançamento pendente para os próximos {upcomingPeriod} dias</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingTransactions.map((transaction) => (
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
                      <div className="text-right flex flex-col items-end gap-2">
                        <p className={`font-semibold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.value))}
                        </p>
                        <StatusSelector
                          currentStatus={transaction.status as TransactionStatus}
                          onStatusChange={(newStatus) => handleStatusChange(transaction.id, newStatus)}
                          disabled={updatingStatus === transaction.id}
                          size="sm"
                          variant="badge"
                        />
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
              <div className="space-y-2">
                {recentTransactions.map((transaction) => {
                  const isPendingIncome = transaction.type === 'income' && transaction.status === 'PENDING';
                  const isPaidExpense = transaction.type === 'expense' && transaction.status === 'PAID' && transaction.is_shared;

                  return (
                    <div
                      key={transaction.id}
                      className={`flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
                        transaction.status === 'PAID' && isPendingIncome ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {isPendingIncome ? (
                          <div className="p-2 rounded-full bg-yellow-100">
                            <BanknoteXIcon className="h-4 w-4 text-yellow-600" />
                          </div>
                        ) : (
                          getTransactionIcon(transaction)
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{transaction.description}</span>
                            {transaction.series_id && transaction.is_shared && (
                              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                                Rateio
                              </Badge>
                            )}
                            {transaction.linked_txn_id && (
                              <Badge variant="outline" className="text-xs">
                                Ligada
                              </Badge>
                            )}
                            {transaction.installment_number && transaction.installments && transaction.installments > 1 && (
                              <Badge variant="secondary" className="text-xs">
                                {transaction.installment_number}/{transaction.installments}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{getAccountName(transaction)}</span>
                            {transaction.categories?.name && (
                              <>
                                <span>•</span>
                                <span>{transaction.categories.name}</span>
                              </>
                            )}
                            {transaction.people?.name && (
                              <>
                                <span>•</span>
                                <span>{transaction.people.name}</span>
                              </>
                            )}
                            {isPaidExpense && (
                              <>
                                <span>•</span>
                                <span className="text-purple-600">
                                  Minha parte: {formatCurrency(transaction.value)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`font-semibold ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}
                            {formatCurrency(transaction.value)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {transaction.status === 'PAID'
                              ? (transaction.type === 'income' ? 'Recebido' : 'Pago') + 
                                ((transaction as any).liquidation_date ? ` em ${new Date((transaction as any).liquidation_date).toLocaleDateString('pt-BR')}` : '')
                              : 'Pendente'}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigate('/sistema/statement?edit=' + transaction.id);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteTransaction(transaction.id)}
                          disabled={deletingTransaction === transaction.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingTransaction === transaction.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>

                        {transaction.status === 'PENDING' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markAsPaid(transaction.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markAsPending(transaction.id)}
                          >
                            <BanknoteXIcon className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit Cards Section */}
        <Card className="bg-gradient-card shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Cartões de Crédito
              </CardTitle>
              <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 w-8 p-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Novo Cartão</DialogTitle>
                  </DialogHeader>
                  <CreditCardForm
                    onSuccess={() => {
                      setCardDialogOpen(false);
                      // Invalidar queries para atualizar dados
                      queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
                    }}
                    showFooter={true}
                    accountSelector={
                      <SelectWithAddButton
                        entityType="accounts"
                        placeholder="Selecione uma conta"
                      >
                        <SelectItem value="none">Nenhuma conta</SelectItem>
                        {accountsWithBalance.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} - {formatCurrency(account.current_balance ?? 0)}
                          </SelectItem>
                        ))}
                      </SelectWithAddButton>
                    }
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {cardsLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : creditCards.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <CreditCard className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p>Nenhum cartão cadastrado</p>
                  <p className="text-sm">Clique no botão + para adicionar um cartão</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {creditCards.slice(0, 6).map((card) => (
                  <div key={card.id} className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-primary" />
                        <div className="flex flex-col">
                          <span className="font-medium">{card.name}</span>
                          {card.brand && <span className="text-sm text-muted-foreground">{card.brand}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Limite:</span>
                        <span className="font-semibold">{formatCurrency(card.limit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fechamento:</span>
                        <span>Dia {card.statement_date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vencimento:</span>
                        <span>Dia {card.due_date}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {creditCards.length > 6 && (
                  <div className="rounded-lg border bg-muted/20 p-4 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      +{creditCards.length - 6} cartões adicionais
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}