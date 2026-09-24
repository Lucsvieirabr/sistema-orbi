import { diagnoseLimitError } from "@/lib/limits";

/**
 * Utilitários compartilhados pelos módulos de planejamento (Orçamentos, Metas,
 * Fechamento do mês). Datas trafegam como `YYYY-MM-DD` e nunca passam por
 * `new Date("YYYY-MM-DD")` puro (bug de fuso — ver CLAUDE.md).
 */

const MONTH_PARAM = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/** `?mes=2026-09` → `2026-09-01`. Valor inválido cai no mês atual. */
export function monthKeyFromParam(value: string | null): string {
  if (!value || !MONTH_PARAM.test(value)) return currentMonthKey();
  return `${value}-01`;
}

export function monthParamFromKey(key: string): string {
  return key.slice(0, 7);
}

export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function toDate(key: string): Date {
  return new Date(`${key.slice(0, 10)}T12:00:00`);
}

const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" });
const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });
const monthAbbr = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const dayMonthYear = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/** "setembro de 2026" */
export const formatMonthLong = (key: string) => monthLong.format(toDate(key));
/** "Setembro de 2026" — só a primeira letra (CSS `capitalize` faria "Setembro De 2026"). */
export const formatMonthTitle = (key: string) => {
  const text = formatMonthLong(key);
  return text.charAt(0).toUpperCase() + text.slice(1);
};
/** "setembro" */
export const formatMonthName = (key: string) => monthName.format(toDate(key));
/** "set. de 26" */
export const formatMonthShort = (key: string) => monthShort.format(toDate(key));
/** "set." sem ponto final → "set" */
export const formatMonthAbbr = (key: string) => monthAbbr.format(toDate(key)).replace(".", "");
/** "10/09" */
export const formatDayMonth = (key: string) => dayMonth.format(toDate(key));
const dayMonthYearNumeric = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
/** "10/09" no mês corrente; "10/09/2027" fora dele (sem o ano, 24/09/2027 parece hoje). */
export const formatDayMonthOrYear = (key: string) => {
  const date = toDate(key);
  const now = new Date();
  const sameMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  return (sameMonth ? dayMonth : dayMonthYearNumeric).format(date);
};
/** "31 de mar. de 2027" */
export const formatDateMedium = (key: string) => dayMonthYear.format(toDate(key));

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export const formatMoney = (value: number) => currency.format(Number.isFinite(value) ? value : 0);

/** Sinal tipográfico: "+" ou "−" (U+2212), nunca o hífen. */
export function formatSignedMoney(value: number): string {
  if (value === 0) return formatMoney(0);
  return `${value > 0 ? "+" : "−"}${formatMoney(Math.abs(value))}`;
}

export function formatPct(value: number | null | undefined, { signed = false, digits = 1 } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const body = (digits === 0 ? integer : decimal1).format(Math.abs(value));
  if (!signed) return `${value < 0 ? "−" : ""}${body}%`;
  if (value === 0) return `${body}%`;
  return `${value > 0 ? "+" : "−"}${body}%`;
}

export function formatPoints(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const body = decimal1.format(Math.abs(value));
  if (value === 0) return `${body} p.p.`;
  return `${value > 0 ? "+" : "−"}${body} p.p.`;
}

export function plural(count: number, one: string, many: string): string {
  return `${integer.format(count)} ${count === 1 ? one : many}`;
}

export const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Mensagem de erro dos módulos de planejamento, pronta para toast.
 * Cota/feature de plano vêm tipadas (P0004/P0005); o resto já chega em pt-BR
 * dos triggers (23514, 42501) ou vira uma frase acionável.
 */
export function describePlanningError(error: unknown): { message: string; suggestUpgrade: boolean } {
  const diagnosis = diagnoseLimitError(error);
  if (diagnosis.kind !== "unknown") {
    return { message: diagnosis.message, suggestUpgrade: diagnosis.suggestUpgrade };
  }

  const err = (error ?? {}) as { code?: string; message?: string };
  switch (err.code) {
    case "23505":
      return { message: "Essa categoria já tem orçamento neste mês. Edite o valor existente.", suggestUpgrade: false };
    case "42501":
      return {
        message: err.message && !/row-level security/i.test(err.message)
          ? err.message
          : "Este registro não é seu. No modo Casal a visualização é somente leitura.",
        suggestUpgrade: false,
      };
    case "23514":
    case "23503":
      return { message: err.message || "Algum valor não passou na validação.", suggestUpgrade: false };
    // PostgREST cru ("Cannot coerce the result to a single JSON object",
    // "invalid input syntax for type uuid") nunca vai para a tela.
    case "PGRST116":
    case "22P02":
      return { message: "Registro não encontrado. Ele pode ter sido excluído ou o link está incorreto.", suggestUpgrade: false };
    default:
      return {
        message: err.message || "Não foi possível concluir agora. Verifique sua conexão e tente de novo.",
        suggestUpgrade: false,
      };
  }
}
