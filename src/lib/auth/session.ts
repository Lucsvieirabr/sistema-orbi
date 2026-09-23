import { isAuthRetryableFetchError, type Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/**
 * ============================================================================
 * LEITURA CONFIÁVEL DA SESSÃO
 * ============================================================================
 * `supabase.auth.getSession()` NÃO é um booleano de "está logado". Ele resolve
 * com `null` em situações transitórias e perfeitamente normais:
 *
 *   - o access token expirou e o refresh ainda está em voo;
 *   - outra aba (ou uma chamada anterior de `auth.updateUser`) está segurando
 *     o Web Lock `lock:orbi-auth` e a aquisição estourou o timeout;
 *   - o storage foi lido durante a reidratação do supabase-js.
 *
 * Tratar esse `null` como "anônimo" era a causa do bug de roteamento: quem
 * estava logado clicava em um plano, caía em `/login`, o App via a sessão viva
 * e devolvia para `/sistema`, e o `SubscriptionGuard` (sem plano) devolvia para
 * `/pricing` — pisca-pisca entre três rotas no meio do checkout.
 *
 * Nenhuma tela decide "não autenticado" por um único `getSession()`. Ela chama
 * `requireSession()`, que só devolve `null` depois de tentar renovar e de
 * confirmar com o servidor (`getUser()`) que não há usuário.
 *
 * Isto é UX/roteamento, não segurança: a autoridade continua sendo o RLS e as
 * RPCs `SECURITY DEFINER` do backend.
 * ============================================================================
 */

async function readSession(): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
}

/**
 * Sessão viva, ou `null` de verdade.
 *
 * Ordem: leitura local → renovação explícita → confirmação no servidor.
 * Cada etapa é tolerante a falha; só o conjunto vazio significa anônimo.
 */
export async function requireSession(): Promise<Session | null> {
  const current = await readSession();
  if (current) return current;

  // O refresh token pode estar válido mesmo sem sessão em memória.
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) return data.session;
  } catch {
    /* sem refresh token utilizável — segue para a confirmação no servidor */
  }

  // Última palavra: o GoTrue. `getUser()` bate na rede e reidrata o storage.
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
  } catch {
    return null;
  }

  return readSession();
}

/** `true` quando existe sessão utilizável agora. */
export async function hasLiveSession(): Promise<boolean> {
  return (await requireSession()) !== null;
}

/**
 * Sessão pronta para a PRIMEIRA query do app (boot e recuperação de 401).
 *
 * `getSession()` só renova quando o `expires_at` local diz que venceu. De um
 * dia para o outro isso não basta: relógio da máquina adiantado/atrasado,
 * sessão revogada no GoTrue ou chave de assinatura rotacionada deixam um JWT
 * que o cliente acha válido e o PostgREST recusa (401). O shell montava,
 * disparava as queries com esse token e só depois caía no /login.
 *
 * Aqui o servidor confirma o token (`getUser`) e, se ele for recusado, a
 * renovação acontece ANTES de liberar as rotas. Refresh recusado = sessão
 * morta de verdade → `null` (login direto, sem rajada de 401). Falha de rede
 * não derruba ninguém: segue com a sessão local.
 */
export async function bootSession(): Promise<Session | null> {
  const session = await requireSession();
  if (!session) return null;

  const { error } = await supabase.auth.getUser(session.access_token);
  if (!error) return (await readSession()) ?? session;
  if (isAuthRetryableFetchError(error)) return session;

  // `getUser` pode ter limpado o storage (session_not_found): o refresh token
  // vai explícito.
  const { data } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token });
  return data.session ?? null;
}
