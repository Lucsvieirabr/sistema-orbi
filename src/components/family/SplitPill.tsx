import { cn, formatCurrencyBRL } from "@/lib/utils";

interface SplitPillProps {
  /** Valor bruto do gasto (linha A do rateio). */
  value: number;
  /** Parte que volta de outra(s) pessoa(s) — `transactions.compensation_value`. */
  compensationValue?: number | null;
  className?: string;
}

/**
 * "Split Pill" — sinaliza, ao lado do valor, que o gasto é dividido
 * (rateio / contrato de rateio). Mini-pizza em SVG mostra a fatia que é
 * SUA; o rótulo diz a proporção ("50/50", "70/30").
 *
 * Só para a linha A (gasto bruto com `compensation_value > 0`). Não renderiza
 * nada fora disso — quem chama não precisa testar.
 */
export function SplitPill({ value, compensationValue, className }: SplitPillProps) {
  const total = Math.abs(Number(value) || 0);
  const others = Math.abs(Number(compensationValue) || 0);
  if (total <= 0 || others <= 0) return null;

  const othersPct = Math.min(100, Math.max(0, Math.round((others / total) * 100)));
  const minePct = 100 - othersPct;

  // Circunferência de r=5 ≈ 31.416; a fatia pintada é a sua parte.
  const C = 2 * Math.PI * 5;
  const mineArc = (minePct / 100) * C;

  return (
    <span
      title={`Despesa dividida — sua parte ${minePct}%, a receber ${formatCurrencyBRL(others)}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/70 py-px pl-0.5 pr-1.5 text-2xs font-medium leading-4 text-muted-foreground ring-1 ring-inset ring-border-subtle tabular",
        className,
      )}
    >
      <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0 -rotate-90" aria-hidden>
        <circle cx="7" cy="7" r="5" fill="none" className="stroke-foreground/15" strokeWidth="4" />
        <circle
          cx="7"
          cy="7"
          r="5"
          fill="none"
          className="stroke-chart-6"
          strokeWidth="4"
          strokeDasharray={`${mineArc} ${C}`}
        />
      </svg>
      <span className="sr-only">Despesa dividida: </span>
      {minePct}/{othersPct}
    </span>
  );
}
