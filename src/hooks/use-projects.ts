import { getCachedAuthUser } from "@/hooks/use-current-user";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useViewMode } from "@/hooks/use-view-mode";
import { toNullableNumber, toNumber } from "@/components/planning/planning-utils";
import { assertUuid, isUuid, roundCurrency } from "@/lib/utils";
import { goalExecuteSchema, parseOrThrow, projectSchema, uuidSchema } from "@/lib/validation/schemas";

export type ProjectKind = "event" | "trip" | "purchase" | "home" | "family" | "other";
export type ProjectStatus = "active" | "archived";

export const PROJECT_KINDS: Array<{ value: ProjectKind; label: string; icon: string }> = [
  { value: "event", label: "Evento", icon: "heart" },
  { value: "trip", label: "Viagem", icon: "plane" },
  { value: "purchase", label: "Compra grande", icon: "gift" },
  { value: "home", label: "Casa e reforma", icon: "home" },
  { value: "family", label: "Família e pets", icon: "baby" },
  { value: "other", label: "Outro", icon: "target" },
];

export interface ProjectTotals {
  budget: number;
  fundedFromGoal: number;
  spent: number;
  committed: number;
  gross: number;
  compensation: number;
  income: number;
  cost: number;
  remaining: number;
  transactions: number;
  pending: number;
  firstDate: string | null;
  lastDate: string | null;
}

export interface ProjectReport {
  closedOn: string;
  auto: boolean;
  budget: number;
  cost: number;
  gross: number;
  compensation: number;
  income: number;
  variance: number;
  variancePct: number | null;
  transactions: number;
  pending: number;
  days: number;
  topCategories: Array<{ name: string; amount: number }>;
}

export interface ProjectSummary {
  id: string;
  userId: string;
  isOwner: boolean;
  name: string;
  description: string | null;
  kind: ProjectKind;
  icon: string;
  color: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  archivedAt: string | null;
  goalId: string | null;
  goalName: string | null;
  ledgerId: string | null;
  ledgerName: string | null;
  ledgerStatus: "open" | "settled" | null;
  finalReport: ProjectReport | null;
  totals: ProjectTotals;
}

export interface ProjectTransaction {
  id: string;
  date: string;
  description: string;
  type: "income" | "expense" | "transfer";
  status: "PAID" | "PENDING" | "CANCELED";
  value: number;
  compensation: number;
  net: number;
  categoryName: string | null;
  categoryIcon: string | null;
  paymentLabel: string | null;
  isShared: boolean;
  ledgerId: string | null;
}

export interface ProjectOverview {
  project: Omit<ProjectSummary, "totals"> & { budget: number; fundedFromGoal: number };
  totals: ProjectTotals;
  pace: { daysTotal: number; daysElapsed: number; timePct: number; budgetPct: number | null };
  categories: Array<{ categoryId: string | null; name: string; icon: string | null; amount: number; transactions: number }>;
  timeline: Array<{ month: string; paid: number; pending: number }>;
  transactions: ProjectTransaction[];
}

export interface ProjectInput {
  name: string;
  description: string | null;
  kind: ProjectKind;
  icon: string;
  color: string;
  budget: number;
  startDate: string;
  endDate: string;
}

export interface GoalExecutionInput {
  goalId: string;
  name: string;
  startDate: string;
  endDate: string;
  kind: ProjectKind;
  extraBudget: number;
  withLedger: boolean;
}

export const PROJECTS_QUERY_KEY = ["projects"] as const;

const KINDS = new Set<ProjectKind>(["event", "trip", "purchase", "home", "family", "other"]);

async function requireUserId(): Promise<string> {
  const { data: { user } } = await getCachedAuthUser();
  if (!user) throw new Error("Sessão expirada. Entre de novo para continuar.");
  return user.id;
}

function toTotals(raw: any): ProjectTotals {
  return {
    budget: toNumber(raw?.budget),
    fundedFromGoal: toNumber(raw?.funded_from_goal),
    spent: toNumber(raw?.spent),
    committed: toNumber(raw?.committed),
    gross: toNumber(raw?.gross),
    compensation: toNumber(raw?.compensation),
    income: toNumber(raw?.income),
    cost: toNumber(raw?.cost),
    remaining: toNumber(raw?.remaining),
    transactions: toNumber(raw?.transactions),
    pending: toNumber(raw?.pending),
    firstDate: raw?.first_date ?? null,
    lastDate: raw?.last_date ?? null,
  };
}

function toReport(raw: any): ProjectReport | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    closedOn: String(raw.closed_on ?? ""),
    auto: Boolean(raw.auto),
    budget: toNumber(raw.budget),
    cost: toNumber(raw.cost),
    gross: toNumber(raw.gross),
    compensation: toNumber(raw.compensation),
    income: toNumber(raw.income),
    variance: toNumber(raw.variance),
    variancePct: toNullableNumber(raw.variance_pct),
    transactions: toNumber(raw.transactions),
    pending: toNumber(raw.pending),
    days: toNumber(raw.days),
    topCategories: (raw.top_categories ?? []).map((row: any) => ({ name: String(row.name ?? ""), amount: toNumber(row.amount) })),
  };
}

function toProjectBase(raw: any) {
  return {
    id: String(raw.id),
    userId: String(raw.user_id),
    isOwner: Boolean(raw.is_owner),
    name: String(raw.name ?? ""),
    description: raw.description ?? null,
    kind: (KINDS.has(raw.kind) ? raw.kind : "other") as ProjectKind,
    icon: String(raw.icon ?? "target"),
    color: String(raw.color ?? "#3B82F6"),
    startDate: String(raw.start_date ?? "").slice(0, 10),
    endDate: String(raw.end_date ?? "").slice(0, 10),
    status: (raw.status === "archived" ? "archived" : "active") as ProjectStatus,
    archivedAt: raw.archived_at ?? null,
    goalId: raw.goal_id ?? null,
    goalName: raw.goal_name ?? null,
    ledgerId: raw.ledger_id ?? null,
    ledgerName: raw.ledger_name ?? null,
    ledgerStatus: raw.ledger_status === "settled" ? "settled" : raw.ledger_status === "open" ? "open" : null,
    finalReport: toReport(raw.final_report),
  } as const;
}

function toPayload(input: ProjectInput) {
  return parseOrThrow(projectSchema, {
    name: input.name,
    description: input.description,
    kind: input.kind,
    icon: input.icon,
    color: input.color,
    budget: roundCurrency(input.budget),
    start_date: input.startDate,
    end_date: input.endDate,
  });
}

function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return (touchTransactions = false, deletedProjectId: string | null = null) => {
    if (deletedProjectId) {
      // Detalhe do projeto excluído não pode ser refeito: o overview devolve 403
      // ("Projeto inexistente") e prendia a tela no projeto apagado.
      const detailKey = [...PROJECTS_QUERY_KEY, "detail", deletedProjectId];
      queryClient.cancelQueries({ queryKey: detailKey, exact: true });
    }
    const tasks = [
      queryClient.invalidateQueries({
        queryKey: PROJECTS_QUERY_KEY,
        predicate: (query) =>
          !deletedProjectId || !(query.queryKey[1] === "detail" && query.queryKey[2] === deletedProjectId),
      }),
      queryClient.invalidateQueries({ queryKey: ["cash-forecast"] }),
      queryClient.invalidateQueries({ queryKey: ["monthly-closing"] }),
      queryClient.invalidateQueries({ queryKey: ["user-notifications"] }),
    ];
    if (touchTransactions) {
      tasks.push(
        queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["budgets"] }),
        queryClient.invalidateQueries({ queryKey: ["ledgers"] }),
        queryClient.invalidateQueries({ queryKey: ["goals"] }),
      );
    }
    return Promise.all(tasks);
  };
}

export function useProjects({ enabled = true }: { enabled?: boolean } = {}) {
  const viewMode = useViewMode();
  const scope = viewMode === "couple" ? "couple" : "personal";
  const invalidate = useInvalidateProjects();

  const query = useQuery({
    queryKey: [...PROJECTS_QUERY_KEY, "list", scope],
    enabled,
    queryFn: async (): Promise<ProjectSummary[]> => {
      const { data, error } = await supabase.rpc("orbi_projects_list", { p_scope: scope });
      if (error) throw error;
      return ((data as any[]) ?? []).map((row) => ({ ...toProjectBase(row), totals: toTotals(row.totals) }));
    },
    staleTime: 30 * 1000,
    placeholderData: (previous) => previous,
  });

  const createProject = async (input: ProjectInput): Promise<string> => {
    const userId = await requireUserId();
    const payload = { user_id: userId, ...toPayload(input) } as TablesInsert<"projects">;
    const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
    if (error) throw error;
    await invalidate();
    return data.id;
  };

  const executeGoal = async (input: GoalExecutionInput): Promise<string> => {
    const args = parseOrThrow(goalExecuteSchema, {
      p_goal_id: input.goalId,
      p_name: input.name,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_kind: input.kind,
      p_extra_budget: roundCurrency(input.extraBudget || 0),
      p_with_ledger: input.withLedger,
    });
    const { data, error } = await supabase.rpc("orbi_goal_execute", args as Required<typeof args>);
    if (error) throw error;
    await invalidate(true);
    return String(data);
  };

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    scope,
    createProject,
    executeGoal,
  };
}

export function useProject(projectId: string | null) {
  const invalidate = useInvalidateProjects();

  const query = useQuery({
    queryKey: [...PROJECTS_QUERY_KEY, "detail", projectId],
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ProjectOverview | null> => {
      // Link quebrado/antigo (?projeto=<uuid inexistente>): `null` = estado
      // "projeto não encontrado", sem retry (igual Cartão e Evento).
      if (!isUuid(projectId)) return null;
      const { data, error } = await supabase.rpc("orbi_project_overview", { p_project_id: projectId });
      if (error) {
        if (error.code === "42501" && /inexistente/i.test(error.message ?? "")) return null;
        throw error;
      }
      const raw: any = data ?? {};
      const project = raw.project ?? {};
      return {
        project: {
          ...toProjectBase(project),
          budget: toNumber(project.budget),
          fundedFromGoal: toNumber(project.funded_from_goal),
        },
        totals: toTotals(raw.totals),
        pace: {
          daysTotal: toNumber(raw.pace?.days_total),
          daysElapsed: toNumber(raw.pace?.days_elapsed),
          timePct: toNumber(raw.pace?.time_pct),
          budgetPct: toNullableNumber(raw.pace?.budget_pct),
        },
        categories: (raw.categories ?? []).map((row: any) => ({
          categoryId: row.category_id ?? null,
          name: String(row.name ?? "Sem categoria"),
          icon: row.icon ?? null,
          amount: toNumber(row.amount),
          transactions: toNumber(row.transactions),
        })),
        timeline: (raw.timeline ?? []).map((row: any) => ({
          month: String(row.month ?? "").slice(0, 10),
          paid: toNumber(row.paid),
          pending: toNumber(row.pending),
        })),
        transactions: (raw.transactions ?? []).map((row: any) => ({
          id: String(row.id),
          date: String(row.date ?? "").slice(0, 10),
          description: String(row.description ?? ""),
          type: row.type,
          status: row.status,
          value: toNumber(row.value),
          compensation: toNumber(row.compensation),
          net: toNumber(row.net),
          categoryName: row.category_name ?? null,
          categoryIcon: row.category_icon ?? null,
          paymentLabel: row.payment_label ?? null,
          isShared: Boolean(row.is_shared),
          ledgerId: row.ledger_id ?? null,
        })),
      };
    },
    staleTime: 15 * 1000,
  });

  const requireId = () => assertUuid(projectId, "project_id");

  const updateProject = async (input: ProjectInput) => {
    const userId = await requireUserId();
    const payload: TablesUpdate<"projects"> = toPayload(input);
    const { error } = await supabase.from("projects").update(payload).eq("id", requireId()).eq("user_id", userId);
    if (error) throw error;
    await invalidate(true);
  };

  const deleteProject = async () => {
    const userId = await requireUserId();
    const id = requireId();
    const { data, error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", userId).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Projeto não encontrado ou sem permissão para excluir.");
    // Sem await: a tela sai do detalhe já; as listas se atualizam em segundo plano.
    void invalidate(true, id);
  };

  const archiveProject = async (): Promise<ProjectReport | null> => {
    const { data, error } = await supabase.rpc("orbi_project_archive", { p_project_id: requireId() });
    if (error) throw error;
    await invalidate();
    return toReport(data);
  };

  const reopenProject = async (endDate: string | null) => {
    const { error } = await supabase.rpc("orbi_project_reopen", {
      p_project_id: requireId(),
      p_end_date: endDate,
    });
    if (error) throw error;
    await invalidate();
  };

  const linkLedger = async (ledgerId: string) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("projects")
      .update({ ledger_id: parseOrThrow(uuidSchema, ledgerId) })
      .eq("id", requireId())
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate(true);
  };

  const attachTransactions = async (transactionIds: string[]) => {
    const userId = await requireUserId();
    const ids = transactionIds.slice(0, 200).map((id) => parseOrThrow(uuidSchema, id));
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("transactions")
      .update({ project_id: requireId() })
      .in("id", ids)
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate(true);
  };

  const detachTransaction = async (transactionId: string) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("transactions")
      .update({ project_id: null })
      .eq("id", assertUuid(transactionId, "transaction_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate(true);
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    updateProject,
    deleteProject,
    archiveProject,
    reopenProject,
    linkLedger,
    attachTransactions,
    detachTransaction,
  };
}

export function useProjectOptions({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...PROJECTS_QUERY_KEY, "options"],
    enabled,
    queryFn: async () => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, color, end_date")
        .eq("user_id", userId)
        .order("status", { ascending: true })
        .order("end_date", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; status: ProjectStatus; color: string; end_date: string }>;
    },
    staleTime: 60 * 1000,
  });
}

export function useAttachableTransactions(projectId: string | null, search: string, range: { from: string; to: string }) {
  return useQuery({
    queryKey: [...PROJECTS_QUERY_KEY, "attachable", projectId, search, range.from, range.to],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const userId = await requireUserId();
      let request = supabase
        .from("transactions")
        .select("id, description, value, date, type, status, project_id, categories(name)")
        .eq("user_id", userId)
        .neq("status", "CANCELED")
        .in("type", ["expense", "income"])
        .is("project_id", null)
        .gte("date", range.from)
        .lte("date", range.to)
        .order("date", { ascending: false })
        .limit(150);
      const term = search.trim().replace(/[%_\\]/g, " ").slice(0, 60);
      if (term) request = request.ilike("description", `%${term}%`);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: String(row.id),
        description: String(row.description ?? ""),
        value: toNumber(row.value),
        date: String(row.date ?? "").slice(0, 10),
        type: row.type as "income" | "expense",
        status: row.status as string,
        categoryName: row.categories?.name ?? null,
      }));
    },
    staleTime: 10 * 1000,
  });
}
