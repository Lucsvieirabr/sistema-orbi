import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard, StatSplit } from "@/components/ui/stat-card";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  PieChart,
  List,
  BarChart3,
  ArrowLeftRight,
  Scale,
  CheckCircle,
  Undo2,
  Edit,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMonthlyTransactions } from "@/hooks/use-monthly-transactions";
import { useDebtStats } from "@/hooks/use-debts";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { supabase } from "@/integrations/supabase/client";
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Pie, Tooltip } from "recharts";
import { formatDateForDisplay, cn } from "@/lib/utils";
import { useChartPalette } from "@/lib/chart-colors";
import { SubscriptionChart } from "./SubscriptionChart";
import { InflationAlertCard } from "@/components/inflation/InflationAlertCard";
import { ViewModeToggle } from "@/components/family/ViewModeToggle";
import { useFamilyGroup } from "@/hooks/use-family-group";
import { useViewMode } from "@/hooks/use-view-mode";
import { assertOwnTransaction } from "@/lib/family-access";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageBody, PageHeader, SectionHeader } from "@/components/ui/page";

interface DashboardProps {
  onLogout: () => void;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (amount: number) => currency.format(amount);

/** Cabeçalho de seção do dashboard: usa o primitivo compartilhado da página. */
function SectionHead({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof PieChart;
  children?: React.ReactNode;
}) {
  return (
    <SectionHeader
      eyebrow={
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3 w-3" aria-hidden />}
          {title}
        </span>
      }
      actions={children}
    />
  );
}

/** Grupo de filtros: segmented control leve, sem botões preenchidos. */
function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: typeof List }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-border bg-surface-sunken p-1">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
              "transition-[background-color,color,box-shadow,transform] duration-200 ease-swift motion-safe:active:scale-[0.97]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Dashboard({ onLogout }: DashboardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const palette = useChartPalette();

  const [currentDate] = useState(new Date());
  const [categoryViewMode, setCategoryViewMode] = useState<"list" | "chart">("list");
  const [upcomingPeriod, setUpcomingPeriod] = useState<7 | 15 | 30>(7);
  const [deletingTransaction, setDeletingTransaction] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { transactions, indicators, isLoading: transactionsLoading } = useMonthlyTransactions(year, month);
  const { data: debtStats } = useDebtStats();
  const { currentUserId, isMine } = useFamilyGroup();
  const viewMode = useViewMode();

  const categoryExpenses = useMemo(() => {
    const expensesByCategory: Record<string, number> = {};
    const paidExpenses = transactions.filter((t) => t.type === "expense" && t.status === "PAID");

    paidExpenses.forEach((transaction) => {
      const categoryName = transaction.categories?.name || "Sem categoria";
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
  }, [transactions]);

  const categoryTotal = useMemo(
    () => categoryExpenses.reduce((sum, item) => sum + item.amount, 0),
    [categoryExpenses],
  );

  const recentTransactions = useMemo(
    () =>
      [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [transactions],
  );

  const upcomingTransactions = useMemo(() => {
    const today = new Date();
    const futureDate = new Date(today.getTime() + upcomingPeriod * 24 * 60 * 60 * 1000);

    return transactions
      .filter((t) => t.status === "PENDING" && new Date(t.date) >= today && new Date(t.date) <= futureDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [transactions, upcomingPeriod]);

  const refreshTransactions = () => {
    queryClient.invalidateQueries({ queryKey: ["monthly-transactions", year, month] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  const truncateText = (text: string, maxLength = 15) =>
    text.length <= maxLength ? text : `${text.substring(0, maxLength)}…`;

  const setStatus = async (transactionId: string, status: "PAID" | "PENDING") => {
    try {
      if (status === "PENDING") await assertOwnTransaction(transactionId);

      const { error } = await supabase
        .from("transactions")
        .update({
          status,
          liquidation_date: status === "PAID" ? new Date().toISOString() : null,
        })
        .eq("id", transactionId);

      if (error) throw error;

      toast({
        title: status === "PAID" ? "Transação liquidada" : "Transação reaberta",
        duration: 2000,
      });
      refreshTransactions();
    } catch (e: any) {
      toast({
        title: "Não foi possível atualizar",
        description: e?.message ?? "Tente novamente em instantes.",
        duration: 4000,
        variant: "destructive",
      });
    }
  };

  const deleteTransaction = async (transactionId: string) => {
    setDeletingTransaction(transactionId);
    try {
      await assertOwnTransaction(transactionId);
      const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
      if (error) throw error;

      toast({ title: "Transação excluída", duration: 2000 });
      refreshTransactions();
    } catch (e: any) {
      toast({
        title: "Não foi possível excluir",
        description: e?.message ?? "Tente novamente em instantes.",
        duration: 4000,
        variant: "destructive",
      });
    } finally {
      setDeletingTransaction(null);
    }
  };

  const transactionTone = (type: string) =>
    type === "transfer" ? "text-muted-foreground" : type === "income" ? "text-success" : "text-destructive";

  const TransactionIcon = ({ type }: { type: string }) => {
    if (type === "transfer") return <ArrowLeftRight className="h-4 w-4 text-muted-foreground" aria-hidden />;
    return type === "income" ? (
      <TrendingUp className="h-4 w-4 text-success" aria-hidden />
    ) : (
      <TrendingDown className="h-4 w-4 text-destructive" aria-hidden />
    );
  };

  const getAccountName = (transaction: any) =>
    transaction.accounts?.name ?? transaction.credit_cards?.name ?? "—";

  /* ---------------------------------------------------------------- loading */

  if (transactionsLoading && transactions.length === 0) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:gap-4 lg:col-span-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl sm:h-32" />
            ))}
          </div>
          <Skeleton className="h-full min-h-[16rem] rounded-xl lg:col-span-1" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl sm:h-96" />
          <Skeleton className="h-72 rounded-xl sm:h-96" />
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------- view */

  const debtsNegative = Boolean(debtStats && debtStats.totalToPay > debtStats.totalToReceive);

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(currentDate);

  return (
    <PageBody className="animate-fade-in space-y-6 md:space-y-8 lg:space-y-10">
      <PageHeader
        eyebrow={<span className="capitalize">{monthLabel}</span>}
        title="Visão geral"
        description="Como o mês está fechando: o que já entrou, o que já saiu e o que ainda está por vir."
        actions={<ViewModeToggle />}
      />

      {/* KPIs — os protagonistas da tela */}
      <section aria-label="Indicadores do mês" className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:gap-4 lg:col-span-2">
          <StatCard
            label="Saldo do mês"
            value={formatCurrency(indicators.netBalance)}
            tone={indicators.netBalance >= 0 ? "positive" : "negative"}
            icon={Wallet}
            hint="Entradas recebidas menos saídas pagas"
          />
          <StatCard
            label="Recebido"
            value={formatCurrency(indicators.incomeReceived)}
            tone="positive"
            icon={TrendingUp}
            hint="Já entrou na conta"
          />
          <StatCard
            label="Pago"
            value={formatCurrency(indicators.expensesPaid)}
            tone="negative"
            icon={TrendingDown}
            hint="Já saiu da conta"
          />
          <StatCard
            label="Dívidas"
            value={formatCurrency(debtStats?.netBalance ?? 0)}
            tone={debtsNegative ? "negative" : "neutral"}
            icon={Scale}
            hint={
              <StatSplit
                items={[
                  { label: "A receber", value: formatCurrency(debtStats?.totalToReceive ?? 0), tone: "positive" },
                  { label: "A pagar", value: formatCurrency(debtStats?.totalToPay ?? 0), tone: "negative" },
                ]}
              />
            }
          />
        </div>

        <div className="lg:col-span-1">
          <SubscriptionChart className="h-full" />
        </div>
      </section>

      <InflationAlertCard />

      {/* Análise */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader>
            <SectionHead title="Gastos por categoria" icon={PieChart}>
              <Segmented
                label="Formato da visualização"
                value={categoryViewMode}
                onChange={setCategoryViewMode}
                options={[
                  { value: "list", label: "Lista", icon: List },
                  { value: "chart", label: "Gráfico", icon: BarChart3 },
                ]}
              />
            </SectionHead>
          </CardHeader>
          <CardContent>
            {categoryExpenses.length === 0 ? (
              <EmptyState
                icon={PieChart}
                title="Nenhum gasto categorizado este mês"
                description="Atribua categorias às suas transações para ver a distribuição aqui."
              />
            ) : categoryViewMode === "list" ? (
              <ul className="space-y-4">
                {categoryExpenses.map((item, index) => {
                  const percentage = categoryTotal > 0 ? (item.amount / categoryTotal) * 100 : 0;
                  return (
                    <li key={item.category}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: palette.at(index) }}
                          />
                          <span className="truncate text-sm text-foreground">{item.category}</span>
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2">
                          <span className="tabular text-2xs text-muted-foreground">{percentage.toFixed(0)}%</span>
                          <span className="figure-sm tabular text-foreground">{formatCurrency(item.amount)}</span>
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${percentage}%`, backgroundColor: palette.at(index) }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="h-64 w-full sm:h-[19rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={categoryExpenses}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={104}
                      paddingAngle={2}
                      dataKey="amount"
                      nameKey="category"
                      stroke="none"
                    >
                      {categoryExpenses.map((entry, index) => (
                        <Cell key={entry.category} fill={palette.at(index)} />
                      ))}
                    </Pie>
                    <Tooltip
                      cursor={false}
                      formatter={(value: number) => [formatCurrency(value), "Valor"]}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        boxShadow: "var(--shadow-md)",
                        fontSize: "0.8125rem",
                      }}
                      labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos lançamentos */}
        <Card>
          <CardHeader>
            <SectionHead title="Próximos lançamentos" icon={Calendar}>
              <Segmented
                label="Período"
                value={upcomingPeriod}
                onChange={setUpcomingPeriod}
                options={[
                  { value: 7, label: "7 dias" },
                  { value: 15, label: "15 dias" },
                  { value: 30, label: "30 dias" },
                ]}
              />
            </SectionHead>
          </CardHeader>
          <CardContent>
            {upcomingTransactions.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title={`Nada pendente nos próximos ${upcomingPeriod} dias`}
                description="Você está em dia com o que estava agendado para este período."
              />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {upcomingTransactions.map((transaction) => (
                  <li key={transaction.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[auto_1fr_auto_auto]">
                    <span
                      aria-hidden
                      className={cn(
                        "h-8 w-0.5 shrink-0 rounded-full",
                        transaction.type === "income" ? "bg-success" : "bg-destructive",
                      )}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground" title={transaction.description}>
                          {transaction.description}
                        </p>
                        {transaction.installmentNumber && transaction.totalInstallments > 1 && (
                          <Badge variant="outline">
                            {transaction.installmentNumber}/{transaction.totalInstallments}
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        <time dateTime={transaction.date}>{formatDateForDisplay(transaction.date)}</time>
                        {transaction.categories?.name && ` · ${transaction.categories.name}`}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className={cn("figure-sm tabular", transactionTone(transaction.type))}>
                        {transaction.type === "income" ? "+" : "−"}
                        {formatCurrency(Math.abs(transaction.value))}
                      </p>
                      <p className="text-2xs text-muted-foreground">Pendente</p>
                    </div>

                    {/* Ações: linha própria no telefone, coluna no desktop. */}
                    <div className="col-span-3 flex items-center justify-end border-t border-border-subtle pt-1 sm:col-span-1 sm:border-t-0 sm:pt-0">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Editar ${transaction.description}`}
                        onClick={() => navigate(`/sistema/statement?edit=${transaction.id}`)}
                      >
                        <Edit />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Marcar ${transaction.description} como liquidada`}
                        onClick={() => setStatus(transaction.id, "PAID")}
                      >
                        <CheckCircle />
                      </Button>
                      <ConfirmationDialog
                        title="Excluir transação"
                        description="Esta ação não pode ser desfeita."
                        confirmText="Excluir"
                        onConfirm={() => deleteTransaction(transaction.id)}
                        variant="destructive"
                      >
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Excluir ${transaction.description}`}
                          className="hover:text-destructive"
                          disabled={deletingTransaction === transaction.id}
                        >
                          <Trash2 />
                        </Button>
                      </ConfirmationDialog>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Últimas transações */}
      <section>
        <Card>
          <CardHeader>
            <SectionHead title="Últimas transações">
              <Button variant="outline" size="sm" onClick={() => navigate("/sistema/statement")}>
                Ver extrato
              </Button>
            </SectionHead>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <EmptyState
                icon={List}
                title="Nenhuma transação este mês"
                description="Registre a primeira transação para começar a acompanhar seu saldo."
              />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {recentTransactions.map((transaction) => {
                  const isPaidSharedExpense =
                    transaction.type === "expense" && transaction.status === "PAID" && transaction.is_shared;
                  const isSettled = transaction.status === "PAID";

                  return (
                    <li
                      key={transaction.id}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[auto_1fr_auto_auto]"
                    >
                      <TransactionIcon type={transaction.type} />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground" title={transaction.description}>
                            {transaction.description}
                          </span>
                          {transaction.series_id && transaction.is_shared && <Badge variant="secondary">Rateio</Badge>}
                          {transaction.linked_txn_id && <Badge variant="outline">Ligada</Badge>}
                          {viewMode === "couple" && currentUserId && transaction.user_id !== currentUserId && (
                            <Badge variant="outline">Parceiro</Badge>
                          )}
                          {transaction.installmentNumber && transaction.totalInstallments > 1 && (
                            <Badge variant="outline">
                              {transaction.installmentNumber}/{transaction.totalInstallments}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {truncateText(getAccountName(transaction), 18)}
                          {transaction.categories?.name && ` · ${truncateText(transaction.categories.name, 18)}`}
                          {transaction.people?.name && ` · ${truncateText(transaction.people.name, 18)}`}
                          {" · "}
                          <time dateTime={transaction.date}>{formatDateForDisplay(transaction.date)}</time>
                          {isPaidSharedExpense && ` · minha parte ${formatCurrency(transaction.value)}`}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className={cn("figure-sm tabular", transactionTone(transaction.type))}>
                          {transaction.type === "income" ? "+" : "−"}
                          {formatCurrency(transaction.value)}
                        </p>
                        <p className="text-2xs text-muted-foreground">
                          {isSettled ? (transaction.type === "income" ? "Recebido" : "Pago") : "Pendente"}
                        </p>
                      </div>

                      {/* Ações: linha própria no telefone, coluna no desktop. */}
                      <div className="col-span-3 flex items-center justify-end border-t border-border-subtle pt-1 sm:col-span-1 sm:border-t-0 sm:pt-0">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Editar ${transaction.description}`}
                          disabled={!isMine(transaction.user_id)}
                          onClick={() => navigate(`/sistema/statement?edit=${transaction.id}`)}
                        >
                          <Edit />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={
                            isSettled
                              ? `Reabrir ${transaction.description}`
                              : `Marcar ${transaction.description} como liquidada`
                          }
                          disabled={!isMine(transaction.user_id)}
                          onClick={() => setStatus(transaction.id, isSettled ? "PENDING" : "PAID")}
                        >
                          {isSettled ? <Undo2 /> : <CheckCircle />}
                        </Button>
                        <ConfirmationDialog
                          title="Excluir transação"
                          description="Esta ação não pode ser desfeita."
                          confirmText="Excluir"
                          onConfirm={() => deleteTransaction(transaction.id)}
                          variant="destructive"
                        >
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Excluir ${transaction.description}`}
                            className="hover:text-destructive"
                            disabled={deletingTransaction === transaction.id || !isMine(transaction.user_id)}
                          >
                            <Trash2 />
                          </Button>
                        </ConfirmationDialog>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </PageBody>
  );
}
