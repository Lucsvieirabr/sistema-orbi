import { formatMoney, formatPct } from "@/components/planning/planning-utils";
import { PROJECT_KINDS, type ProjectKind, type ProjectReport } from "@/hooks/use-projects";

export function kindLabel(kind: ProjectKind): string {
  return PROJECT_KINDS.find((item) => item.value === kind)?.label ?? "Projeto";
}

export function kindIcon(kind: ProjectKind): string {
  return PROJECT_KINDS.find((item) => item.value === kind)?.icon ?? "target";
}

export function reportSentence(name: string, report: ProjectReport): { lead: string; tone: "positive" | "negative" | "neutral" } {
  const cost = formatMoney(report.cost);
  // Arquivado antes de gastar: "abaixo do orçamento" seria vitória falsa.
  if (report.cost <= 0) {
    return { lead: `${name} foi arquivado sem gastos.`, tone: "neutral" };
  }
  if (report.budget <= 0 || report.variancePct === null) {
    return { lead: `${name} custou ${cost}.`, tone: "neutral" };
  }
  if (Math.abs(report.variancePct) < 0.5) {
    return { lead: `${name} custou ${cost}, exatamente o orçamento previsto.`, tone: "positive" };
  }
  const pct = formatPct(Math.abs(report.variancePct), { digits: 0 });
  return report.variancePct < 0
    ? { lead: `${name} custou ${cost}, ${pct} abaixo do orçamento previsto.`, tone: "positive" }
    : { lead: `${name} custou ${cost}, ${pct} acima do orçamento previsto.`, tone: "negative" };
}

export function addDaysKey(key: string, days: number): string {
  const [year, month, day] = key.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function paceTone(costPct: number | null, timePct: number): "neutral" | "warning" | "negative" {
  if (costPct === null) return "neutral";
  if (costPct > 100) return "negative";
  if (costPct > timePct + 15 && costPct >= 50) return "warning";
  return "neutral";
}
