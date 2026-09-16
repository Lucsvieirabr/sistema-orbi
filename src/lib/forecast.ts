/**
 * Motor Preditivo — núcleo de cálculo puro (sem React, sem Supabase).
 *
 * A RPC `orbi_cash_forecast` entrega o saldo real de hoje, o "ralo diário"
 * (média dos gastos variáveis dos últimos 90 dias) e a lista de compromissos
 * agendados. A curva é montada aqui, no cliente, porque os Eventos Fantasmas
 * do simulador existem só no estado da tela — nunca vão ao banco.
 *
 * Datas trafegam como `YYYY-MM-DD` e a aritmética de dia é feita em UTC para
 * não sofrer com horário de verão nem com o bug de `new Date("YYYY-MM-DD")`.
 */
import { roundCurrency } from "@/lib/utils";

export type ForecastEventKind = "scheduled" | "invoice" | "recurring" | "project" | "ghost";

export interface ForecastEvent {
  date: string;
  /** Positivo = entra, negativo = sai. */
  amount: number;
  description: string;
  kind: ForecastEventKind;
  ghostId?: string;
}

export interface GhostEvent {
  id: string;
  name: string;
  /** Valor total, sempre positivo. */
  total: number;
  installments: number;
  /** Data da 1ª parcela (`YYYY-MM-DD`). */
  firstDate: string;
  direction: "expense" | "income";
  enabled: boolean;
}

export interface ProjectionPoint {
  date: string;
  day: number;
  /** Saldo projetado com cenário (fantasmas ligados). */
  balance: number;
  /** Saldo projetado só com o que é real. */
  baseline: number;
  /** Compromissos reais do dia. */
  scheduled: number;
  /** Fantasmas do dia. */
  ghosts: number;
}

export interface ProjectionMoment {
  date: string;
  day: number;
  balance: number;
}

export interface Projection {
  points: ProjectionPoint[];
  /** Primeiro dia com saldo abaixo de zero (cenário). */
  rupture: ProjectionMoment | null;
  /** Primeiro dia com saldo abaixo de zero (só o real). */
  baselineRupture: ProjectionMoment | null;
  /** Menor saldo do horizonte (cenário). */
  lowest: ProjectionMoment;
  baselineLowest: ProjectionMoment;
  end: ProjectionPoint;
  /** Soma do ralo aplicado no horizonte. */
  drainTotal: number;
}

const DAY_MS = 86_400_000;

function toUtc(key: string): number {
  const [year, month, day] = key.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtc(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(key: string, days: number): string {
  return fromUtc(toUtc(key) + days * DAY_MS);
}

/** Soma meses preservando o dia (31/jan + 1 mês = 28/fev, + 2 meses = 31/mar). */
export function addMonths(key: string, months: number): string {
  const [year, month, day] = key.slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return fromUtc(target.getTime());
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Parcelas mensais de um Evento Fantasma. O resíduo de centavos vai para a última. */
export function expandGhost(ghost: GhostEvent): ForecastEvent[] {
  const count = Math.max(1, Math.min(Math.trunc(ghost.installments) || 1, 120));
  const total = roundCurrency(Math.abs(ghost.total));
  const base = roundCurrency(total / count);
  const sign = ghost.direction === "income" ? 1 : -1;

  return Array.from({ length: count }, (_, index) => {
    const value = index === count - 1 ? roundCurrency(total - base * (count - 1)) : base;
    return {
      date: addMonths(ghost.firstDate, index),
      amount: sign * value,
      description: count > 1 ? `${ghost.name} (${index + 1}/${count})` : ghost.name,
      kind: "ghost" as const,
      ghostId: ghost.id,
    };
  });
}

export function buildProjection({
  today,
  horizonDays,
  startBalance,
  dailyDrain,
  events,
  ghosts,
}: {
  today: string;
  horizonDays: number;
  startBalance: number;
  dailyDrain: number;
  events: ForecastEvent[];
  ghosts: GhostEvent[];
}): Projection {
  const byDay = new Map<number, { scheduled: number; ghosts: number }>();
  const bump = (event: ForecastEvent, field: "scheduled" | "ghosts") => {
    const day = daysBetween(today, event.date);
    // Compromisso real de hoje já está no saldo real; fantasma de hoje ainda não.
    if (day > horizonDays || day < (field === "ghosts" ? 0 : 1)) return;
    const slot = byDay.get(day) ?? { scheduled: 0, ghosts: 0 };
    slot[field] += event.amount;
    byDay.set(day, slot);
  };

  events.forEach((event) => bump(event, "scheduled"));
  ghosts.filter((ghost) => ghost.enabled).flatMap(expandGhost).forEach((event) => bump(event, "ghosts"));

  const drain = Math.max(0, dailyDrain);
  const todayGhosts = roundCurrency(byDay.get(0)?.ghosts ?? 0);
  let balance = roundCurrency(startBalance + todayGhosts);
  let baseline = roundCurrency(startBalance);

  const first: ProjectionPoint = { date: today, day: 0, balance, baseline, scheduled: 0, ghosts: todayGhosts };
  const points: ProjectionPoint[] = [first];
  let rupture: ProjectionMoment | null = balance < 0 ? { date: today, day: 0, balance } : null;
  let baselineRupture: ProjectionMoment | null = baseline < 0 ? { date: today, day: 0, balance: baseline } : null;
  let lowest: ProjectionMoment = { date: today, day: 0, balance };
  let baselineLowest: ProjectionMoment = { date: today, day: 0, balance: baseline };

  for (let day = 1; day <= horizonDays; day += 1) {
    const slot = byDay.get(day) ?? { scheduled: 0, ghosts: 0 };
    baseline = roundCurrency(baseline + slot.scheduled - drain);
    balance = roundCurrency(balance + slot.scheduled + slot.ghosts - drain);
    const date = addDays(today, day);

    points.push({
      date,
      day,
      balance,
      baseline,
      scheduled: roundCurrency(slot.scheduled),
      ghosts: roundCurrency(slot.ghosts),
    });

    if (!rupture && balance < 0) rupture = { date, day, balance };
    if (!baselineRupture && baseline < 0) baselineRupture = { date, day, balance: baseline };
    if (balance < lowest.balance) lowest = { date, day, balance };
    if (baseline < baselineLowest.balance) baselineLowest = { date, day, balance: baseline };
  }

  return {
    points,
    rupture,
    baselineRupture,
    lowest,
    baselineLowest,
    end: points[points.length - 1],
    drainTotal: roundCurrency(drain * horizonDays),
  };
}
