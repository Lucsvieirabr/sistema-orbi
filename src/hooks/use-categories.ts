import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Category = Tables<"categories">;

export function useCategories() {
  const queryClient = useQueryClient();

  const fetchCategories = async (): Promise<Category[]> => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const { data, error } = await supabase
      .from("categories")
      .select("id, user_id, name, created_at")
      .eq("user_id", user?.id ?? "");
    if (error) throw error;
    return data ?? [];
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  useEffect(() => {
    const channel = supabase
      .channel("categories-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createCategory = async (values: Pick<TablesInsert<"categories">, "name">) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: TablesInsert<"categories"> = { name: values.name, user_id: user!.id };
    const { error } = await supabase.from("categories").insert(payload);
    if (error) throw error;
  };

  const updateCategory = async (id: string, values: Pick<TablesUpdate<"categories">, "name">) => {
    const { error } = await supabase.from("categories").update({ name: values.name }).eq("id", id);
    if (error) throw error;
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;
  };

  return {
    categories: data ?? [],
    isLoading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}


