import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectWithAddButton } from "@/components/ui/select-with-add-button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RecurringTransactionForm } from "@/components/ui/recurring-transaction-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonthlyTransactions } from "@/hooks/use-monthly-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useAccounts } from "@/hooks/use-accounts";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { usePeople } from "@/hooks/use-people";
// Removido: useDebts, useMarkDebtAsPaid - usando apenas transactions
import { supabase } from "@/integrations/supabase/client";
import { toast, useToast } from "@/hooks/use-toast";
import {
  formatCurrencyBRL,
  getCurrentDateString,
  formatDateForDisplay,
  roundCurrency,
  getMinAllowedDate,
  getMaxAllowedDate,
} from "@/lib/utils";
import { PendingTransactionsDialog } from "@/components/ui/pending-transactions-dialog";
import { InstallmentForm } from "@/components/ui/installment-form";
import { useInstallments } from "@/hooks/use-installments";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  CompositionDialog,
  CompositionItem,
} from "@/components/ui/composition-dialog";
import { CompositionViewDialog } from "@/components/ui/composition-view-dialog";
import { ExtratoUploader } from "@/components/extrato-uploader";

interface Installment {
  id: string;
  value: number;
  date: string;
  status: "PAID" | "PENDING";
  installment_number: number;
  isEdited?: boolean;
}
import {
  TrendingUp,
  TrendingDown,
  BanknoteXIcon,
  CheckCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Filter,
  Plus,
  CreditCard,
  User,
  Edit,
  Trash2,
  Receipt,
  DollarSign,
  AlertTriangle,
  Clock10Icon,
  BanknoteArrowDown,
  Info,
  Loader2,
  Upload,
} from "lucide-react";

export default function MonthlyStatement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<
    "all" | "income" | "expense" | "fixed" | "pending" | "paid"
  >("all");
  const [open, setOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [type, setType] = useState<"income" | "expense" | "transfer" | "fixed">(
    "income"
  );
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [value, setValue] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<string>(getCurrentDateString());
  const [isFixed, setIsFixed] = useState(false);
  const [frequency, setFrequency] = useState<
    "daily" | "weekly" | "monthly" | "yearly"
  >("monthly");
  const [endDate, setEndDate] = useState<string>("");
  const [fixedType, setFixedType] = useState<"income" | "expense">("expense"); // Tipo específico para transações fixas
  const [paymentMethod, setPaymentMethod] = useState<"debit" | "credit">(
    "debit"
  );
  const [creditCardId, setCreditCardId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [installments, setInstallments] = useState<number | null>(null);
  const [fromAccountId, setFromAccountId] = useState<string | undefined>(
    undefined
  );
  const [toAccountId, setToAccountId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"PAID" | "PENDING">("PAID");
  const [editScope, setEditScope] = useState<
    "current" | "future" | "individual"
  >("current");
  const [editCurrentTransaction, setEditCurrentTransaction] = useState(false);
  const [editFutureTransactions, setEditFutureTransactions] = useState(false);

  // Sincronizar toggles com editScope
  useEffect(() => {
    if (editScope === "current") {
      setEditCurrentTransaction(true);
      setEditFutureTransactions(false);
    } else if (editScope === "future") {
      setEditCurrentTransaction(true);
      setEditFutureTransactions(true);
    } else if (editScope === "individual") {
      setEditCurrentTransaction(false);
      setEditFutureTransactions(false);
    }
  }, [editScope]);

  // Sincronizar editScope com toggles
  const handleToggleChange = (current: boolean, future: boolean) => {
    setEditCurrentTransaction(current);
    setEditFutureTransactions(future);

    if (current && future) {
      setEditScope("future");
    } else if (current && !future) {
      setEditScope("current");
    } else if (!current && !future) {
      setEditScope("individual");
    }
  };
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [isTransactionSeries, setIsTransactionSeries] = useState(false);
  const [seriesTransactions, setSeriesTransactions] = useState<any[]>([]);
  const [isFixedSeries, setIsFixedSeries] = useState(false);

  // Estados para empréstimos e rateios
  const [isShared, setIsShared] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [isLoan, setIsLoan] = useState(false);
  const [isRateio, setIsRateio] = useState(false);
  const [peopleSearchTerm, setPeopleSearchTerm] = useState("");

  // Estados para rateio composto personalizado
  const [compositionDialogOpen, setCompositionDialogOpen] = useState(false);
  const [compositionItems, setCompositionItems] = useState<CompositionItem[]>(
    []
  );
  const [viewCompositionDialogOpen, setViewCompositionDialogOpen] =
    useState(false);
  const [viewCompositionItems, setViewCompositionItems] = useState<
    CompositionItem[]
  >([]);

  // Estados para os diálogos de contas pendentes
  const [showPendingIncomeDialog, setShowPendingIncomeDialog] = useState(false);
  const [showPendingExpenseDialog, setShowPendingExpenseDialog] =
    useState(false);

  // Estados para gerenciamento de parcelas
  const [showInstallmentForm, setShowInstallmentForm] = useState(false);
  const [installmentData, setInstallmentData] = useState<{
    installments: any[];
    totalValue: number;
  }>({ installments: [], totalValue: 0 });

  // Hooks
  const { categories } = useCategories();
  const { accountsWithBalance } = useAccounts();
  const { creditCards } = useCreditCards();
  const { people } = usePeople();

  // Pessoas filtradas para busca
  const filteredPeople = useMemo(() => {
    if (!peopleSearchTerm.trim()) return people;
    return people.filter((person) =>
      person.name.toLowerCase().includes(peopleSearchTerm.toLowerCase())
    );
  }, [people, peopleSearchTerm]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const monthlyData = useMonthlyTransactions(year, month);
  const {
    transactions,
    groupedTransactions,
    isLoading,
    error,
    refetch,
    indicators,
  } = monthlyData;

  const { toast } = useToast();
  const {
    createInstallmentSeries: createInstallmentSeriesMutation,
    updateInstallmentSeries: updateInstallmentSeriesMutation,
  } = useInstallments();

  // Calcular valor da parcela automaticamente
  const installmentValue = useMemo(() => {
    if (!value || !installments || installments <= 0) return 0;
    return roundCurrency(value / installments);
  }, [value, installments]);

  // Initialize default values
  useEffect(() => {
    setAccountId((prev) => prev ?? accountsWithBalance[0]?.id);
    setCategoryId((prev) => prev ?? categories[0]?.id);
    setFromAccountId((prev) => prev ?? accountsWithBalance[0]?.id);
    setToAccountId((prev) => prev ?? accountsWithBalance[1]?.id);
  }, [accountsWithBalance, categories]);

  const title = useMemo(
    () => (editingId ? "Editar Transação" : "Nova Transação"),
    [editingId]
  );

  useEffect(() => {
    if (search.get("new") === "1") {
      setOpen(true);
      setSearch((prev) => {
        prev.delete("new");
        return prev;
      });
    }

    const editParam = search.get("edit");
    if (editParam) {
      setEditingId(editParam);
      setOpen(true);
      setSearch((prev) => {
        prev.delete("edit");
        return prev;
      });
    }

    const personIdParam = search.get("personId");
    if (personIdParam) {
      setPersonId(personIdParam);
      setSearch((prev) => {
        prev.delete("personId");
        return prev;
      });
    }
  }, [search, setSearch]);

  // Load transaction data when editing
  useEffect(() => {
    if (editingId) {
      loadTransactionData(editingId);
    }
  }, [editingId]);

  // Estado para controlar se a manutenção está rodando
  const [isMaintenanceRunning, setIsMaintenanceRunning] = useState(false);

  // Manutenção automática de transações fixas
  useEffect(() => {
    const runMaintenance = async () => {
      // Evitar múltiplas execuções simultâneas
      if (isMaintenanceRunning) return;

      setIsMaintenanceRunning(true);

      try {
        // 1. Manutenção geral de séries fixas (para períodos futuros)
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: fixedSeries, error } = await supabase
          .from("series")
          .select("id")
          .eq("is_fixed", true)
          .eq("user_id", user.id);

        if (error || !fixedSeries) return;

        // Verificar cada série e adicionar transações futuras se necessário
        for (const series of fixedSeries) {
          await maintainFixedTransactionsForSeries(series.id);
        }

        // 2. Garantir que o período atual tenha todas as transações fixas necessárias
        await generateFixedTransactionsForPeriod(year, month);

        // Após manutenção, recarregar dados
        refetch();
      } catch (error) {
        console.error("Erro na manutenção automática:", error);
      } finally {
        setIsMaintenanceRunning(false);
      }
    };

    // Executar manutenção sempre que o mês/ano mudar
    runMaintenance();
  }, [year, month]); // Removido transactions.length para evitar loop infinito

  const loadTransactionData = async (transactionId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id, user_id, description, value, date, type, payment_method,
          account_id, credit_card_id, category_id, person_id, series_id, status, created_at,
          accounts(name),
          categories(name),
          credit_cards(name),
          people(name),
          series(total_installments, is_fixed)
        `
        )
        .eq("id", transactionId)
        .eq("user_id", user?.id ?? "")
        .single();

      if (error) throw error;

      if (data) {
        // Verificar se é uma transação em série
        const hasSeries = Boolean(
          data.series_id ||
            (data.series &&
              Array.isArray(data.series) &&
              data.series[0]?.total_installments > 1)
        );
        setIsTransactionSeries(hasSeries);

        // Se é uma série, carregar todas as transações da série
        if (hasSeries && Boolean(data.series_id)) {
          const { data: seriesData, error: seriesError } = await supabase
            .from("transactions")
            .select(
              `
              id, description, value, date, status, series_id, installment_number,
              accounts(name),
              categories(name),
              credit_cards(name)
            `
            )
            .eq("series_id", data.series_id)
            .eq("user_id", user?.id ?? "")
            .order("date");

          if (seriesError) {
          } else {
            setSeriesTransactions(seriesData || []);
            // Verificar se a série é fixa
            if (
              seriesData &&
              seriesData.length > 0 &&
              seriesData[0].series_id
            ) {
              const seriesId = seriesData[0].series_id;
              // Buscar informações da série
              const { data: seriesInfo } = await supabase
                .from("series")
                .select("is_fixed")
                .eq("id", seriesId)
                .single();

              setIsFixedSeries(seriesInfo?.is_fixed || false);
            } else {
              setIsFixedSeries(false);
            }
          }
        } else {
          setSeriesTransactions([]);
          setIsFixedSeries(false);
        }
        // Populate form with transaction data
        setType((data as any).type as "income" | "expense" | "transfer");
        // Para transações em série, o valor mostrado é da parcela individual
        // Para transações únicas, é o valor total
        setValue((data as any).value);
        setDescription((data as any).description);
        setDate((data as any).date.slice(0, 10));
        setIsFixed(
          Array.isArray((data as any).series)
            ? (data as any).series[0]?.is_fixed || false
            : (data as any).series?.is_fixed || false
        );
        setPersonId((data as any).person_id);
        setStatus((data as any).status as "PAID" | "PENDING");

        // Verificar se é transação fixa (is_fixed = true)
        const isFixedTransaction = (data as any).is_fixed === true;
        
        if (isFixedTransaction) {
          // Transação fixa: pode ser income ou expense, carregar tipo e método de pagamento
          setType("fixed");
          setFixedType((data as any).type as "income" | "expense");
          setAccountId((data as any).account_id);
          setCategoryId((data as any).category_id);
          setPaymentMethod((data as any).payment_method as "debit" | "credit");
          setCreditCardId((data as any).credit_card_id);
          setFromAccountId(undefined);
          setToAccountId(undefined);
          setInstallments(null);
          setIsFixed(true);
          // Carregar configurações da série se disponível
          if ((data as any).series && (data as any).series.length > 0) {
            const series = (data as any).series[0];
            setFrequency(series.frequency || "monthly");
            setEndDate(series.end_date || "");
          }
        } else if ((data as any).type === "income") {
          setAccountId((data as any).account_id);
          setCategoryId((data as any).category_id);
          setPaymentMethod("debit");
          setCreditCardId(null);
          setFromAccountId(undefined);
          setToAccountId(undefined);
          setInstallments(
            Array.isArray((data as any).series)
              ? (data as any).series[0]?.total_installments || null
              : (data as any).series?.total_installments || null
          );
        } else if ((data as any).type === "expense") {
          setAccountId((data as any).account_id);
          setCategoryId((data as any).category_id);
          setPaymentMethod((data as any).payment_method as "debit" | "credit");
          setCreditCardId((data as any).credit_card_id);
          setFromAccountId(undefined);
          setToAccountId(undefined);
          setInstallments(
            Array.isArray((data as any).series)
              ? (data as any).series[0]?.total_installments || null
              : (data as any).series?.total_installments || null
          );
        } else if ((data as any).type === "transfer") {
          // Para transferências, definir contas padrão já que os campos específicos não vêm na query
          setFromAccountId(accountsWithBalance[0]?.id);
          setToAccountId(accountsWithBalance[1]?.id);
          setPaymentMethod("debit");
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
        variant: "destructive",
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
    setDate(getCurrentDateString());
    setIsFixed(type === "fixed"); // Ativa automaticamente para tipo fixo
    setFixedType("expense"); // Define gasto como padrão para tipo fixo
    setFrequency("monthly");
    setEndDate("");
    setPaymentMethod("debit");
    setCreditCardId(null);
    setPersonId(null);
    setInstallments(null);
    setFromAccountId(accountsWithBalance[0]?.id);
    setToAccountId(accountsWithBalance[1]?.id);
    setStatus("PAID");
    setEditScope("current");
    setEditCurrentTransaction(false);
    setEditFutureTransactions(false);
    setIsTransactionSeries(false);
    setSeriesTransactions([]);
    setIsFixedSeries(false);
    setIsShared(false);
    setSelectedPeople([]);
    setIsLoan(false);
    setIsRateio(false);
    setPeopleSearchTerm("");
    setCompositionItems([]);
    // Reset installment data
    setInstallmentData({ installments: [], totalValue: 0 });
  };

  const handleDialogOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      // Limpar estado de edição quando dialog é fechado
      setEditingId(null);
      setCompositionDialogOpen(false); // Fechar dialog de composição se estiver aberto
      resetForm();
    }
  };

  // Reset campos específicos quando tipo muda
  const handleTypeChange = (
    newType: "income" | "expense" | "transfer" | "fixed"
  ) => {
    setType(newType);

    // Reset campos específicos baseado no tipo
    if (newType === "income") {
      // Ganho: limpa campos de pagamento, mantém parcelas
      setPaymentMethod("debit");
      setCreditCardId(null);
      setFromAccountId(undefined);
      setToAccountId(undefined);
      setIsShared(false);
      setSelectedPeople([]);
      setIsLoan(false);
      setIsRateio(false);
      // Parcelas ficam disponíveis para ganhos
    } else if (newType === "expense") {
      // Gasto: limpa campos de transferência
      setFromAccountId(undefined);
      setToAccountId(undefined);
      setIsShared(false);
      setSelectedPeople([]);
      setIsLoan(false);
      setIsRateio(false);
      // Parcelas serão controladas pelo método de pagamento
    } else if (newType === "transfer") {
      // Transferência: limpa campos de pagamento, categoria e parcelas
      setPaymentMethod("debit");
      setCreditCardId(null);
      setInstallments(null);
      setCategoryId(undefined);
      setIsShared(false);
      setSelectedPeople([]);
      setIsLoan(false);
      setIsRateio(false);
    } else if (newType === "fixed") {
      // Fixo: configura para transações recorrentes, limpa campos específicos
      setPaymentMethod("debit");
      setCreditCardId(null);
      setInstallments(null);
      setFromAccountId(undefined);
      setToAccountId(undefined);
      setIsShared(false);
      setSelectedPeople([]);
      setIsLoan(false);
      setIsRateio(false);
      setIsFixed(true); // Ativa automaticamente o modo recorrente
      setFrequency("monthly"); // Define frequência padrão
      setEndDate(""); // Limpa data final
    }
  };

  // Função para gerar parcelas automaticamente
  const generateInstallmentsAutomatically = (): Installment[] => {
    if (!value || !installments || installments <= 0) {
      toast({
        title: "Erro",
        description: "Valor e número de parcelas são obrigatórios",
        variant: "destructive",
      });
      return [];
    }

    const newInstallments: Installment[] = [];
    const startDateObj = new Date(date);

    // Calcular valor base para cada parcela
    const baseValue = value / installments;
    const roundedBaseValue = roundCurrency(baseValue);

    // Calcular a diferença total para ajustar a última parcela
    const totalDistributed = roundedBaseValue * installments;
    const difference = value - totalDistributed;

    for (let i = 0; i < installments; i++) {
      const installmentDate = new Date(startDateObj);
      installmentDate.setMonth(installmentDate.getMonth() + i);

      newInstallments.push({
        id: `installment-${i}`,
        value:
          i === installments - 1
            ? roundCurrency(roundedBaseValue + difference)
            : roundedBaseValue,
        date: installmentDate.toISOString().slice(0, 10),
        status: i === 0 ? "PAID" : "PENDING",
        installment_number: i + 1,
      });
    }

    setInstallmentData({
      installments: newInstallments,
      totalValue: value,
    });

    return newInstallments;
  };

  // Função para mostrar formulário de parcelas
  const showInstallmentFormHandler = () => {
    if (!value || !installments || installments <= 0) {
      toast({
        title: "Erro",
        description: "Valor e número de parcelas são obrigatórios",
        variant: "destructive",
      });
      return;
    }
    setShowInstallmentForm(true);
  };

  // Função para salvar parcelas (fechar dialog e mostrar resumo)
  const handleSaveInstallments = () => {
    if (installmentData.installments.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhuma parcela foi gerada",
        variant: "destructive",
      });
      return;
    }

    // Fechar dialog e voltar ao form principal
    setShowInstallmentForm(false);

    toast({
      title: "Sucesso",
      description: "Parcelas configuradas com sucesso",
      duration: 2000,
    });
  };

  // Função para salvar parcelas editadas individualmente
  const handleSaveEditedInstallments = async () => {
    if (!editingId || !seriesTransactions.length) {
      toast({
        title: "Erro",
        description: "Nenhuma série de parcelas para atualizar",
        variant: "destructive",
      });
      return;
    }

    try {
      // Usar os dados das parcelas que estão sendo editadas (seriesTransactions)
      // em vez de installmentData.installments que está vazio no modo de edição
      const installmentsData = seriesTransactions.map((transaction) => ({
        id: transaction.id,
        value: roundCurrency(transaction.value),
        date: transaction.date,
        status: transaction.status,
        installment_number: transaction.installment_number || 1,
      }));

      // Atualizar a série de parcelas
      await updateInstallmentSeriesMutation.mutateAsync({
        series_id: seriesTransactions[0].series_id,
        installments: installmentsData,
      });

      // Fechar ambos os diálogos
      setShowInstallmentForm(false);
      setOpen(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as alterações das parcelas",
        variant: "destructive",
      });
    }
  };

  const createSharedTransactions = async (userId: string, payload: any) => {
    try {
      if (
        payload.type === "expense" &&
        payload.isRateio &&
        payload.selectedPeople?.length > 0
      ) {
        // Modelo correto: 2 transações (gasto bruto + dívida pendente)
        const amountPerPerson = roundCurrency(
          payload.value / (payload.selectedPeople.length + 1)
        );

        // Preparar composition_details se houver itens
        const compositionDetailsJson =
          payload.compositionItems && payload.compositionItems.length > 0
            ? JSON.stringify(payload.compositionItems)
            : null;

        // 1. Inserir primeiro a transação de gasto bruto (R$ 200) com compensation_value e composition_details
        const { data: expenseTransaction, error: expenseError } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            type: "expense",
            value: payload.value, // Valor total
            description: `${payload.description} (Pagamento Total)`,
            date: payload.date,
            account_id: payload.account_id,
            category_id: payload.category_id,
            payment_method: "debit",
            credit_card_id: null,
            person_id: null,
            // is_fixed field moved to series table
            is_shared: true,
            compensation_value: amountPerPerson, // Valor que será compensado
            series_id: null, // Será definido após criar a segunda transação
            linked_txn_id: null, // Será definido após criar a segunda transação
            status: payload.status,
            composition_details: compositionDetailsJson, // Detalhes da composição
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        // 2. Inserir transações de dívida para cada pessoa selecionada
        const debtTransactions = [];
        const totalPeople = payload.selectedPeople.length + 1; // +1 para incluir o usuário

        // Preparar composition_details proporcional para cada parte
        let proportionalCompositionDetailsJson = null;
        if (payload.compositionItems && payload.compositionItems.length > 0) {
          const proportionalItems = payload.compositionItems.map(
            (item: CompositionItem) => ({
              value: roundCurrency(item.value / totalPeople), // Valor individual (dividido)
              totalValue: item.value, // Valor total do item
              description: item.description,
              date: item.date,
            })
          );
          proportionalCompositionDetailsJson =
            JSON.stringify(proportionalItems);
        }

        for (const personId of payload.selectedPeople) {
          // Buscar o nome da pessoa
          const { data: personData, error: personError } = await supabase
            .from("people")
            .select("name")
            .eq("id", personId)
            .single();

          if (personError) throw personError;

          const { data: debtTransaction, error: debtError } = await supabase
            .from("transactions")
            .insert({
              user_id: userId,
              type: "income",
              value: amountPerPerson, // Valor que cada pessoa deve
              description: `${payload.description} (Parte - ${personData.name})`,
              date: payload.date,
              account_id: payload.account_id,
              category_id: payload.category_id,
              payment_method: "debit",
              credit_card_id: null,
              person_id: personId, // Vincular à pessoa específica
              // is_fixed field moved to series table
              is_shared: true,
              compensation_value: 0, // Não há compensação nesta transação
              series_id: null, // Será definido após criar a primeira transação
              linked_txn_id: expenseTransaction.id, // Liga à transação de gasto
              status: "PENDING", // Começa como pendente
              composition_details: proportionalCompositionDetailsJson, // Detalhes proporcionais da composição
            })
            .select()
            .single();

          if (debtError) throw debtError;
          debtTransactions.push(debtTransaction);
        }

        // 3. Criar série e vincular transações
        const seriesId = crypto.randomUUID();

        // Criar registro na tabela series (sem composition_details)
        const { error: seriesError } = await supabase.from("series").insert({
          id: seriesId,
          user_id: userId,
          description: payload.description,
          total_value: payload.value,
          total_installments: 1,
          is_fixed: false,
          category_id: payload.category_id,
          frequency: "monthly",
          start_date: payload.date,
        });

        if (seriesError) throw seriesError;

        // Atualizar a transação de gasto com series_id
        await supabase
          .from("transactions")
          .update({
            series_id: seriesId,
          })
          .eq("id", expenseTransaction.id);

        // Atualizar todas as transações de dívida com o mesmo series_id
        for (const debtTransaction of debtTransactions) {
          await supabase
            .from("transactions")
            .update({
              series_id: seriesId,
            })
            .eq("id", debtTransaction.id);
        }

        toast({
          title: "Sucesso",
          description: `Rateio criado: gasto bruto + dívida pendente`,
          duration: 2000,
        });
      } else if (payload.isLoan && payload.person_id) {
        // Para empréstimo: criar gasto + conta a receber
        const seriesId = crypto.randomUUID();

        // 1. Criar gasto (expense) com o valor total
        const { data: expenseTransaction, error: expenseError } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            type: "expense",
            value: payload.value,
            description: `${payload.description} (Empréstimo)`,
            date: payload.date,
            account_id: payload.account_id,
            category_id: payload.category_id,
            payment_method: "debit",
            credit_card_id: null,
            person_id: null,
            // is_fixed field moved to series table
            is_shared: false,
            compensation_value: 0,
            series_id: seriesId,
            linked_txn_id: null,
            status: payload.status,
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        // 2. Criar conta a receber (income) para a pessoa
        const { data: incomeTransaction, error: incomeError } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            type: "income",
            value: payload.value,
            description: `${payload.description} (A receber de ${payload.person_name})`,
            date: payload.date,
            account_id: payload.account_id,
            category_id: payload.category_id,
            payment_method: "debit",
            credit_card_id: null,
            person_id: payload.person_id,
            // is_fixed field moved to series table
            is_shared: false,
            compensation_value: 0,
            series_id: seriesId,
            linked_txn_id: expenseTransaction.id,
            status: "PENDING",
          })
          .select()
          .single();

        if (incomeError) throw incomeError;

        toast({
          title: "Sucesso",
          description: "Empréstimo criado: gasto + conta a receber",
          duration: 2000,
        });
      }
    } catch (error) {
      throw error;
    }
  };

  const onSubmit = async () => {
    setIsSubmitting(true);
    const toastInstance = toast({
      title: "Salvando...",
      description: "Aguarde",
      duration: 2000,
    });
    try {
      // Validação básica
      if (!description.trim()) {
        toast({
          title: "Erro",
          description: "Descrição é obrigatória",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!value || value <= 0) {
        toast({
          title: "Erro",
          description: "Valor deve ser maior que zero",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Validação específica por tipo
      if (type === "fixed") {
        // Validar método de pagamento para transações fixas
        if (paymentMethod === "debit" && !accountId) {
          toast({
            title: "Erro",
            description: "Conta é obrigatória para transações fixas com débito",
            variant: "destructive",
          });
          return;
        }
        if (paymentMethod === "credit" && !creditCardId) {
          toast({
            title: "Erro",
            description: "Cartão de crédito é obrigatório para transações fixas com crédito",
            variant: "destructive",
          });
          return;
        }
        if (!categoryId) {
          toast({
            title: "Erro",
            description: "Categoria é obrigatória para transações fixas",
            variant: "destructive",
          });
          return;
        }
        // Validar que ganho fixo não pode ter cartão de crédito
        if (fixedType === "income" && paymentMethod === "credit") {
          toast({
            title: "Erro",
            description: "Transações fixas de ganho não podem usar cartão de crédito",
            variant: "destructive",
          });
          return;
        }
      }

      // Construir payload baseado no tipo de transação
      let payload: any = {
        type: type,
        value,
        description,
        date,
        person_id: personId,
        is_fixed: isFixed, // Campo is_fixed restaurado
        frequency: isFixed ? frequency : undefined, // Frequência para transações fixas
        endDate: isFixed ? endDate : undefined, // Data final para transações fixas
        is_shared: isShared,
        selectedPeople: selectedPeople, // Para rateios
        isLoan: isLoan, // Para empréstimos
        isRateio: isRateio, // Para rateios
        compositionItems: compositionItems, // Para rateio composto personalizado
        status: status, // Status da transação
      };

      if (type === "income") {
        // Ganho: conta + categoria obrigatórios, com parcelas opcionais
        // Se for parcelado, usar o valor da parcela; senão, usar o valor total
        const transactionValue =
          installments && installments > 1 ? installmentValue : value;

        payload = {
          ...payload,
          value: transactionValue,
          account_id: accountId,
          category_id: categoryId,
          payment_method: "debit",
          credit_card_id: null,
          installments: installments || 1, // Default 1 se não especificado
        };
      } else if (type === "expense") {
        // Gasto ou Rateio: depende do método de pagamento
        if (paymentMethod === "debit") {
          // Débito: conta obrigatória, sem cartão, sem parcelas
          payload = {
            ...payload,
            account_id: accountId,
            category_id: categoryId,
            payment_method: "debit",
            credit_card_id: null,
            installments: null,
          };
        } else {
          // Crédito: cartão obrigatório, sem conta, com parcelas
          // Se for parcelado, usar o valor da parcela; senão, usar o valor total
          const transactionValue =
            installments && installments > 1 ? installmentValue : value;

          payload = {
            ...payload,
            value: transactionValue,
            account_id: null,
            category_id: categoryId,
            payment_method: "credit",
            credit_card_id: creditCardId,
            installments: installments,
          };
        }
      } else if (type === "transfer") {
        // Transferência: contas origem/destino, sem categoria
        payload = {
          ...payload,
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          payment_method: "debit",
          credit_card_id: null,
          installments: null,
        };
      } else if (isLoan) {
        // Empréstimo: conta obrigatória, categoria obrigatória, valor total
        payload = {
          ...payload,
          account_id: accountId,
          category_id: categoryId,
          payment_method: "debit",
          credit_card_id: null,
          installments: null,
          compensation_value: 0,
        };
      } else if (isRateio) {
        // Rateio (gasto compartilhado): conta obrigatória, categoria obrigatória, valor total
        const compensationValue =
          selectedPeople.length > 0
            ? roundCurrency(value / (selectedPeople.length + 1)) // Parte que será compensada
            : 0;

        payload = {
          ...payload,
          account_id: accountId,
          category_id: categoryId,
          payment_method: "debit",
          credit_card_id: null,
          installments: null,
          compensation_value: compensationValue,
        };
      } else if (type === "fixed") {
        // Fixo (recorrente): conta ou cartão + categoria obrigatórios, sempre recorrente
        payload = {
          ...payload,
          type: fixedType, // Usa o tipo específico (income/expense) para transações fixas
          account_id: paymentMethod === "debit" ? accountId : null,
          category_id: categoryId,
          payment_method: paymentMethod,
          credit_card_id: paymentMethod === "credit" ? creditCardId : null,
          installments: null,
          is_fixed: true,
          frequency: frequency,
          endDate: endDate,
        };
      }

      if (editingId) {
        // Para transações em série, ajustar o payload
        if (isTransactionSeries) {
          // Para transações em série, o valor é sempre da parcela individual
          // Não recalcular installmentValue pois já é o valor correto da parcela
          payload.value = value;
        }

        // Implementar edição transacional
        await updateTransaction(editingId, payload);
      } else {
        // Criar nova transação usando o hook useMonthlyTransactions
        if (type === "fixed" || payload.is_fixed) {
          // Para transações fixas, usar sistema inteligente moderno
          await createSmartFixedTransaction(payload);
        } else if (payload.installments && payload.installments > 1) {
          // Para transações parceladas, verificar se já foram configuradas
          if (installmentData.installments.length > 0) {
            // Usar parcelas já configuradas
            await createInstallmentSeriesMutation.mutateAsync({
              description,
              type: type as "income" | "expense",
              account_id: accountId,
              category_id: categoryId,
              payment_method: paymentMethod,
              credit_card_id: creditCardId,
              person_id: personId,
              // is_fixed field moved to series table
              installments: installmentData.installments,
            });
          } else {
            // Gerar parcelas automaticamente se não foram configuradas
            const generatedInstallments = generateInstallmentsAutomatically();
            // Usar as parcelas geradas automaticamente
            await createInstallmentSeriesMutation.mutateAsync({
              description,
              type: type as "income" | "expense",
              account_id: accountId,
              category_id: categoryId,
              payment_method: paymentMethod,
              credit_card_id: creditCardId,
              person_id: personId,
              installments: generatedInstallments,
            });
          }
        } else {
          // Transação única
          const { data: user } = await supabase.auth.getUser();
          if (!user.user) throw new Error("Usuário não autenticado");

          // Se for empréstimo ou rateio, criar transações compartilhadas
          if (isLoan || (type === "expense" && isRateio)) {
            // Buscar nome da pessoa para empréstimo
            if (isLoan && personId) {
              const { data: personData } = await supabase
                .from("people")
                .select("name")
                .eq("id", personId)
                .single();
              payload.person_name = personData?.name || "Pessoa";
            }
            await createSharedTransactions(user.user.id, payload);
          } else {
            // Para outros tipos (income, expense normal), criar transação única
            const { error } = await supabase.from("transactions").insert({
              user_id: user.user.id,
              type: payload.type,
              account_id: payload.account_id,
              category_id: payload.category_id,
              value: payload.value,
              description: payload.description,
              date: payload.date,
              payment_method: payload.payment_method,
              credit_card_id: payload.credit_card_id,
              person_id: payload.person_id,
              is_shared: payload.is_shared,
              compensation_value: payload.compensation_value || 0,
              status: payload.status,
            });

            if (error) throw error;
            toast({
              title: "Sucesso",
              description: "Transação criada",
              duration: 2000,
            });
          }
        }
      }
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível salvar",
        duration: 3000,
        variant: "destructive" as any,
      });
    } finally {
      setIsSubmitting(false);
      setOpen(false);
      resetForm();
      queryClient.invalidateQueries({
        queryKey: ["monthly-transactions", year, month],
      });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    }
  };

  const updateTransaction = async (transactionId: string, newData: any) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Buscar dados atuais da transação
      const { data: currentTransaction, error: fetchError } = await supabase
        .from("transactions")
        .select(
          `
          *,
          series(total_installments, is_fixed)
        `
        )
        .eq("id", transactionId)
        .eq("user_id", user.id)
        .single();

      if (fetchError) throw fetchError;

      // 2. Aplicar regras de imutabilidade
      const immutableFields = {
        type: currentTransaction.type,
        payment_method: currentTransaction.payment_method,
        credit_card_id: currentTransaction.credit_card_id,
        status: currentTransaction.status,
        compensation_value: currentTransaction.compensation_value,
        series_id: currentTransaction.series_id,
        linked_txn_id: currentTransaction.linked_txn_id,
        installments: Array.isArray((currentTransaction as any).series)
          ? (currentTransaction as any).series[0]?.total_installments || null
          : (currentTransaction as any).series?.total_installments || null,
      };

      // 3. Verificar se campos imutáveis foram alterados
      const hasImmutableChanges = Object.entries(immutableFields).some(
        ([key, originalValue]) => {
          if (key === "type" && newData.type !== originalValue) {
            toast({
              title: "Erro",
              description: "Tipo de transação não pode ser alterado",
              variant: "destructive" as any,
            });
            return true;
          }
          if (
            key === "payment_method" &&
            newData.payment_method !== originalValue
          ) {
            toast({
              title: "Erro",
              description: "Método de pagamento não pode ser alterado",
              variant: "destructive" as any,
            });
            return true;
          }
          if (
            key === "credit_card_id" &&
            newData.credit_card_id !== originalValue
          ) {
            toast({
              title: "Erro",
              description: "Cartão de crédito não pode ser alterado",
              variant: "destructive" as any,
            });
            return true;
          }
          return false;
        }
      );

      if (hasImmutableChanges) return;

      // 4. Determinar se é uma transação em série
      const hasSeriesId = currentTransaction?.series_id;

      // 5. Se for uma transação em série, aplicar lógica de edição em lote
      if (hasSeriesId && editScope === "future") {
        // Editar esta transação e todas as futuras da mesma série
        await updateTransactionSeries(
          currentTransaction.series_id,
          currentTransaction.date,
          newData
        );
        return;
      }

      // 6. Detectar mudanças em campos críticos
      const criticalChanges = {
        value: newData.value !== currentTransaction.value,
        date: newData.date !== currentTransaction.date,
        account_id: newData.account_id !== currentTransaction.account_id,
      };

      // 7. Se há mudanças críticas, mostrar aviso
      if (Object.values(criticalChanges).some(Boolean)) {
        toast({
          title: "Atenção",
          description: "Campos críticos alterados - recalculando saldos",
          duration: 3000,
        });
      }

      // 8. Executar transação com campos imutáveis preservados
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          // Campos editáveis
          description: newData.description,
          category_id: newData.category_id,
          person_id: newData.person_id,

          // Campos críticos (com recálculo de saldo)
          value: newData.value,
          date: newData.date,
          account_id: newData.account_id,

          // Campos imutáveis preservados
          type: immutableFields.type,
          payment_method: immutableFields.payment_method,
          credit_card_id: immutableFields.credit_card_id,
          status: newData.status,
          compensation_value: immutableFields.compensation_value,
          series_id: immutableFields.series_id,
          linked_txn_id: immutableFields.linked_txn_id,
          // installments field removed - now managed by series table
        })
        .eq("id", transactionId);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso",
        description: "Transação atualizada com segurança",
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar",
        duration: 3000,
        variant: "destructive" as any,
      });
    }
  };

  const updateTransactionSeries = async (
    seriesId: string,
    fromDate: string,
    newData: any
  ) => {
    try {
      // Buscar todas as transações da série (não apenas futuras)
      const { data: allSeriesTransactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("series_id", seriesId)
        .order("date");

      if (error) throw error;

      if (!allSeriesTransactions || allSeriesTransactions.length === 0) {
        throw new Error("Nenhuma transação encontrada para esta série");
      }

      // Preparar dados das parcelas atualizadas
      const installmentsData = allSeriesTransactions.map(
        (transaction, index) => {
          // Se a transação é anterior à data de início da edição, manter dados originais
          if (transaction.date < fromDate) {
            return {
              value: transaction.value,
              date: transaction.date,
              status: transaction.status,
            };
          }

          // Para transações futuras (a partir da data de início), aplicar as mudanças
          return {
            value: newData.value,
            date: newData.date,
            status: transaction.status,
          };
        }
      );

      // Usar nossa função update_installment_series que recria todas as transações
      await updateInstallmentSeriesMutation.mutateAsync({
        series_id: seriesId,
        installments: installmentsData.map((installment, index) => ({
          id: allSeriesTransactions[index].id,
          value: installment.value,
          date: installment.date,
          status: installment.status as "PAID" | "PENDING",
          installment_number: index + 1,
        })),
      });

      toast({
        title: "Sucesso",
        description: `Série de parcelas atualizada com sucesso`,
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a série",
        duration: 3000,
        variant: "destructive" as any,
      });
    }
  };

  const createInstallmentSeries = async (payload: any) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
          series_id: seriesId,
          installment_number: i + 1, // Número da parcela (1, 2, 3, etc.)
          status: i === 0 ? "PAID" : "PENDING", // Primeira parcela como PAID, outras como PENDING
        });
      }

      // Inserir todas as transações
      const { error } = await supabase
        .from("transactions")
        .insert(transactionsToInsert);
      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `${payload.installments} parcelas criadas`,
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar as parcelas",
        duration: 3000,
        variant: "destructive" as any,
      });
    }
  };

  const createSmartFixedTransaction = async (payload: any) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Sistema inteligente: criar série de transações fixas que se auto-renova
      const seriesId = crypto.randomUUID();
      const startDate = new Date(payload.date);

      // Calcular data final se fornecida
      const endDateObj = payload.endDate ? new Date(payload.endDate) : null;

      // Buscar logo automaticamente se for uma assinatura (com cache local)
      let logoUrl: string | null = null;
      try {
        // Check if category is "Assinaturas"
        if (payload.category_id) {
          const { data: category } = await supabase
            .from("categories")
            .select("name")
            .eq("id", payload.category_id)
            .single();

          const isSubscription = category?.name?.toLowerCase().includes("assinatura");
          
          if (isSubscription) {
            // Search for company logo (with local caching)
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
              const logoResponse = await fetch(
                `${supabaseUrl}/functions/v1/get-company-logo`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ 
                    companyName: payload.description.toLowerCase().trim() 
                  }),
                }
              );
              
              if (logoResponse.ok) {
                const logoData = await logoResponse.json();
                logoUrl = logoData.logo_url || null;
                // logoData.source indica se veio do 'storage' ou 'api'
                console.log(`Logo obtained from: ${logoData.source}`);
              }
            }
          }
        }
      } catch (logoError) {
        // Logo search failed, but don't stop the transaction creation
        console.warn("Failed to fetch logo:", logoError);
      }

      // Criar registro na tabela series para controle inteligente
      const { error: seriesError } = await supabase.from("series").insert({
        id: seriesId,
        user_id: user.id,
        description: payload.description,
        total_value: payload.value,
        total_installments: 1, // Será atualizado conforme necessário
        is_fixed: true,
        category_id: payload.category_id,
        frequency: payload.frequency || "monthly",
        start_date: payload.date,
        end_date: payload.endDate || null,
        logo_url: logoUrl,
      });

      if (seriesError) throw seriesError;

      // Criar transação atual (primeira)
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: payload.type,
          account_id: payload.account_id,
          category_id: payload.category_id,
          value: payload.value,
          description: payload.description,
          date: payload.date,
          payment_method: payload.payment_method,
          credit_card_id: payload.credit_card_id,
          person_id: payload.person_id,
          series_id: seriesId,
          installment_number: 1, // Primeira parcela da série
          is_fixed: true,
          status: payload.status,
        });

      if (transactionError) throw transactionError;

      // Gerar próximas transações baseadas na frequência (sistema inteligente)
      const futureTransactions = [];
      const startDateObj = new Date(payload.date);

      // Gerar até 6 meses de transações futuras inicialmente
      const monthsToGenerate = 6;
      for (let i = 1; i <= monthsToGenerate; i++) {
        let futureDate = new Date(startDateObj);

        // Calcular próxima data baseada na frequência
        switch (payload.frequency || "monthly") {
          case "daily":
            futureDate.setDate(futureDate.getDate() + i);
            break;
          case "weekly":
            futureDate.setDate(futureDate.getDate() + i * 7);
            break;
          case "monthly":
            futureDate.setMonth(futureDate.getMonth() + i);
            break;
          case "yearly":
            futureDate.setFullYear(futureDate.getFullYear() + i);
            break;
          default:
            futureDate.setMonth(futureDate.getMonth() + i);
        }

        // Verificar se a data está dentro do limite (se houver)
        if (endDateObj && futureDate > endDateObj) {
          break;
        }

        const formattedDate = futureDate.toISOString().slice(0, 10);

        futureTransactions.push({
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
          series_id: seriesId,
          installment_number: i + 1, // Número da parcela (1, 2, 3, etc.)
          is_fixed: true,
          status: "PENDING",
        });
      }

      // Inserir transações futuras (apenas se houver)
      if (futureTransactions.length > 0) {
        const { error: futureError } = await supabase
          .from("transactions")
          .insert(futureTransactions);

        if (futureError) throw futureError;
      }

      // Atualizar série com total correto
      const { error: updateSeriesError } = await supabase
        .from("series")
        .update({
          total_installments: futureTransactions.length + 1, // 1 atual + futuras geradas
          total_value: payload.value * (futureTransactions.length + 1),
        })
        .eq("id", seriesId);

      if (updateSeriesError) throw updateSeriesError;

      toast({
        title: "Sucesso",
        description:
          "Transação fixa criada com sistema inteligente de renovação automática",
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a transação fixa",
        duration: 3000,
        variant: "destructive" as any,
      });
    }
  };

  // Função para manter transações fixas de uma série específica
  const maintainFixedTransactionsForSeries = async (
    seriesIdToCheck: string
  ) => {
    try {
      // Buscar informações da série
      const { data: seriesData, error: seriesError } = await supabase
        .from("series")
        .select("*")
        .eq("id", seriesIdToCheck)
        .eq("is_fixed", true)
        .single();

      if (seriesError || !seriesData) return;

      // Buscar a última transação da série
      const { data: lastTransactions, error: lastError } = await supabase
        .from("transactions")
        .select("*")
        .eq("series_id", seriesIdToCheck)
        .order("date", { ascending: false })
        .limit(1);

      if (lastError || !lastTransactions || lastTransactions.length === 0)
        return;

      const lastTransaction = lastTransactions[0];

      const currentDate = new Date();
      const lastTransactionDate = new Date(lastTransaction.date);
      const monthsSinceLast = Math.floor(
        (currentDate.getTime() - lastTransactionDate.getTime()) /
          (1000 * 60 * 60 * 24 * 30)
      );

      // Se passaram menos de 2 meses desde a última transação, não precisamos gerar mais
      if (monthsSinceLast < 2) return;

      // Gerar próximas transações conforme necessário
      const transactionsToAdd = [];
      let nextDate = new Date(lastTransactionDate);

      for (let i = 1; i <= 6; i++) {
        // Gerar até 6 meses à frente
        switch (seriesData.frequency) {
          case "daily":
            nextDate.setDate(nextDate.getDate() + 1);
            break;
          case "weekly":
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case "monthly":
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case "yearly":
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
          default:
            nextDate.setMonth(nextDate.getMonth() + 1);
        }

        // Verificar se a data está dentro do limite
        if (seriesData.end_date && nextDate > new Date(seriesData.end_date)) {
          break;
        }

        // Verificar se já existe transação para esta data
        const { data: existingTransaction } = await supabase
          .from("transactions")
          .select("id")
          .eq("series_id", seriesIdToCheck)
          .eq("date", nextDate.toISOString().slice(0, 10))
          .single();

        if (!existingTransaction) {
          transactionsToAdd.push({
            user_id: seriesData.user_id,
            type: lastTransaction.type,
            account_id: lastTransaction.account_id,
            category_id: lastTransaction.category_id,
            value: seriesData.total_value,
            description: lastTransaction.description,
            date: nextDate.toISOString().slice(0, 10),
            payment_method: lastTransaction.payment_method,
            credit_card_id: lastTransaction.credit_card_id,
            person_id: lastTransaction.person_id,
            series_id: seriesIdToCheck,
            installment_number: lastTransaction.installment_number + i,
            is_fixed: true,
            status: "PENDING",
          });
        }
      }

      // Inserir transações se houver alguma para adicionar
      if (transactionsToAdd.length > 0) {
        const { error: insertError } = await supabase
          .from("transactions")
          .insert(transactionsToAdd);

        if (insertError) {
          console.error("Erro ao inserir transações futuras:", insertError);
        } else {
          console.log(
            `Adicionadas ${transactionsToAdd.length} transações futuras para série ${seriesIdToCheck}`
          );
        }
      }
    } catch (error) {
      console.error("Erro na manutenção de transações fixas:", error);
    }
  };

  // Função para gerar transações fixas para um período específico (mês/ano)
  const generateFixedTransactionsForPeriod = async (
    targetYear: number,
    targetMonth: number
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar todas as séries fixas do usuário
      const { data: fixedSeries, error } = await supabase
        .from("series")
        .select("*")
        .eq("is_fixed", true)
        .eq("user_id", user.id);

      if (error || !fixedSeries) return;

      const transactionsToAdd = [];

      for (const series of fixedSeries) {
        // Calcular datas do período alvo
        const periodStart = new Date(targetYear, targetMonth - 1, 1);
        const periodEnd = new Date(targetYear, targetMonth, 0); // Último dia do mês

        // Buscar última transação da série
        const { data: lastTransactions } = await supabase
          .from("transactions")
          .select("*")
          .eq("series_id", series.id)
          .order("date", { ascending: false })
          .limit(1);

        let lastTransaction = null;
        let nextDate = null;

        if (lastTransactions && lastTransactions.length > 0) {
          lastTransaction = lastTransactions[0];
          nextDate = new Date(lastTransaction.date);
        } else {
          // Se não há transações ainda, usar a data de início da série
          nextDate = new Date(series.start_date);
        }

        // Gerar transações para o período alvo
        for (let i = 0; i < 12; i++) {
          // Até 12 meses à frente
          switch (series.frequency) {
            case "daily":
              nextDate.setDate(nextDate.getDate() + 1);
              break;
            case "weekly":
              nextDate.setDate(nextDate.getDate() + 7);
              break;
            case "monthly":
              nextDate.setMonth(nextDate.getMonth() + 1);
              break;
            case "yearly":
              nextDate.setFullYear(nextDate.getFullYear() + 1);
              break;
            default:
              nextDate.setMonth(nextDate.getMonth() + 1);
          }

          // Verificar se a data está no período alvo e dentro do limite da série
          if (nextDate >= periodStart && nextDate <= periodEnd) {
            if (series.end_date && nextDate > new Date(series.end_date)) {
              break;
            }

            // Verificar se já existe transação para esta data
            const { data: existingTransaction } = await supabase
              .from("transactions")
              .select("id")
              .eq("series_id", series.id)
              .eq("date", nextDate.toISOString().slice(0, 10))
              .single();

            if (!existingTransaction) {
              const installmentNumber = lastTransaction
                ? lastTransaction.installment_number + i + 1
                : i + 1;

              // Buscar a primeira transação da série para obter o valor e tipo corretos
              const { data: firstTransaction } = await supabase
                .from("transactions")
                .select("value, type")
                .eq("series_id", series.id)
                .order("installment_number", { ascending: true })
                .limit(1)
                .single();

              const correctValue =
                firstTransaction?.value || series.total_value;
              const correctType = firstTransaction?.type || "expense";

              transactionsToAdd.push({
                user_id: user.id,
                type: correctType, // Usar o tipo correto da primeira transação
                account_id: null, // Será definido quando a transação for editada
                category_id: series.category_id,
                value: correctValue, // Usar o valor correto da primeira transação
                description: series.description,
                date: nextDate.toISOString().slice(0, 10),
                payment_method: "debit",
                credit_card_id: null,
                person_id: null, // Será definido quando a transação for editada
                series_id: series.id,
                installment_number: installmentNumber,
                is_fixed: true,
                status: "PENDING",
              });
            }
          } else if (nextDate > periodEnd) {
            // Se passou do período alvo, para de gerar
            break;
          }
        }
      }

      // Inserir transações se houver alguma para adicionar
      if (transactionsToAdd.length > 0) {
        const { error: insertError } = await supabase
          .from("transactions")
          .insert(transactionsToAdd);

        if (insertError) {
          console.error("Erro ao inserir transações do período:", insertError);
        } else {
          console.log(
            `Adicionadas ${transactionsToAdd.length} transações para ${targetYear}/${targetMonth}`
          );
        }
      }
    } catch (error) {
      console.error("Erro na geração de transações do período:", error);
    }
  };

  // Filter transactions based on selected filter
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    switch (filterType) {
      case "income":
        filtered = transactions.filter((t) => t.type === "income");
        break;
      case "expense":
        filtered = transactions.filter((t) => t.type === "expense");
        break;
      case "fixed":
        filtered = transactions.filter((t) => t.type === "fixed");
        break;
      case "pending":
        filtered = transactions.filter((t) => t.status === "PENDING");
        break;
      case "paid":
        filtered = transactions.filter((t) => t.status === "PAID");
        break;
    }

    return filtered;
  }, [transactions, filterType]);

  // Group filtered transactions by date with simple ordering (same as Dashboard)
  const filteredGroupedTransactions = useMemo(() => {
    const grouped: Record<string, typeof filteredTransactions> = {};

    // Ordenar as transações filtradas por data (mais recente primeiro) - mesma lógica simples do Dashboard
    const sortedTransactions = [...filteredTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sortedTransactions.forEach((transaction) => {
      const date = transaction.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(transaction);
    });

    return grouped;
  }, [filteredTransactions]);

  const handleMonthChange = (
    direction: "prev" | "next",
    months: number = 1
  ) => {
    const newDate = new Date(currentDate);
    if (direction === "prev") {
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
    const toastInstance = toast({
      title: "Atualizando...",
      description: "Aguarde",
      duration: 2000,
    });
    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          status: "PAID",
          liquidation_date: new Date().toISOString(),
        })
        .eq("id", transactionId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Transação marcada como paga",
        duration: 2000,
      });
      refetch();
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível atualizar",
        duration: 3000,
        variant: "destructive" as any,
      });
    }
  };

  const markAsPending = async (transactionId: string) => {
    const toastInstance = toast({
      title: "Atualizando...",
      description: "Aguarde",
      duration: 2000,
    });
    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          status: "PENDING",
          liquidation_date: null,
        })
        .eq("id", transactionId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Status alterado para pendente",
        duration: 2000,
      });
      refetch();
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível atualizar",
        duration: 3000,
        variant: "destructive" as any,
      });
    }
  };

  const viewComposition = (compositionDetailsJson: string) => {
    try {
      if (compositionDetailsJson) {
        const items = JSON.parse(compositionDetailsJson) as CompositionItem[];
        setViewCompositionItems(items);
        setViewCompositionDialogOpen(true);
      } else {
        toast({
          title: "Informação",
          description: "Este rateio não possui detalhes de composição",
          duration: 2000,
        });
      }
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível carregar a composição",
        duration: 3000,
        variant: "destructive" as any,
      });
    }
  };

  const deleteTransaction = async (transactionId: string) => {
    const toastInstance = toast({
      title: "Excluindo...",
      description: "Aguarde",
      duration: 2000,
    });
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Transação excluída",
        duration: 2000,
      });
      refetch();
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível excluir",
        duration: 3000,
        variant: "destructive" as any,
      });
    }
  };

  const deleteTransactionSeries = async () => {
    if (!editingId) return;

    const toastInstance = toast({
      title: "Excluindo série...",
      description: "Aguarde",
      duration: 2000,
    });
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar a série atual da transação e verificar se é fixa
      const { data: currentTransaction, error: fetchError } = await supabase
        .from("transactions")
        .select("series_id, is_fixed, date")
        .eq("id", editingId)
        .eq("user_id", user.id)
        .single();

      if (fetchError) throw fetchError;
      if (!currentTransaction?.series_id)
        throw new Error("Transação não faz parte de uma série");

      // Se for transação fixa, remover series_id das transações passadas para mantê-las como histórico
      if (currentTransaction.is_fixed) {
        const currentDate = new Date(currentTransaction.date);
        
        // Atualizar transações passadas para remover series_id (torná-las independentes)
        await supabase
          .from("transactions")
          .update({ series_id: null })
          .eq("series_id", currentTransaction.series_id)
          .eq("user_id", user.id)
          .lt("date", currentDate.toISOString().slice(0, 10));

        // Excluir transações atuais e futuras (incluindo a data atual)
        const { error: deleteError } = await supabase
          .from("transactions")
          .delete()
          .eq("series_id", currentTransaction.series_id)
          .eq("user_id", user.id)
          .gte("date", currentDate.toISOString().slice(0, 10));

        if (deleteError) throw deleteError;

        // Excluir a série
        const { error: seriesError } = await supabase
          .from("series")
          .delete()
          .eq("id", currentTransaction.series_id)
          .eq("user_id", user.id);

        if (seriesError) throw seriesError;

        toast({
          title: "Sucesso",
          description: "Transação fixa excluída. Histórico mantido.",
          duration: 2000,
        });
      } else {
        // Para séries normais (parcelas), excluir todas as transações
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("series_id", currentTransaction.series_id)
          .eq("user_id", user.id);

        if (error) throw error;

        // Excluir a série
        await supabase
          .from("series")
          .delete()
          .eq("id", currentTransaction.series_id)
          .eq("user_id", user.id);

        toast({
          title: "Sucesso",
          description: "Série de transações excluída",
          duration: 2000,
        });
      }

      setOpen(false);
      resetForm();
      refetch();
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message || "Não foi possível excluir a série",
        duration: 3000,
        variant: "destructive" as any,
      });
    }
  };

  const getTransactionIcon = (transaction: any) => {
    if (transaction.type === "transfer") {
      return <ArrowUpCircle className="h-4 w-4 text-blue-500" />;
    }
    if (transaction.type === "fixed") {
      return <ArrowUpCircle className="h-4 w-4 text-blue-600" />;
    }
    return transaction.type === "income" ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  // Filtrar transações pendentes por tipo
  const pendingIncomeTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.type === "income" && t.status === "PENDING"
    );
  }, [transactions]);

  const pendingExpenseTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.type === "expense" && t.status === "PENDING"
    );
  }, [transactions]);

  // Verificar se há contas a pagar vencidas
  const overdueExpenseTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return pendingExpenseTransactions.filter((t) => new Date(t.date) < today);
  }, [pendingExpenseTransactions]);

  const getAccountName = (transaction: any) => {
    if (transaction.account_id && transaction.accounts?.name) {
      return transaction.accounts.name;
    }
    if (transaction.credit_card_id && transaction.credit_cards?.name) {
      return transaction.credit_cards.name;
    }
    return "N/A";
  };

  // Loading screen while fetching data
  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-40" />
            </div>
          </CardHeader>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header with month selector and filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMonthChange("prev")}
              >
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
                {currentDate.toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
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
                            {new Date(year, month).toLocaleDateString("pt-BR", {
                              month: "short",
                            })}
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
                            onClick={() =>
                              setMonthYear(year, currentDate.getMonth() + 1)
                            }
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
                onClick={() => handleMonthChange("next")}
              >
                Próximo
                <Calendar className="h-4 w-4 ml-2" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={filterType}
                onValueChange={(value: any) => setFilterType(value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="income">Apenas Ganhos</SelectItem>
                  <SelectItem value="expense">Apenas Gastos</SelectItem>
                  <SelectItem value="fixed">Apenas Fixas</SelectItem>
                  <SelectItem value="pending">Apenas Pendentes</SelectItem>
                  <SelectItem value="paid">Apenas Pagas</SelectItem>
                </SelectContent>
              </Select>
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
                <p className="text-sm text-muted-foreground">
                  Ganhos Recebidos
                </p>
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
                <p className="text-sm text-muted-foreground">
                  Contas a Receber
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrencyBRL(indicators.incomePending)}
                </p>
              </div>
              <Clock10Icon className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contas a Pagar</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrencyBRL(indicators.expensesPending)}
                </p>
              </div>
              <DollarSign className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo Líquido</p>
                <p
                  className={`text-2xl font-bold ${
                    indicators.netBalance >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrencyBRL(indicators.netBalance)}
                </p>
              </div>
              {indicators.netBalance >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Transactions Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowPendingIncomeDialog(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <Receipt className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Contas a Receber
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {pendingIncomeTransactions.length}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrencyBRL(
                    roundCurrency(
                      pendingIncomeTransactions.reduce(
                        (sum, t) => sum + t.value,
                        0
                      )
                    )
                  )}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {pendingIncomeTransactions.length > 0
                  ? `Clique e gerencie suas ${pendingIncomeTransactions.length} contas a receber pendentes`
                  : "Não há contas a receber pendentes"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:shadow-lg transition-shadow ${
            overdueExpenseTransactions.length > 0
              ? "ring-2 ring-red-200 dark:ring-red-800"
              : ""
          }`}
          onClick={() => setShowPendingExpenseDialog(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                    <DollarSign className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  {overdueExpenseTransactions.length > 0 && (
                    <div className="absolute -top-1 -right-1 p-1 bg-red-500 rounded-full">
                      <AlertTriangle className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Contas a Pagar
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {pendingExpenseTransactions.length}
                    {overdueExpenseTransactions.length > 0 && (
                      <span className="ml-2 text-sm font-normal text-red-500">
                        ({overdueExpenseTransactions.length} vencida
                        {overdueExpenseTransactions.length > 1 ? "s" : ""})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-lg font-semibold text-red-600">
                  {formatCurrencyBRL(
                    roundCurrency(
                      pendingExpenseTransactions.reduce(
                        (sum, t) => sum + t.value,
                        0
                      )
                    )
                  )}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {pendingExpenseTransactions.length > 0
                  ? `Clique e gerencie suas ${pendingExpenseTransactions.length} contas a pagar pendentes`
                  : "Não há contas a pagar pendentes"}
              </p>
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
                <div
                  key={i}
                  className="flex items-center justify-between p-4 border-b"
                >
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
              {Object.entries(filteredGroupedTransactions).map(
                ([date, dayTransactions]) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-muted-foreground">
                        {(() => {
                          const formattedDate = new Date(
                            date + "T12:00:00"
                          ).toLocaleDateString("pt-BR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          });
                          // Capitalizar primeira letra
                          return (
                            formattedDate.charAt(0).toUpperCase() +
                            formattedDate.slice(1)
                          );
                        })()}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {dayTransactions.map((transaction) => {
                        // Verificar se esta transação faz parte de um rateio
                        const isPartOfShared =
                          transaction.series_id && transaction.is_shared;
                        const isLinkedTransaction = transaction.linked_txn_id;
                        const isPendingIncome =
                          transaction.type === "income" &&
                          transaction.status === "PENDING";
                        const isPaidExpense =
                          transaction.type === "expense" &&
                          transaction.status === "PAID" &&
                          transaction.is_shared;

                        return (
                          <div
                            key={transaction.id}
                            className={`flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
                              transaction.status === "PAID" && isPendingIncome
                                ? "opacity-60"
                                : ""
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
                                  <span className="font-medium">
                                    {transaction.description}
                                  </span>
                                  {isPartOfShared && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs bg-purple-100 text-purple-800"
                                    >
                                      Rateio
                                    </Badge>
                                  )}
                                  {(transaction as any).is_fixed && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                    >
                                      Fixa
                                    </Badge>
                                  )}
                                  {isLinkedTransaction && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Ligada
                                    </Badge>
                                  )}
                                  {transaction.series_id &&
                                    transaction.installmentNumber &&
                                    transaction.totalInstallments &&
                                    transaction.totalInstallments > 1 &&
                                    !(transaction as any).is_fixed && (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {transaction.installmentNumber}/
                                        {transaction.totalInstallments}
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
                                        Minha parte:{" "}
                                        {formatCurrencyBRL(transaction.value)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div
                                  className={`font-semibold ${
                                    transaction.type === "income"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {transaction.type === "income" ? "+" : "-"}
                                  {formatCurrencyBRL(transaction.value)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {transaction.status === "PAID"
                                    ? (transaction.type === "income"
                                        ? "Recebido"
                                        : "Pago") +
                                      ((transaction as any).liquidation_date
                                        ? ` em ${new Date(
                                            (
                                              transaction as any
                                            ).liquidation_date
                                          ).toLocaleDateString("pt-BR")}`
                                        : "")
                                    : "Pendente"}
                                </div>
                              </div>

                              {transaction.status === "PENDING" ? (
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

                              {(transaction as any).composition_details && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    viewComposition(
                                      (transaction as any).composition_details
                                    )
                                  }
                                  className="text-white-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  title="Ver detalhes da composição"
                                >
                                  <Info className="h-4 w-4" />
                                </Button>
                              )}
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
                              <ConfirmationDialog
                                title="Confirmar Exclusão"
                                description="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
                                confirmText="Excluir"
                                onConfirm={() =>
                                  deleteTransaction(transaction.id)
                                }
                                variant="destructive"
                              >
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </ConfirmationDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Creation Modal */}
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Tipo de Transação - IMUTÁVEL em edição */}
            <div className="space-y-2">
              {editingId ? (
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant={type === "income" ? "default" : "outline"}
                      disabled
                      className="flex items-center gap-2 flex-1"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                      Ganho
                    </Button>
                    <Button
                      type="button"
                      variant={type === "expense" ? "default" : "outline"}
                      disabled
                      className="flex items-center gap-2 flex-1"
                    >
                      <ArrowDownCircle className="h-4 w-4" />
                      Gasto
                    </Button>
                    <Button
                      type="button"
                      variant={type === "transfer" ? "default" : "outline"}
                      disabled
                      className="flex items-center gap-2 flex-1"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                      Transferência
                    </Button>
                    <Button
                      type="button"
                      variant={
                        type === "fixed" || (editingId && isFixed)
                          ? "default"
                          : "outline"
                      }
                      disabled
                      className={`flex items-center gap-2 flex-1 ${
                        type === "fixed" || (editingId && isFixed)
                          ? "border-blue-500/50 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30"
                          : "hover:border-blue-500/30 hover:bg-blue-500/5 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
                      }`}
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                      {isFixed ? "Fixa" : "Fixo"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleTypeChange("income")}
                    className={`flex items-center gap-2 flex-1 ${
                      type === "income"
                        ? "border-primary/50 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary hover:bg-primary/20 dark:hover:bg-primary/30"
                        : "hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary dark:hover:text-primary"
                    }`}
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Ganho
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleTypeChange("expense")}
                    className={`flex items-center gap-2 flex-1 ${
                      type === "expense"
                        ? "border-destructive/50 bg-destructive/10 dark:bg-destructive/20 text-destructive dark:text-destructive hover:bg-destructive/20 dark:hover:bg-destructive/30"
                        : "hover:border-destructive/30 hover:bg-destructive/5 dark:hover:bg-destructive/10 hover:text-destructive dark:hover:text-destructive"
                    }`}
                  >
                    <ArrowDownCircle className="h-4 w-4" />
                    Gasto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleTypeChange("transfer")}
                    className={`flex items-center gap-2 flex-1 ${
                      type === "transfer"
                        ? "border-primary/50 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary hover:bg-primary/20 dark:hover:bg-primary/30"
                        : "hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary dark:hover:text-primary"
                    }`}
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Transferência
                  </Button>
                  <Button
                    type="button"
                    variant={type === "fixed" ? "default" : "outline"}
                    onClick={() => handleTypeChange("fixed")}
                    className={`flex items-center gap-2 flex-1 ${
                      type === "fixed"
                        ? "border-blue-500/50 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30"
                        : "hover:border-blue-500/30 hover:bg-blue-500/5 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
                    }`}
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Fixo
                  </Button>
                </div>
              )}
            </div>
            {/* Campos Opcionais - exceto para tipo fixed que tem sua própria estrutura */}
            {type !== "transfer" && type !== "fixed" && (
              <div className="space-y-4">
                {/* Tipo de Operação para Gastos */}
                {type === "expense" && (
                  <div className="space-y-2">
                    {editingId ? (
                      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={
                              !isLoan && !isRateio ? "default" : "outline"
                            }
                            disabled
                            className="flex-1 h-9 text-xs"
                          >
                            Gasto Normal
                          </Button>
                          <Button
                            type="button"
                            variant={
                              isLoan && !isRateio ? "default" : "outline"
                            }
                            disabled
                            className="flex-1 h-9 text-xs"
                          >
                            Empréstimo
                          </Button>
                          <Button
                            type="button"
                            variant={
                              !isLoan && isRateio ? "default" : "outline"
                            }
                            disabled
                            className="flex-1 h-9 text-xs"
                          >
                            Rateio
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={!isLoan && !isRateio ? "default" : "outline"}
                          onClick={() => {
                            setIsLoan(false);
                            setIsRateio(false);
                            setIsFixed(false);
                          }}
                          className={`flex-1 h-9 text-xs ${
                            !isLoan && !isRateio
                              ? "border-2 border-destructive bg-destructive/10 dark:bg-destructive/20 text-destructive dark:text-destructive hover:bg-destructive/20 dark:hover:bg-destructive/30"
                              : "hover:border-destructive/30 hover:bg-destructive/5 dark:hover:bg-destructive/10 hover:text-destructive dark:hover:text-destructive"
                          }`}
                        >
                          Gasto Normal
                        </Button>
                        <Button
                          type="button"
                          variant={isLoan && !isRateio ? "default" : "outline"}
                          onClick={() => {
                            setIsLoan(true);
                            setIsRateio(false);
                            setIsFixed(false);
                          }}
                          className={`flex-1 h-9 text-xs ${
                            isLoan && !isRateio
                              ? "border-2 border-purple-500 bg-purple-100/50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100/70 dark:hover:bg-purple-900/30"
                              : "hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 hover:text-purple-600 dark:hover:text-purple-400"
                          }`}
                        >
                          Empréstimo
                        </Button>
                        <Button
                          type="button"
                          variant={!isLoan && isRateio ? "default" : "outline"}
                          onClick={() => {
                            setIsLoan(false);
                            setIsRateio(true);
                            setIsFixed(false);
                          }}
                          className={`flex-1 h-9 text-xs ${
                            !isLoan && isRateio
                              ? "border-2 border-primary bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary hover:bg-primary/20 dark:hover:bg-primary/30"
                              : "hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary dark:hover:text-primary"
                          }`}
                        >
                          Rateio
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Campo de Descrição */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Descrição</Label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: Salário, Aluguel, etc..."
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Data</Label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      min={getMinAllowedDate()}
                      max={getMaxAllowedDate()}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Campos principais com lógica de visibilidade dinâmica */}
            {type === "transfer" ? (
              /* Transferência: Conta Origem + Conta Destino */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Conta de Origem</Label>
                  <SelectWithAddButton
                    entityType="accounts"
                    value={fromAccountId}
                    onValueChange={setFromAccountId}
                    placeholder="Origem"
                  >
                    {accountsWithBalance.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
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
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectWithAddButton>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Data</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={getMinAllowedDate()}
                    max={getMaxAllowedDate()}
                    className="h-9"
                  />
                </div>
              </div>
            ) : type === "income" ? (
              /* Ganho: Conta + Categoria + Valor */
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
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
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
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
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
            ) : type === "expense" ? (
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
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
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
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
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
            ) : type === "fixed" ? (
              /* Fixo: Campos organizados conforme especificação */
              <div className="space-y-4">

                {/* Primeira linha: Método de Pagamento (apenas para gastos fixos) */}
                {fixedType === "expense" && (
                  <div className="space-y-1">
                    <Label className="text-sm">Método de Pagamento</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={paymentMethod === "debit" ? "default" : "outline"}
                        onClick={() => {
                          setPaymentMethod("debit");
                          setCreditCardId(null);
                        }}
                        className="flex-1 h-9 text-xs"
                      >
                        Débito/Dinheiro
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === "credit" ? "default" : "outline"}
                        onClick={() => {
                          setPaymentMethod("credit");
                          setAccountId(undefined);
                        }}
                        className="flex-1 h-9 text-xs flex items-center gap-1"
                      >
                        <CreditCard className="h-3 w-3" />
                        Cartão de Crédito
                      </Button>
                    </div>
                  </div>
                )}
                {/* Segunda linha: Conta ou Cartão (dependendo do método), Categoria, Valor */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Mostrar Conta apenas se método de pagamento for débito */}
                  {paymentMethod === "debit" && (
                    <div className="space-y-1">
                      <Label className="text-sm">Conta</Label>
                      <SelectWithAddButton
                        entityType="accounts"
                        value={accountId}
                        onValueChange={setAccountId}
                        placeholder="Conta"
                      >
                        {accountsWithBalance.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectWithAddButton>
                    </div>
                  )}
                  {/* Mostrar Cartão apenas se método de pagamento for crédito */}
                  {paymentMethod === "credit" && (
                    <div className="space-y-1">
                      <Label className="text-sm">Cartão de Crédito</Label>
                      <SelectWithAddButton
                        entityType="creditCards"
                        value={creditCardId || "none"}
                        onValueChange={(value) =>
                          setCreditCardId(value === "none" ? null : value)
                        }
                        placeholder="Selecione"
                      >
                        <SelectItem value="none">Nenhum</SelectItem>
                        {creditCards.map((card) => (
                          <SelectItem key={card.id} value={card.id}>
                            {card.name}
                          </SelectItem>
                        ))}
                      </SelectWithAddButton>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-sm">Categoria</Label>
                    <SelectWithAddButton
                      entityType="categories"
                      value={categoryId}
                      onValueChange={setCategoryId}
                      placeholder="Categoria"
                    >
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
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

                {/* Terceira linha: Descrição, Pessoa, Frequência */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Descrição</Label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: Salário, Aluguel, etc..."
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Pessoa</Label>
                    <SelectWithAddButton
                      entityType="people"
                      value={personId || "none"}
                      onValueChange={(value) =>
                        setPersonId(value === "none" ? null : value)
                      }
                      placeholder="Opcional"
                    >
                      <SelectItem value="none">Nenhum</SelectItem>
                      {people.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectWithAddButton>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Frequência</Label>
                    <Select
                      value={frequency}
                      onValueChange={(value: "weekly" | "monthly" | "yearly") =>
                        setFrequency(value)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Quarta linha: Data, Data Final */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Data</Label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      min={getMinAllowedDate()}
                      max={getMaxAllowedDate()}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Data Final (opcional)</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      placeholder="Sem limite"
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Quinta linha: Tipo de Transação e Configurações */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Toggle para tipo de transação fixa (ganho/gasto) */}
                  <div className="space-y-3">
                    <Label className="text-sm">Tipo de Transação</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={fixedType === "income" ? "default" : "outline"}
                        onClick={() => {
                          setFixedType("income");
                          // Se for ganho, forçar método débito e limpar cartão
                          setPaymentMethod("debit");
                          setCreditCardId(null);
                        }}
                        className={`flex items-center gap-2 flex-1 h-9 ${
                          fixedType === "income"
                            ? "border-green-500/50 bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400"
                            : "hover:border-green-500/30 hover:bg-green-500/5 dark:hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400"
                        }`}
                      >
                        <ArrowUpCircle className="h-4 w-4 text-green-500" />
                        Ganho
                      </Button>
                      <Button
                        type="button"
                        variant={
                          fixedType === "expense" ? "default" : "outline"
                        }
                        onClick={() => setFixedType("expense")}
                        className={`flex items-center gap-2 flex-1 h-9 ${
                          fixedType === "expense"
                            ? "border-red-500/50 bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400"
                            : "hover:border-red-500/30 hover:bg-red-500/5 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                        }`}
                      >
                        <ArrowDownCircle className="h-4 w-4 text-red-500" />
                        Gasto
                      </Button>
                    </div>
                  </div>

                  {/* Configurações */}
                  <div className="space-y-3">
                    <Label className="text-sm">Configurações</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={status === "PAID"}
                        onCheckedChange={(checked) =>
                          setStatus(checked ? "PAID" : "PENDING")
                        }
                      />
                      <Label className="text-sm">Paga</Label>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Método de Pagamento (apenas para gastos) */}
            {type === "expense" && (
              <div className="space-y-1">
                <Label className="text-sm">Método de Pagamento</Label>
                {editingId ? (
                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex gap-2 mt-3">
                      <Button
                        type="button"
                        variant={
                          paymentMethod === "debit" ? "default" : "outline"
                        }
                        disabled
                        className="flex-1 h-9 text-xs opacity-60"
                      >
                        Débito/Dinheiro
                      </Button>
                      <Button
                        type="button"
                        variant={
                          paymentMethod === "credit" ? "default" : "outline"
                        }
                        disabled
                        className="flex-1 h-9 text-xs flex items-center gap-1 opacity-60"
                      >
                        <CreditCard className="h-3 w-3" />
                        Cartão de Crédito
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={
                        paymentMethod === "debit" ? "default" : "outline"
                      }
                      onClick={() => {
                        setPaymentMethod("debit");
                        setCreditCardId(null);
                        setInstallments(null);
                      }}
                      className="flex-1 h-9 text-xs"
                    >
                      Débito/Dinheiro
                    </Button>
                    <Button
                      type="button"
                      variant={
                        paymentMethod === "credit" ? "default" : "outline"
                      }
                      onClick={() => {
                        setPaymentMethod("credit");
                        setAccountId(undefined);
                      }}
                      className="flex-1 h-9 text-xs flex items-center gap-1"
                    >
                      <CreditCard className="h-3 w-3" />
                      Cartão de Crédito
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Cartão de Crédito e Parcelas (quando selecionado) */}
            {type === "expense" && paymentMethod === "credit" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Cartão de Crédito</Label>
                  <SelectWithAddButton
                    entityType="creditCards"
                    value={creditCardId || "none"}
                    onValueChange={(value) =>
                      setCreditCardId(value === "none" ? null : value)
                    }
                    placeholder="Selecione"
                  >
                    <SelectItem value="none">Nenhum</SelectItem>
                    {creditCards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.name}
                      </SelectItem>
                    ))}
                  </SelectWithAddButton>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm">Parcelas</Label>
                  <NumericInput
                    value={installments}
                    onChange={(value) => setInstallments(value)}
                    placeholder="Ex: 12"
                    min={2}
                    integer={true}
                    currency={false}
                    className="h-9"
                  />
                </div>
              </div>
            )}

            {/* Informação do valor da parcela para gastos parcelados - APENAS no modo de criação */}
            {!editingId &&
              type === "expense" &&
              paymentMethod === "credit" &&
              installments &&
              installments > 1 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  {installmentData.installments.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-red-700 dark:text-red-300 font-medium">
                          Parcelas Configuradas:
                        </span>
                        <span className="text-red-900 dark:text-red-100 font-semibold">
                          {installmentData.installments.length} parcelas
                        </span>
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-400 mb-2">
                        <div>
                          Valor Total:{" "}
                          {formatCurrencyBRL(installmentData.totalValue)}
                        </div>
                        <div className="flex justify-between mt-1">
                          <span>
                            Pagas:{" "}
                            {
                              installmentData.installments.filter(
                                (i) => i.status === "PAID"
                              ).length
                            }
                          </span>
                          <span>
                            Pendentes:{" "}
                            {
                              installmentData.installments.filter(
                                (i) => i.status === "PENDING"
                              ).length
                            }
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-red-700 dark:text-red-300 font-medium">
                          Valor por Parcela:
                        </span>
                        <span className="text-red-900 dark:text-red-100 font-semibold">
                          {formatCurrencyBRL(installmentValue)}
                        </span>
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-400 mb-3">
                        {installments} parcelas de{" "}
                        {formatCurrencyBRL(installmentValue)} ={" "}
                        {formatCurrencyBRL(value)}
                      </div>
                    </>
                  )}
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={showInstallmentFormHandler}
                      className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                    >
                      <Edit className="h-4 w-4" />
                      {installmentData.installments.length > 0
                        ? "Editar Parcelas"
                        : "Gerar Série de Parcelas Personalizada"}
                    </Button>
                  </div>
                </div>
              )}

            {/* Seleção de Pessoas para Rateio */}
            {type === "expense" && isRateio && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm">
                    Pessoas Envolvidas no Rateio
                  </Label>
                  <Input
                    placeholder="Buscar pessoa por nome..."
                    className="h-9"
                    value={peopleSearchTerm}
                    onChange={(e) => setPeopleSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {filteredPeople.map((person) => (
                    <Button
                      key={person.id}
                      type="button"
                      variant={
                        selectedPeople.includes(person.id)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        setSelectedPeople((prev) =>
                          prev.includes(person.id)
                            ? prev.filter((id) => id !== person.id)
                            : [...prev, person.id]
                        );
                      }}
                      className={`h-8 ${
                        selectedPeople.includes(person.id)
                          ? "bg-purple-100 text-purple-800 border-2 border-purple-300 hover:bg-purple-200"
                          : "border-2 border-gray-300 hover:bg-transparent"
                      }`}
                    >
                      {person.name}
                    </Button>
                  ))}
                </div>
                {selectedPeople.length > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mt-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-purple-700 dark:text-purple-300 font-medium">
                            {selectedPeople.length} pessoa
                            {selectedPeople.length !== 1 ? "s" : ""}
                          </span>
                          <span className="text-purple-600 dark:text-purple-400">
                            selecionada{selectedPeople.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-purple-700 dark:text-purple-300 font-medium">
                          Valor por pessoa
                        </div>
                        <div className="text-purple-900 dark:text-purple-100 font-semibold">
                          {formatCurrencyBRL(
                            roundCurrency(value / (selectedPeople.length + 1))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botão para Personalizar Rateio */}
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCompositionDialogOpen(true)}
                    className="w-full border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Personalizar Rateio
                    {compositionItems.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {compositionItems.length}{" "}
                        {compositionItems.length === 1 ? "item" : "itens"}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Campo de Pessoa e Configurações - exceto para tipo fixed */}
            {type !== "transfer" && type !== "fixed" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Campo de Pessoa - Oculto para Rateio */}
                {!isRateio && (
                  <div className="space-y-1">
                    <Label className="text-sm">Pessoa</Label>
                    <SelectWithAddButton
                      entityType="people"
                      value={personId || "none"}
                      onValueChange={(value) =>
                        setPersonId(value === "none" ? null : value)
                      }
                      placeholder="Opcional"
                    >
                      <SelectItem value="none">Nenhum</SelectItem>
                      {people.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectWithAddButton>
                  </div>
                )}

                {/* Configurações */}
                <div className="space-y-3">
                  <Label className="text-sm">Configurações</Label>
                  <div className="flex items-center justify-start space-x-6 py-2 pl-0">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={status === "PAID"}
                        onCheckedChange={(checked) =>
                          setStatus(checked ? "PAID" : "PENDING")
                        }
                      />
                      <Label className="text-sm">
                        {type === "income" ? "Recebido" : "Paga"}
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Escopo de Edição para Transações em Série - Estilo do Sistema */}
            {editingId && isTransactionSeries && (
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="space-y-4">
                  {/* Header com título e badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Edit className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {isFixedSeries
                            ? "Edição geral"
                            : "Edição de Parcelas"}
                        </h3>
                        {!isFixedSeries && (
                          <p className="text-xs text-muted-foreground">
                            {seriesTransactions.length} parcelas nesta série
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botão de exclusão */}
                    <ConfirmationDialog
                      title={`Confirmar Exclusão ${
                        isFixedSeries ? "da Transação Fixa" : "de Parcelas"
                      }`}
                      description={`Tem certeza que deseja excluir ${
                        isFixedSeries
                          ? "esta transação fixa"
                          : "todas as parcelas desta série"
                      }? Esta ação não pode ser desfeita.`}
                      confirmText={
                        isFixedSeries
                          ? "Excluir transação fixa"
                          : "Excluir todas"
                      }
                      onConfirm={deleteTransactionSeries}
                      variant="destructive"
                    >
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 px-3 text-xs"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />

                        {isFixedSeries
                          ? "Excluir transação fixa"
                          : "Excluir todas as parcelas"}
                      </Button>
                    </ConfirmationDialog>
                  </div>

                  {/* Opções de edição */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Opção 1: Editar transação atual */}
                    <div
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        editScope === "current"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setEditScope("current");
                        handleToggleChange(true, false);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            editScope === "current"
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {editScope === "current" && (
                            <div className="w-full h-full rounded-full bg-primary-foreground scale-50"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-foreground">
                            Apenas esta transação
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isFixedSeries
                              ? "Editar apenas esta transação."
                              : "Editar apenas a parcela selecionada"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Opção 2: Editar transação atual + futuras */}
                    <div
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        editScope === "future"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setEditScope("future");
                        handleToggleChange(true, true);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            editScope === "future"
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {editScope === "future" && (
                            <div className="w-full h-full rounded-full bg-primary-foreground scale-50"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-foreground">
                            Esta e futuras
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isFixedSeries
                              ? "Aplicar mudanças em futuras"
                              : "Aplicar mudanças às parcelas restantes"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Opção 3: Edição individual - apenas para séries não fixas */}
                  {!isFixedSeries && (
                    <div
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        editScope === "individual"
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-accent/50"
                      }`}
                      onClick={() => {
                        setEditScope("individual");
                        handleToggleChange(false, false);
                        setShowInstallmentForm(true);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 ${
                            editScope === "individual"
                              ? "border-accent bg-accent"
                              : "border-muted-foreground"
                          }`}
                        >
                          {editScope === "individual" && (
                            <div className="w-full h-full rounded-full bg-accent-foreground scale-50"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-foreground">
                              Edição Individual
                            </h4>
                            <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                              Avançado
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Editar cada parcela separadamente com valores e
                            datas personalizados
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Abrir
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {editingId && (
              <ConfirmationDialog
                title="Confirmar Exclusão"
                description="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
                confirmText="Excluir"
                onConfirm={() => {
                  deleteTransaction(editingId);
                  setOpen(false);
                  resetForm();
                }}
                variant="destructive"
              >
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </ConfirmationDialog>
            )}
            <Button onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Composition Dialog */}
      <CompositionDialog
        open={compositionDialogOpen}
        onOpenChange={setCompositionDialogOpen}
        onSave={(items, total) => {
          setCompositionItems(items);
          setValue(total);
        }}
        initialItems={compositionItems}
      />

      {/* Composition View Dialog */}
      <CompositionViewDialog
        open={viewCompositionDialogOpen}
        onOpenChange={setViewCompositionDialogOpen}
        items={viewCompositionItems}
      />

      {/* Pending Transactions Dialogs */}
      <PendingTransactionsDialog
        transactions={pendingIncomeTransactions}
        title="Contas a Receber"
        type="income"
        onMarkAsPaid={markAsPaid}
        onMarkAsPending={markAsPending}
        onEdit={(id) => {
          setEditingId(id);
          setOpen(true);
        }}
        onDelete={deleteTransaction}
        isOpen={showPendingIncomeDialog}
        onOpenChange={setShowPendingIncomeDialog}
        trigger={<div />}
      />

      <PendingTransactionsDialog
        transactions={pendingExpenseTransactions}
        title="Contas a Pagar"
        type="expense"
        onMarkAsPaid={markAsPaid}
        onMarkAsPending={markAsPending}
        onEdit={(id) => {
          setEditingId(id);
          setOpen(true);
        }}
        onDelete={deleteTransaction}
        isOpen={showPendingExpenseDialog}
        onOpenChange={setShowPendingExpenseDialog}
        trigger={<div />}
      />

      {/* Import Dialog */}
      <ExtratoUploader
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onTransactionsImported={() => {
          queryClient.invalidateQueries({ queryKey: ["monthly-transactions", year, month] });
          queryClient.invalidateQueries({ queryKey: ["balances"] });
          toast({
            title: "Sucesso!",
            description: "Transações importadas e categorizadas com IA.",
          });
        }}
      />

      {/* Floating Button for Import */}
      <button
        aria-label="Importar Extrato"
        onClick={() => setImportDialogOpen(true)}
        className="fixed bottom-6 right-20 h-12 w-12 rounded-lg bg-transparent border-2 border-dashed border-green-400 text-green-400 shadow-lg hover:bg-green-400/10 hover:border-green-300 hover:text-green-300 flex items-center justify-center text-lg font-semibold transition-all duration-300 z-50"
      >
        <Upload className="h-4 w-4" />
      </button>

      {/* Floating Button for New Transaction */}
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogTrigger asChild>
          <button
            aria-label="Nova Transação"
            className="fixed bottom-6 right-6 h-12 w-12 rounded-lg bg-transparent border-2 border-dashed border-blue-400 text-blue-400 shadow-lg hover:bg-blue-400/10 hover:border-blue-300 hover:text-blue-300 flex items-center justify-center text-lg font-semibold transition-all duration-300 z-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </DialogTrigger>
      </Dialog>

      {/* Modal para gerenciar parcelas */}
      <Dialog open={showInstallmentForm} onOpenChange={setShowInstallmentForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? "Editar Parcelas Individualmente"
                : "Gerenciar Parcelas"}
            </DialogTitle>
          </DialogHeader>

          <InstallmentForm
            totalValue={
              editingId
                ? roundCurrency(
                    seriesTransactions.reduce((sum, t) => sum + t.value, 0)
                  )
                : installmentData.totalValue > 0
                ? installmentData.totalValue
                : value
            }
            installments={
              editingId ? seriesTransactions.length : installments || 1
            }
            startDate={editingId ? seriesTransactions[0]?.date || date : date}
            description={description}
            initialInstallments={
              editingId
                ? seriesTransactions.map((t) => ({
                    id: t.id,
                    value: t.value,
                    date: t.date,
                    status: t.status as "PAID" | "PENDING",
                    installment_number: t.installment_number || 1,
                    isEdited: false,
                  }))
                : installmentData.installments
            }
            onInstallmentsChange={(installments) => {
              if (editingId) {
                // Converter installments para o formato de seriesTransactions
                const updatedTransactions = installments.map(
                  (installment, index) => {
                    const originalTransaction = seriesTransactions[index];
                    return {
                      ...originalTransaction,
                      value: installment.value,
                      date: installment.date,
                      status: installment.status,
                      installment_number: installment.installment_number, // Use from backend
                    };
                  }
                );
                setSeriesTransactions(updatedTransactions);
              } else {
                setInstallmentData((prev) => ({ ...prev, installments }));
              }
            }}
            onTotalValueChange={(totalValue) => {
              if (editingId) {
                // Para transações em série, não alterar o valor individual da parcela
                // O valor total será recalculado automaticamente
                // setValue(totalValue); // Comentado para evitar confusão
              } else {
                setInstallmentData((prev) => ({ ...prev, totalValue }));
              }
            }}
            onInstallmentsCountChange={(count) => {
              if (!editingId) {
                setInstallments(count);
              }
            }}
            allowTotalValueEdit={editingId ? true : false}
            onTotalValueEdit={(newTotalValue) => {
              if (editingId) {
                // Atualizar o valor total da série no sistema
                // Isso pode ser usado para recalcular o valor total baseado nas parcelas editadas
              }
            }}
            disabled={
              editingId ? false : createInstallmentSeriesMutation.isPending
            }
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInstallmentForm(false)}
            >
              Fechar
            </Button>
            {editingId && (
              <Button
                onClick={handleSaveEditedInstallments}
                disabled={updateInstallmentSeriesMutation.isPending}
              >
                {updateInstallmentSeriesMutation.isPending
                  ? "Salvando..."
                  : "Salvar"}
              </Button>
            )}
            {!editingId && (
              <Button
                onClick={handleSaveInstallments}
                disabled={
                  createInstallmentSeriesMutation.isPending ||
                  installmentData.installments.length === 0
                }
              >
                {createInstallmentSeriesMutation.isPending
                  ? "Salvando..."
                  : "Salvar Parcelas"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
