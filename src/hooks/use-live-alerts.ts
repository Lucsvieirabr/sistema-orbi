/**
 * Avisos derivados do estado atual (não gravados em `user_notifications`):
 * contas vencidas e ruptura de caixa projetada. O sino junta estes aos avisos
 * persistidos para nunca dizer "nenhum aviso" com pendência real na tela.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCachedAuthUser } from "@/hooks/use-current-user";
import { useCashForecast } from "@/hooks/use-cash-forecast";
import { useFeature } from "@/hooks/use-feature";
import { supabase } from "@/integrations/supabase/client";
import { buildProjection } from "@/lib/forecast";
import { formatCurrencyBRL, fromDateKey, getCurrentDateString } from "@/lib/utils";

export interface LiveAlert {
  id: string;
  kind: "overdue" | "cash_rupture";
  title: string;
  body: string;
  actionPath: string;
}

const FORECAST_HORIZON = 90;
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export function useLiveAlerts() {
  const today = getCurrentDateString();

  const overdue = useQuery({
    queryKey: ["live-alerts", "overdue", today],
    queryFn: async () => {
      const { data: { user } } = await getCachedAuthUser();
      if (!user) return 0;
      const { count, error } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("type", "expense")
        .eq("status", "PENDING")
        .lt("date", today);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { hasFeature: canForecast } = useFeature("motor_preditivo");
  const { forecast } = useCashForecast(FORECAST_HORIZON, { enabled: canForecast });

  return useMemo<LiveAlert[]>(() => {
    const alerts: LiveAlert[] = [];
    const overdueCount = overdue.data ?? 0;
    if (overdueCount > 0) {
      alerts.push({
        id: "live-overdue",
        kind: "overdue",
        title: overdueCount === 1 ? "1 conta em atraso" : `${overdueCount} contas em atraso`,
        body: "Pague ou marque como paga para o saldo acompanhar.",
        actionPath: "/sistema/statement",
      });
    }
    if (canForecast && forecast) {
      const { rupture, lowest } = buildProjection({
        today: forecast.asOf,
        horizonDays: FORECAST_HORIZON,
        startBalance: forecast.currentBalance,
        dailyDrain: forecast.burn.daily,
        events: forecast.events,
        ghosts: [],
      });
      if (rupture) {
        alerts.push({
          id: "live-cash-rupture",
          kind: "cash_rupture",
          title: `Ruptura de caixa em ${dayMonth.format(fromDateKey(rupture.date))}`,
          body: `A projeção chega a ${formatCurrencyBRL(Math.min(lowest.balance, rupture.balance))} nos próximos ${FORECAST_HORIZON} dias.`,
          actionPath: "/sistema/forecast",
        });
      }
    }
    return alerts;
  }, [overdue.data, canForecast, forecast]);
}
