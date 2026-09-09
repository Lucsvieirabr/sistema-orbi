import * as React from "react";

import { useTheme } from "@/hooks/use-theme";

/**
 * Tokens de data-viz. SVG não resolve `var()` em atributos de apresentação,
 * então lemos as CSS vars do :root e devolvemos cores concretas — que se
 * atualizam sozinhas quando o tema troca.
 */
const CHART_TOKENS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"] as const;

export const SEMANTIC_TOKENS = {
  success: "--success",
  destructive: "--destructive",
  warning: "--warning",
  primary: "--primary",
  muted: "--muted-foreground",
  border: "--border",
} as const;

function read(token: string): string {
  if (typeof window === "undefined") return "hsl(210 50% 37%)";
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return raw ? `hsl(${raw})` : "hsl(210 50% 37%)";
}

/**
 * Lê a paleta de data-viz no momento da chamada.
 * SVG não resolve `var()` em atributos de apresentação de forma consistente,
 * então resolvemos para cores concretas antes de entregar ao Recharts.
 */
export function chartColors(): string[] {
  return CHART_TOKENS.map(read);
}

export function useChartPalette() {
  const { theme } = useTheme();

  return React.useMemo(() => {
    const series = CHART_TOKENS.map(read);
    const semantic = Object.fromEntries(
      Object.entries(SEMANTIC_TOKENS).map(([key, token]) => [key, read(token)]),
    ) as Record<keyof typeof SEMANTIC_TOKENS, string>;

    return { series, semantic, at: (index: number) => series[index % series.length] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}
