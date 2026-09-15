/**
 * Fechamento do mês — DRE pessoal (módulo premium — Pro/Casal).
 *
 * Todo o cálculo mora na RPC `orbi_monthly_closing` (uma varredura de
 * `transactions` por user_id+date, agregada no Postgres). O cliente só
 * normaliza números e renderiza — nada de somar milhares de linhas no browser.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useViewMode } from "@/hooks/use-view-mode";
import { toNullableNumber, toNumber } from "@/components/planning/planning-utils";

export interface ClosingTotals {
  income: number;
  expenses: number;
  fixed: number;
  installments: number;
  variable: number;
  result: number;
  savingsRate: number | null;
  goalContributions: number;
  freeCash: number;
}

export interface ClosingCurrent extends ClosingTotals {
  incomeReceived: number;
  incomePending: number;
  expensesPaid: number;
  expensesPending: number;
  transactionsCount: number;
  pendingCount: number;
}

export interface ClosingCategory {
  categoryId: string | null;
  name: string;
  icon: string | null;
  amount: number;
  previousAmount: number;
  variationPct: number | null;
  budgetLimit: number | null;
  transactionsCount: number;
}

export interface MonthlyClosing {
  month: string;
  previousMonth: string;
  scope: "personal" | "couple";
  hasData: boolean;
  hasPrevious: boolean;
  current: ClosingCurrent;
  previous: ClosingTotals;
  variation: {
    incomePct: number | null;
    expensesPct: number | null;
    resultPct: number | null;
    savingsRatePp: number | null;
  };
  largestExpense: {
    id: string;
    description: string;
    amount: number;
    date: string;
    status: string;
    category: string;
  } | null;
  expenseCategories: ClosingCategory[];
  expenseCategoriesCount: number;
  incomeCategories: Array<{ categoryId: string | null; name: string; icon: string | null; amount: number }>;
  trend: Array<{ month: string; income: number; expenses: number; result: number }>;
  budgets: { count: number; over: number; limit: number; spent: number };
}

function totals(raw: any): ClosingTotals {
  return {
    income: toNumber(raw?.income),
    expenses: toNumber(raw?.expenses),
    fixed: toNumber(raw?.fixed),
    installments: toNumber(raw?.installments),
    variable: toNumber(raw?.variable),
    result: toNumber(raw?.result),
    savingsRate: toNullableNumber(raw?.savings_rate),
    goalContributions: toNumber(raw?.goal_contributions),
    freeCash: toNumber(raw?.free_cash),
  };
}

function normalize(raw: any, month: string): MonthlyClosing {
  const current = raw?.current ?? {};
  return {
    month: raw?.month ?? month,
    previousMonth: raw?.previous_month ?? month,
    scope: raw?.scope === "couple" ? "couple" : "personal",
    hasData: Boolean(raw?.has_data),
    hasPrevious: Boolean(raw?.has_previous),
    current: {
      ...totals(current),
      incomeReceived: toNumber(current.income_received),
      incomePending: toNumber(current.income_pending),
      expensesPaid: toNumber(current.expenses_paid),
      expensesPending: toNumber(current.expenses_pending),
      transactionsCount: toNumber(current.transactions_count),
      pendingCount: toNumber(current.pending_count),
    },
    previous: totals(raw?.previous),
    variation: {
      incomePct: toNullableNumber(raw?.variation?.income_pct),
      expensesPct: toNullableNumber(raw?.variation?.expenses_pct),
      resultPct: toNullableNumber(raw?.variation?.result_pct),
      savingsRatePp: toNullableNumber(raw?.variation?.savings_rate_pp),
    },
    largestExpense: raw?.largest_expense
      ? {
          id: raw.largest_expense.id,
          description: raw.largest_expense.description ?? "",
          amount: toNumber(raw.largest_expense.amount),
          date: raw.largest_expense.date,
          status: raw.largest_expense.status,
          category: raw.largest_expense.category ?? "Sem categoria",
        }
      : null,
    expenseCategories: (raw?.expense_categories ?? []).map((row: any) => ({
      categoryId: row.category_id ?? null,
      name: row.name ?? "Sem categoria",
      icon: row.icon ?? null,
      amount: toNumber(row.amount),
      previousAmount: toNumber(row.previous_amount),
      variationPct: toNullableNumber(row.variation_pct),
      budgetLimit: toNullableNumber(row.budget_limit),
      transactionsCount: toNumber(row.transactions_count),
    })),
    expenseCategoriesCount: toNumber(raw?.expense_categories_count),
    incomeCategories: (raw?.income_categories ?? []).map((row: any) => ({
      categoryId: row.category_id ?? null,
      name: row.name ?? "Sem categoria",
      icon: row.icon ?? null,
      amount: toNumber(row.amount),
    })),
    trend: (raw?.trend ?? []).map((row: any) => ({
      month: row.month,
      income: toNumber(row.income),
      expenses: toNumber(row.expenses),
      result: toNumber(row.result),
    })),
    budgets: {
      count: toNumber(raw?.budgets?.count),
      over: toNumber(raw?.budgets?.over),
      limit: toNumber(raw?.budgets?.limit),
      spent: toNumber(raw?.budgets?.spent),
    },
  };
}

export function useMonthlyClosing(month: string) {
  const viewMode = useViewMode();
  const scope = viewMode === "couple" ? "couple" : "personal";

  return useQuery({
    queryKey: ["monthly-closing", month, scope],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("orbi_monthly_closing", { p_month: month, p_scope: scope });
      if (error) throw error;
      return normalize(data, month);
    },
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
  });
}
