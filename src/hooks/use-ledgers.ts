/**
 * Acertos de viagem / Mini-ledgers (módulo premium — Pro/Casal).
 *
 * Um evento agrupa: (1) transações do dono vinculadas por `transactions.ledger_id`
 * e (2) gastos pagos por outros participantes (`ledger_entries`). O fechamento
 * — quem pagou, quanto cabia a cada um e as transferências mínimas — vem
 * agregado da RPC `orbi_ledger_summary`. "Liquidar lote" é a RPC
 * `orbi_ledger_settle` (PENDING → PAID em todas as transações do evento).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { toNumber } from "@/components/planning/planning-utils";
import { assertUuid, roundCurrency } from "@/lib/utils";
import {
  ledgerEntrySchema,
  ledgerParticipantSchema,
  ledgerSchema,
  parseOrThrow,
} from "@/lib/validation/schemas";

export type LedgerStatus = "open" | "settled";

export interface Ledger {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  owner_weight: number;
  pix_key: string | null;
  pix_name: string | null;
  status: LedgerStatus;
  settled_at: string | null;
  created_at: string;
  transactions_count: number;
  entries_count: number;
  participants_count: number;
}

export interface LedgerInput {
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerWeight: number;
  pixKey: string | null;
  pixName: string | null;
}

export interface LedgerParticipantRow {
  id: string;
  person_id: string;
  name: string;
  pix: string | null;
  weight: number;
}

export interface LedgerEntryRow {
  id: string;
  paid_by_person_id: string;
  payer_name: string;
  description: string;
  value: number;
  entry_date: string;
}

export interface LedgerTransactionRow {
  id: string;
  description: string;
  value: number;
  date: string;
  type: string;
  status: string;
  category_name: string | null;
}

export interface LedgerBalance {
  key: string;
  person_id: string | null;
  name: string;
  pix: string | null;
  weight: number;
  paid: number;
  share: number;
  balance: number;
}

export interface LedgerTransfer {
  from_key: string;
  from_name: string;
  to_key: string;
  to_name: string;
  to_pix: string | null;
  amount: number;
}

export interface LedgerSummary {
  status: LedgerStatus;
  settled_at: string | null;
  total: number;
  participants: LedgerBalance[];
  transfers: LedgerTransfer[];
  transactions_count: number;
  pending_count: number;
  entries_count: number;
}

export const LEDGERS_QUERY_KEY = ["ledgers"] as const;

async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre de novo para continuar.");
  return user.id;
}

const countOf = (value: unknown) => toNumber(Array.isArray(value) ? (value[0] as any)?.count : (value as any)?.count);

function toLedger(row: any): Ledger {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description ?? null,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    owner_weight: toNumber(row.owner_weight),
    pix_key: row.pix_key ?? null,
    pix_name: row.pix_name ?? null,
    status: row.status === "settled" ? "settled" : "open",
    settled_at: row.settled_at ?? null,
    created_at: row.created_at,
    transactions_count: countOf(row.transactions),
    entries_count: countOf(row.ledger_entries),
    participants_count: countOf(row.ledger_participants),
  };
}

const LEDGER_COLUMNS =
  "id, user_id, name, description, start_date, end_date, owner_weight, pix_key, pix_name, status, settled_at, created_at, transactions(count), ledger_entries(count), ledger_participants(count)";

function ledgerPayload(input: LedgerInput) {
  return parseOrThrow(ledgerSchema, {
    name: input.name,
    description: input.description,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    owner_weight: Math.round(input.ownerWeight * 100) / 100,
    pix_key: input.pixKey,
    pix_name: input.pixName,
  });
}

/** Lista de eventos (abertos primeiro). */
export function useLedgers({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: LEDGERS_QUERY_KEY,
    enabled,
    queryFn: async (): Promise<Ledger[]> => {
      const { data, error } = await supabase
        .from("ledgers")
        .select(LEDGER_COLUMNS)
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toLedger);
    },
    staleTime: 30 * 1000,
  });

  const createLedger = async (input: LedgerInput): Promise<string> => {
    const userId = await requireUserId();
    const safe = ledgerPayload(input);
    const payload: TablesInsert<"ledgers"> = { user_id: userId, ...safe };
    const { data, error } = await supabase.from("ledgers").insert(payload).select("id").single();
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: LEDGERS_QUERY_KEY });
    return data.id;
  };

  return {
    ledgers: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createLedger,
  };
}

/** Um evento com participantes, gastos, transações vinculadas e o fechamento. */
export function useLedger(ledgerId: string | null) {
  const queryClient = useQueryClient();
  const key = [...LEDGERS_QUERY_KEY, "detail", ledgerId] as const;

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(ledgerId),
    queryFn: async () => {
      const id = assertUuid(ledgerId, "ledger_id");
      const [ledgerRes, participantsRes, entriesRes, transactionsRes, summaryRes] = await Promise.all([
        supabase.from("ledgers").select(LEDGER_COLUMNS).eq("id", id).single(),
        supabase
          .from("ledger_participants")
          .select("id, person_id, weight, people(name, pix)")
          .eq("ledger_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("ledger_entries")
          .select("id, paid_by_person_id, description, value, entry_date, people(name)")
          .eq("ledger_id", id)
          .order("entry_date", { ascending: false }),
        supabase
          .from("transactions")
          .select("id, description, value, date, type, status, categories(name)")
          .eq("ledger_id", id)
          .neq("status", "CANCELED")
          .order("date", { ascending: false }),
        supabase.rpc("orbi_ledger_summary", { p_ledger_id: id }),
      ]);

      if (ledgerRes.error) throw ledgerRes.error;
      if (participantsRes.error) throw participantsRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (transactionsRes.error) throw transactionsRes.error;
      if (summaryRes.error) throw summaryRes.error;

      const raw: any = summaryRes.data ?? {};
      const summary: LedgerSummary = {
        status: raw.status === "settled" ? "settled" : "open",
        settled_at: raw.settled_at ?? null,
        total: toNumber(raw.total),
        participants: (raw.participants ?? []).map((row: any) => ({
          key: String(row.key),
          person_id: row.person_id ?? null,
          name: row.name ?? "Participante",
          pix: row.pix ?? null,
          weight: toNumber(row.weight),
          paid: toNumber(row.paid),
          share: toNumber(row.share),
          balance: toNumber(row.balance),
        })),
        transfers: (raw.transfers ?? []).map((row: any) => ({
          from_key: String(row.from_key),
          from_name: row.from_name ?? "",
          to_key: String(row.to_key),
          to_name: row.to_name ?? "",
          to_pix: row.to_pix ?? null,
          amount: toNumber(row.amount),
        })),
        transactions_count: toNumber(raw.transactions_count),
        pending_count: toNumber(raw.pending_count),
        entries_count: toNumber(raw.entries_count),
      };

      return {
        ledger: toLedger(ledgerRes.data),
        participants: (participantsRes.data ?? []).map((row: any) => ({
          id: row.id,
          person_id: row.person_id,
          name: row.people?.name ?? "Pessoa",
          pix: row.people?.pix ?? null,
          weight: toNumber(row.weight),
        })) as LedgerParticipantRow[],
        entries: (entriesRes.data ?? []).map((row: any) => ({
          id: row.id,
          paid_by_person_id: row.paid_by_person_id,
          payer_name: row.people?.name ?? "Pessoa",
          description: row.description,
          value: toNumber(row.value),
          entry_date: row.entry_date,
        })) as LedgerEntryRow[],
        transactions: (transactionsRes.data ?? []).map((row: any) => ({
          id: row.id,
          description: row.description,
          value: toNumber(row.value),
          date: row.date,
          type: row.type,
          status: row.status,
          category_name: row.categories?.name ?? null,
        })) as LedgerTransactionRow[],
        summary,
      };
    },
    staleTime: 15 * 1000,
  });

  const invalidate = async (touchTransactions = false) => {
    const tasks = [queryClient.invalidateQueries({ queryKey: LEDGERS_QUERY_KEY })];
    if (touchTransactions) {
      tasks.push(
        queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["balances"] }),
        queryClient.invalidateQueries({ queryKey: ["projected-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["person-transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["cash-forecast"] }),
      );
    }
    await Promise.all(tasks);
  };

  const requireId = () => assertUuid(ledgerId, "ledger_id");

  const updateLedger = async (input: LedgerInput) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("ledgers")
      .update(ledgerPayload(input))
      .eq("id", requireId())
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  const savePix = async (pixKey: string | null, pixName: string | null) => {
    const userId = await requireUserId();
    const current = query.data?.ledger;
    if (!current) return;
    const safe = ledgerPayload({
      name: current.name,
      description: current.description,
      startDate: current.start_date,
      endDate: current.end_date,
      ownerWeight: current.owner_weight,
      pixKey,
      pixName,
    });
    const { error } = await supabase
      .from("ledgers")
      .update({ pix_key: safe.pix_key, pix_name: safe.pix_name })
      .eq("id", requireId())
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  const deleteLedger = async () => {
    const userId = await requireUserId();
    const { error } = await supabase.from("ledgers").delete().eq("id", requireId()).eq("user_id", userId);
    if (error) throw error;
    await invalidate(true);
  };

  const reopenLedger = async () => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("ledgers")
      .update({ status: "open" })
      .eq("id", requireId())
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  const addParticipant = async (personId: string, weight: number) => {
    const userId = await requireUserId();
    const safe = parseOrThrow(ledgerParticipantSchema, { ledger_id: requireId(), person_id: personId, weight });
    const payload: TablesInsert<"ledger_participants"> = { user_id: userId, ...safe };
    const { error } = await supabase.from("ledger_participants").insert(payload);
    if (error) throw error;
    await invalidate();
  };

  const updateParticipantWeight = async (participantId: string, weight: number) => {
    const userId = await requireUserId();
    const safe = parseOrThrow(ledgerParticipantSchema.shape.weight, weight);
    const { error } = await supabase
      .from("ledger_participants")
      .update({ weight: safe })
      .eq("id", assertUuid(participantId, "participant_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  /** Remove o participante e os gastos que ele pagou neste evento (sem ele, não entram no rateio). */
  const removeParticipant = async (participantId: string) => {
    const userId = await requireUserId();
    const participant = query.data?.participants.find((row) => row.id === participantId);
    if (participant) {
      const { error: entriesError } = await supabase
        .from("ledger_entries")
        .delete()
        .eq("ledger_id", requireId())
        .eq("paid_by_person_id", assertUuid(participant.person_id, "person_id"))
        .eq("user_id", userId);
      if (entriesError) throw entriesError;
    }
    const { error } = await supabase
      .from("ledger_participants")
      .delete()
      .eq("id", assertUuid(participantId, "participant_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  const updateOwnerWeight = async (weight: number) => {
    const current = query.data?.ledger;
    if (!current) return;
    await updateLedger({
      name: current.name,
      description: current.description,
      startDate: current.start_date,
      endDate: current.end_date,
      ownerWeight: weight,
      pixKey: current.pix_key,
      pixName: current.pix_name,
    });
  };

  const addEntry = async (values: { personId: string; description: string; value: number; date: string }) => {
    const userId = await requireUserId();
    const safe = parseOrThrow(ledgerEntrySchema, {
      ledger_id: requireId(),
      paid_by_person_id: values.personId,
      description: values.description,
      value: roundCurrency(values.value),
      entry_date: values.date,
    });
    const payload: TablesInsert<"ledger_entries"> = { user_id: userId, ...safe };
    const { error } = await supabase.from("ledger_entries").insert(payload);
    if (error) throw error;
    await invalidate();
  };

  const deleteEntry = async (entryId: string) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("ledger_entries")
      .delete()
      .eq("id", assertUuid(entryId, "entry_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate();
  };

  /** Tira a transação do evento (ela continua no extrato). */
  const detachTransaction = async (transactionId: string) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("transactions")
      .update({ ledger_id: null })
      .eq("id", assertUuid(transactionId, "transaction_id"))
      .eq("user_id", userId);
    if (error) throw error;
    await invalidate(true);
  };

  /** Liquidar lote: todas as transações pendentes do evento → PAID, evento → liquidado. */
  const settleLedger = async (): Promise<number> => {
    const { data, error } = await supabase.rpc("orbi_ledger_settle", { p_ledger_id: requireId() });
    if (error) throw error;
    await invalidate(true);
    return toNumber((data as any)?.updated);
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    updateLedger,
    savePix,
    deleteLedger,
    reopenLedger,
    addParticipant,
    updateParticipantWeight,
    removeParticipant,
    updateOwnerWeight,
    addEntry,
    deleteEntry,
    detachTransaction,
    settleLedger,
  };
}

/** Eventos abertos — para o seletor do lançamento. */
export function useOpenLedgers({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...LEDGERS_QUERY_KEY, "open-options"],
    enabled,
    queryFn: async () => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("ledgers")
        .select("id, name, status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; status: LedgerStatus }>;
    },
    staleTime: 60 * 1000,
  });
}
