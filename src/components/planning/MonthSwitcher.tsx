import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  currentMonthKey,
  formatMonthLong,
  formatMonthTitle,
  monthKeyFromParam,
  monthParamFromKey,
  shiftMonth,
} from "./planning-utils";

/**
 * Mês de referência na URL (`?mes=2026-09`): recarregar, compartilhar e o
 * botão Voltar preservam o período escolhido. O mês atual não suja a URL.
 */
export function useMonthParam(): [string, (next: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const month = monthKeyFromParam(searchParams.get("mes"));

  const setMonth = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === currentMonthKey()) params.delete("mes");
          else params.set("mes", monthParamFromKey(next));
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return [month, setMonth];
}

interface MonthSwitcherProps {
  month: string;
  onChange: (month: string) => void;
  className?: string;
}

/** Navegador de mês: trilho afundado, setas ghost e o mês por extenso. */
export function MonthSwitcher({ month, onChange, className }: MonthSwitcherProps) {
  const isCurrent = month === currentMonthKey();
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="group"
        aria-label="Mês de referência"
        className="inline-flex items-center rounded-xl border border-border-subtle bg-surface-sunken p-1"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(previous)}
          aria-label={`Mês anterior: ${formatMonthLong(previous)}`}
          className="rounded-lg"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <p
          aria-live="polite"
          className="min-w-[9.5rem] select-none px-2 text-center text-sm font-medium tabular text-foreground"
        >
          {formatMonthTitle(month)}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(next)}
          aria-label={`Próximo mês: ${formatMonthLong(next)}`}
          className="rounded-lg"
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
      {!isCurrent && (
        <Button variant="ghost" size="sm" onClick={() => onChange(currentMonthKey())}>
          Mês atual
        </Button>
      )}
    </div>
  );
}
