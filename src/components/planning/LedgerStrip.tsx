import * as React from "react";

import { cn } from "@/lib/utils";

export type LedgerTone = "neutral" | "positive" | "negative" | "warning";

const toneText: Record<LedgerTone, string> = {
  neutral: "text-foreground",
  positive: "text-success",
  negative: "text-destructive",
  warning: "text-warning",
};

const toneFill: Record<LedgerTone, string> = {
  neutral: "bg-primary",
  positive: "bg-success",
  negative: "bg-destructive",
  warning: "bg-warning",
};

export interface LedgerCell {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: LedgerTone;
}

/**
 * Faixa de razão contábil: três leituras lado a lado numa única superfície,
 * separadas por hairline — em vez de três tiles soltos competindo entre si.
 * Empilha no telefone. Opcionalmente fecha com uma barra de consumo.
 */
export function LedgerStrip({
  cells,
  footer,
  className,
  ...props
}: { cells: LedgerCell[]; footer?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("relative isolate overflow-hidden rounded-xl border border-border bg-card", className)}
      {...props}
    >
      <dl
        className={cn(
          "grid grid-cols-1 divide-y divide-border-subtle",
          cells.length === 3 && "sm:grid-cols-3 sm:divide-x sm:divide-y-0",
          cells.length === 2 && "sm:grid-cols-2 sm:divide-x sm:divide-y-0",
        )}
      >
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0 px-4 py-4 md:px-5 md:py-5 lg:px-6">
            <dt className="label-eyebrow truncate">{cell.label}</dt>
            <dd className={cn("figure-lg mt-2 tabular", toneText[cell.tone ?? "neutral"])}>{cell.value}</dd>
            {cell.hint && (
              <dd className="mt-1.5 text-xs leading-5 text-pretty text-muted-foreground">{cell.hint}</dd>
            )}
          </div>
        ))}
      </dl>
      {footer}
    </section>
  );
}

interface UsageBarProps {
  /** Valor consumido (inclui o agendado). */
  value: number;
  /** Teto. */
  max: number;
  /** Parte de `value` que ainda está agendada (renderizada lavada). */
  scheduled?: number;
  tone?: LedgerTone;
  /** Cor livre escolhida pelo usuário (metas). Tem precedência sobre `tone`. */
  color?: string;
  label: string;
  valueText: string;
  className?: string;
}

/**
 * Barra de consumo. Anima só `transform: scaleX` (compositor), a partir da
 * esquerda, e respeita `prefers-reduced-motion`. O agendado aparece como a
 * mesma cor lavada atrás do consumido — nunca como uma cor nova.
 */
export function UsageBar({ value, max, scheduled = 0, tone = "neutral", color, label, valueText, className }: UsageBarProps) {
  const safeMax = max > 0 ? max : 1;
  const total = Math.min(Math.max(value / safeMax, 0), 1);
  const settled = Math.min(Math.max((value - scheduled) / safeMax, 0), 1);
  const style = color ? { backgroundColor: color } : undefined;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(safeMax * 100) / 100}
      aria-valuenow={Math.round(Math.min(value, safeMax) * 100) / 100}
      aria-valuetext={valueText}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken", className)}
    >
      {scheduled > 0 && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 origin-left rounded-full opacity-40 transition-transform duration-500 ease-swift motion-reduce:transition-none",
            !color && toneFill[tone],
          )}
          style={{ ...style, transform: `scaleX(${total})` }}
        />
      )}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 origin-left rounded-full transition-transform duration-500 ease-swift motion-reduce:transition-none",
          !color && toneFill[tone],
        )}
        style={{ ...style, transform: `scaleX(${scheduled > 0 ? settled : total})` }}
      />
    </div>
  );
}

/** Tom de consumo de um teto: < 80% neutro, 80–100% atenção, > 100% estourado. */
export function usageTone(spent: number, limit: number): LedgerTone {
  if (limit <= 0) return "neutral";
  if (spent > limit) return "negative";
  if (spent / limit >= 0.8) return "warning";
  return "positive";
}
