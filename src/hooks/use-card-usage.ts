import { getCachedAuthUser } from "@/hooks/use-current-user";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isUuid, roundCurrency, toDateKey } from "@/lib/utils";

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
      const { data: { user }, error: userError } = await getCachedAuthUser();
      if (userError) throw userError;

      const period = getCurrentStatementPeriod(statementDay);
      const startDate = toDateKey(period.startDate);
      const endDate = toDateKey(period.endDate);

      const net = (rows: Array<{ value: number; type: string }> | null) =>
        (rows ?? []).reduce(
          (sum, t) => (t.type === "expense" ? sum + t.value : t.type === "income" ? sum - t.value : sum),
          0,
        );

      const [periodRes, pendingRes] = await Promise.all([
        // Fatura em aberto: lançamentos do período corrente.
        supabase
          .from("transactions")
          .select("value, type")
          .eq("user_id", user?.id ?? "")
          .eq("credit_card_id", cardId)
          .gte("date", startDate)
          .lte("date", endDate)
          .neq("status", "CANCELED"),
        // Limite comprometido: TUDO que ainda não foi pago no cartão, inclusive
        // parcelas futuras (3x R$ 100 prende R$ 300 do limite, não R$ 100).
        supabase
          .from("transactions")
          .select("value, type")
          .eq("user_id", user?.id ?? "")
          .eq("credit_card_id", cardId)
          .eq("status", "PENDING"),
      ]);
      if (periodRes.error) throw periodRes.error;
      if (pendingRes.error) throw pendingRes.error;

      return {
        used: Math.max(0, roundCurrency(net(periodRes.data))),
        committed: Math.max(0, roundCurrency(net(pendingRes.data))),
        periodStart: period.startDate,
        periodEnd: period.endDate,
      };
    },
    enabled: isUuid(cardId) && !!statementDay,
  });
}

