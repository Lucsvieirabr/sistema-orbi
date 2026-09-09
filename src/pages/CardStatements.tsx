import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RecordActions,
  RecordCard,
  RecordCardHead,
  RecordCardList,
  RecordField,
  RecordFields,
  TableView,
} from "@/components/ui/record-card";
import {
  CreditCard,
  Receipt,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowLeft,
  Filter,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  ShoppingCart,
  Receipt as ReceiptIcon,
  ChevronLeft,
  ChevronRight,
  PieChart,
  List as ListIcon,
  BarChart3,
} from "lucide-react";
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Pie, Tooltip, Legend } from "recharts";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { useCardTransactions } from "@/hooks/use-card-transactions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { chartColors } from "@/lib/chart-colors";

import {
  formatCurrencyBRL,
  getCurrentDateString,
  formatDateForDisplay,
  roundCurrency,
  getCardStatementPeriod,
} from "@/lib/utils";

export default function CardStatements() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { creditCards } = useCreditCards();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<
    "all" | "income" | "expense" | "fixed" | "pending" | "paid"
  >("all");
  const [categoryViewMode, setCategoryViewMode] = useState<'list' | 'chart'>('list');
  const [payingStatement, setPayingStatement] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<string | null>(null);

  // Find the current card
  const currentCard = creditCards.find((card) => card.id === cardId);

  // Get year and month for filtering
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Calculate statement period based on card's statement date
  // Padrão do mercado: período entre data de fechamento até próximo fechamento
  const statementPeriod = currentCard
    ? getCardStatementPeriod(currentCard.statement_date, currentDate)
    : {
        startDate: new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        ),
        endDate: new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0
        ),
        billingMonth: currentDate.getMonth() + 1,
        billingYear: currentDate.getFullYear(),
      };

  // Custom hook for card transactions - filter by credit_card_id and statement period
  const { data: cardTransactions = [], isLoading } = useCardTransactions({
    cardId: cardId!,
    startDate: statementPeriod.startDate.toISOString().split("T")[0],
    endDate: statementPeriod.endDate.toISOString().split("T")[0],
  });

  const filteredTransactions = useMemo(() => {
    if (!cardTransactions) return [];

    let filtered = cardTransactions;

    if (filterType !== "all") {
      switch (filterType) {
        case "income":
          filtered = filtered.filter((t) => t.type === "income");
          break;
        case "expense":
          filtered = filtered.filter((t) => t.type === "expense");
          break;
        case "pending":
          filtered = filtered.filter((t) => t.status === "PENDING");
          break;
        case "paid":
          filtered = filtered.filter((t) => t.status === "PAID");
          break;
        case "fixed":
          filtered = filtered.filter((t) => t.is_fixed);
          break;
      }
    }

    return filtered;
  }, [cardTransactions, filterType]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);

  const getCardBrandIcon = (brand: string | null) => {
    if (!brand) return <CreditCard className="h-5 w-5" />;
    const brandLower = brand.toLowerCase();
    if (brandLower.includes("visa"))
      return <CreditCard className="h-5 w-5 text-primary" />;
    if (brandLower.includes("mastercard"))
      return <CreditCard className="h-5 w-5 text-destructive" />;
    if (brandLower.includes("elo"))
      return <CreditCard className="h-5 w-5 text-warning" />;
    return <CreditCard className="h-5 w-5" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PAID":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-warning" />;
      case "CANCELED":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === "income" ? (
      <TrendingUp className="h-4 w-4 text-success" />
    ) : (
      <TrendingDown className="h-4 w-4 text-destructive" />
    );
  };

  // Calculate totals and category expenses
  const totals = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === "expense");
    const pending = cardTransactions?.filter((t) => t.status === "PENDING") || [];
    
    return {
      totalExpenses: expenses.reduce((sum, t) => sum + t.value, 0),
      count: filteredTransactions.length,
      hasPending: pending.length > 0,
    };
  }, [filteredTransactions, cardTransactions]);

  // Calculate category expenses for chart
  const categoryExpenses = useMemo(() => {
    const expensesByCategory: Record<string, number> = {};
    
    const paidExpenses = cardTransactions?.filter(t => t.type === 'expense') || [];
    
    paidExpenses.forEach((transaction) => {
      const categoryName = transaction.categories?.name || 'Sem Categoria';
      let realValue = transaction.value;
      
      if (transaction.compensation_value && transaction.compensation_value > 0) {
        realValue = transaction.value - transaction.compensation_value;
      }
      
      realValue = Math.max(0, realValue);
      expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + realValue;
    });

    return Object.entries(expensesByCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [cardTransactions]);

  const handleMonthChange = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (direction === "prev") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goBack = () => {
    navigate("/sistema/cards");
  };

  const handlePayStatement = async () => {
    if (!cardId) return;
    
    setPayingStatement(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar todas as transações do período
      const transactionsToUpdate = cardTransactions?.filter(t => t.status === "PENDING") || [];
      
      if (transactionsToUpdate.length === 0) {
        toast({ 
          title: "Informação", 
          description: "Não há transações pendentes nesta fatura" 
        });
        return;
      }

      // Atualizar todas as transações para PAID
      const { error } = await supabase
        .from("transactions")
        .update({ status: "PAID" })
        .in("id", transactionsToUpdate.map(t => t.id))
        .eq("user_id", user.id);

      if (error) throw error;

      toast({ 
        title: "Sucesso", 
        description: `${transactionsToUpdate.length} transação(ões) marcada(s) como paga(s)` 
      });
      
      queryClient.invalidateQueries({ queryKey: ["card_transactions"] });
    } catch (e: any) {
      toast({ 
        title: "Erro", 
        description: e.message || "Não foi possível pagar a fatura",
        variant: "destructive"
      });
    } finally {
      setPayingStatement(false);
    }
  };

  const deleteTransaction = async (transactionId: string) => {
    setDeletingTransaction(transactionId);
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Transação excluída" });
      
      queryClient.invalidateQueries({ queryKey: ["card_transactions"] });
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível excluir",
        variant: "destructive"
      });
    } finally {
      setDeletingTransaction(null);
    }
  };

  if (!currentCard) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Cartão não encontrado
            </h3>
            <p className="text-muted-foreground mb-4">
              O cartão solicitado não foi encontrado ou não está disponível.
            </p>
            <Button onClick={goBack} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Cartões
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 md:space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
              <Button variant="outline" size="icon" onClick={goBack} aria-label="Voltar para Cartões" className="shrink-0 lg:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goBack} className="hidden shrink-0 lg:inline-flex">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
                <span className="shrink-0">{getCardBrandIcon(currentCard.brand)}</span>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate font-display text-lg font-semibold tracking-tight md:text-xl lg:text-2xl" title={currentCard.name}>
                    {currentCard.name}
                  </h1>
                  <p className="truncate text-xs text-muted-foreground md:text-sm">
                    Faturas mensais • {currentCard.brand || "Cartão de Crédito"}
                  </p>
                </div>
              </div>
            </div>

            {/* Seletor de mês: linha inteira no telefone, pílula no desktop. */}
            <div className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1.5 lg:w-auto lg:justify-start lg:px-3 lg:py-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleMonthChange("prev")}
                aria-label="Mês anterior"
                className="shrink-0 lg:h-8 lg:w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1 text-center lg:min-w-[200px] lg:flex-none">
                <div className="truncate text-sm font-medium capitalize">
                  {new Intl.DateTimeFormat("pt-BR", {
                    month: "long",
                    year: "numeric",
                  }).format(currentDate)}
                </div>
                <div className="truncate text-2xs text-muted-foreground md:text-xs">
                  {new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  }).format(statementPeriod.startDate)}{" "}
                  até{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  }).format(statementPeriod.endDate)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleMonthChange("next")}
                aria-label="Próximo mês"
                className="shrink-0 lg:h-8 lg:w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards and Chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Left Column - Stats (lado a lado no telefone, empilhado no desktop) */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1 lg:content-start">
          <Card className="col-span-2 sm:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="label-eyebrow">
                Fatura Atual
              </CardTitle>
              <TrendingDown className="h-3.5 w-3.5 shrink-0 text-destructive" />
            </CardHeader>
            <CardContent className="pb-4">
              <div className="figure-lg tabular text-destructive">
                {formatCurrency(totals.totalExpenses)}
              </div>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                Total da fatura
              </p>
              <Button
                onClick={handlePayStatement}
                disabled={payingStatement || !totals.hasPending}
                className="w-full mt-3 bg-success hover:bg-success disabled:opacity-50 disabled:cursor-not-allowed"
                size="sm"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {payingStatement ? "Pagando..." : totals.hasPending ? "Pagar Fatura" : "Sem Pendências"}
              </Button>
            </CardContent>
          </Card>

          <Card className="col-span-2 sm:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="label-eyebrow">
                Total de Transações
              </CardTitle>
              <ReceiptIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
            </CardHeader>
            <CardContent className="pb-4">
              <div className="figure-lg tabular text-primary">{totals.count}</div>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                No período da fatura
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Category Chart */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 shrink-0 text-primary" />
                  Gastos por Categoria
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={categoryViewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategoryViewMode('list')}
                    className="flex-1 sm:flex-none"
                  >
                    <ListIcon className="mr-1 h-4 w-4" />
                    Lista
                  </Button>
                  <Button
                    variant={categoryViewMode === 'chart' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategoryViewMode('chart')}
                    className="flex-1 sm:flex-none"
                  >
                    <BarChart3 className="mr-1 h-3.5 w-3.5" />
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
              ) : categoryViewMode === 'list' ? (
                categoryExpenses.length > 0 ? (
                  <div className="space-y-3">
                    {categoryExpenses.map((item, index) => {
                      const percentage = (item.amount / categoryExpenses.reduce((sum, cat) => sum + cat.amount, 0)) * 100;
                      const colors = [
                        'bg-primary', 'bg-success', 'bg-warning',
                        'bg-destructive', 'bg-chart-6', 'bg-chart-6'
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
                      <p className="text-muted-foreground">Nenhum gasto categorizado</p>
                    </div>
                  </div>
                )
              ) : categoryExpenses.length > 0 ? (
                <div className="h-56 w-full sm:h-[185px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={categoryExpenses}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        dataKey="amount"
                        nameKey="category"
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {categoryExpenses.map((entry, index) => {
                          const colors = chartColors();
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
                <div className="flex items-center justify-center h-42 bg-muted/20 rounded-lg">
                  <div className="text-center">
                    <PieChart className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Nenhum gasto categorizado</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters and Transactions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 shrink-0" />
              Transações da Fatura
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={filterType}
                onValueChange={(value: any) => setFilterType(value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="expense">Despesas</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagas</SelectItem>
                  <SelectItem value="fixed">Fixas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhuma transação encontrada
              </h3>
              <p className="text-muted-foreground mb-4">
                Não há transações para este cartão neste período.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: cada transação vira um card. Nada de rolar a tela. */}
              <RecordCardList>
                {filteredTransactions.map((transaction) => (
                  <RecordCard
                    key={transaction.id}
                    accent={transaction.type === "income" ? "positive" : "negative"}
                  >
                    <RecordCardHead
                      title={transaction.description}
                      meta={
                        <span className="flex items-center gap-1.5">
                          {getTypeIcon(transaction.type)}
                          {formatDateForDisplay(transaction.date)}
                        </span>
                      }
                      value={`${transaction.type === "income" ? "+" : "-"}${formatCurrency(transaction.value)}`}
                      valueClassName={
                        transaction.type === "income" ? "text-success" : "text-destructive"
                      }
                    />

                    <RecordFields>
                      <RecordField label="Categoria">
                        {transaction.categories?.name || "Sem categoria"}
                      </RecordField>
                      {transaction.person_id && (
                        <RecordField label="Pessoa">Pessoa relacionada</RecordField>
                      )}
                    </RecordFields>

                    <RecordActions>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Editar ${transaction.description}`}
                        onClick={() => navigate('/sistema/statement?edit=' + transaction.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <ConfirmationDialog
                        title="Confirmar Exclusão"
                        description="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
                        confirmText="Excluir"
                        onConfirm={() => deleteTransaction(transaction.id)}
                        variant="destructive"
                      >
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Excluir ${transaction.description}`}
                          className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                          disabled={deletingTransaction === transaction.id}
                        >
                          {deletingTransaction === transaction.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-destructive" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </ConfirmationDialog>
                    </RecordActions>
                  </RecordCard>
                ))}
              </RecordCardList>

              {/* md+: volta a ser tabela, com rolagem contida no contêiner. */}
              <TableView>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(transaction.type)}
                          {formatDateForDisplay(transaction.date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium truncate max-w-xs" title={transaction.description}>
                          {transaction.description}
                        </div>
                        {transaction.person_id && (
                          <div className="text-sm text-muted-foreground">
                            Pessoa relacionada
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="truncate block max-w-[150px]" title={transaction.categories?.name || "Sem categoria"}>
                          {transaction.categories?.name || "Sem categoria"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold ${
                            transaction.type === "income"
                              ? "text-success"
                              : "text-destructive"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {formatCurrency(transaction.value)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => navigate('/sistema/statement?edit=' + transaction.id)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <ConfirmationDialog
                            title="Confirmar Exclusão"
                            description="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
                            confirmText="Excluir"
                            onConfirm={() => deleteTransaction(transaction.id)}
                            variant="destructive"
                          >
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive-soft disabled:opacity-50"
                              disabled={deletingTransaction === transaction.id}
                            >
                              {deletingTransaction === transaction.id ? (
                                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-destructive"></div>
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </ConfirmationDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TableView>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
