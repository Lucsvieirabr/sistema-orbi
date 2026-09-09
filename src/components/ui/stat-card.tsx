import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "negative" | "warning" | "accent";

const toneText: Record<Tone, string> = {
  neutral: "text-foreground",
  positive: "text-success",
  negative: "text-destructive",
  warning: "text-warning",
  accent: "text-primary",
};

const toneMarker: Record<Tone, string> = {
  neutral: "bg-border",
  positive: "bg-success",
  negative: "bg-destructive",
  warning: "bg-warning",
  accent: "bg-primary",
};

export interface StatCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Rótulo curto do indicador. Aparece em micro-caps acima do número. */
  label: string;
  /** O valor. É o protagonista: sempre em display + tabular-nums. */
  value: React.ReactNode;
  /** Contexto do valor, em uma linha. */
  hint?: React.ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  /** Compacta a tile para grades de 4 colunas. */
  dense?: boolean;
  loading?: boolean;
}

/**
 * Ledger Tile — a unidade de leitura do dashboard.
 *
 * Hierarquia: barra de acento (1px de cor) → rótulo micro-caps → número grande
 * → contexto. Cor aparece só na barra e no número; todo o resto é neutro.
 */
export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ label, value, hint, tone = "neutral", icon: Icon, dense = false, loading = false, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group relative isolate overflow-hidden rounded-xl border border-border bg-card",
          "transition-colors duration-200 ease-swift hover:border-ring/35",
          dense ? "p-4 lg:p-5" : "p-5 lg:p-6",
          className,
        )}
        {...props}
      >
        {/* Barra de acento: a única cromia estrutural da tile. */}
        <span aria-hidden className={cn("absolute inset-x-0 top-0 h-px", toneMarker[tone])} />

        <div className="flex items-start justify-between gap-3">
          <p className="label-eyebrow">{label}</p>
          {Icon && <Icon aria-hidden className={cn("h-4 w-4 shrink-0", toneText[tone], "opacity-60")} />}
        </div>

        {loading ? (
          <div className="mt-3 h-8 w-32 animate-pulse rounded-md bg-muted" />
        ) : (
          <p className={cn("mt-2.5 tabular", dense ? "figure-lg" : "figure-xl", toneText[tone])}>{value}</p>
        )}

        {hint && <div className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</div>}
      </div>
    );
  },
);
StatCard.displayName = "StatCard";

/** Linha de rodapé de uma tile: dois valores contrastantes lado a lado. */
export function StatSplit({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode; tone?: Tone }[];
  className?: string;
}) {
  return (
    <dl className={cn("flex items-center gap-4", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn("tabular text-xs font-medium", toneText[item.tone ?? "neutral"])}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
