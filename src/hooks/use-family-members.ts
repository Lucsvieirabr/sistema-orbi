import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type FamilyMember = Tables<"family_members">;

export function useFamilyMembers() {
  const queryClient = useQueryClient();

  const fetchFamilyMembers = async (): Promise<FamilyMember[]> => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const { data, error } = await supabase
      .from("family_members")
      .select("id, user_id, name, created_at")
      .eq("user_id", user?.id ?? "");
    if (error) throw error;
    return data ?? [];
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["family_members"],
    queryFn: fetchFamilyMembers,
  });

  useEffect(() => {
    const channel = supabase
      .channel("family_members-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_members" },
        () => queryClient.invalidateQueries({ queryKey: ["family_members"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createFamilyMember = async (values: Pick<TablesInsert<"family_members">, "name">) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: TablesInsert<"family_members"> = { name: values.name, user_id: user!.id };
    const { error } = await supabase.from("family_members").insert(payload);
    if (error) throw error;
  };

  const updateFamilyMember = async (id: string, values: Pick<TablesUpdate<"family_members">, "name">) => {
    const { error } = await supabase.from("family_members").update({ name: values.name }).eq("id", id);
    if (error) throw error;
  };

  const deleteFamilyMember = async (id: string) => {
    // A exclusão é permitida pois as transações têm ON DELETE SET NULL
    const { error } = await supabase.from("family_members").delete().eq("id", id);
    if (error) throw error;
  };

  return {
    familyMembers: data ?? [],
    isLoading,
    error,
    createFamilyMember,
    updateFamilyMember,
    deleteFamilyMember,
  };
}
