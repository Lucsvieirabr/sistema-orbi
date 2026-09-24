import { getCachedAuthUser } from "@/hooks/use-current-user";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fromDateKey, toDateKey } from "@/lib/utils";

type Transaction = Tables<"transactions"> & {
  accounts?: { name: string };
  categories?: { name: string };
  credit_cards?: { name: string };
  people?: { name: string };
};

/** Acerto em aberto de um evento de Rateio (ledger) entre o titular e esta pessoa. */
export interface PersonLedgerDebt {
  ledgerId: string;
  ledgerName: string;
  /** > 0 = a pessoa deve ao titular (a receber); < 0 = o titular deve à pessoa (a pagar). */
  amount: number;
}

interface PersonTransactionsData {
  transactions: Transaction[];
  ledgerDebts: PersonLedgerDebt[];
  indicators: {
    totalAReceber: number;
    totalAPagar: number;
    saldoLiquido: number;
    totalRecebido: number;
    totalPago: number;
  };
  isLoading: boolean;
  error: any;
  refetch: () => void;
}

export function usePersonTransactions(personId: string, month?: number, year?: number): PersonTransactionsData {
  const queryClient = useQueryClient();

  const fetchPersonTransactions = async (): Promise<Transaction[]> => {
    if (!personId) return [];

    const { data: { user } } = await getCachedAuthUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from("transactions")
      .select(`
        id, user_id, description, value, date, type, payment_method,
        account_id, credit_card_id, category_id, person_id, series_id, status, created_at, compensation_value,
        linked_txn_id, installment_number, composition_details,
        accounts(name),
        categories(name),
        credit_cards(name),
        people(name),
        series(total_installments, is_fixed)
      `)
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  };

  // Eventos de Rateio não geram `transactions.person_id`: a dívida vem das
  // transferências de `orbi_ledger_summary` entre o titular ('owner') e a pessoa.
  // Só eventos abertos do próprio titular — liquidado = acerto quitado.
  const fetchLedgerDebts = async (): Promise<PersonLedgerDebt[]> => {
    if (!personId) return [];
    const { data: { user } } = await getCachedAuthUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from("ledger_participants")
      .select("ledger_id, ledgers!inner(id, name, status, user_id)")
      .eq("person_id", personId)
      .eq("ledgers.user_id", user.id)
      .eq("ledgers.status", "open");
    if (error) throw error;

    const ledgers = (data ?? []).map((row: any) => row.ledgers).filter(Boolean);
    const results = await Promise.allSettled(
      ledgers.map((ledger: any) => supabase.rpc("orbi_ledger_summary", { p_ledger_id: ledger.id })),
    );

    const debts: PersonLedgerDebt[] = [];
    results.forEach((result, index) => {
      // Sem a feature (plano Free) a RPC recusa: o evento só não entra no extrato.
      if (result.status !== "fulfilled" || result.value.error) return;
      const transfers: any[] = (result.value.data as any)?.transfers ?? [];
      const amount = transfers.reduce((sum, t) => {
        if (t.from_key === personId && t.to_key === "owner") return sum + Number(t.amount || 0);
        if (t.from_key === "owner" && t.to_key === personId) return sum - Number(t.amount || 0);
        return sum;
      }, 0);
      const rounded = Math.round(amount * 100) / 100;
      if (Math.abs(rounded) >= 0.01) {
        debts.push({ ledgerId: ledgers[index].id, ledgerName: ledgers[index].name, amount: rounded });
      }
    });
    return debts;
  };

  const ledgerQuery = useQuery({
    queryKey: ["person-transactions", personId, "ledgers"],
    queryFn: fetchLedgerDebts,
    enabled: !!personId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const query = useQuery({
    queryKey: ["person-transactions", personId, month, year],
    queryFn: fetchPersonTransactions,
    enabled: !!personId,
    staleTime: 0, // Sempre considerar dados como desatualizados
    refetchOnMount: 'always', // Sempre atualizar quando o componente for montado
    refetchOnWindowFocus: true, // Atualizar quando a janela receber foco
  });

  // Calculate indicators based on transactions with period filter
  const indicators = useMemo(() => {
    let transactions = query.data ?? [];

    // Apply period filter if month and year are provided
    if (month !== undefined && year !== undefined) {
      transactions = transactions.filter(t => {
        const transactionDate = fromDateKey(t.date);
        return transactionDate.getMonth() === month && transactionDate.getFullYear() === year;
      });
    }

    const totalAReceber = transactions
      .filter(t => t.type === 'income' && t.status === 'PENDING')
      .reduce((sum, t) => sum + t.value, 0);

    const totalAPagar = transactions
      .filter(t => t.type === 'expense' && t.status === 'PENDING')
      .reduce((sum, t) => sum + t.value, 0);

    const totalRecebido = transactions
      .filter(t => t.type === 'income' && t.status === 'PAID')
      .reduce((sum, t) => sum + t.value, 0);

    const totalPago = transactions
      .filter(t => t.type === 'expense' && t.status === 'PAID')
      .reduce((sum, t) => sum + t.value, 0);

    // Acertos de eventos em aberto não têm mês: são pendências vigentes e
    // entram em qualquer período até o evento ser liquidado.
    const ledgerDebts = ledgerQuery.data ?? [];
    const ledgerAReceber = ledgerDebts.filter(d => d.amount > 0).reduce((sum, d) => sum + d.amount, 0);
    const ledgerAPagar = ledgerDebts.filter(d => d.amount < 0).reduce((sum, d) => sum - d.amount, 0);

    const saldoLiquido = (totalAReceber + ledgerAReceber) - (totalAPagar + ledgerAPagar);

    return {
      totalAReceber: totalAReceber + ledgerAReceber,
      totalAPagar: totalAPagar + ledgerAPagar,
      saldoLiquido,
      totalRecebido,
      totalPago,
    };
  }, [query.data, ledgerQuery.data, month, year]);

  // Filter transactions for display based on period
  const filteredTransactions = useMemo(() => {
    let transactions = query.data ?? [];

    if (month !== undefined && year !== undefined) {
      transactions = transactions.filter(t => {
        const transactionDate = fromDateKey(t.date);
        return transactionDate.getMonth() === month && transactionDate.getFullYear() === year;
      });
    }

    return transactions;
  }, [query.data, month, year]);

  return {
    transactions: filteredTransactions,
    ledgerDebts: ledgerQuery.data ?? [],
    indicators,
    isLoading: query.isLoading || ledgerQuery.isLoading,
    error: query.error ?? ledgerQuery.error,
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
    const { data: { user } } = await getCachedAuthUser();
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
        date: toDateKey(new Date()),
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
