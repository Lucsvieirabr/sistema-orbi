import { getCachedAuthUser } from "@/hooks/use-current-user";
/**
 * Plano Casal — fluxo cru:
 *   criar grupo -> adicionar e-mail do parceiro -> parceiro abre o app e é vinculado.
 * Sem e-mail transacional, sem token, sem página de aceite.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isOwnRow } from "@/lib/family-access";

export interface FamilyMember {
  id: string;
  email: string;
  user_id: string | null;
  created_at: string;
}

export interface FamilyGroupState {
  groupId: string | null;
  ownerId: string | null;
  isOwner: boolean;
  members: FamilyMember[];
  currentUserId: string | null;
  /** Grupo com 2 pessoas efetivamente vinculadas -> modo Casal disponível */
  isLinked: boolean;
}

const db = supabase as any;

const EMPTY: FamilyGroupState = {
  groupId: null,
  ownerId: null,
  isOwner: false,
  members: [],
  currentUserId: null,
  isLinked: false,
};

export function useFamilyGroup() {
  const queryClient = useQueryClient();

  const fetchFamilyGroup = async (): Promise<FamilyGroupState> => {
    const { data: { user } } = await getCachedAuthUser();
    if (!user) return EMPTY;

    // Vincula convites pendentes endereçados ao e-mail deste usuário.
    await db.rpc("orbi_claim_family_invites");

    const { data: groupId, error: rpcError } = await db.rpc("orbi_my_family_group_id");
    if (rpcError) throw rpcError;
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

    const memberList: FamilyMember[] = members ?? [];
    const isOwner = group?.owner_id === user.id;

    return {
      groupId,
      ownerId: group?.owner_id ?? null,
      isOwner,
      members: memberList,
      currentUserId: user.id,
      isLinked: isOwner ? memberList.some((m) => !!m.user_id) : true,
    };
  };

  const query = useQuery({
    queryKey: ["family-group"],
    queryFn: fetchFamilyGroup,
  });

  useEffect(() => {
    const channel = supabase
      .channel("family-group-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "family_group_members" }, () => {
        queryClient.invalidateQueries({ queryKey: ["family-group"] });
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

  return {
    ...state,
    isMine,
    isLoading: query.isLoading,
    error: query.error,
    createGroup,
    addPartner,
    removePartner,
  };
}
