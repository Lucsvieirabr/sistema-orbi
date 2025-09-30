import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions"> & {
  accounts?: { name: string };
  categories?: { name: string };
  credit_cards?: { name: string };
  people?: { name: string };
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

    // Fetch transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from("transactions")
      .select(`
        id, user_id, description, value, date, type, payment_method,
        installments, installment_number, is_fixed, account_id,
        credit_card_id, category_id, person_id, series_id, status, created_at, compensation_value,
        accounts(name),
        categories(name),
        credit_cards(name),
        people(name)
      `)
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (transactionsError) throw transactionsError;

    // Return transactions only (no debts table anymore)
    return transactions ?? [];
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

    console.log('=== DEBUG INDICADORES ===');
    console.log('Total de transações:', transactions.length);

    // Ganhos recebidos: apenas transações de income com status PAID que NÃO são reembolsos
    // Reembolsos são identificados pela descrição que contém "Parte" ou "A receber"
    const incomeReceived = transactions
      .filter(t => t.type === 'income' && t.status === 'PAID' && 
                   !t.description.includes('Parte') && 
                   !t.description.includes('A receber'))
      .reduce((sum, t) => sum + t.value, 0);

    // Debug: mostrar detalhes das transações de income
    const allIncomeTransactions = transactions.filter(t => t.type === 'income' && t.status === 'PAID');
    console.log('Todas as transações de income PAID:', allIncomeTransactions.length);
    allIncomeTransactions.forEach(t => {
      console.log(`- ${t.description}: linked_txn_id = ${t.linked_txn_id}, value = ${t.value}`);
    });
    
    console.log('Ganhos recebidos (income PAID sem linked_txn_id):', incomeReceived);

    // Gastos pagos: transações de expense com status PAID, usando valor líquido (valor - compensação)
    const expensesPaid = transactions
      .filter(t => t.type === 'expense' && t.status === 'PAID')
      .reduce((sum, t) => {
        // Se há compensation_value, é uma transação compartilhada (mesmo que is_shared seja undefined)
        const netValue = (t.compensation_value && t.compensation_value > 0) 
          ? (t.value - t.compensation_value) 
          : t.value;
        console.log(`Gasto: ${t.description}, Valor bruto: ${t.value}, Compensação: ${t.compensation_value || 0}, Valor líquido: ${netValue}`);
        return sum + netValue;
      }, 0);

    console.log('Gastos pagos (expense PAID - líquido):', expensesPaid);

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

    console.log('Saldo líquido calculado:', netBalance);
    console.log('========================');

    return {
      incomeReceived,
      expensesPaid,
      incomePending,
      expensesPending,
      netBalance,
    };
  }, [query.data, startDate, endDate]);

  // Group transactions by day
  const groupedTransactions = useMemo(() => {
    if (!query.data) return {};

    const grouped: Record<string, Transaction[]> = {};

    query.data.forEach(transaction => {
      const date = transaction.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(transaction);
    });

    // Sort transactions within each day by creation time (newest first)
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });

    return grouped;
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

// Hook para manutenção automática de transações fixas
export function useTransactionMaintenance() {
  const maintainFixedTransactions = async () => {
    try {
      const { data, error } = await supabase.rpc('maintain_fixed_transaction_series');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro na manutenção de transações fixas:', error);
      throw error;
    }
  };

  return { maintainFixedTransactions };
}
