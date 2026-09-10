import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { assertUuid } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { featureRegistry } from "@/lib/features/feature-registry";

type Series = Tables<"series">;
type Category = Tables<"categories">;

interface SubscriptionWithCategory extends Series {
  categories: Category | null;
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Find the "Assinaturas" category (global or user-specific)
      // SEGURANÇA: valida o UUID antes de interpolar na string de filtro.
      const userId = assertUuid(user.id, "user_id");

      const { data: categories } = await supabase
        .from("categories")
        .select("*")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .ilike("name", "%assinatura%")
        .limit(1);

      const subscriptionCategoryId = categories?.[0]?.id;

      // Only get series from "Assinaturas" category
      if (!subscriptionCategoryId) {
        // If no subscription category exists, return empty array
        return [];
      }

      const { data, error } = await supabase
        .from("series")
        .select(`
          *,
          categories (*)
        `)
        .eq("user_id", user.id)
        .eq("category_id", subscriptionCategoryId)
        .order("description", { ascending: true });

      if (error) throw error;

      return (data || []) as SubscriptionWithCategory[];
    },
  });
}
