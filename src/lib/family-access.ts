import { getCachedAuthUser } from "@/hooks/use-current-user";
/**
 * Plano Casal — regras de escrita no espaço compartilhado.
 *
 *   - Transações: os dois EDITAM (policy `family_update_transactions`), com o
 *     trigger `orbi_transactions_family_guard` limitando o parceiro a
 *     descrição, valor, data, categoria, status e pagador. Excluir segue só
 *     com quem lançou.
 *   - Contas, cartões, pessoas, metas: escrita só do dono (RLS).
 *
 * Aqui a falha do banco vira mensagem clara em vez de erro genérico.
 */
import { supabase } from "@/integrations/supabase/client";

export const PARTNER_READ_ONLY_MESSAGE =
  "Este registro é do seu parceiro. Contas, cartões e cadastros só podem ser alterados por quem os criou.";

export const PARTNER_DELETE_MESSAGE =
  "Só quem lançou a transação pode excluí-la. Você pode editar os detalhes no Nosso espaço.";

export const SHARED_EDIT_DENIED_MESSAGE =
  "Você não tem permissão para alterar esta transação. Verifique se o Plano Casal continua ativo.";

export const TRANSACTION_NOT_FOUND_MESSAGE =
  "Transação não encontrada. Ela pode ter sido excluída ou não está mais compartilhada com você.";

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await getCachedAuthUser();
  return user?.id ?? null;
}

/** true se a linha pertence ao usuário logado (ou se não há dono definido). */
export function isOwnRow(rowUserId: string | null | undefined, currentUserId: string | null | undefined): boolean {
  if (!rowUserId || !currentUserId) return true;
  return rowUserId === currentUserId;
}

let claimInFlight: Promise<void> | null = null;
/**
 * Claim já feito nesta aba (usuário + confirmação de e-mail): 1 RPC por sessão,
 * não por render/rota. Confirmar o e-mail muda a chave e libera novo claim.
 */
let claimedKey: string | null = null;

/**
 * Vincula convites pendentes do Plano Casal ao usuário logado
 * (RPC `orbi_claim_family_invites`, idempotente, só com e-mail confirmado).
 *
 * Roda ANTES de ler o status da assinatura: o convidado herda o plano do dono,
 * e sem o vínculo o primeiro acesso dele cairia em `no_plan` → /pricing.
 * Falha aqui nunca bloqueia o fluxo — o status segue como está no servidor.
 */
export function claimFamilyInvites(): Promise<void> {
  if (claimInFlight) return claimInFlight;

  claimInFlight = (async () => {
    try {
      // Sessão local (sem rede): o cache do usuário pode estar atrasado logo após o login.
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      const key = user ? `${user.id}:${user.email_confirmed_at ?? ""}` : null;
      if (!key || key === claimedKey) return;
      const { error } = await supabase.rpc("orbi_claim_family_invites");
      if (!error) claimedKey = key;
    } catch {
      /* best-effort: o servidor decide o acesso */
    } finally {
      claimInFlight = null;
    }
  })();

  return claimInFlight;
}

/**
 * Lança erro se a transação não for do usuário logado (usado antes de EXCLUIR).
 * `maybeSingle` + RLS: sem filtro de user_id no client — linha invisível vira
 * "não encontrada", nunca PGRST116.
 */
export async function assertOwnTransaction(transactionId: string): Promise<void> {
  const currentUserId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("transactions")
    .select("user_id")
    .eq("id", transactionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(TRANSACTION_NOT_FOUND_MESSAGE);
  if (!isOwnRow(data.user_id, currentUserId)) throw new Error(PARTNER_DELETE_MESSAGE);
}
