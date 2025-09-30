import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectWithAddButton } from "@/components/ui/select-with-add-button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonthlyTransactions, useTransactionMaintenance } from "@/hooks/use-monthly-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useAccounts } from "@/hooks/use-accounts";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { usePeople } from "@/hooks/use-people";
import { supabase } from "@/integrations/supabase/client";
import { toast, useToast } from "@/hooks/use-toast";
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
  User,
  Edit,
  Trash2
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
  const [personId, setPersonId] = useState<string | null>(null);
  const [installments, setInstallments] = useState<number | null>(null);
  const [fromAccountId, setFromAccountId] = useState<string | undefined>(undefined);
  const [toAccountId, setToAccountId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [editScope, setEditScope] = useState<'current' | 'future'>('current');
  const [showMonthSelector, setShowMonthSelector] = useState(false);

  // Hooks
  const { categories } = useCategories();
  const { accountsWithBalance } = useAccounts();
  const { creditCards } = useCreditCards();
  const { people } = usePeople();

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

  const { maintainFixedTransactions } = useTransactionMaintenance();
  const { toast } = useToast();

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

  // Manutenção automática de transações fixas
  useEffect(() => {
    const runMaintenance = async () => {
      try {
        await maintainFixedTransactions();
        // Após manutenção, recarregar dados
        refetch();
      } catch (error) {
        console.error('Erro na manutenção automática:', error);
      }
    };

    runMaintenance();
  }, [year, month]); // Executar quando o mês/ano mudar

  const title = useMemo(() => (editingId ? "Editar Transação" : "Nova Transação"), [editingId]);

  useEffect(() => {
    if (search.get('new') === '1') {
      setOpen(true);
      setSearch((prev) => { prev.delete('new'); return prev; });
    }
  }, [search, setSearch]);

  // Load transaction data when editing
  useEffect(() => {
    if (editingId) {
      loadTransactionData(editingId);
    }
  }, [editingId]);

  const loadTransactionData = async (transactionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id, user_id, description, value, date, type, payment_method,
          installments, installment_number, is_fixed, account_id,
          credit_card_id, category_id, person_id, series_id, status, created_at,
          accounts(name),
          categories(name),
          credit_cards(name),
          people(name)
        `)
        .eq("id", transactionId)
        .eq("user_id", user?.id ?? "")
        .single();

      if (error) throw error;

      if (data) {
        // Populate form with transaction data
        setType(data.type as 'income' | 'expense' | 'transfer');
        setValue(data.value);
        setDescription(data.description);
        setDate(data.date.slice(0, 10));
        setIsFixed(data.is_fixed);
        setPersonId(data.person_id);
        setStatus(data.status);

        if (data.type === 'income') {
          setAccountId(data.account_id);
          setCategoryId(data.category_id);
          setPaymentMethod('debit');
          setCreditCardId(null);
          setFromAccountId(undefined);
          setToAccountId(undefined);
          setInstallments(data.installments);
        } else if (data.type === 'expense') {
          setAccountId(data.account_id);
          setCategoryId(data.category_id);
          setPaymentMethod(data.payment_method as 'debit' | 'credit');
          setCreditCardId(data.credit_card_id);
          setFromAccountId(undefined);
          setToAccountId(undefined);
          setInstallments(data.installments);
        } else if (data.type === 'transfer') {
          setFromAccountId(data.from_account_id);
          setToAccountId(data.to_account_id);
          setPaymentMethod('debit');
          setCreditCardId(null);
          setInstallments(null);
          setAccountId(undefined);
          setCategoryId(undefined);
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados da transação",
        variant: "destructive"
      });
    }
  };

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
    setPersonId(null);
    setInstallments(null);
    setFromAccountId(accountsWithBalance[0]?.id);
    setToAccountId(accountsWithBalance[1]?.id);
    setStatus('PAID');
    setEditScope('current');
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
    const toastInstance = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
    try {
      // Construir payload baseado no tipo de transação
      let payload: any = {
        type,
        value,
        description,
        date,
        person_id: personId,
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
        // Implementar edição transacional
        await updateTransaction(editingId, payload);
      } else {
        // Criar nova transação usando o hook useMonthlyTransactions
        if (payload.is_fixed) {
          // Para transações fixas, gerar 12 meses futuros
          await createFixedTransactionSeries(payload);
        } else if (payload.installments && payload.installments > 1) {
          // Para transações parceladas, criar todas as parcelas
          await createInstallmentSeries(payload);
        } else {
          // Transação única
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
            person_id: payload.person_id,
            is_fixed: payload.is_fixed,
            installments: null,
            installment_number: null,
            series_id: null,
            status: 'PAID', // Transação única é sempre paga no momento da criação
          });
          if (error) throw error;
        }

        if (error) throw error;

        toast({ title: "Sucesso", description: "Transação criada", duration: 2000 });
      }
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível salvar",
        duration: 3000,
        variant: "destructive" as any
      });
    }
    setOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["monthly-transactions", year, month] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  const updateTransaction = async (transactionId: string, newData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Buscar dados atuais da transação
      const { data: currentTransaction, error: fetchError } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .eq("user_id", user.id)
        .single();

      if (fetchError) throw fetchError;

      // 2. Determinar se é uma transação em série
      const hasSeriesId = currentTransaction?.series_id;

      // 3. Se for uma transação em série, aplicar lógica de edição em lote
      if (hasSeriesId && editScope === 'future') {
        // Editar esta transação e todas as futuras da mesma série
        await updateTransactionSeries(currentTransaction.series_id, currentTransaction.date, newData);
        return;
      }

      // 4. Calcular impacto no saldo
      const oldValue = currentTransaction?.value || 0;
      const newValue = newData.value;
      const valueDifference = newValue - oldValue;

      // 5. Determinar conta afetada
      let affectedAccountId = null;
      if (newData.type === 'income' && newData.account_id) {
        affectedAccountId = newData.account_id;
      } else if (newData.type === 'expense') {
        if (newData.payment_method === 'debit' && newData.account_id) {
          affectedAccountId = newData.account_id;
        } else if (newData.payment_method === 'credit' && newData.credit_card_id) {
          // Para cartão de crédito, afetar a conta conectada
          const { data: creditCard } = await supabase
            .from("credit_cards")
            .select("connected_account_id")
            .eq("id", newData.credit_card_id)
            .single();

          affectedAccountId = creditCard?.connected_account_id;
        }
      } else if (newData.type === 'transfer') {
        // Para transferências, não há impacto direto no saldo
        affectedAccountId = null;
      }

      // 6. Executar transação
      const { error: updateError } = await supabase.rpc('update_transaction_with_balance', {
        transaction_id: transactionId,
        new_type: newData.type,
        new_value: newValue,
        new_description: newData.description,
        new_date: newData.date,
        new_account_id: newData.account_id,
        new_category_id: newData.category_id,
        new_payment_method: newData.payment_method,
        new_credit_card_id: newData.credit_card_id,
        new_person_id: newData.person_id,
        new_is_fixed: newData.is_fixed,
        new_installments: newData.installments,
        value_difference: valueDifference,
        affected_account_id: affectedAccountId
      });

      if (updateError) throw updateError;

      toast({ title: "Sucesso", description: "Transação atualizada", duration: 2000 });
    } catch (error: any) {
      console.error("Erro ao atualizar transação:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar",
        duration: 3000,
        variant: "destructive" as any
      });
    }
  };

  const updateTransactionSeries = async (seriesId: string, fromDate: string, newData: any) => {
    try {
      // Buscar todas as transações futuras da série
      const { data: futureTransactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("series_id", seriesId)
        .gte("date", fromDate)
        .order("date");

      if (error) throw error;

      if (!futureTransactions || futureTransactions.length === 0) {
        throw new Error("Nenhuma transação futura encontrada para esta série");
      }

      // Calcular o valor antigo total das transações futuras
      const oldTotalValue = futureTransactions.reduce((sum, t) => sum + t.value, 0);
      const newTotalValue = futureTransactions.length * newData.value;
      const totalValueDifference = newTotalValue - oldTotalValue;

      // Determinar conta afetada (usar a primeira transação como referência)
      let affectedAccountId = null;
      const firstTransaction = futureTransactions[0];

      if (newData.type === 'income' && newData.account_id) {
        affectedAccountId = newData.account_id;
      } else if (newData.type === 'expense') {
        if (newData.payment_method === 'debit' && newData.account_id) {
          affectedAccountId = newData.account_id;
        } else if (newData.payment_method === 'credit' && newData.credit_card_id) {
          const { data: creditCard } = await supabase
            .from("credit_cards")
            .select("connected_account_id")
            .eq("id", newData.credit_card_id)
            .single();

          affectedAccountId = creditCard?.connected_account_id;
        }
      }

      // Executar edição em lote
      const { error: updateError } = await supabase.rpc('update_transaction_series_with_balance', {
        series_id: seriesId,
        from_date: fromDate,
        new_type: newData.type,
        new_value: newData.value,
        new_description: newData.description,
        new_account_id: newData.account_id,
        new_category_id: newData.category_id,
        new_payment_method: newData.payment_method,
        new_credit_card_id: newData.credit_card_id,
        new_person_id: newData.person_id,
        new_is_fixed: newData.is_fixed,
        new_installments: newData.installments,
        total_value_difference: totalValueDifference,
        affected_account_id: affectedAccountId
      });

      if (updateError) throw updateError;

      toast({ title: "Sucesso", description: `${futureTransactions.length} transações da série atualizadas`, duration: 2000 });
    } catch (error: any) {
      console.error("Erro ao atualizar série de transações:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a série",
        duration: 3000,
        variant: "destructive" as any
      });
    }
  };

  const createInstallmentSeries = async (payload: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Gerar um series_id único para as parcelas
      const seriesId = crypto.randomUUID();

      // Data inicial
      const startDate = new Date(payload.date);

      // Criar array de transações para todas as parcelas
      const transactionsToInsert = [];

      for (let i = 0; i < payload.installments; i++) {
        const transactionDate = new Date(startDate);
        transactionDate.setMonth(transactionDate.getMonth() + i);

        // Formatar data como YYYY-MM-DD
        const formattedDate = transactionDate.toISOString().slice(0, 10);

        transactionsToInsert.push({
          user_id: user.id,
          type: payload.type,
          account_id: payload.account_id,
          category_id: payload.category_id,
          value: payload.value, // Valor da parcela (já calculado anteriormente)
          description: payload.description,
          date: formattedDate,
          payment_method: payload.payment_method,
          credit_card_id: payload.credit_card_id,
          person_id: payload.person_id,
          is_fixed: false,
          installments: payload.installments,
          installment_number: i + 1, // Começar com parcela 1
          series_id: seriesId,
          status: i === 0 ? 'PAID' : 'PENDING', // Primeira parcela como PAID, outras como PENDING
        });
      }

      // Inserir todas as transações
      const { error } = await supabase.from("transactions").insert(transactionsToInsert);
      if (error) throw error;

      toast({ title: "Sucesso", description: `${payload.installments} parcelas criadas`, duration: 2000 });
    } catch (error: any) {
      console.error("Erro ao criar série de parcelas:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar as parcelas",
        duration: 3000,
        variant: "destructive" as any
      });
    }
  };

  const createFixedTransactionSeries = async (payload: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Gerar um series_id único
      const seriesId = crypto.randomUUID();

      // Data inicial
      const startDate = new Date(payload.date);

      // Criar array de transações para os próximos 12 meses
      const transactionsToInsert = [];

      for (let i = 0; i < 12; i++) {
        const transactionDate = new Date(startDate);
        transactionDate.setMonth(transactionDate.getMonth() + i);

        // Formatar data como YYYY-MM-DD
        const formattedDate = transactionDate.toISOString().slice(0, 10);

        transactionsToInsert.push({
          user_id: user.id,
          type: payload.type,
          account_id: payload.account_id,
          category_id: payload.category_id,
          value: payload.value,
          description: payload.description,
          date: formattedDate,
          payment_method: payload.payment_method,
          credit_card_id: payload.credit_card_id,
          person_id: payload.person_id,
          is_fixed: true,
          installments: payload.installments,
          installment_number: 1,
          series_id: seriesId,
          status: 'PENDING', // Todas as transações futuras começam como PENDING
        });
      }

      // Inserir todas as transações
      const { error } = await supabase.from("transactions").insert(transactionsToInsert);
      if (error) throw error;

      // Marcar apenas a primeira transação como PAID (a atual)
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ status: 'PAID' })
        .eq("series_id", seriesId)
        .eq("date", payload.date);

      if (updateError) throw updateError;

      toast({ title: "Sucesso", description: "Transações fixas criadas para 12 meses", duration: 2000 });
    } catch (error: any) {
      console.error("Erro ao criar série de transações fixas:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar transações fixas",
        duration: 3000,
        variant: "destructive" as any
      });
    }
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

  const handleMonthChange = (direction: 'prev' | 'next', months: number = 1) => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - months);
    } else {
      newDate.setMonth(newDate.getMonth() + months);
    }
    setCurrentDate(newDate);
  };

  const setMonthYear = (year: number, month: number) => {
    const newDate = new Date(year, month - 1, 1); // Month is 0-indexed in JS Date
    setCurrentDate(newDate);
    setShowMonthSelector(false);
  };

  const markAsPaid = async (transactionId: string) => {
    const toastInstance = toast({ title: "Atualizando...", description: "Aguarde", duration: 2000 });
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ status: 'PAID' })
        .eq("id", transactionId);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Transação marcada como paga", duration: 2000 });
      refetch();
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
        .update({ status: 'PENDING' })
        .eq("id", transactionId);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Status alterado para pendente", duration: 2000 });
      refetch();
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
    const toastInstance = toast({ title: "Excluindo...", description: "Aguarde", duration: 2000 });
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Transação excluída", duration: 2000 });
      refetch();
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível excluir",
        duration: 3000,
        variant: "destructive" as any
      });
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMonthSelector(!showMonthSelector)}
                className="relative h-9"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                {showMonthSelector && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg z-50 p-4 min-w-64">
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = i;
                        const year = currentDate.getFullYear();
                        return (
                          <Button
                            key={month}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setMonthYear(year, month + 1)}
                          >
                            {new Date(year, month).toLocaleDateString('pt-BR', { month: 'short' })}
                          </Button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-5 gap-1 mt-2">
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = currentDate.getFullYear() + (i - 2);
                        return (
                          <Button
                            key={year}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setMonthYear(year, currentDate.getMonth() + 1)}
                          >
                            {year}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMonthChange('next')}
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
                            className={transaction.status === 'PAID' ? 'bg-primary/10 text-primary' : 'bg-yellow-100 text-yellow-800'}
                          >
                            {transaction.status === 'PAID'
                              ? (transaction.type === 'income' ? 'Recebido' : 'Pago')
                              : 'Pendente'}
                          </Badge>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(transaction.id);
                              setOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteTransaction(transaction.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
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
                    ? 'border-primary/50 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary hover:bg-primary/20 dark:hover:bg-primary/30'
                    : 'hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary dark:hover:text-primary'}`}
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Ganho
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTypeChange('expense')}
                  className={`flex items-center gap-2 flex-1 ${type === 'expense'
                    ? 'border-destructive/50 bg-destructive/10 dark:bg-destructive/20 text-destructive dark:text-destructive hover:bg-destructive/20 dark:hover:bg-destructive/30'
                    : 'hover:border-destructive/30 hover:bg-destructive/5 dark:hover:bg-destructive/10 hover:text-destructive dark:hover:text-destructive'}`}
                >
                  <ArrowDownCircle className="h-4 w-4" />
                  Gasto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTypeChange('transfer')}
                  className={`flex items-center gap-2 flex-1 ${type === 'transfer'
                    ? 'border-primary/50 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary hover:bg-primary/20 dark:hover:bg-primary/30'
                    : 'hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary dark:hover:text-primary'}`}
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
                  <SelectWithAddButton
                    entityType="accounts"
                    value={fromAccountId}
                    onValueChange={setFromAccountId}
                    placeholder="Origem"
                  >
                    {accountsWithBalance.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectWithAddButton>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Conta de Destino</Label>
                  <SelectWithAddButton
                    entityType="accounts"
                    value={toAccountId}
                    onValueChange={setToAccountId}
                    placeholder="Destino"
                  >
                    {accountsWithBalance.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectWithAddButton>
                </div>
              </div>
            ) : type === 'income' ? (
              /* Ganho: Conta + Categoria + Valor Total + Parcelas */
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Conta</Label>
                  <SelectWithAddButton
                    entityType="accounts"
                    value={accountId}
                    onValueChange={setAccountId}
                    placeholder="Conta"
                  >
                    {accountsWithBalance.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectWithAddButton>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Categoria</Label>
                  <SelectWithAddButton
                    entityType="categories"
                    value={categoryId}
                    onValueChange={setCategoryId}
                    placeholder="Categoria"
                  >
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectWithAddButton>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Valor</Label>
                  <NumericInput
                    currency
                    value={value}
                    onChange={setValue}
                    placeholder="0,00"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Parcelas</Label>
                  <NumericInput
                    value={installments}
                    onChange={(value) => setInstallments(value)}
                    placeholder="1"
                    min={1}
                    className="h-9"
                  />
                </div>
              </div>
            ) : (
              /* Gasto: Conta + Categoria + Valor (método de pagamento será tratado abaixo) */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Conta</Label>
                  <SelectWithAddButton
                    entityType="accounts"
                    value={accountId}
                    onValueChange={setAccountId}
                    placeholder="Conta"
                  >
                    {accountsWithBalance.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectWithAddButton>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Categoria</Label>
                  <SelectWithAddButton
                    entityType="categories"
                    value={categoryId}
                    onValueChange={setCategoryId}
                    placeholder="Categoria"
                  >
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectWithAddButton>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Valor</Label>
                  <NumericInput
                    currency
                    value={value}
                    onChange={setValue}
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
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Valor por Parcela:</span>
                  <span className="text-blue-900 dark:text-blue-100 font-semibold">
                    {formatCurrencyBRL(installmentValue)}
                  </span>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
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
                    <SelectWithAddButton
                      entityType="creditCards"
                      value={creditCardId || "none"}
                      onValueChange={(value) => setCreditCardId(value === "none" ? null : value)}
                      placeholder="Selecione"
                    >
                      <SelectItem value="none">Nenhum</SelectItem>
                      {creditCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                      ))}
                    </SelectWithAddButton>
                  </div>
                ) : null}
              </div>
            )}

            {/* Parcelas para Cartão de Crédito */}
            {type === 'expense' && paymentMethod === 'credit' && (
              <div className="space-y-1">
                <Label className="text-sm">Parcelas</Label>
                <NumericInput
                  value={installments}
                  onChange={(value) => setInstallments(value)}
                  placeholder="Ex: 12"
                  min={2}
                  className="h-9"
                />
              </div>
            )}

            {/* Informação do valor da parcela para gastos parcelados */}
            {type === 'expense' && paymentMethod === 'credit' && installments && installments > 1 && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-700 dark:text-red-300 font-medium">Valor por Parcela:</span>
                  <span className="text-red-900 dark:text-red-100 font-semibold">
                    {formatCurrencyBRL(installmentValue)}
                  </span>
                </div>
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {installments} parcelas de {formatCurrencyBRL(installmentValue)} = {formatCurrencyBRL(value)}
                </div>
              </div>
            )}

            {/* Campos Opcionais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Membro da Família</Label>
                <SelectWithAddButton
                  entityType="people"
                  value={personId || "none"}
                  onValueChange={(value) => setPersonId(value === "none" ? null : value)}
                  placeholder="Opcional"
                >
                  <SelectItem value="none">Nenhum</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectWithAddButton>
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Configurações</Label>
                <div className="flex items-center space-x-2 h-9">
                  <Switch checked={isFixed} onCheckedChange={setIsFixed} />
                  <Label className="text-sm">Transação Recorrente</Label>
                </div>
              </div>
            </div>

            {/* Escopo de Edição para Transações em Série */}
            {editingId && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-blue-900 dark:text-blue-100">Escopo de Edição</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="edit-current"
                        name="editScope"
                        value="current"
                        checked={editScope === 'current'}
                        onChange={(e) => setEditScope(e.target.value as 'current' | 'future')}
                        className="text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                      <Label htmlFor="edit-current" className="text-sm text-blue-800 dark:text-blue-200 cursor-pointer">
                        Apenas esta transação - Útil para adiar uma parcela específica ou alterar valor pontualmente
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="edit-future"
                        name="editScope"
                        value="future"
                        checked={editScope === 'future'}
                        onChange={(e) => setEditScope(e.target.value as 'current' | 'future')}
                        className="text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                      <Label htmlFor="edit-future" className="text-sm text-blue-800 dark:text-blue-200 cursor-pointer">
                        Esta e todas as futuras - Útil para mudar o valor da mensalidade que ainda será paga
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={onSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
