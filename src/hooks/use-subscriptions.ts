import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

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

      // Find the "Assinaturas" category
      const { data: categories } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .ilike("name", "%assinatura%")
        .limit(1);

      const subscriptionCategoryId = categories?.[0]?.id;

      // Build query - get series that are fixed (recurring) OR in subscription category
      let query = supabase
        .from("series")
        .select(`
          *,
          categories (*)
        `)
        .eq("user_id", user.id);

      // Filter by is_fixed = true OR category_id = subscriptionCategoryId
      if (subscriptionCategoryId) {
        query = query.or(`is_fixed.eq.true,category_id.eq.${subscriptionCategoryId}`);
      } else {
        query = query.eq("is_fixed", true);
      }

      const { data, error } = await query.order("description", { ascending: true });

      if (error) throw error;

      return (data || []) as SubscriptionWithCategory[];
    },
  });
}

export interface LogoSearchResponse {
  domain?: string;
  logo_url?: string;
  error?: string;
}

export async function searchCompanyLogo(companyName: string): Promise<LogoSearchResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error("User not authenticated");
  }

  // Call the Edge Function
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(
    `${supabaseUrl}/functions/v1/search-logo`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ query: companyName }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to search logo");
  }

  return await response.json();
}

export async function updateSeriesLogo(seriesId: string, logoUrl: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("series")
    .update({ logo_url: logoUrl })
    .eq("id", seriesId)
    .eq("user_id", user.id);

  if (error) throw error;
}

