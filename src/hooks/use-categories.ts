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

  const populateInitialCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Check if user already has categories
    const { data: existingCategories } = await supabase
      .from("categories")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (existingCategories && existingCategories.length > 0) {
      return; // User already has categories
    }

    // Initial categories data
    const initialCategories = [
      // Expense categories
      { name: "Moradia", category_type: "expense", icon: "fa-home" },
      { name: "Alimentação", category_type: "expense", icon: "fa-utensils" },
      { name: "Transporte", category_type: "expense", icon: "fa-car" },
      { name: "Saúde", category_type: "expense", icon: "fa-heartbeat" },
      { name: "Educação", category_type: "expense", icon: "fa-graduation-cap" },
      { name: "Lazer e Viagem", category_type: "expense", icon: "fa-plane" },
      { name: "Pessoal e Vestuário", category_type: "expense", icon: "fa-shopping-bag" },
      { name: "Impostos e Taxas", category_type: "expense", icon: "fa-file-invoice-dollar" },
      // Income categories
      { name: "Salário / Renda Principal", category_type: "income", icon: "fa-briefcase" },
      { name: "Renda Extra / Freelance", category_type: "income", icon: "fa-dollar-sign" },
      { name: "Investimentos", category_type: "income", icon: "fa-chart-line" },
      { name: "Presentes e Reembolsos", category_type: "income", icon: "fa-gift" },
    ];

    // Insert all initial categories
    const categoriesToInsert = initialCategories.map(category => ({
      ...category,
      user_id: user.id,
    }));

    const { error } = await supabase.from("categories").insert(categoriesToInsert);
    if (error) throw error;

    // Invalidate queries to refresh the data
    queryClient.invalidateQueries({ queryKey: ["categories"] });
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


