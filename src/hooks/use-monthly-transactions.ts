import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions"> & {
  accounts?: { name: string };
  categories?: { name: string };
  credit_cards?: { name: string };
  people?: { name: string };
  series?: { total_installments: number; is_fixed: boolean } | { total_installments: number; is_fixed: boolean }[];
  installmentNumber?: number | null;
  totalInstallments?: number | null;
};

interface MonthlyTransactionsData {
  transactions: Transaction[];
  groupedTransactions: Record<string, Transaction[]>;
  isLoading: boolean;
  error: any;
  refetch: () => void;
}

interface MonthlyIndicators {
  incomeReceived: number;
  expensesPaid: number;
  incomePending: number;
  expensesPending: number;
  netBalance: number;
}

export function useMonthlyTransactions(year: number, month: number): MonthlyTransactionsData & { indicators: MonthlyIndicators } {
  const queryClient = useQueryClient();

  // Calculate month range
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10); // Last day of month

  const fetchTransactionsAndDebts = async (): Promise<Transaction[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    // Fetch transactions with liquidation_date
    const { data: transactions, error: transactionsError } = await supabase
      .from("transactions")
      .select(`
        id, user_id, description, value, date, type, payment_method,
        account_id, credit_card_id, category_id, person_id, series_id, status, created_at, 
        updated_at, liquidation_date, compensation_value, installment_number, is_fixed, composition_details,
        accounts(name),
        categories(name),
        credit_cards(name),
        people(name),
        series(total_installments, is_fixed)
      `)
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate);

    if (transactionsError) throw transactionsError;

    // Aplicar ordenação simplificada: liquidation_date vs created_at
    const sortedTransactions = (transactions ?? []).sort((a, b) => {
      // Para cada transação, usar liquidation_date se paga, senão created_at
      const getEffectiveDate = (transaction: Transaction) => {
        if (transaction.status === 'PAID' && transaction.liquidation_date) {
          return transaction.liquidation_date;
        }
        return transaction.created_at;
      };
      
      const aEffectiveDate = getEffectiveDate(a);
      const bEffectiveDate = getEffectiveDate(b);
      
      // Ordenar por data efetiva mais recente (mais recente primeiro)
      return new Date(bEffectiveDate).getTime() - new Date(aEffectiveDate).getTime();
    });

    // Usar installment_number do backend em vez de calcular
    const transactionsWithInstallmentNumber = sortedTransactions.map(transaction => {
      if (transaction.series_id) {
        const totalInstallments = Array.isArray(transaction.series) 
          ? transaction.series[0]?.total_installments 
          : transaction.series?.total_installments;
        
        return {
          ...transaction,
          installmentNumber: transaction.installment_number,
          totalInstallments: totalInstallments || 0
        };
      }
      
      return {
        ...transaction,
        installmentNumber: null,
        totalInstallments: null
      };
    });

    return transactionsWithInstallmentNumber;
  };

  const query = useQuery({
    queryKey: ["monthly-transactions", year, month],
    queryFn: fetchTransactionsAndDebts,
    staleTime: 30000, // 30 seconds
  });

  // Real-time subscription for transactions only
  useEffect(() => {
    const channel = supabase
      .channel("monthly-transactions-changes")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "transactions",
        filter: `date=gte.${startDate},date=lte.${endDate}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["monthly-transactions", year, month] });
        queryClient.invalidateQueries({ queryKey: ["balances"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, year, month, startDate, endDate]);


  // Calculate indicators based on transactions only
  const indicators = useMemo((): MonthlyIndicators => {
    const transactions = query.data ?? [];


    // Ganhos recebidos: apenas transações de income com status PAID que NÃO são reembolsos
    // Reembolsos são identificados pela descrição que contém "Parte" ou "A receber"
    const incomeReceived = transactions
      .filter(t => t.type === 'income' && t.status === 'PAID' && 
                   !t.description.includes('Parte') && 
                   !t.description.includes('A receber'))
      .reduce((sum, t) => sum + t.value, 0);


    // Gastos pagos: transações de expense com status PAID, usando valor líquido (valor - compensação)
    const expensesPaid = transactions
      .filter(t => t.type === 'expense' && t.status === 'PAID')
      .reduce((sum, t) => {
        // Se há compensation_value, é uma transação compartilhada (mesmo que is_shared seja undefined)
        const netValue = (t.compensation_value && t.compensation_value > 0) 
          ? (t.value - t.compensation_value) 
          : t.value;
        return sum + netValue;
      }, 0);


    // Contas a receber: transações de income com status PENDING
    const incomePending = transactions
      .filter(t => t.type === 'income' && t.status === 'PENDING')
      .reduce((sum, t) => sum + t.value, 0);

    // Contas a pagar: transações de expense com status PENDING
    const expensesPending = transactions
      .filter(t => t.type === 'expense' && t.status === 'PENDING')
      .reduce((sum, t) => {
        // Se há compensation_value, é uma transação compartilhada (mesmo que is_shared seja undefined)
        const netValue = (t.compensation_value && t.compensation_value > 0) 
          ? (t.value - t.compensation_value) 
          : t.value;
        return sum + netValue;
      }, 0);

    // Saldo líquido: ganhos recebidos - gastos pagos (líquidos)
    const netBalance = incomeReceived - expensesPaid;


    return {
      incomeReceived,
      expensesPaid,
      incomePending,
      expensesPending,
      netBalance,
    };
  }, [query.data, startDate, endDate]);

  // Group transactions by day (mantendo a ordenação inteligente)
  const groupedTransactions = useMemo(() => {
    if (!query.data) return {};

    const grouped: Record<string, Transaction[]> = {};

    // As transações já vêm ordenadas pela lógica inteligente
    query.data.forEach(transaction => {
      const date = transaction.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(transaction);
    });

    // Ordenar as datas para exibição (mais recente primeiro)
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const sortedGrouped: Record<string, Transaction[]> = {};
    sortedDates.forEach(date => {
      sortedGrouped[date] = grouped[date];
    });

    return sortedGrouped;
  }, [query.data]);

  return {
    transactions: query.data ?? [],
    groupedTransactions,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    indicators,
  };
}

