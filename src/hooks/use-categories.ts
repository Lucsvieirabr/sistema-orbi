import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { assertUuid } from "@/lib/utils";
import { categorySchema, parseOrThrow } from "@/lib/validation/schemas";

type Category = Tables<"categories">;

export function useCategories() {
  const queryClient = useQueryClient();

  const fetchCategories = async (): Promise<Category[]> => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Usuário não autenticado");

    // SEGURANÇA: o id é validado como UUID antes de ser interpolado no filtro
    // `.or()` — string de filtro do PostgREST é parseada como expressão.
    const userId = assertUuid(user.id, "user_id");

    // Buscar categorias globais (is_system = true) e categorias do usuário
    const { data, error } = await supabase
      .from("categories")
      .select("id, user_id, name, category_type, icon, created_at, is_system")
      .or(`is_system.eq.true,user_id.eq.${userId}`);
    
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
    if (!user) throw new Error("Usuário não autenticado");
    // SEGURANCA: `category_type` era texto livre — so 'expense'/'income'.
    const safe = parseOrThrow(categorySchema, values);
    const payload: TablesInsert<"categories"> = {
      name: safe.name,
      category_type: safe.category_type,
      icon: safe.icon ?? null,
      // is_system fica de fora de proposito: a policy exige is_system = FALSE
      // no INSERT do usuario, e a CHECK do banco amarra dono x sistema.
      user_id: user.id
    };
    const { data, error } = await supabase.from("categories").insert(payload).select().single();
    if (error) throw error;
    return data;
  };

  const updateCategory = async (id: string, values: Pick<TablesUpdate<"categories">, "name" | "category_type" | "icon">) => {
    // Check if this is a system category (protected)
    const { data: category } = await supabase
      .from("categories")
      .select("is_system")
      .eq("id", id)
      .single();
    
    if (category?.is_system) {
      throw new Error("Categorias do sistema não podem ser editadas.");
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");
    const safe = parseOrThrow(categorySchema, values);
    const { error } = await supabase
      .from("categories")
      .update({
        name: safe.name,
        category_type: safe.category_type,
        icon: safe.icon ?? null
      })
      .eq("id", assertUuid(id, "category_id"))
      .eq("user_id", user.id)
      .eq("is_system", false);
    if (error) throw error;
  };

  const deleteCategory = async (id: string) => {
    // Check if this is a system category (protected)
    const { data: category } = await supabase
      .from("categories")
      .select("name, is_system")
      .eq("id", id)
      .single();
    
    if (category?.is_system) {
      throw new Error("Categorias do sistema não podem ser excluídas.");
    }
    
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


