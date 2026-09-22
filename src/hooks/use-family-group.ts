import { getCachedAuthUser } from "@/hooks/use-current-user";
/**
 * Plano Casal — fluxo cru:
 *   criar grupo -> adicionar e-mail do parceiro -> parceiro abre o app e é vinculado.
 * Sem e-mail transacional, sem token, sem página de aceite.
 */
import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isOwnRow } from "@/lib/family-access";
import { SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";
import { QUOTA_QUERY_KEY } from "@/hooks/use-quota";

export interface FamilyMember {
  id: string;
  email: string;
  user_id: string | null;
  created_at: string;
}

/** Pessoa do grupo visível no modo Casal (RPC `orbi_family_directory`). */
export interface FamilyAuthor {
  userId: string;
  /** Primeiro nome; "Parceiro(a)" quando a conta não tem nome cadastrado. */
  name: string;
  /** Inicial para o avatar. */
  initial: string;
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

const FAMILY_GROUP_QUERY_KEY = ["family-group"] as const;

interface DirectoryRow {
  user_id: string;
  is_self: boolean;
  name: string | null;
}

function toAuthor(row: DirectoryRow): FamilyAuthor {
  const name = row.name?.trim() || (row.is_self ? "Você" : "Parceiro(a)");
  return {
    userId: row.user_id,
    name,
    initial: name.charAt(0).toLocaleUpperCase("pt-BR"),
    isSelf: row.is_self,
  };
}

export function useFamilyGroup() {
  const queryClient = useQueryClient();

  const fetchFamilyGroup = async (): Promise<FamilyGroupState> => {
    const { data: { user } } = await getCachedAuthUser();
    if (!user) return EMPTY;

    // Vincula convites pendentes endereçados ao e-mail deste usuário.
    await db.rpc("orbi_claim_family_invites");

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
      .select("id, email, user_id, created_at")
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

  const addPartner = async (email: string) => {
    const state = query.data;
    if (!state?.groupId) throw new Error("Crie o Plano Casal primeiro.");
    const { error } = await db
      .from("family_group_members")
      .insert({ family_group_id: state.groupId, email: email.trim().toLowerCase() });
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["family-group"] });
  };

  const removePartner = async (memberId: string) => {
    const { error } = await db.from("family_group_members").delete().eq("id", memberId);
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["family-group"] });
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
    addPartner,
    removePartner,
  };
}
