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
      .select("id, user_id, name, category_type, icon, created_at")
      .eq("user_id", user?.id ?? "");
    if (error) throw error;
    return data ?? [];
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const populateInitialCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Use the database function to create initial categories
    const { error } = await supabase.rpc('create_initial_categories_for_user', {
      user_id: user.id
    });
    
    if (error) throw error;

    // Invalidate queries to refresh the data
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

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

  // Auto-create initial categories if user has no categories
  useEffect(() => {
    const autoCreateCategories = async () => {
      if (!isLoading && data && data.length === 0) {
        try {
          await populateInitialCategories();
        } catch (error) {
          console.error("Failed to auto-create initial categories:", error);
        }
      }
    };

    autoCreateCategories();
  }, [isLoading, data, populateInitialCategories]);

  const createCategory = async (values: Pick<TablesInsert<"categories">, "name" | "category_type" | "icon">) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: TablesInsert<"categories"> = {
      name: values.name,
      category_type: values.category_type || 'expense',
      icon: values.icon,
      user_id: user!.id
    };
    const { error } = await supabase.from("categories").insert(payload);
    if (error) throw error;
  };

  const updateCategory = async (id: string, values: Pick<TablesUpdate<"categories">, "name" | "category_type" | "icon">) => {
    const { error } = await supabase
      .from("categories")
      .update({
        name: values.name,
        category_type: values.category_type,
        icon: values.icon
      })
      .eq("id", id);
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
    populateInitialCategories,
  };
}


