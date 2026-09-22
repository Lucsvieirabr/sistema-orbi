import { getCachedAuthUser } from "@/hooks/use-current-user";
/**
 * Plano Casal — guarda de escrita.
 * No modo Casal o usuário LÊ os registros do parceiro, mas nunca escreve neles
 * (RLS já bloqueia; aqui a falha vira mensagem clara em vez de erro genérico).
 */
import { supabase } from "@/integrations/supabase/client";

export const PARTNER_READ_ONLY_MESSAGE =
  "Este registro é do seu parceiro. No modo Casal a visualização é somente leitura.";

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await getCachedAuthUser();
  return user?.id ?? null;
}

/** true se a linha pertence ao usuário logado (ou se não há dono definido). */
export function isOwnRow(rowUserId: string | null | undefined, currentUserId: string | null | undefined): boolean {
  if (!rowUserId || !currentUserId) return true;
  return rowUserId === currentUserId;
}

/** Lança erro se a transação não for do usuário logado. */
export async function assertOwnTransaction(transactionId: string): Promise<void> {
  const currentUserId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("transactions")
    .select("user_id")
    .eq("id", transactionId)
    .single();
  if (error) throw error;
  if (!isOwnRow(data?.user_id, currentUserId)) throw new Error(PARTNER_READ_ONLY_MESSAGE);
}
