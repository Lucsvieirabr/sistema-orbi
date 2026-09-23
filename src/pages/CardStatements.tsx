import { getCachedAuthUser } from "@/hooks/use-current-user";
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
import { EmptyState, PageBody, PageHeader, SectionHeader } from "@/components/ui/page";
import { cn, deleteErrorMessage, toDateKey } from "@/lib/utils";
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

/** "1/3" para parcela de compra parcelada; nada para avulsa ou recorrente fixa. */
function installmentLabel(transaction: { installment_number?: number | null; series?: unknown }): string | null {
  const series = (Array.isArray(transaction.series) ? transaction.series[0] : transaction.series) as
    | { total_installments?: number; is_fixed?: boolean }
    | null
    | undefined;
  const total = series?.total_installments ?? 0;
  if (!transaction.installment_number || total <= 1 || series?.is_fixed) return null;
  return `${transaction.installment_number}/${total}`;
}

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
    startDate: toDateKey(statementPeriod.startDate),
    endDate: toDateKey(statementPeriod.endDate),
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
        return <CheckCircle className="h-4 w-4 text-success" aria-label="Pago" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-warning" aria-label="Pendente" />;
      case "CANCELED":
        return <AlertTriangle className="h-4 w-4 text-destructive" aria-label="Cancelado" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" aria-label="Status desconhecido" />;
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
      const { data: { user } } = await getCachedAuthUser();
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
      queryClient.invalidateQueries({ queryKey: ["card_usage"] });
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

      toast({ title: "Transação excluída" });
      
      queryClient.invalidateQueries({ queryKey: ["card_transactions"] });
    } catch (e: any) {
      toast({
        title: "Não foi possível excluir",
        description: deleteErrorMessage(e),
        duration: 8000,
        variant: "destructive"
      });
    } finally {
      setDeletingTransaction(null);
    }
  };

  if (!currentCard) {
    return (
      <PageBody>
        <EmptyState
          icon={AlertTriangle}
          title="Cartão não encontrado"
          description="O cartão que você tentou abrir não existe mais ou não está disponível nesta conta."
          action={
            <Button variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" />
              Voltar para cartões
            </Button>
          }
        />
      </PageBody>
    );
  }

  const rawMonthLabel = currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);
  // "04 de out." sem o ponto da abreviação: a frase da descrição já termina em ponto.
  const shortDay = (date: Date) =>
    new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(/\./g, "");
  const periodLabel = `${shortDay(statementPeriod.startDate)} até ${shortDay(statementPeriod.endDate)}`;
  const categoryTotal = categoryExpenses.reduce((sum, cat) => sum + cat.amount, 0);

  return (
    <PageBody>
      <Button variant="subtle" size="sm" onClick={goBack} className="-ml-1 px-1">
        <ArrowLeft className="h-4 w-4" />
        Cartões
      </Button>

      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <span className="shrink-0 [&_svg]:h-3 [&_svg]:w-3">{getCardBrandIcon(currentCard.brand)}</span>
            Fatura · {currentCard.brand || "cartão de crédito"}
          </span>
        }
        title={<span className="truncate" title={currentCard.name}>{currentCard.name}</span>}
        description={`Período de ${periodLabel}. Uma compra entra na fatura que fecha depois dela, não no mês do calendário.`}
        actions={
          /* Stepper de mês: o controle que rege tudo abaixo. Fica ancorado à
             direita do cabeçalho, não perdido dentro de um card. */
          <div className="flex w-full items-center justify-between gap-1 rounded-lg border border-border bg-surface-sunken p-1 lg:w-auto">
            <Button variant="ghost" size="icon-sm" onClick={() => handleMonthChange("prev")} aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1 px-2 text-center lg:min-w-[9rem] lg:flex-none">
              <p className="truncate text-sm font-medium text-foreground">{monthLabel}</p>
              <p className="truncate text-2xs tabular text-muted-foreground">{periodLabel}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => handleMonthChange("next")} aria-label="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Fatura: o número é a manchete da tela, e a ação fica colada nele. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-1">
          <span aria-hidden className="block h-px w-full bg-destructive" />
          <CardContent className="pt-4 md:pt-5">
            <p className="label-eyebrow">Fatura do período</p>
            <p className="figure-xl mt-1 tabular text-destructive">{formatCurrency(totals.totalExpenses)}</p>
            <p className="mt-1.5 text-xs tabular text-muted-foreground">
              {totals.count} {totals.count === 1 ? "lançamento" : "lançamentos"}
            </p>
            <Button
              onClick={handlePayStatement}
              disabled={payingStatement || !totals.hasPending}
              variant={totals.hasPending ? "default" : "outline"}
              className="mt-4 w-full"
            >
              <CheckCircle className="h-4 w-4" />
              {payingStatement ? "Marcando como paga…" : totals.hasPending ? "Marcar fatura como paga" : "Fatura sem pendências"}
            </Button>
          </CardContent>
        </Card>

        {/* Distribuição por categoria: mesmo vocabulário de ranking usado na
            tela da IA — barra de 1px, ordem como informação. */}
        <Card className="lg:col-span-2">
          <CardHeader className="gap-0 space-y-0">
            <SectionHeader
              eyebrow="Composição"
              title="Gastos por categoria"
              actions={
                <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-sunken p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCategoryViewMode("list")}
                    aria-pressed={categoryViewMode === "list"}
                    className={cn("h-8", categoryViewMode === "list" && "bg-card text-foreground shadow-sm")}
                  >
                    <ListIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Lista</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCategoryViewMode("chart")}
                    aria-pressed={categoryViewMode === "chart"}
                    className={cn("h-8", categoryViewMode === "chart" && "bg-card text-foreground shadow-sm")}
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
            ) : categoryExpenses.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhum gasto categorizado neste período.
              </p>
            ) : categoryViewMode === "list" ? (
              <ul className="space-y-3">
                {categoryExpenses.map((item, index) => {
                  const percentage = categoryTotal > 0 ? (item.amount / categoryTotal) * 100 : 0;
                  return (
                    <li key={item.category} className="grid gap-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-foreground" title={item.category}>
                          {item.category}
                        </span>
                        <span className="shrink-0 text-sm tabular text-muted-foreground">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className={cn(
                            "h-1 rounded-full transition-[width] duration-500 ease-swift",
                            `bg-chart-${(index % 6) + 1}`,
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={categoryExpenses}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={1}
                      dataKey="amount"
                      nameKey="category"
                    >
                      {categoryExpenses.map((entry, index) => {
                        const colors = chartColors();
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="none" />;
                      })}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Gasto"]}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lançamentos */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Lançamentos"
          title="O que entrou nesta fatura"
          className="border-b border-border-subtle pb-2"
          actions={
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger className="h-10 w-[10.5rem] md:h-9" aria-label="Filtrar lançamentos">
                <Filter className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <SelectValue placeholder="Filtrar" />
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
          }
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhum lançamento neste período"
            description="Compras feitas depois do fechamento entram na fatura do mês seguinte — navegue pelos meses acima."
          />
        ) : (
          <>
            {/* Telefone: cada lançamento vira um card. Nada de rolar a tela. */}
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
                        {installmentLabel(transaction) && (
                          <Badge variant="outline" className="tabular">{installmentLabel(transaction)}</Badge>
                        )}
                      </span>
                    }
                    value={`${transaction.type === "income" ? "+" : "−"}${formatCurrency(transaction.value)}`}
                    valueClassName={transaction.type === "income" ? "text-success" : "text-destructive"}
                  />

                  <RecordFields>
                    <RecordField label="Categoria">
                      {transaction.categories?.name || "Sem categoria"}
                    </RecordField>
                    {transaction.person_id && <RecordField label="Rateio">Com outra pessoa</RecordField>}
                  </RecordFields>

                  <RecordActions>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Editar ${transaction.description}`}
                      onClick={() => navigate("/sistema/statement?edit=" + transaction.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <ConfirmationDialog
                      title="Excluir lançamento"
                      description="O lançamento sai da fatura e do extrato. Não dá para desfazer."
                      confirmText="Excluir lançamento"
                      onConfirm={() => deleteTransaction(transaction.id)}
                      variant="destructive"
                    >
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Excluir ${transaction.description}`}
                        className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                        disabled={deletingTransaction === transaction.id}
                      >
                        {deletingTransaction === transaction.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
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
                    <TableHead className="w-32">Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="tabular text-muted-foreground">
                        <span className="flex items-center gap-2">
                          {getTypeIcon(transaction.type)}
                          {formatDateForDisplay(transaction.date)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-xs items-center gap-2">
                          <span className="truncate font-medium" title={transaction.description}>
                            {transaction.description}
                          </span>
                          {installmentLabel(transaction) && (
                            <Badge variant="outline" className="shrink-0 tabular">{installmentLabel(transaction)}</Badge>
                          )}
                        </div>
                        {transaction.person_id && (
                          <div className="mt-0.5 text-xs text-muted-foreground">Rateado com outra pessoa</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span
                          className="block max-w-[150px] truncate"
                          title={transaction.categories?.name || "Sem categoria"}
                        >
                          {transaction.categories?.name || "Sem categoria"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-medium tabular",
                            transaction.type === "income" ? "text-success" : "text-destructive",
                          )}
                        >
                          {transaction.type === "income" ? "+" : "−"}
                          {formatCurrency(transaction.value)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Editar ${transaction.description}`}
                            onClick={() => navigate("/sistema/statement?edit=" + transaction.id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <ConfirmationDialog
                            title="Excluir lançamento"
                            description="O lançamento sai da fatura e do extrato. Não dá para desfazer."
                            confirmText="Excluir lançamento"
                            onConfirm={() => deleteTransaction(transaction.id)}
                            variant="destructive"
                          >
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Excluir ${transaction.description}`}
                              className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                              disabled={deletingTransaction === transaction.id}
                            >
                              {deletingTransaction === transaction.id ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
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
      </section>
    </PageBody>
  );
}
