/**
 * Orçamentos (módulo premium — Pro/Casal).
 *
 * Leitura: 1 round-trip na RPC `orbi_budget_overview` (consumo, agendado, média
 * de 3 meses e sugestões agregados no Postgres). Escrita: insert/update/delete
 * diretos em `budgets` — RLS + trigger `orbi_budgets_guard` validam feature,
 * dono da categoria e tipo de gasto.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useViewMode } from "@/hooks/use-view-mode";
import { assertUuid, roundCurrency } from "@/lib/utils";
import { toNumber } from "@/components/planning/planning-utils";
import { budgetLimitSchema, budgetSchema, monthStartSchema, parseOrThrow } from "@/lib/validation/schemas";

export interface BudgetRow {
  id: string;
  user_id: string;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  amount_limit: number;
  spent: number;
  scheduled: number;
  previous_spent: number;
  avg_3m: number;
  remaining: number;
  used_pct: number;
}

export interface BudgetSuggestion {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  avg_3m: number;
  spent: number;
}

export interface BudgetOverview {
  month: string;
  scope: "personal" | "couple";
  budgets: BudgetRow[];
  suggestions: BudgetSuggestion[];
  previousMonthBudgets: number;
  totals: {
    limit: number;
    spent: number;
    scheduled: number;
    remaining: number;
    overCount: number;
    warningCount: number;
    count: number;
  };
}

export const BUDGETS_QUERY_KEY = ["budgets"] as const;

function normalize(raw: any, month: string): BudgetOverview {
  const totals = raw?.totals ?? {};
  return {
    month: raw?.month ?? month,
    scope: raw?.scope === "couple" ? "couple" : "personal",
    budgets: (raw?.budgets ?? []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      category_id: row.category_id,
      category_name: row.category_name ?? "Sem categoria",
      category_icon: row.category_icon ?? null,
      amount_limit: toNumber(row.amount_limit),
      spent: toNumber(row.spent),
      scheduled: toNumber(row.scheduled),
      previous_spent: toNumber(row.previous_spent),
      avg_3m: toNumber(row.avg_3m),
      remaining: toNumber(row.remaining),
      used_pct: toNumber(row.used_pct),
    })),
    suggestions: (raw?.suggestions ?? []).map((row: any) => ({
      category_id: row.category_id,
      category_name: row.category_name ?? "Sem categoria",
      category_icon: row.category_icon ?? null,
      avg_3m: toNumber(row.avg_3m),
      spent: toNumber(row.spent),
    })),
    previousMonthBudgets: toNumber(raw?.previous_month_budgets),
    totals: {
      limit: toNumber(totals.limit),
      spent: toNumber(totals.spent),
      scheduled: toNumber(totals.scheduled),
      remaining: toNumber(totals.remaining),
      overCount: toNumber(totals.over_count),
      warningCount: toNumber(totals.warning_count),
      count: toNumber(totals.count),
    },
  };
}

async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre de novo para continuar.");
  return user.id;
}

export function useBudgets(month: string) {
  const queryClient = useQueryClient();
  const viewMode = useViewMode();
  const scope = viewMode === "couple" ? "couple" : "personal";

  const query = useQuery({
    queryKey: [...BUDGETS_QUERY_KEY, month, scope],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("orbi_budget_overview", {
        p_month: month,
        p_scope: scope,
        p_exclude_projects: true,
      });
      if (error) throw error;
      return normalize(data, month);
    },
    staleTime: 30 * 1000,
    placeholderData: (previous) => previous,
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["monthly-closing"] }),
    ]);

  const createBudget = async (values: { categoryId: string; amountLimit: number }) => {
    const userId = await requireUserId();
    const safe = parseOrThrow(budgetSchema, {
      category_id: values.categoryId,
      amount_limit: roundCurrency(values.amountLimit),
      period_month: month,
    });
    const payload: TablesInsert<"budgets"> = {
      user_id: userId,
      category_id: safe.category_id,
      amount_limit: safe.amount_limit,
      period_month: safe.period_month,
    };
    const { error } = await supabase.from("budgets").insert(payload);
    if (error) throw error;
    await invalidate();
  };

  const updateBudget = async (id: string, amountLimit: number) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("budgets")
      .update({ amount_limit: parseOrThrow(budgetLimitSchema, roundCurrency(amountLimit)) })
      .eq("id", assertUuid(id, "budget_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  const deleteBudget = async (id: string) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("id", assertUuid(id, "budget_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  /** Copia os tetos do mês anterior. Retorna quantos foram criados. */
  const copyPreviousMonth = async (): Promise<number> => {
    const { data, error } = await supabase.rpc("orbi_budget_copy_previous", {
      p_month: parseOrThrow(monthStartSchema, month),
    });
    if (error) throw error;
    await invalidate();
    return toNumber(data);
  };

  return {
    overview: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    scope,
    createBudget,
    updateBudget,
    deleteBudget,
    copyPreviousMonth,
  };
}
