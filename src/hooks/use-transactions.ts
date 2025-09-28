import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

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
      .select("id, user_id, description, value, date, type, payment_method, installments, installment_number, is_fixed, account_id, credit_card_id, category_id, family_member_id, created_at")
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
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, start, end]);

  const createTransaction = async (values: Partial<TablesInsert<"transactions">> & { type: 'income' | 'expense'; account_id: string; category_id: string; value: number; description: string; date: string; is_fixed?: boolean; }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: TablesInsert<"transactions"> = {
      user_id: user!.id,
      type: values.type,
      account_id: values.account_id,
      category_id: values.category_id,
      value: values.value,
      description: values.description,
      date: values.date,
      is_fixed: values.is_fixed ?? false,
      payment_method: 'debit',
      credit_card_id: null,
    };
    const { error } = await supabase.from("transactions").insert(payload);
    if (error) throw error;
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) throw error;
  };

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createTransaction,
    deleteTransaction,
  };
}


