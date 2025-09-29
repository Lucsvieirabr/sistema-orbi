import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions"> & {
  accounts?: { name: string };
  categories?: { name: string };
  credit_cards?: { name: string };
  family_members?: { name: string };
};

interface MonthlyTransactionsData {
  transactions: Transaction[];
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

  const fetchTransactions = async (): Promise<Transaction[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        id, user_id, description, value, date, type, payment_method,
        installments, installment_number, is_fixed, account_id,
        credit_card_id, category_id, family_member_id, series_id, status, created_at,
        accounts(name),
        categories(name),
        credit_cards(name),
        family_members(name)
      `)
      .eq("user_id", user?.id ?? "")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  };

  const query = useQuery({
    queryKey: ["monthly-transactions", year, month],
    queryFn: fetchTransactions,
    staleTime: 30000, // 30 seconds
  });

  // Real-time subscription
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

  // Calculate indicators
  const indicators = useMemo((): MonthlyIndicators => {
    const transactions = query.data ?? [];

    const incomeReceived = transactions
      .filter(t => t.type === 'income' && t.status === 'PAID')
      .reduce((sum, t) => sum + t.value, 0);

    const expensesPaid = transactions
      .filter(t => t.type === 'expense' && t.status === 'PAID')
      .reduce((sum, t) => sum + t.value, 0);

    const incomePending = transactions
      .filter(t => t.type === 'income' && t.status === 'PENDING')
      .reduce((sum, t) => sum + t.value, 0);

    const expensesPending = transactions
      .filter(t => t.type === 'expense' && t.status === 'PENDING')
      .reduce((sum, t) => sum + t.value, 0);

    const netBalance = incomeReceived - expensesPaid;

    return {
      incomeReceived,
      expensesPaid,
      incomePending,
      expensesPending,
      netBalance,
    };
  }, [query.data]);

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
