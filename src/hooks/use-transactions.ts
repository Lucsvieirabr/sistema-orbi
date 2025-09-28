import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions">;

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: toIso(start), end: toIso(end) };
}

export function useTransactions() {
  const queryClient = useQueryClient();
  const { start, end } = getMonthRange();

  const fetchTransactions = async (): Promise<Transaction[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        id, user_id, description, value, date, type, payment_method, 
        installments, installment_number, is_fixed, account_id, 
        credit_card_id, category_id, family_member_id, created_at,
        accounts(name, type, color),
        categories(name),
        credit_cards(name, brand),
        family_members(name)
      `)
      .eq("user_id", user?.id ?? "")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  };

  const query = useQuery({ queryKey: ["transactions", start, end], queryFn: fetchTransactions });

  useEffect(() => {
    const channel = supabase
      .channel("transactions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["transactions", start, end] });
        queryClient.invalidateQueries({ queryKey: ["balances"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, start, end]);

  // Validações de negócio
  const validateTransaction = (values: any) => {
    if (!values.description?.trim()) {
      throw new Error("Descrição é obrigatória");
    }
    if (!values.value || values.value <= 0) {
      throw new Error("Valor deve ser maior que zero");
    }
    if (!values.date) {
      throw new Error("Data é obrigatória");
    }
    if (values.type !== 'transfer') {
      if (!values.account_id) {
        throw new Error("Conta é obrigatória para ganhos e gastos");
      }
      if (!values.category_id) {
        throw new Error("Categoria é obrigatória para ganhos e gastos");
      }
    }
    if (values.type === 'transfer') {
      if (!values.from_account_id || !values.to_account_id) {
        throw new Error("Transferência deve ter conta de origem e destino");
      }
      if (values.from_account_id === values.to_account_id) {
        throw new Error("Conta de origem e destino devem ser diferentes");
      }
    }
    if (values.payment_method === 'credit' && !values.credit_card_id) {
      throw new Error("Cartão de crédito é obrigatório para pagamento com cartão");
    }
    if (values.installments && values.installments < 2) {
      throw new Error("Número de parcelas deve ser pelo menos 2");
    }
  };

  const createTransaction = async (values: {
    type: 'income' | 'expense' | 'transfer';
    account_id?: string;
    category_id?: string;
    value: number;
    description: string;
    date: string;
    payment_method?: 'debit' | 'credit';
    credit_card_id?: string | null;
    family_member_id?: string | null;
    is_fixed?: boolean;
    installments?: number | null;
    installment_number?: number | null;
    from_account_id?: string;
    to_account_id?: string;
  }) => {
    validateTransaction(values);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (values.type === 'transfer') {
      // Criar duas transações para transferência
      const fromTransaction: TablesInsert<"transactions"> = {
        user_id: user!.id,
        type: 'expense',
        account_id: values.from_account_id!,
        category_id: values.category_id || null,
        value: values.value,
        description: `Transferência: ${values.description}`,
        date: values.date,
        payment_method: 'debit',
        credit_card_id: null,
        family_member_id: values.family_member_id,
        is_fixed: false,
        installments: null,
        installment_number: null,
      };

      const toTransaction: TablesInsert<"transactions"> = {
        user_id: user!.id,
        type: 'income',
        account_id: values.to_account_id!,
        category_id: values.category_id || null,
        value: values.value,
        description: `Transferência: ${values.description}`,
        date: values.date,
        payment_method: 'debit',
        credit_card_id: null,
        family_member_id: values.family_member_id,
        is_fixed: false,
        installments: null,
        installment_number: null,
      };

      // Inserir ambas as transações
      const { data: fromData, error: fromError } = await supabase
        .from("transactions")
        .insert(fromTransaction)
        .select()
        .single();
      
      if (fromError) throw fromError;

      const { data: toData, error: toError } = await supabase
        .from("transactions")
        .insert(toTransaction)
        .select()
        .single();
      
      if (toError) throw toError;

      // Vincular as transações relacionadas
      await supabase
        .from("transactions")
        .update({ related_transaction_id: toData.id })
        .eq("id", fromData.id);

      await supabase
        .from("transactions")
        .update({ related_transaction_id: fromData.id })
        .eq("id", toData.id);

    } else {
      // Transação normal (income/expense)
      const payload: TablesInsert<"transactions"> = {
        user_id: user!.id,
        type: values.type,
        account_id: values.account_id!,
        category_id: values.category_id!,
        value: values.value,
        description: values.description,
        date: values.date,
        payment_method: values.payment_method || 'debit',
        credit_card_id: values.credit_card_id,
        family_member_id: values.family_member_id,
        is_fixed: values.is_fixed || false,
        installments: values.installments,
        installment_number: values.installment_number,
      };

      const { error } = await supabase.from("transactions").insert(payload);
      if (error) throw error;

      // Se for parcelado, criar as parcelas futuras
      if (values.installments && values.installments > 1) {
        await createInstallments(payload, values.installments);
      }
    }
  };

  const createInstallments = async (baseTransaction: TablesInsert<"transactions">, totalInstallments: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    const baseDate = new Date(baseTransaction.date!);
    
    for (let i = 2; i <= totalInstallments; i++) {
      const installmentDate = new Date(baseDate);
      installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
      
      const installment: TablesInsert<"transactions"> = {
        ...baseTransaction,
        user_id: user!.id,
        date: installmentDate.toISOString().slice(0, 10),
        installment_number: i,
        is_fixed: false,
      };

      await supabase.from("transactions").insert(installment);
    }
  };

  const updateTransaction = async (id: string, values: Partial<TablesUpdate<"transactions">>) => {
    // Buscar transação original para estornar impacto
    const { data: originalTransaction, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();
    
    if (fetchError) throw fetchError;

    // Se mudou valor ou conta, estornar impacto original
    if ((values.value && values.value !== originalTransaction.value) || 
        (values.account_id && values.account_id !== originalTransaction.account_id)) {
      // Aqui seria necessário implementar lógica de estorno
      // Por simplicidade, vamos apenas atualizar
    }

    const { error } = await supabase
      .from("transactions")
      .update(values)
      .eq("id", id);
    
    if (error) throw error;
  };

  const deleteTransaction = async (id: string) => {
    // Buscar transação para verificar se é transferência
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select("related_transaction_id")
      .eq("id", id)
      .single();
    
    if (fetchError) throw fetchError;

    // Se for transferência, deletar ambas as partes
    if (transaction.related_transaction_id) {
      await supabase
        .from("transactions")
        .delete()
        .eq("id", transaction.related_transaction_id);
    }

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  };

  // Calcular saldos projetados
  const projectedBalances = useMemo(() => {
    const balances = new Map<string, number>();
    const today = new Date().toISOString().slice(0, 10);
    const transactionsData = query.data ?? [];
    
    transactionsData.forEach(transaction => {
      const accountId = transaction.account_id;
      if (!accountId) return;
      
      const currentBalance = balances.get(accountId) || 0;
      const isFuture = transaction.date > today;
      const isFixed = transaction.is_fixed;
      
      // Aplicar impacto se for transação passada ou futura/fixa
      if (!isFuture || isFixed) {
        const impact = transaction.type === 'income' ? transaction.value : -transaction.value;
        balances.set(accountId, currentBalance + impact);
      }
    });
    
    return balances;
  }, [query.data]);

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    projectedBalances,
  };
}


