import { format, formatDistanceToNowStrict, isValid, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Vocabulário único do painel admin: moeda, datas, status e variação.
 * Toda tela do /admin importa daqui — nada de `getStatusBadge` duplicado.
 */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const int = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export const formatBRL = (v: number | string | null | undefined) => brl.format(Number(v) || 0);
export const formatInt = (v: number | null | undefined) => int.format(v ?? 0);
export const formatPct = (v: number | null | undefined) => pct.format(v ?? 0);

/** Aceita ISO completo (`timestamptz`) ou só a data (`date`). Nunca lança. */
export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

export function formatDate(value: string | null | undefined, pattern = "dd MMM yyyy") {
  const d = toDate(value);
  return d ? format(d, pattern, { locale: ptBR }) : "—";
}

export function formatRelative(value: string | null | undefined) {
  const d = toDate(value);
  return d ? formatDistanceToNowStrict(d, { locale: ptBR, addSuffix: true }) : "nunca";
}

/** Dias até a data (negativo = já passou). */
export function daysUntil(value: string | null | undefined) {
  const d = toDate(value);
  return d ? differenceInCalendarDays(d, new Date()) : null;
}

export type SubscriptionStatus = "active" | "trial" | "past_due" | "pending" | "canceled" | "expired";

export const STATUS_META: Record<SubscriptionStatus, { label: string; variant: BadgeProps["variant"]; dot: string }> = {
  active:   { label: "Ativa",     variant: "success",     dot: "bg-success" },
  trial:    { label: "Trial",     variant: "info",        dot: "bg-info" },
  past_due: { label: "Em atraso", variant: "warning",     dot: "bg-warning" },
  pending:  { label: "Pendente",  variant: "secondary",   dot: "bg-muted-foreground" },
  canceled: { label: "Cancelada", variant: "outline",     dot: "bg-border" },
  expired:  { label: "Expirada",  variant: "destructive", dot: "bg-destructive" },
};

export const STATUS_ORDER: SubscriptionStatus[] = ["active", "trial", "past_due", "pending", "canceled", "expired"];

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <Badge variant="outline" className={className}>Sem assinatura</Badge>;
  const meta = STATUS_META[status as SubscriptionStatus] ?? { label: status, variant: "outline" as const, dot: "bg-border" };
  return (
    <Badge variant={meta.variant} className={cn("gap-1.5", className)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export const cycleLabel = (c: string | null | undefined) =>
  c === "yearly" ? "Anual" : c === "monthly" ? "Mensal" : "—";

/**
 * Variação contra o período anterior. `invert` para métricas em que subir é
 * ruim (churn). Sem base anterior, mostra "novo" em vez de um +∞% mentiroso.
 */
export function Delta({
  now,
  prev,
  invert = false,
  mode = "relative",
  className,
}: {
  now: number;
  prev: number;
  invert?: boolean;
  /** `points` para taxas (churn): diferença em p.p., não variação relativa. */
  mode?: "relative" | "points";
  className?: string;
}) {
  const diff = now - prev;
  if (mode === "relative" && prev === 0) {
    return (
      <span className={cn("text-2xs text-muted-foreground md:text-xs", className)}>
        {now > 0 ? "novo no período" : "sem variação"}
      </span>
    );
  }

  const value = mode === "points" ? diff * 100 : diff / Math.abs(prev);
  const flat = Math.abs(value) < (mode === "points" ? 0.05 : 0.0005);
  const good = invert ? diff < 0 : diff > 0;
  const Icon = flat ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
  const label = flat
    ? "estável"
    : mode === "points"
      ? `${diff > 0 ? "+" : "−"}${Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`
      : `${diff > 0 ? "+" : "−"}${pct.format(Math.abs(value))}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-2xs font-medium tabular leading-4 md:text-xs",
        flat ? "bg-muted text-muted-foreground" : good ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

/** Mensagem de erro do Postgres/PostgREST sem vazar detalhes internos. */
export function rpcErrorMessage(error: unknown, fallback = "Não foi possível concluir a ação.") {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return fallback;
  if (e.code === "42501") return "Sua conta não tem acesso de administrador.";
  // P0001/P0002/22023 são as mensagens escritas por nós nas RPCs admin_*.
  if (e.code === "P0001" || e.code === "P0002" || e.code === "22023") return e.message ?? fallback;
  return fallback;
}
