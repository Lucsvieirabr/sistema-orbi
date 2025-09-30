import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Debt = Tables<"debts"> & {
  people?: Tables<"people">;
  transactions?: Tables<"transactions">;
};

export type DebtInsert = TablesInsert<"debts">;
export type DebtUpdate = TablesUpdate<"debts">;

export function useDebts() {
  return useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("debts")
        .select(`
          *,
          people(name),
          transactions(description, date, value)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Debt[];
    },
  });
}

export function useDebtsByStatus(status: "PENDING" | "PAID") {
  return useQuery({
    queryKey: ["debts", status],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("debts")
        .select(`
          *,
          people(name),
          transactions(description, date, value)
        `)
        .eq("user_id", user.id)
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Debt[];
    },
  });
}

export function useDebtsByType(type: "TO_RECEIVE" | "TO_PAY") {
  return useQuery({
    queryKey: ["debts", type],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("debts")
        .select(`
          *,
          people(name),
          transactions(description, date, value)
        `)
        .eq("user_id", user.id)
        .eq("type", type)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Debt[];
    },
  });
}

export function useCreateDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (debt: DebtInsert) => {
      const { data, error } = await supabase
        .from("debts")
        .insert(debt)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      toast({
        title: "Sucesso",
        description: "Dívida criada com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar dívida",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: DebtUpdate }) => {
      const { data, error } = await supabase
        .from("debts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      toast({
        title: "Sucesso",
        description: "Dívida atualizada com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar dívida",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("debts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      toast({
        title: "Sucesso",
        description: "Dívida excluída com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir dívida",
        variant: "destructive",
      });
    },
  });
}

export function useMarkDebtAsPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("debts")
        .update({ status: "PAID" })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Quando uma dívida é marcada como paga, criar uma transação de entrada
      if (data.type === "TO_RECEIVE") {
        // Pessoa pagou o que devia - criar transação de entrada
        await supabase.from("transactions").insert({
          user_id: data.user_id,
          type: "income",
          value: data.amount,
          description: `Recebimento de ${data.people?.name || "pessoa"}`,
          date: new Date().toISOString().split('T')[0],
          status: "PAID",
        });
      } else if (data.type === "TO_PAY") {
        // Usuário pagou o que devia - criar transação de saída
        await supabase.from("transactions").insert({
          user_id: data.user_id,
          type: "expense",
          value: data.amount,
          description: `Pagamento para ${data.people?.name || "pessoa"}`,
          date: new Date().toISOString().split('T')[0],
          status: "PAID",
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: "Sucesso",
        description: "Dívida marcada como paga",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao marcar dívida como paga",
        variant: "destructive",
      });
    },
  });
}

// Hook para obter estatísticas de dívidas (calcula baseado em transações pendentes e com person_id)
export function useDebtStats() {
  return useQuery({
    queryKey: ["debt-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar todas as transações pendentes (PENDING)
      const { data: pendingTransactions, error: pendingError } = await supabase
        .from("transactions")
        .select("value, type, status, person_id")
        .eq("user_id", user.id)
        .eq("status", "PENDING");

      if (pendingError) throw pendingError;

      // Calcular valores a receber (income pendentes)
      const totalToReceive = pendingTransactions
        .filter(transaction => transaction.type === "income")
        .reduce((sum, transaction) => sum + transaction.value, 0);

      // Calcular valores a pagar (expense pendentes)  
      const totalToPay = pendingTransactions
        .filter(transaction => transaction.type === "expense")
        .reduce((sum, transaction) => sum + transaction.value, 0);

      const netBalance = totalToReceive - totalToPay;

      return {
        totalToReceive,
        totalToPay,
        netBalance,
        totalPendingDebts: pendingTransactions.length,
      };
    },
  });
}
