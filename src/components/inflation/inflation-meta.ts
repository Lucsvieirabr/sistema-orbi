import { formatPct } from "@/components/planning/planning-utils";
import type { InflationBasis } from "@/hooks/use-personal-inflation";

export const BASIS_OPTIONS: Array<{ value: InflationBasis; label: string; short: string }> = [
  { value: 3, label: "3 meses", short: "3m" },
  { value: 6, label: "6 meses", short: "6m" },
  { value: 12, label: "12 meses", short: "12m" },
];

export function basisPhrase(basis: InflationBasis): string {
  if (basis === 12) return "nos últimos 12 meses";
  if (basis === 6) return "nos últimos 6 meses";
  return "nos últimos 3 meses";
}

export function basisComparison(basis: InflationBasis): string {
  if (basis === 12) return "contra o mesmo trimestre do ano passado";
  if (basis === 6) return "contra o trimestre de seis meses atrás";
  return "contra o trimestre anterior";
}

export function inflationTone(pct: number | null): "negative" | "warning" | "positive" | "neutral" {
  if (pct === null) return "neutral";
  if (pct >= 10) return "negative";
  if (pct > 0.5) return "warning";
  if (pct < -0.5) return "positive";
  return "neutral";
}

export function headlineSentence(pct: number, basis: InflationBasis): { lead: string; tail: string } {
  const value = formatPct(Math.abs(pct), { digits: 1 });
  if (pct > 0.5) {
    return {
      lead: `Sua inflação pessoal ${basisPhrase(basis)} é de ${value}.`,
      tail: "O custo de manutenção do seu estilo de vida subiu.",
    };
  }
  if (pct < -0.5) {
    return {
      lead: `Seus preços essenciais caíram ${value} ${basisPhrase(basis)}.`,
      tail: "Seu poder de compra aumentou no que é recorrente.",
    };
  }
  return {
    lead: `Sua inflação pessoal ${basisPhrase(basis)} está estável (${formatPct(pct, { signed: true })}).`,
    tail: "O custo do essencial não mudou de forma relevante.",
  };
}

export const toneText = {
  negative: "text-destructive",
  warning: "text-warning",
  positive: "text-success",
  neutral: "text-foreground",
} as const;
