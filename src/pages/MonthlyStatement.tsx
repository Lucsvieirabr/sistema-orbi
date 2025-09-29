import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonthlyTransactions } from "@/hooks/use-monthly-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useAccounts } from "@/hooks/use-accounts";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyBRL } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Filter,
  Plus,
  CreditCard,
  User
} from "lucide-react";

export default function MonthlyStatement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'pending' | 'paid'>('all');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>("income");
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [value, setValue] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [isFixed, setIsFixed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'debit' | 'credit'>('debit');
  const [creditCardId, setCreditCardId] = useState<string | null>(null);
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [installments, setInstallments] = useState<number | null>(null);
  const [fromAccountId, setFromAccountId] = useState<string | undefined>(undefined);
  const [toAccountId, setToAccountId] = useState<string | undefined>(undefined);

  // Hooks
  const { categories } = useCategories();
  const { accountsWithBalance } = useAccounts();
  const { creditCards } = useCreditCards();
  const { familyMembers } = useFamilyMembers();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const {
    transactions,
    groupedTransactions,
    isLoading,
    error,
    refetch,
    indicators
  } = useMonthlyTransactions(year, month);

  // Calcular valor da parcela automaticamente
  const installmentValue = useMemo(() => {
    if (!value || !installments || installments <= 0) return 0;
    return value / installments;
  }, [value, installments]);

  // Initialize default values
  useEffect(() => {
    setAccountId((prev) => prev ?? accountsWithBalance[0]?.id);
    setCategoryId((prev) => prev ?? categories[0]?.id);
    setFromAccountId((prev) => prev ?? accountsWithBalance[0]?.id);
    setToAccountId((prev) => prev ?? accountsWithBalance[1]?.id);
  }, [accountsWithBalance, categories]);

  const title = useMemo(() => (editingId ? "Editar Transação" : "Nova Transação"), [editingId]);

  useEffect(() => {
    if (search.get('new') === '1') {
      setOpen(true);
      setSearch((prev) => { prev.delete('new'); return prev; });
    }
  }, [search, setSearch]);

  const resetForm = () => {
    setEditingId(null);
    setType("income");
    setAccountId(accountsWithBalance[0]?.id);
    setCategoryId(categories[0]?.id);
    setValue(0);
    setDescription("");
    setDate(new Date().toISOString().slice(0,10));
    setIsFixed(false);
    setPaymentMethod('debit');
    setCreditCardId(null);
    setFamilyMemberId(null);
    setInstallments(null);
    setFromAccountId(accountsWithBalance[0]?.id);
    setToAccountId(accountsWithBalance[1]?.id);
  };

  // Reset campos específicos quando tipo muda
  const handleTypeChange = (newType: 'income' | 'expense' | 'transfer') => {
    setType(newType);

    // Reset campos específicos baseado no tipo
    if (newType === 'income') {
      // Ganho: limpa campos de pagamento, mantém parcelas
      setPaymentMethod('debit');
      setCreditCardId(null);
      setFromAccountId(undefined);
      setToAccountId(undefined);
      // Parcelas ficam disponíveis para ganhos
    } else if (newType === 'expense') {
      // Gasto: limpa campos de transferência
      setFromAccountId(undefined);
      setToAccountId(undefined);
      // Parcelas serão controladas pelo método de pagamento
    } else if (newType === 'transfer') {
      // Transferência: limpa campos de pagamento, categoria e parcelas
      setPaymentMethod('debit');
      setCreditCardId(null);
      setInstallments(null);
      setCategoryId(undefined);
    }
  };

  const onSubmit = async () => {
    const t = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
    try {
      // Construir payload baseado no tipo de transação
      let payload: any = {
        type,
        value,
        description,
        date,
        family_member_id: familyMemberId,
        is_fixed: isFixed,
      };

      if (type === 'income') {
        // Ganho: conta + categoria obrigatórios, com parcelas opcionais
        // Se for parcelado, usar o valor da parcela; senão, usar o valor total
        const transactionValue = (installments && installments > 1) ? installmentValue : value;

        payload = {
          ...payload,
          value: transactionValue,
          account_id: accountId,
          category_id: categoryId,
          payment_method: 'debit',
          credit_card_id: null,
          installments: installments || 1, // Default 1 se não especificado
        };
      } else if (type === 'expense') {
        // Gasto: depende do método de pagamento
        if (paymentMethod === 'debit') {
          // Débito: conta obrigatória, sem cartão, sem parcelas
          payload = {
            ...payload,
            account_id: accountId,
            category_id: categoryId,
            payment_method: 'debit',
            credit_card_id: null,
            installments: null,
          };
        } else {
          // Crédito: cartão obrigatório, sem conta, com parcelas
          // Se for parcelado, usar o valor da parcela; senão, usar o valor total
          const transactionValue = (installments && installments > 1) ? installmentValue : value;

          payload = {
            ...payload,
            value: transactionValue,
            account_id: null,
            category_id: categoryId,
            payment_method: 'credit',
            credit_card_id: creditCardId,
            installments: installments,
          };
        }
      } else if (type === 'transfer') {
        // Transferência: contas origem/destino, sem categoria
        payload = {
          ...payload,
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          payment_method: 'debit',
          credit_card_id: null,
          installments: null,
        };
      }

      if (editingId) {
        // TODO: Implementar edição
        t.update({ title: "Erro", description: "Edição ainda não implementada", duration: 3000, variant: "destructive" as any });
      } else {
        // Criar nova transação usando o hook useMonthlyTransactions
        const { error } = await supabase.from("transactions").insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          type: payload.type,
          account_id: payload.account_id,
          category_id: payload.category_id,
          value: payload.value,
          description: payload.description,
          date: payload.date,
          payment_method: payload.payment_method,
          credit_card_id: payload.credit_card_id,
          family_member_id: payload.family_member_id,
          is_fixed: payload.is_fixed,
          installments: payload.installments,
          installment_number: 1,
          series_id: null,
          status: 'PAID', // Transação única é sempre paga no momento da criação
        });

        if (error) throw error;

        t.update({ title: "Sucesso", description: "Transação criada", duration: 2000 });
      }
    } catch (e: any) {
      t.update({ title: "Erro", description: e.message || "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
    }
    setOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["monthly-transactions", year, month] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  // Filter transactions based on selected filter
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    switch (filterType) {
      case 'income':
        filtered = transactions.filter(t => t.type === 'income');
        break;
      case 'expense':
        filtered = transactions.filter(t => t.type === 'expense');
        break;
      case 'pending':
        filtered = transactions.filter(t => t.status === 'PENDING');
        break;
      case 'paid':
        filtered = transactions.filter(t => t.status === 'PAID');
        break;
    }

    return filtered;
  }, [transactions, filterType]);

  // Re-group filtered transactions
  const filteredGroupedTransactions = useMemo(() => {
    const grouped: Record<string, typeof filteredTransactions> = {};

    filteredTransactions.forEach(transaction => {
      const date = transaction.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(transaction);
    });

    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });

    return grouped;
  }, [filteredTransactions]);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const markAsPaid = async (transactionId: string) => {
    const t = toast({ title: "Atualizando...", description: "Aguarde", duration: 2000 });
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ status: 'PAID' })
        .eq("id", transactionId);

      if (error) throw error;

      t.update({ title: "Sucesso", description: "Transação marcada como paga", duration: 2000 });
      refetch();
    } catch (e: any) {
      t.update({ title: "Erro", description: e.message || "Não foi possível atualizar", duration: 3000, variant: "destructive" as any });
    }
  };

  const markAsPending = async (transactionId: string) => {
    const t = toast({ title: "Atualizando...", description: "Aguarde", duration: 2000 });
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ status: 'PENDING' })
        .eq("id", transactionId);

      if (error) throw error;

      t.update({ title: "Sucesso", description: "Status alterado para pendente", duration: 2000 });
      refetch();
    } catch (e: any) {
      t.update({ title: "Erro", description: e.message || "Não foi possível atualizar", duration: 3000, variant: "destructive" as any });
    }
  };

  const getTransactionIcon = (transaction: any) => {
    if (transaction.installment_number) {
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

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header with month selector and filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => handleMonthChange('prev')}>
                <Calendar className="h-4 w-4 mr-2" />
                Anterior
              </Button>
              <div className="text-lg font-semibold">
                {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMonthChange('next')}
                disabled={currentDate >= new Date()}
              >
                Próximo
                <Calendar className="h-4 w-4 ml-2" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="income">Apenas Ganhos</SelectItem>
                  <SelectItem value="expense">Apenas Gastos</SelectItem>
                  <SelectItem value="pending">Apenas Pendentes</SelectItem>
                  <SelectItem value="paid">Apenas Pagas</SelectItem>
                </SelectContent>
              </Select>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 w-8 p-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Indicators Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ganhos Recebidos</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrencyBRL(indicators.incomeReceived)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gastos Pagos</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrencyBRL(indicators.expensesPaid)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contas a Receber</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrencyBRL(indicators.incomePending)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contas a Pagar</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatCurrencyBRL(indicators.expensesPending)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo Líquido</p>
                <p className={`text-2xl font-bold ${
                  indicators.netBalance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrencyBRL(indicators.netBalance)}
                </p>
              </div>
              {indicators.netBalance >= 0 ?
                <TrendingUp className="h-8 w-8 text-green-500" /> :
                <TrendingDown className="h-8 w-8 text-red-500" />
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Extrato Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border-b">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : Object.keys(filteredGroupedTransactions).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma transação encontrada para este período</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(filteredGroupedTransactions).map(([date, dayTransactions]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-muted-foreground">
                      {new Date(date).toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      })}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {dayTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {getTransactionIcon(transaction)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{transaction.description}</span>
                              {transaction.installment_number && (
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
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className={`font-semibold ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}
                              {formatCurrencyBRL(transaction.value)}
                            </div>
                          </div>

                          <Badge
                            variant={transaction.status === 'PAID' ? 'default' : 'secondary'}
                            className={transaction.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                          >
                            {transaction.status === 'PAID' ? 'Pago' : 'Pendente'}
                          </Badge>

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
                              <Clock className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Creation Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Tipo de Transação */}
            <div className="space-y-2">
              <Label>Tipo de Transação</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTypeChange('income')}
                  className={`flex items-center gap-2 flex-1 ${type === 'income'
                    ? 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100'
                    : 'hover:border-green-300 hover:bg-green-50 hover:text-green-700'}`}
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Ganho
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTypeChange('expense')}
                  className={`flex items-center gap-2 flex-1 ${type === 'expense'
                    ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100'
                    : 'hover:border-red-300 hover:bg-red-50 hover:text-red-700'}`}
                >
                  <ArrowDownCircle className="h-4 w-4" />
                  Gasto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTypeChange('transfer')}
                  className={`flex items-center gap-2 flex-1 ${type === 'transfer'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100'
                    : 'hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'}`}
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Transferência
                </Button>
              </div>
            </div>

            {/* Campos principais com lógica de visibilidade dinâmica */}
            {type === 'transfer' ? (
              /* Transferência: Conta Origem + Conta Destino */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Conta de Origem</Label>
                  <Select value={fromAccountId} onValueChange={setFromAccountId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Origem" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsWithBalance.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Conta de Destino</Label>
                  <Select value={toAccountId} onValueChange={setToAccountId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsWithBalance.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : type === 'income' ? (
              /* Ganho: Conta + Categoria + Valor Total + Parcelas */
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Conta</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsWithBalance.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Valor</Label>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(parseFloat(e.target.value || '0'))}
                    placeholder="0,00"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Parcelas</Label>
                  <Input
                    type="number"
                    value={installments || ''}
                    onChange={(e) => setInstallments(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="1"
                    min="1"
                    className="h-9"
                  />
                </div>
              </div>
            ) : (
              /* Gasto: Conta + Categoria + Valor (método de pagamento será tratado abaixo) */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Conta</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsWithBalance.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Valor</Label>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(parseFloat(e.target.value || '0'))}
                    placeholder="0,00"
                    className="h-9"
                  />
                </div>
              </div>
            )}

            {/* Descrição e Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Descrição</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Salário, Aluguel, etc."
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Data</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Informação do valor da parcela para ganhos parcelados */}
            {type === 'income' && installments && installments > 1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700 font-medium">Valor por Parcela:</span>
                  <span className="text-blue-900 font-semibold">
                    {formatCurrencyBRL(installmentValue)}
                  </span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {installments} parcelas de {formatCurrencyBRL(installmentValue)} = {formatCurrencyBRL(value)}
                </div>
              </div>
            )}

            {/* Método de Pagamento (apenas para gastos) */}
            {type === 'expense' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Método de Pagamento</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={paymentMethod === 'debit' ? 'default' : 'outline'}
                      onClick={() => {
                        setPaymentMethod('debit');
                        setCreditCardId(null);
                        setInstallments(null);
                      }}
                      className="flex-1 h-9 text-xs"
                    >
                      Débito/Dinheiro
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === 'credit' ? 'default' : 'outline'}
                      onClick={() => {
                        setPaymentMethod('credit');
                        setAccountId(undefined);
                      }}
                      className="flex-1 h-9 text-xs flex items-center gap-1"
                    >
                      <CreditCard className="h-3 w-3" />
                      Cartão de Crédito
                    </Button>
                  </div>
                </div>

                {paymentMethod === 'credit' ? (
                  <div className="space-y-1">
                    <Label className="text-sm">Cartão de Crédito</Label>
                    <Select value={creditCardId || "none"} onValueChange={(value) => setCreditCardId(value === "none" ? null : value)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {creditCards.map((card) => (
                          <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            )}

            {/* Parcelas para Cartão de Crédito */}
            {type === 'expense' && paymentMethod === 'credit' && (
              <div className="space-y-1">
                <Label className="text-sm">Parcelas</Label>
                <Input
                  type="number"
                  value={installments || ''}
                  onChange={(e) => setInstallments(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Ex: 12"
                  min="2"
                  className="h-9"
                />
              </div>
            )}

            {/* Informação do valor da parcela para gastos parcelados */}
            {type === 'expense' && paymentMethod === 'credit' && installments && installments > 1 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-700 font-medium">Valor por Parcela:</span>
                  <span className="text-red-900 font-semibold">
                    {formatCurrencyBRL(installmentValue)}
                  </span>
                </div>
                <div className="text-xs text-red-600 mt-1">
                  {installments} parcelas de {formatCurrencyBRL(installmentValue)} = {formatCurrencyBRL(value)}
                </div>
              </div>
            )}

            {/* Campos Opcionais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Membro da Família</Label>
                <Select value={familyMemberId || "none"} onValueChange={(value) => setFamilyMemberId(value === "none" ? null : value)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {familyMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Configurações</Label>
                <div className="flex items-center space-x-2 h-9">
                  <Switch checked={isFixed} onCheckedChange={setIsFixed} />
                  <Label className="text-sm">Transação Recorrente</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
