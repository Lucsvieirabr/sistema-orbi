import { getCachedAuthUser } from "@/hooks/use-current-user";
/**
 * Plano Casal — convite com aceite explícito:
 *   criar grupo -> convidar e-mail (Edge Function `family-invite`: convite
 *   pendente + e-mail com link) -> parceiro aceita em /invite/accept.
 * Nada é compartilhado enquanto o convite está pendente.
 */
import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isOwnRow } from "@/lib/family-access";
import { initialsOf, isAvatarPath } from "@/lib/avatar";
import { SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";
import { QUOTA_QUERY_KEY } from "@/hooks/use-quota";
import { invoke } from "@/hooks/use-payment";

export interface FamilyMember {
  id: string;
  email: string;
  user_id: string | null;
  /** pending = convite aguardando aceite; active = parceiro vinculado. */
  status: "pending" | "active";
  /** Validade do link atual (null: vínculo ativo ou convite antigo nunca enviado). */
  invite_expires_at: string | null;
  invite_sent_at: string | null;
  created_at: string;
}

interface InviteResponse {
  email_sent: boolean;
}

/** Pessoa do grupo visível no modo Casal (RPC `orbi_family_directory`). */
export interface FamilyAuthor {
  userId: string;
  /** Apelido (display_name) ou primeiro nome; "Parceiro(a)" sem nome algum. */
  name: string;
  /** Primeira letra do nome (glifos minúsculos). */
  initial: string;
  /** Até 2 iniciais ("João Silva" → "JS"); vazio quando não há nome real. */
  initials: string;
  /** Caminho no bucket privado `avatars` (resolvido por signed URL no `<UserAvatar>`). */
  avatarPath: string | null;
  isSelf: boolean;
}

export interface FamilyGroupState {
  groupId: string | null;
  ownerId: string | null;
  isOwner: boolean;
  members: FamilyMember[];
  currentUserId: string | null;
  /**
   * Leitura compartilhada ATIVA: 2+ pessoas vinculadas e o dono ainda com
   * `familia_compartilhada`. Downgrade do dono desliga o modo Casal.
   */
  isLinked: boolean;
  /** Quem aparece no modo Casal (eu primeiro). Vazio fora do Casal. */
  directory: FamilyAuthor[];
}

const db = supabase as any;

const EMPTY: FamilyGroupState = {
  groupId: null,
  ownerId: null,
  isOwner: false,
  members: [],
  currentUserId: null,
  isLinked: false,
  directory: [],
};

export const FAMILY_GROUP_QUERY_KEY = ["family-group"] as const;

interface DirectoryRow {
  user_id: string;
  is_self: boolean;
  name: string | null;
  avatar_path?: string | null;
}

export function toAuthor(row: DirectoryRow): FamilyAuthor {
  const realName = row.name?.trim() || "";
  const name = realName || (row.is_self ? "Você" : "Parceiro(a)");
  return {
    userId: row.user_id,
    name,
    initial: name.charAt(0).toLocaleUpperCase("pt-BR"),
    initials: initialsOf(realName),
    avatarPath: isAvatarPath(row.avatar_path) ? row.avatar_path : null,
    isSelf: row.is_self,
  };
}

export function useFamilyGroup() {
  const queryClient = useQueryClient();

  const fetchFamilyGroup = async (): Promise<FamilyGroupState> => {
    const { data: { user } } = await getCachedAuthUser();
    if (!user) return EMPTY;

    const { data: groupId, error: rpcError } = await db.rpc("orbi_my_family_group_id");
    if (rpcError) throw rpcError;

    // Vínculo novo (ou desfeito) muda o plano efetivo do parceiro: o status da
    // assinatura e a cota precisam ser relidos, senão ele segue preso em /pricing.
    const previous = queryClient.getQueryData<FamilyGroupState>(FAMILY_GROUP_QUERY_KEY);
    if (previous && (previous.groupId ?? null) !== (groupId ?? null)) {
      void queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: QUOTA_QUERY_KEY });
    }

    if (!groupId) return { ...EMPTY, currentUserId: user.id };

    const { data: group, error: groupError } = await db
      .from("family_groups")
      .select("id, owner_id, created_at")
      .eq("id", groupId)
      .maybeSingle();
    if (groupError) throw groupError;

    const { data: members, error: membersError } = await db
      .from("family_group_members")
      .select("id, email, user_id, status, invite_expires_at, invite_sent_at, created_at")
      .eq("family_group_id", groupId);
    if (membersError) throw membersError;

    // Diretório já passa pelo gate do banco (dono com familia_compartilhada).
    const { data: directoryRows, error: directoryError } = await db.rpc("orbi_family_directory");
    if (directoryError) throw directoryError;

    const memberList: FamilyMember[] = members ?? [];
    const isOwner = group?.owner_id === user.id;
    const directory = (Array.isArray(directoryRows) ? (directoryRows as DirectoryRow[]) : []).map(toAuthor);

    return {
      groupId,
      ownerId: group?.owner_id ?? null,
      isOwner,
      members: memberList,
      currentUserId: user.id,
      isLinked: directory.length > 1,
      directory: directory.length > 1 ? directory : [],
    };
  };

  const query = useQuery({
    queryKey: FAMILY_GROUP_QUERY_KEY,
    queryFn: fetchFamilyGroup,
    // Vínculo muda raramente e o canal realtime abaixo invalida na hora:
    // sem isto cada modal/rota que monta o hook refazia as RPCs de família.
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("family-group-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "family_group_members" }, () => {
        queryClient.invalidateQueries({ queryKey: FAMILY_GROUP_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: QUOTA_QUERY_KEY });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createGroup = async () => {
    const { data: { user } } = await getCachedAuthUser();
    const { data, error } = await db
      .from("family_groups")
      .insert({ owner_id: user!.id })
      .select()
      .single();
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["family-group"] });
    return data;
  };

  /**
   * Convida (ou reenvia para) um e-mail. Reenviar troca o link: o anterior
   * para de funcionar. `false` = convite salvo, mas o e-mail não saiu.
   */
  const invitePartner = async (email: string): Promise<boolean> => {
    if (!query.data?.groupId) throw new Error("Crie o Plano Casal primeiro.");
    try {
      const { email_sent } = await invoke<InviteResponse>("family-invite", { email: email.trim().toLowerCase() });
      return email_sent;
    } finally {
      await queryClient.invalidateQueries({ queryKey: FAMILY_GROUP_QUERY_KEY });
    }
  };

  const removePartner = async (memberId: string) => {
    const { error } = await db.from("family_group_members").delete().eq("id", memberId);
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["family-group"] });
  };

  /**
   * Parceiro sai do Plano Casal: apaga o próprio vínculo. O dono deixa de ver
   * os dados dele e o plano herdado acaba na hora. Não invalida cache: quem
   * chama recarrega a página ao fim da cena de saída (invalidar antes faria o
   * guard de assinatura trocar de rota no meio da animação).
   */
  const leaveGroup = async () => {
    const { data: { user } } = await getCachedAuthUser();
    if (!user) throw new Error("Sessão expirada. Entre novamente.");
    const { error } = await db
      .from("family_group_members")
      .delete()
      .eq("user_id", user.id)
      .eq("status", "active");
    if (error) throw error;
  };

  const state = query.data ?? EMPTY;

  /** true se a linha (conta, cartão, transação) pertence ao usuário logado */
  const isMine = (rowUserId?: string | null) => isOwnRow(rowUserId, state.currentUserId);

  /**
   * Autor de uma linha no modo Casal (selo "quem lançou").
   * `null` fora do Casal ou para user_id fora do grupo visível.
   */
  const { directory } = state;
  const authorOf = useCallback(
    (rowUserId?: string | null): FamilyAuthor | null =>
      (rowUserId && directory.find((person) => person.userId === rowUserId)) || null,
    [directory],
  );

  return {
    ...state,
    isMine,
    authorOf,
    isLoading: query.isLoading,
    error: query.error,
    createGroup,
    invitePartner,
    removePartner,
    leaveGroup,
  };
}
