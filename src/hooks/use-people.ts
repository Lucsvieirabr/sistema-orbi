import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Person = Tables<"people">;

export function usePeople() {
  const queryClient = useQueryClient();

  const fetchPeople = async (): Promise<Person[]> => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const { data, error } = await supabase
      .from("people")
      .select("id, user_id, name, created_at")
      .eq("user_id", user?.id ?? "");
    if (error) throw error;
    return data ?? [];
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["people"],
    queryFn: fetchPeople,
  });

  useEffect(() => {
    const channel = supabase
      .channel("people-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people" },
        () => queryClient.invalidateQueries({ queryKey: ["people"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createPerson = async (values: Pick<TablesInsert<"people">, "name">) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: TablesInsert<"people"> = { name: values.name, user_id: user!.id };
    const { error } = await supabase.from("people").insert(payload);
    if (error) throw error;
  };

  const updatePerson = async (id: string, values: Pick<TablesUpdate<"people">, "name">) => {
    const { error } = await supabase.from("people").update({ name: values.name }).eq("id", id);
    if (error) throw error;
  };

  const deletePerson = async (id: string) => {
    // A exclusão é permitida pois as transações têm ON DELETE SET NULL
    const { error } = await supabase.from("people").delete().eq("id", id);
    if (error) throw error;
  };

  return {
    people: data ?? [],
    isLoading,
    error,
    createPerson,
    updatePerson,
    deletePerson,
  };
}
