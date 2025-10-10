import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

interface CardTransactionFilters {
  cardId: string;
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
}

type CardTransaction = Tables<"transactions"> & {
  accounts?: { name: string } | null;
  categories?: { name: string } | null;
  credit_cards?: { name: string } | null;
  people?: { name: string } | null;
  series?: { total_installments: number; is_fixed: boolean } | null;
};

export function useCardTransactions({ cardId, startDate, endDate }: CardTransactionFilters) {
  return useQuery<CardTransaction[]>({
    queryKey: ["card_transactions", cardId, startDate, endDate],
    queryFn: async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id, user_id, description, value, date, type, payment_method,
          account_id, credit_card_id, category_id, person_id, series_id,
          status, created_at, is_fixed, composition_details,
          installment_number, compensation_value,
          accounts(name),
          categories(name),
          credit_cards(name),
          people(name),
          series(total_installments, is_fixed)
        `)
        .eq("user_id", user?.id ?? "")
        .eq("credit_card_id", cardId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as CardTransaction[];
    },
    enabled: !!cardId && !!startDate && !!endDate,
  });
}
