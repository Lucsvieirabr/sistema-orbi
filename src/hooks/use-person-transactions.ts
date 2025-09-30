import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions"> & {
  accounts?: { name: string };
  categories?: { name: string };
  credit_cards?: { name: string };
  people?: { name: string };
};

interface PersonTransactionsData {
  transactions: Transaction[];
  indicators: {
    totalAReceber: number;
    totalAPagar: number;
    saldoLiquido: number;
  };
  isLoading: boolean;
  error: any;
  refetch: () => void;
}

export function usePersonTransactions(personId: string): PersonTransactionsData {
  const queryClient = useQueryClient();

  const fetchPersonTransactions = async (): Promise<Transaction[]> => {
    if (!personId) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from("transactions")
      .select(`
        id, user_id, description, value, date, type, payment_method,
        installments, installment_number, is_fixed, account_id,
        credit_card_id, category_id, person_id, series_id, status, created_at, compensation_value,
        linked_txn_id,
        accounts(name),
        categories(name),
        credit_cards(name),
        people(name)
      `)
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  };

  const query = useQuery({
    queryKey: ["person-transactions", personId],
    queryFn: fetchPersonTransactions,
    enabled: !!personId,
    staleTime: 30000, // 30 seconds
  });

  // Calculate indicators based on transactions
  const indicators = useMemo(() => {
    const transactions = query.data ?? [];

    const totalAReceber = transactions
      .filter(t => t.type === 'income' && t.status === 'PENDING')
      .reduce((sum, t) => sum + t.value, 0);

    const totalAPagar = transactions
      .filter(t => t.type === 'expense' && t.status === 'PENDING')
      .reduce((sum, t) => sum + t.value, 0);

    const saldoLiquido = totalAReceber - totalAPagar;

    return {
      totalAReceber,
      totalAPagar,
      saldoLiquido,
    };
  }, [query.data]);

  return {
    transactions: query.data ?? [],
    indicators,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Hook para atualizar o status de uma transação
export function useUpdateTransactionStatus() {
  const queryClient = useQueryClient();

  const updateTransactionStatus = async (transactionId: string, newStatus: string) => {
    const { error } = await supabase
      .from("transactions")
      .update({ status: newStatus })
      .eq("id", transactionId);

    if (error) throw error;

    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ["person-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  return { updateTransactionStatus };
}

// Hook para criar uma nova transação de pagamento
export function useCreatePaymentTransaction() {
  const queryClient = useQueryClient();

  const createPaymentTransaction = async (debtTransactionId: string, paymentValue: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    // Primeiro, buscar a transação de dívida original
    const { data: debtTransaction, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", debtTransactionId)
      .single();

    if (fetchError) throw fetchError;
    if (!debtTransaction) throw new Error("Transação de dívida não encontrada");

    // Criar nova transação de pagamento (expense - PAID)
    const { error: createError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        description: `Pagamento de dívida: ${debtTransaction.description}`,
        value: paymentValue,
        date: new Date().toISOString().split('T')[0],
        type: 'expense',
        status: 'PAID',
        person_id: debtTransaction.person_id,
        category_id: debtTransaction.category_id,
        account_id: debtTransaction.account_id,
        payment_method: 'debit_card', // ou outro método padrão
      });

    if (createError) throw createError;

    // Atualizar status da dívida original para PAID
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ status: 'PAID' })
      .eq("id", debtTransactionId);

    if (updateError) throw updateError;

    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ["person-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  return { createPaymentTransaction };
}
