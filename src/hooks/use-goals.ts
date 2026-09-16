/**
 * Metas financeiras (módulo premium — Pro/Casal).
 *
 * Leitura: view `vw_goal_progress` (security_invoker — RLS de goals e
 * goal_allocations vale para quem consulta); saldo, % e aporte mensal
 * necessário já vêm calculados do banco.
 * Escrita: `goals` e `goal_allocations`. O trigger de aportes serializa
 * movimentos concorrentes da mesma meta e impede resgate acima do guardado.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { getScopeUserIds, useViewMode } from "@/hooks/use-view-mode";
import { assertUuid, roundCurrency } from "@/lib/utils";
import { toNullableNumber, toNumber } from "@/components/planning/planning-utils";
import { goalAllocationSchema, goalSchema, parseOrThrow } from "@/lib/validation/schemas";

export interface GoalProgress {
  id: string;
  user_id: string;
  name: string;
  target_value: number;
  deadline: string | null;
  icon: string;
  color: string;
  created_at: string;
  saved_value: number;
  remaining_value: number;
  progress_pct: number;
  allocations_count: number;
  last_allocation_on: string | null;
  months_left: number | null;
  monthly_needed: number | null;
  executed_at: string | null;
  project_id: string | null;
}

export interface GoalAllocation {
  id: string;
  user_id: string;
  goal_id: string;
  amount: number;
  allocated_on: string;
  note: string | null;
  created_at: string;
}

export interface GoalInput {
  name: string;
  targetValue: number;
  deadline: string | null;
  icon: string;
  color: string;
}

export const GOALS_QUERY_KEY = ["goals"] as const;

function toGoalPayload(input: GoalInput) {
  return parseOrThrow(goalSchema, {
    name: input.name,
    target_value: roundCurrency(input.targetValue),
    deadline: input.deadline || null,
    icon: input.icon,
    color: input.color,
  });
}

async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre de novo para continuar.");
  return user.id;
}

export function useGoals() {
  const queryClient = useQueryClient();
  const viewMode = useViewMode();

  const query = useQuery({
    queryKey: [...GOALS_QUERY_KEY, viewMode],
    queryFn: async (): Promise<GoalProgress[]> => {
      const userIds = await getScopeUserIds();
      const { data, error } = await supabase
        .from("vw_goal_progress")
        .select("*")
        .in("user_id", userIds)
        .order("created_at", { ascending: true });
      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id as string,
        user_id: row.user_id as string,
        name: row.name ?? "",
        target_value: toNumber(row.target_value),
        deadline: row.deadline,
        icon: row.icon ?? "target",
        color: row.color ?? "#3B82F6",
        created_at: row.created_at ?? "",
        saved_value: toNumber(row.saved_value),
        remaining_value: toNumber(row.remaining_value),
        progress_pct: toNumber(row.progress_pct),
        allocations_count: toNumber(row.allocations_count),
        last_allocation_on: row.last_allocation_on,
        months_left: toNullableNumber(row.months_left),
        monthly_needed: toNullableNumber(row.monthly_needed),
        executed_at: (row as any).executed_at ?? null,
        project_id: (row as any).project_id ?? null,
      }));
    },
    staleTime: 30 * 1000,
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: GOALS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["goal-allocations"] }),
      queryClient.invalidateQueries({ queryKey: ["monthly-closing"] }),
    ]);

  const createGoal = async (input: GoalInput) => {
    const userId = await requireUserId();
    const payload: TablesInsert<"goals"> = { user_id: userId, ...toGoalPayload(input) };
    const { error } = await supabase.from("goals").insert(payload);
    if (error) throw error;
    await invalidate();
  };

  const updateGoal = async (id: string, input: GoalInput) => {
    const userId = await requireUserId();
    const payload: TablesUpdate<"goals"> = toGoalPayload(input);
    const { error } = await supabase
      .from("goals")
      .update(payload)
      .eq("id", assertUuid(id, "goal_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  const deleteGoal = async (id: string) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("goals")
      .delete()
      .eq("id", assertUuid(id, "goal_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  /** amount > 0 = aporte; amount < 0 = resgate. */
  const addAllocation = async (values: { goalId: string; amount: number; allocatedOn: string; note?: string }) => {
    const userId = await requireUserId();
    const safe = parseOrThrow(goalAllocationSchema, {
      goal_id: values.goalId,
      amount: roundCurrency(values.amount),
      allocated_on: values.allocatedOn,
      note: values.note ?? null,
    });
    const payload: TablesInsert<"goal_allocations"> = {
      user_id: userId,
      goal_id: safe.goal_id,
      amount: safe.amount,
      allocated_on: safe.allocated_on,
      note: safe.note,
    };
    const { error } = await supabase.from("goal_allocations").insert(payload);
    if (error) throw error;
    await invalidate();
  };

  const deleteAllocation = async (id: string) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("goal_allocations")
      .delete()
      .eq("id", assertUuid(id, "allocation_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  return {
    goals: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createGoal,
    updateGoal,
    deleteGoal,
    addAllocation,
    deleteAllocation,
  };
}

export function useGoalAllocations(goalId: string | null) {
  return useQuery({
    queryKey: ["goal-allocations", goalId],
    enabled: Boolean(goalId),
    queryFn: async (): Promise<GoalAllocation[]> => {
      const { data, error } = await supabase
        .from("goal_allocations")
        .select("id, user_id, goal_id, amount, allocated_on, note, created_at")
        .eq("goal_id", assertUuid(goalId, "goal_id"))
        .order("allocated_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, amount: toNumber(row.amount) }));
    },
  });
}
