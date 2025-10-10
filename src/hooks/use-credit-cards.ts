import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type CreditCard = Tables<"credit_cards">;

export function useCreditCards() {
  const queryClient = useQueryClient();

  const fetchCreditCards = async (): Promise<CreditCard[]> => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const { data, error } = await supabase
      .from("credit_cards")
      .select("id, user_id, name, brand, limit, statement_date, due_date, connected_account_id, created_at")
      .eq("user_id", user?.id ?? "");
    if (error) throw error;
    return data ?? [];
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["credit_cards"],
    queryFn: fetchCreditCards,
  });

  useEffect(() => {
    const channel = supabase
      .channel("credit_cards-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "credit_cards" },
        () => queryClient.invalidateQueries({ queryKey: ["credit_cards"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createCreditCard = async (values: Pick<TablesInsert<"credit_cards">, "name" | "brand" | "limit" | "statement_date" | "due_date" | "connected_account_id">) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: TablesInsert<"credit_cards"> = { 
      name: values.name, 
      brand: values.brand,
      limit: values.limit,
      statement_date: values.statement_date,
      due_date: values.due_date,
      connected_account_id: values.connected_account_id,
      user_id: user!.id 
    };
    const { data, error } = await supabase.from("credit_cards").insert(payload).select().single();
    if (error) throw error;
    return data;
  };

  const updateCreditCard = async (id: string, values: Pick<TablesUpdate<"credit_cards">, "name" | "brand" | "limit" | "statement_date" | "due_date" | "connected_account_id">) => {
    const { error } = await supabase.from("credit_cards").update(values).eq("id", id);
    if (error) throw error;
  };

  const deleteCreditCard = async (id: string) => {
    // Verificar se há transações vinculadas ao cartão
    const { data: { user } } = await supabase.auth.getUser();
    const { data: transactions, error: checkError } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user?.id ?? "")
      .eq("credit_card_id", id)
      .limit(1);
    
    if (checkError) throw checkError;
    
    if (transactions && transactions.length > 0) {
      throw new Error("Não é possível excluir o cartão pois existem transações vinculadas a ele.");
    }

    const { error } = await supabase.from("credit_cards").delete().eq("id", id);
    if (error) throw error;
  };

  return {
    creditCards: data ?? [],
    isLoading,
    error,
    createCreditCard,
    updateCreditCard,
    deleteCreditCard,
  };
}
