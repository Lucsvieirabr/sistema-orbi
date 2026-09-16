/**
 * Contratos de rateio (módulo premium — Pro/Casal).
 *
 * Um contrato amarra pessoa + categoria de gasto a um percentual: quanto do
 * valor a pessoa compensa. No lançamento, a regra vira SUGESTÃO pré-preenchida
 * — nunca trava o valor. RLS + trigger `orbi_split_contracts_guard` validam
 * feature, dono da pessoa e tipo da categoria.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { toNumber } from "@/components/planning/planning-utils";
import { assertUuid, roundCurrency } from "@/lib/utils";
import { parseOrThrow, splitContractSchema } from "@/lib/validation/schemas";

export interface SplitContract {
  id: string;
  user_id: string;
  person_id: string;
  person_name: string;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  /** % do valor que a pessoa compensa (0–100). */
  proportion_percentage: number;
  note: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SplitContractInput {
  personId: string;
  categoryId: string;
  percentage: number;
  note: string | null;
  isActive: boolean;
}

export const SPLIT_CONTRACTS_QUERY_KEY = ["split-contracts"] as const;

async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre de novo para continuar.");
  return user.id;
}

export function useSplitContracts({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SPLIT_CONTRACTS_QUERY_KEY,
    enabled,
    queryFn: async (): Promise<SplitContract[]> => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("split_contracts")
        .select(
          "id, user_id, person_id, category_id, proportion_percentage, note, is_active, created_at, people(name), categories(name, icon)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        person_id: row.person_id,
        person_name: row.people?.name ?? "Pessoa",
        category_id: row.category_id,
        category_name: row.categories?.name ?? "Categoria",
        category_icon: row.categories?.icon ?? null,
        proportion_percentage: toNumber(row.proportion_percentage),
        note: row.note ?? null,
        is_active: row.is_active !== false,
        created_at: row.created_at,
      }));
    },
    staleTime: 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: SPLIT_CONTRACTS_QUERY_KEY });

  const toPayload = (input: SplitContractInput) =>
    parseOrThrow(splitContractSchema, {
      person_id: input.personId,
      category_id: input.categoryId,
      proportion_percentage: Math.round(input.percentage * 100) / 100,
      note: input.note,
      is_active: input.isActive,
    });

  const createContract = async (input: SplitContractInput) => {
    const userId = await requireUserId();
    const safe = toPayload(input);
    const payload: TablesInsert<"split_contracts"> = {
      user_id: userId,
      person_id: safe.person_id,
      category_id: safe.category_id,
      proportion_percentage: safe.proportion_percentage,
      note: safe.note,
      is_active: safe.is_active,
    };
    const { error } = await supabase.from("split_contracts").insert(payload);
    if (error) throw error;
    await invalidate();
  };

  const updateContract = async (id: string, input: SplitContractInput) => {
    const userId = await requireUserId();
    const safe = toPayload(input);
    const { error } = await supabase
      .from("split_contracts")
      .update({
        person_id: safe.person_id,
        category_id: safe.category_id,
        proportion_percentage: safe.proportion_percentage,
        note: safe.note,
        is_active: safe.is_active,
      })
      .eq("id", assertUuid(id, "contract_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  const toggleContract = async (id: string, isActive: boolean) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("split_contracts")
      .update({ is_active: isActive })
      .eq("id", assertUuid(id, "contract_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  const deleteContract = async (id: string) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("split_contracts")
      .delete()
      .eq("id", assertUuid(id, "contract_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  return {
    contracts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createContract,
    updateContract,
    toggleContract,
    deleteContract,
  };
}

export interface SplitSuggestion {
  /** Total a ser compensado pelas pessoas selecionadas. */
  total: number;
  /** Quanto cada pessoa compensa (soma = total). */
  perPerson: Record<string, number>;
  /** Contratos que moldaram a sugestão. */
  matched: SplitContract[];
}

/**
 * Sugestão de compensação para um gasto rateado.
 * Pessoa com contrato ativo na categoria → percentual do contrato.
 * Pessoa sem contrato → divisão igual entre todos (você incluído).
 */
export function suggestCompensation(
  value: number,
  categoryId: string | null | undefined,
  personIds: string[],
  contracts: SplitContract[],
): SplitSuggestion {
  const gross = Math.max(0, roundCurrency(value || 0));
  const equalShare = personIds.length > 0 ? 100 / (personIds.length + 1) : 0;
  const matched: SplitContract[] = [];
  const perPerson: Record<string, number> = {};

  personIds.forEach((personId) => {
    const contract = categoryId
      ? contracts.find((c) => c.is_active && c.person_id === personId && c.category_id === categoryId)
      : undefined;
    if (contract) matched.push(contract);
    const pct = contract ? contract.proportion_percentage : equalShare;
    perPerson[personId] = roundCurrency((gross * pct) / 100);
  });

  const total = roundCurrency(Object.values(perPerson).reduce((sum, v) => sum + v, 0));
  return { total: Math.min(total, gross), perPerson, matched };
}

/** Redistribui um total editado à mão na mesma proporção da sugestão. Resíduo vai para a última pessoa. */
export function distributeCompensation(total: number, personIds: string[], weights: Record<string, number>): Record<string, number> {
  const safeTotal = Math.max(0, roundCurrency(total || 0));
  const result: Record<string, number> = {};
  if (personIds.length === 0) return result;

  const weightSum = personIds.reduce((sum, id) => sum + Math.max(0, weights[id] ?? 0), 0);
  let assigned = 0;
  personIds.forEach((id, index) => {
    if (index === personIds.length - 1) {
      result[id] = roundCurrency(safeTotal - assigned);
      return;
    }
    const share = weightSum > 0 ? Math.max(0, weights[id] ?? 0) / weightSum : 1 / personIds.length;
    result[id] = roundCurrency(safeTotal * share);
    assigned = roundCurrency(assigned + result[id]);
  });
  return result;
}
