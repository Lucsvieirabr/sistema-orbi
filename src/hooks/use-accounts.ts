import { getCachedAuthUser } from "@/hooks/use-current-user";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate, Database } from "@/integrations/supabase/types";
import { getScopeUserIds, useViewMode } from "@/hooks/use-view-mode";
import { accountSchema, parseOrThrow } from "@/lib/validation/schemas";
import { assertUuid } from "@/lib/utils";

type Account = Tables<"accounts">;
type BalanceRow = Database["public"]["Views"]["vw_account_current_balance"]["Row"];
type ProjectedBalanceRow = Database["public"]["Views"]["vw_account_projected_balance"]["Row"];

export type AccountInput = Pick<TablesInsert<"accounts">, "name" | "type" | "initial_balance" | "color">;

/**
 * INSERT de conta fora do hook (onboarding): sem abrir um segundo canal
 * realtime `accounts-changes`. O trigger `check_accounts_limit` é a autoridade.
 */
export async function insertAccount(values: AccountInput): Promise<Account> {
  const { data: { user } } = await getCachedAuthUser();
  if (!user) throw new Error("Usuario nao autenticado");
  // SEGURANCA: valida/sanitiza antes de ir ao banco (whitelist de `type`,
  // cor so em hex, nome sem caractere de controle). O banco repete via CHECK.
  const safe = parseOrThrow(accountSchema, values);
  const payload: TablesInsert<"accounts"> = { ...safe, user_id: user.id };
  const { data, error } = await supabase
    .from("accounts")
    .insert(payload)
    .select("id, user_id, name, type, initial_balance, color, created_at")
    .single();
  if (error) throw error;
  return data as Account;
}

export function useAccounts() {
  const queryClient = useQueryClient();
  const viewMode = useViewMode();

  const fetchAccounts = async (): Promise<Account[]> => {
    const userIds = await getScopeUserIds();
    const { data, error } = await supabase
      .from("accounts")
      .select("id, user_id, name, type, initial_balance, color, created_at")
      .in("user_id", userIds);
    if (error) throw error;
    return data ?? [];
  };

  const fetchBalances = async (): Promise<BalanceRow[]> => {
    const userIds = await getScopeUserIds();
    const { data, error } = await supabase
      .from("vw_account_current_balance")
      .select("account_id, user_id, current_balance")
      .in("user_id", userIds);
    if (error) throw error;
    return (data as BalanceRow[]) ?? [];
  };

  const fetchProjectedBalances = async (): Promise<ProjectedBalanceRow[]> => {
    const userIds = await getScopeUserIds();
    const { data, error } = await supabase
      .from("vw_account_projected_balance")
      .select("account_id, user_id, projected_balance")
      .in("user_id", userIds);
    if (error) throw error;
    return (data as ProjectedBalanceRow[]) ?? [];
  };

  const accountsQuery = useQuery({ queryKey: ["accounts", viewMode], queryFn: fetchAccounts });
  const balancesQuery = useQuery({ queryKey: ["balances", viewMode], queryFn: fetchBalances });
  const projectedBalancesQuery = useQuery({ queryKey: ["projected-balances", viewMode], queryFn: fetchProjectedBalances });

  useEffect(() => {
    const channel = supabase
      .channel("accounts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["balances"] });
        queryClient.invalidateQueries({ queryKey: ["projected-balances"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        // transactions affect balances
        queryClient.invalidateQueries({ queryKey: ["balances"] });
        queryClient.invalidateQueries({ queryKey: ["projected-balances"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const accountsWithBalance = useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    const balances = new Map((balancesQuery.data ?? []).map((b) => [b.account_id, b.current_balance]));
    return accounts.map((a) => ({ ...a, current_balance: balances.get(a.id) ?? a.initial_balance }));
  }, [accountsQuery.data, balancesQuery.data]);

  const accountsWithProjectedBalance = useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    const projectedBalances = new Map((projectedBalancesQuery.data ?? []).map((b) => [b.account_id, b.projected_balance]));
    return accounts.map((a) => ({ ...a, projected_balance: projectedBalances.get(a.id) ?? a.initial_balance }));
  }, [accountsQuery.data, projectedBalancesQuery.data]);

  const createAccount = insertAccount;

  const updateAccount = async (id: string, values: Pick<TablesUpdate<"accounts">, "name" | "type" | "initial_balance" | "color">) => {
    const { data: { user } } = await getCachedAuthUser();
    if (!user) throw new Error("Usuario nao autenticado");
    const safe = parseOrThrow(accountSchema, values);
    // `.eq("user_id")` e defesa em profundidade: a RLS ja isola, mas o filtro
    // explicito impede que um id de outro tenant vire um UPDATE de 0 linhas
    // silencioso interpretado como sucesso pela UI.
    const { error } = await supabase
      .from("accounts")
      .update(safe)
      .eq("id", assertUuid(id, "account_id"))
      .eq("user_id", user.id);
    if (error) throw error;
  };

  const deleteAccount = async (id: string) => {
    const { data: { user } } = await getCachedAuthUser();
    if (!user) throw new Error("Usuario nao autenticado");
    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", assertUuid(id, "account_id"))
      .eq("user_id", user.id);
    if (error) throw error;
  };

  return {
    accountsWithBalance,
    accountsWithProjectedBalance,
    isLoading: accountsQuery.isLoading || balancesQuery.isLoading,
    isProjectedLoading: projectedBalancesQuery.isLoading,
    error: accountsQuery.error || balancesQuery.error || projectedBalancesQuery.error,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}


