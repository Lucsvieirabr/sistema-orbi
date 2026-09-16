/**
 * Motor Preditivo (módulo premium — Pro/Casal).
 *
 * 1 round-trip na RPC `orbi_cash_forecast`: saldo real, ralo diário (média de
 * gastos variáveis dos últimos 90 dias, via `orbi_daily_burn_rate`) e os
 * compromissos agendados do horizonte. A curva e os Eventos Fantasmas são
 * montados no cliente (`@/lib/forecast`).
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useViewMode } from "@/hooks/use-view-mode";
import { toNumber } from "@/components/planning/planning-utils";
import type { ForecastEvent } from "@/lib/forecast";

export type ForecastHorizon = 30 | 90 | 365;

export interface BurnCategory {
  category_id: string | null;
  name: string;
  icon: string | null;
  total: number;
  daily: number;
}

export interface CashForecastData {
  asOf: string;
  horizonDays: number;
  scope: "personal" | "couple";
  currentBalance: number;
  burn: {
    windowDays: number;
    from: string;
    to: string;
    total: number;
    daily: number;
    transactions: number;
    topCategories: BurnCategory[];
  };
  events: ForecastEvent[];
}

export const CASH_FORECAST_QUERY_KEY = ["cash-forecast"] as const;

const KINDS = new Set(["scheduled", "invoice", "recurring"]);

function normalize(raw: any, horizon: number): CashForecastData {
  const burn = raw?.burn ?? {};
  return {
    asOf: String(raw?.as_of ?? ""),
    horizonDays: toNumber(raw?.horizon_days) || horizon,
    scope: raw?.scope === "couple" ? "couple" : "personal",
    currentBalance: toNumber(raw?.current_balance),
    burn: {
      windowDays: toNumber(burn.window_days) || 90,
      from: String(burn.from ?? ""),
      to: String(burn.to ?? ""),
      total: toNumber(burn.total),
      daily: toNumber(burn.daily),
      transactions: toNumber(burn.transactions),
      topCategories: (burn.top_categories ?? []).map((row: any) => ({
        category_id: row.category_id ?? null,
        name: row.name ?? "Sem categoria",
        icon: row.icon ?? null,
        total: toNumber(row.total),
        daily: toNumber(row.daily),
      })),
    },
    events: (raw?.events ?? [])
      .filter((event: any) => KINDS.has(event?.kind) && typeof event?.date === "string")
      .map((event: any) => ({
        date: event.date.slice(0, 10),
        amount: toNumber(event.amount),
        description: String(event.description ?? ""),
        kind: event.kind,
      })),
  };
}

export function useCashForecast(horizon: ForecastHorizon) {
  const viewMode = useViewMode();
  const scope = viewMode === "couple" ? "couple" : "personal";

  const query = useQuery({
    queryKey: [...CASH_FORECAST_QUERY_KEY, horizon, scope],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("orbi_cash_forecast", {
        p_horizon_days: horizon,
        p_scope: scope,
      });
      if (error) throw error;
      return normalize(data, horizon);
    },
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
  });

  return {
    forecast: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    scope,
  };
}
