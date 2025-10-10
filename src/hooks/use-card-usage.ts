import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CardUsageParams {
  cardId: string;
  statementDay: number;
}

// Calcula o período da fatura atual baseado na data de fechamento
const getCurrentStatementPeriod = (statementDay: number) => {
  const today = new Date();
  const closingDate = new Date(today.getFullYear(), today.getMonth(), statementDay);
  
  let periodStart: Date;
  let periodEnd: Date;
  
  if (today < closingDate) {
    // Período do mês anterior
    periodEnd = new Date(closingDate);
    periodEnd.setDate(periodEnd.getDate() - 1);
    
    periodStart = new Date(closingDate);
    periodStart.setMonth(periodStart.getMonth() - 1);
  } else {
    // Período atual
    periodStart = new Date(closingDate);
    
    periodEnd = new Date(closingDate);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(periodEnd.getDate() - 1);
  }
  
  return { startDate: periodStart, endDate: periodEnd };
};

export function useCardUsage({ cardId, statementDay }: CardUsageParams) {
  return useQuery({
    queryKey: ["card_usage", cardId, statementDay],
    queryFn: async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const period = getCurrentStatementPeriod(statementDay);
      const startDate = period.startDate.toISOString().split('T')[0];
      const endDate = period.endDate.toISOString().split('T')[0];

      // Buscar transações do período
      const { data, error } = await supabase
        .from("transactions")
        .select("value, type, status")
        .eq("user_id", user?.id ?? "")
        .eq("credit_card_id", cardId)
        .gte("date", startDate)
        .lte("date", endDate)
        .neq("status", "CANCELED");

      if (error) throw error;

      // Calcular total usado (despesas - receitas/estornos)
      const total = (data || []).reduce((sum, transaction) => {
        if (transaction.type === "expense") {
          return sum + transaction.value;
        } else if (transaction.type === "income") {
          return sum - transaction.value;
        }
        return sum;
      }, 0);

      return {
        used: Math.max(0, total),
        periodStart: period.startDate,
        periodEnd: period.endDate,
      };
    },
    enabled: !!cardId && !!statementDay,
  });
}

