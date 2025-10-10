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

      // Find the "Assinaturas" category (global or user-specific)
      const { data: categories } = await supabase
        .from("categories")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
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

  // Call the new Edge Function that handles caching
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(
    `${supabaseUrl}/functions/v1/get-company-logo`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ companyName: companyName.toLowerCase().trim() }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get logo");
  }

  const data = await response.json();
  
  // Return in the expected format
  return {
    logo_url: data.logo_url,
    domain: undefined // Not needed anymore
  };
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

