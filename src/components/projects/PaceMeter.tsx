import { useEffect, useState } from "react";

import { formatMoney, formatPct } from "@/components/planning/planning-utils";
import { cn } from "@/lib/utils";

import { paceTone } from "./project-meta";

const toneFill = {
  neutral: "",
  warning: "bg-warning",
  negative: "bg-destructive",
} as const;

export function PaceMeter({
  budget,
  spent,
  committed,
  timePct,
  color,
  archived = false,
  compact = false,
  className,
}: {
  budget: number;
  spent: number;
  committed: number;
  timePct: number;
  color: string;
  archived?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const cost = spent + committed;
  const costPct = budget > 0 ? (cost / budget) * 100 : null;
  const tone = archived ? "neutral" : paceTone(costPct, timePct);
  const safe = budget > 0 ? budget : Math.max(cost, 1);
  const paidScale = Math.min(Math.max(spent / safe, 0), 1);
  const totalScale = Math.min(Math.max(cost / safe, 0), 1);
  const time = Math.min(Math.max(timePct, 0), 100);
  const fillStyle = tone === "neutral" ? { backgroundColor: color } : undefined;

  const valueText =
    costPct === null
      ? `${formatMoney(cost)} lançados, sem orçamento definido`
      : `${formatPct(costPct, { digits: 0 })} do orçamento usado com ${formatPct(time, { digits: 0 })} do prazo percorrido`;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="meter"
        aria-label="Ritmo do projeto"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(costPct ?? 0, 100))}
        aria-valuetext={valueText}
        className={cn("relative w-full rounded-full bg-surface-sunken", compact ? "h-1.5" : "h-2")}
      >
        <span className="absolute inset-0 overflow-hidden rounded-full">
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 origin-left opacity-35 transition-transform duration-700 ease-entrance motion-reduce:transition-none",
              toneFill[tone],
            )}
            style={{ ...fillStyle, transform: `scaleX(${ready ? totalScale : 0})` }}
          />
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 origin-left transition-transform duration-700 ease-entrance motion-reduce:transition-none",
              toneFill[tone],
            )}
            style={{ ...fillStyle, transform: `scaleX(${ready ? paidScale : 0})` }}
          />
        </span>
        {!archived && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-full transition-transform duration-700 ease-entrance motion-reduce:transition-none"
            style={{ transform: `translateX(${ready ? time : 0}%)` }}
          >
            <span className={cn("absolute -translate-x-1/2 rounded-full bg-foreground", compact ? "-inset-y-1 w-px" : "-inset-y-1.5 w-0.5")} />
          </span>
        )}
      </div>
      {!compact && (
        <div className="flex items-baseline justify-between gap-3 text-xs tabular text-muted-foreground">
          <span>
            <span className={cn("font-medium", tone === "negative" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-foreground")}>
              {costPct === null ? formatMoney(cost) : formatPct(costPct, { digits: 0 })}
            </span>{" "}
            do orçamento
          </span>
          {!archived && (
            <span>
              <span className="font-medium text-foreground">{formatPct(time, { digits: 0 })}</span> do prazo
            </span>
          )}
        </div>
      )}
    </div>
  );
}
