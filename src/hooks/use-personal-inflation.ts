import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { toNullableNumber, toNumber } from "@/components/planning/planning-utils";
import { assertUuid, roundCurrency } from "@/lib/utils";
import { budgetLimitSchema, parseOrThrow } from "@/lib/validation/schemas";

export type InflationBasis = 3 | 6 | 12;

export interface InflationMover {
  merchant: string;
  basis: InflationBasis;
  curTicket: number;
  baseTicket: number;
  changePct: number;
}

export interface InflationCategory {
  categoryId: string;
  name: string;
  icon: string | null;
  monthlySpend: number;
  idx: Record<InflationBasis, number | null>;
  method: "merchant" | "category";
  paired: number;
  movers: InflationMover[];
}

export interface InflationHistoryPoint {
  month: string;
  idx: Record<InflationBasis, number | null>;
  headlinePct: number | null;
  headlineBasis: InflationBasis | null;
  essentialMonthly: number;
  sampleSize: number;
  categories: Array<{ categoryId: string; name: string; idx: Record<InflationBasis, number | null> }>;
}

export interface BudgetInflationAlert {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  budgetId: string | null;
  categoryName: string;
  periodMonth: string | null;
  currentLimit: number;
  suggestedLimit: number;
  inflationPct: number;
  basis: InflationBasis | null;
}

export interface PersonalInflation {
  referenceMonth: string;
  windowStart: string;
  computedAt: string | null;
  essentialMonthly: number;
  idx: Record<InflationBasis, number | null>;
  headlinePct: number | null;
  headlineBasis: InflationBasis | null;
  matchedMerchants: number;
  sampleSize: number;
  categories: InflationCategory[];
  history: InflationHistoryPoint[];
  alerts: BudgetInflationAlert[];
}

export const PERSONAL_INFLATION_QUERY_KEY = ["personal-inflation"] as const;

const toBasis = (value: unknown): InflationBasis | null => {
  const n = Number(value);
  return n === 3 || n === 6 || n === 12 ? n : null;
};

const toIdx = (raw: any): Record<InflationBasis, number | null> => ({
  3: toNullableNumber(raw?.idx_3m ?? raw?.inflation_3m),
  6: toNullableNumber(raw?.idx_6m ?? raw?.inflation_6m),
  12: toNullableNumber(raw?.idx_12m ?? raw?.inflation_12m),
});

export function toAlert(row: any): BudgetInflationAlert {
  const payload = row?.payload ?? {};
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    createdAt: String(row.created_at ?? ""),
    budgetId: typeof payload.budget_id === "string" ? payload.budget_id : null,
    categoryName: String(payload.category_name ?? ""),
    periodMonth: payload.period_month ? String(payload.period_month).slice(0, 10) : null,
    currentLimit: toNumber(payload.current_limit),
    suggestedLimit: toNumber(payload.suggested_limit),
    inflationPct: toNumber(payload.inflation_pct),
    basis: toBasis(payload.basis),
  };
}

function normalize(raw: any): PersonalInflation {
  return {
    referenceMonth: String(raw?.reference_month ?? "").slice(0, 10),
    windowStart: String(raw?.window_start ?? "").slice(0, 10),
    computedAt: raw?.computed_at ?? null,
    essentialMonthly: toNumber(raw?.essential_monthly),
    idx: toIdx(raw),
    headlinePct: toNullableNumber(raw?.headline_pct),
    headlineBasis: toBasis(raw?.headline_basis),
    matchedMerchants: toNumber(raw?.matched_merchants),
    sampleSize: toNumber(raw?.sample_size),
    categories: (raw?.categories ?? []).map((row: any) => ({
      categoryId: String(row.category_id),
      name: String(row.name ?? "Sem categoria"),
      icon: row.icon ?? null,
      monthlySpend: toNumber(row.monthly_spend),
      idx: toIdx(row),
      method: row.method === "merchant" ? "merchant" : "category",
      paired: toNumber(row.paired),
      movers: (row.movers ?? []).map((mover: any) => ({
        merchant: String(mover.merchant ?? ""),
        basis: toBasis(mover.basis) ?? 3,
        curTicket: toNumber(mover.cur_ticket),
        baseTicket: toNumber(mover.base_ticket),
        changePct: toNumber(mover.change_pct),
      })),
    })),
    history: (raw?.history ?? []).map((row: any) => ({
      month: String(row.month ?? "").slice(0, 10),
      idx: toIdx(row),
      headlinePct: toNullableNumber(row.headline_pct),
      headlineBasis: toBasis(row.headline_basis),
      essentialMonthly: toNumber(row.essential_monthly),
      sampleSize: toNumber(row.sample_size),
      categories: (row.categories ?? []).map((cat: any) => ({
        categoryId: String(cat.category_id),
        name: String(cat.name ?? ""),
        idx: toIdx(cat),
      })),
    })),
    alerts: (raw?.alerts ?? []).map(toAlert),
  };
}

export function usePersonalInflation({ enabled = true, months = 12 }: { enabled?: boolean; months?: number } = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...PERSONAL_INFLATION_QUERY_KEY, months],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("orbi_personal_inflation", { p_months: months, p_refresh: false });
      if (error) throw error;
      return normalize(data);
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const refresh = async () => {
    const { data, error } = await supabase.rpc("orbi_personal_inflation", { p_months: months, p_refresh: true });
    if (error) throw error;
    queryClient.setQueryData([...PERSONAL_INFLATION_QUERY_KEY, months], normalize(data));
  };

  return {
    inflation: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    refresh,
  };
}

export function useApplyInflationAlert() {
  const queryClient = useQueryClient();

  const markRead = async (alertId: string) => {
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", assertUuid(alertId, "notification_id"));
    if (error) throw error;
  };

  const apply = async (alert: BudgetInflationAlert) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada. Entre de novo para continuar.");
    const limit = parseOrThrow(budgetLimitSchema, roundCurrency(alert.suggestedLimit));
    const { error } = await supabase
      .from("budgets")
      .update({ amount_limit: limit })
      .eq("id", assertUuid(alert.budgetId, "budget_id"))
      .eq("user_id", user.id);
    if (error) throw error;
    await markRead(alert.id);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["budgets"] }),
      queryClient.invalidateQueries({ queryKey: PERSONAL_INFLATION_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["user-notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["monthly-closing"] }),
    ]);
  };

  const dismiss = async (alertId: string) => {
    await markRead(alertId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: PERSONAL_INFLATION_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["user-notifications"] }),
    ]);
  };

  return { apply, dismiss };
}
