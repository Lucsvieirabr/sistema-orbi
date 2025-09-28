import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate, Database } from "@/integrations/supabase/types";

type Account = Tables<"accounts">;
type BalanceRow = Database["public"]["Views"]["vw_account_current_balance"]["Row"]; 

export function useAccounts() {
  const queryClient = useQueryClient();

  const fetchAccounts = async (): Promise<Account[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("accounts")
      .select("id, user_id, name, type, initial_balance, color, created_at")
      .eq("user_id", user?.id ?? "");
    if (error) throw error;
    return data ?? [];
  };

  const fetchBalances = async (): Promise<BalanceRow[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("vw_account_current_balance")
      .select("account_id, user_id, current_balance")
      .eq("user_id", user?.id ?? "");
    if (error) throw error;
    return (data as BalanceRow[]) ?? [];
  };

  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const balancesQuery = useQuery({ queryKey: ["balances"], queryFn: fetchBalances });

  useEffect(() => {
    const channel = supabase
      .channel("accounts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["balances"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        // transactions affect balances
        queryClient.invalidateQueries({ queryKey: ["balances"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const accountsWithBalance = useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    const balances = new Map((balancesQuery.data ?? []).map((b) => [b.account_id, b.current_balance]));
    return accounts.map((a) => ({ ...a, current_balance: balances.get(a.id) ?? a.initial_balance }));
  }, [accountsQuery.data, balancesQuery.data]);

  const createAccount = async (values: Pick<TablesInsert<"accounts">, "name" | "type" | "initial_balance" | "color">) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: TablesInsert<"accounts"> = { ...values, user_id: user!.id };
    const { error } = await supabase.from("accounts").insert(payload);
    if (error) throw error;
  };

  const updateAccount = async (id: string, values: Pick<TablesUpdate<"accounts">, "name" | "type" | "initial_balance" | "color">) => {
    const { error } = await supabase.from("accounts").update(values).eq("id", id);
    if (error) throw error;
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) throw error;
  };

  return {
    accountsWithBalance,
    isLoading: accountsQuery.isLoading || balancesQuery.isLoading,
    error: accountsQuery.error || balancesQuery.error,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}


