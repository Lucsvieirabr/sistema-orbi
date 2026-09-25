import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader, PageToolbar, ToolbarSpacer } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  RecordCard,
  RecordCardHead,
  RecordCardList,
  RecordField,
  RecordFields,
  TableView,
} from "@/components/ui/record-card";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  STATUS_ORDER,
  StatusBadge,
  cycleLabel,
  daysUntil,
  formatBRL,
  formatDate,
  formatInt,
  type SubscriptionStatus,
} from "@/admin/lib/admin-ui";

export interface AdminSubscriptionRow {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  plan_name: string | null;
  plan_slug: string | null;
  status: SubscriptionStatus;
  billing_cycle: string;
  amount: number | null;
  current_period_start: string | null;
  period_end: string | null;
  cancel_at_period_end: boolean;
  last_payment_at: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string | null;
}

type StatusFilter = "all" | SubscriptionStatus;

/** "Termina em" com contexto: renova, encerra no fim do ciclo ou já venceu. */
function PeriodEnd({ row }: { row: AdminSubscriptionRow }) {
  const days = daysUntil(row.period_end);
  const live = row.status === "active" || row.status === "trial" || row.status === "past_due";
  let note: string | null = null;
  let tone = "text-muted-foreground";

  if (days !== null && live) {
    if (days < 0) { note = `venceu há ${Math.abs(days)} d`; tone = "text-destructive"; }
    else if (row.cancel_at_period_end) { note = `encerra em ${days} d`; tone = "text-warning"; }
    else note = days === 0 ? "renova hoje" : `renova em ${days} d`;
  }

  return (
    <div className="min-w-0">
      <div className="tabular text-sm text-foreground">{formatDate(row.period_end)}</div>
      {note && <div className={cn("text-2xs tabular", tone)}>{note}</div>}
    </div>
  );
}

export default function SubscriptionManagement() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [plan, setPlan] = useState<string>("all");
  const [onlyCurrent, setOnlyCurrent] = useState(true);

  const { data: rows = [], isLoading } = useQuery<AdminSubscriptionRow[]>({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_subscriptions");
      if (error) throw error;
      return (data ?? []) as AdminSubscriptionRow[];
    },
    refetchInterval: 60_000,
  });

  const scoped = useMemo(() => rows.filter((r) => !onlyCurrent || r.is_current), [rows, onlyCurrent]);

  const plans = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => r.plan_slug && map.set(r.plan_slug, r.plan_name ?? r.plan_slug));
    return [...map.entries()];
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    scoped.forEach((r) => {
      if (plan !== "all" && r.plan_slug !== plan) return;
      c.all += 1;
      c[r.status] = (c[r.status] ?? 0) + 1;
    });
    return c;
  }, [scoped, plan]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((r) =>
      (status === "all" || r.status === status) &&
      (plan === "all" || r.plan_slug === plan) &&
      (!q || r.email?.toLowerCase().includes(q) || r.full_name?.toLowerCase().includes(q)),
    );
  }, [scoped, status, plan, search]);

  const chips: StatusFilter[] = ["all", ...STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0 || s === status)];

  return (
    <div className="min-w-0 space-y-5 md:space-y-7">
      <PageHeader
        eyebrow="Administração"
        icon={CreditCard}
        title="Assinaturas"
        description="Registro de auditoria, somente leitura. Cancelamentos e reembolsos acontecem no Asaas ou pelo próprio cliente."
      >
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Nenhuma assinatura é alterada ou excluída por esta tela (LGPD).
        </p>
      </PageHeader>

      <PageToolbar>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Buscar assinaturas"
          />
        </div>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por plano">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {plans.map(([slug, name]) => (
              <SelectItem key={slug} value={slug}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToolbarSpacer />
        <div className="flex items-center gap-2">
          <Switch id="only-current" checked={onlyCurrent} onCheckedChange={setOnlyCurrent} />
          <Label htmlFor="only-current" className="cursor-pointer text-sm text-muted-foreground">
            Só a vigente de cada conta
          </Label>
        </div>
      </PageToolbar>

      {/* Filtro por status: trilho afundado com contagem. */}
      <div
        role="radiogroup"
        aria-label="Filtrar por status"
        className="scroll-x -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-fit sm:flex-wrap sm:rounded-xl sm:border sm:border-border-subtle sm:bg-surface-sunken sm:p-1"
      >
        {chips.map((s) => {
          const on = status === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setStatus(s)}
              className={cn(
                "press inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm transition-colors duration-200 ease-swift md:h-8",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-border bg-card text-foreground shadow-sm" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s !== "all" && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[s].dot)} />}
              {s === "all" ? "Todas" : STATUS_META[s].label}
              <span className="tabular text-xs text-muted-foreground">{formatInt(counts[s] ?? 0)}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhuma assinatura neste recorte"
          description={search ? `Nada corresponde a “${search}”.` : "Ajuste os filtros de status ou plano."}
        />
      ) : (
        <>
          <RecordCardList>
            {filtered.map((r) => (
              <RecordCard
                key={r.id}
                accent={r.status === "active" ? "positive" : r.status === "past_due" ? "warning" : r.status === "expired" ? "negative" : "neutral"}
              >
                <RecordCardHead
                  title={r.full_name || r.email || "Sem nome"}
                  meta={r.email}
                  value={r.amount != null ? formatBRL(r.amount) : "—"}
                  valueMeta={cycleLabel(r.billing_cycle)}
                />
                <RecordFields>
                  <RecordField label="Plano">{r.plan_name ?? "—"}</RecordField>
                  <RecordField label="Status"><StatusBadge status={r.status} /></RecordField>
                  <RecordField label="Termina em"><PeriodEnd row={r} /></RecordField>
                  <RecordField label="Último pagamento">{formatDate(r.last_payment_at)}</RecordField>
                </RecordFields>
              </RecordCard>
            ))}
          </RecordCardList>

          <TableView className="overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Termina em</TableHead>
                  <TableHead>Últ. pagamento</TableHead>
                  <TableHead className="text-right">Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className={cn("transition-colors duration-150 ease-swift", !r.is_current && "text-muted-foreground")}>
                    <TableCell className="max-w-[16rem]">
                      <div className="truncate font-medium text-foreground">{r.full_name || r.email || "Sem nome"}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{r.plan_name ?? "—"}</div>
                      <div className="text-2xs text-muted-foreground">{cycleLabel(r.billing_cycle)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={r.status} />
                        {!r.is_current && <span className="text-2xs text-muted-foreground">histórico</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular">{r.amount != null ? formatBRL(r.amount) : "—"}</TableCell>
                    <TableCell className="tabular text-sm">{formatDate(r.current_period_start)}</TableCell>
                    <TableCell><PeriodEnd row={r} /></TableCell>
                    <TableCell className="tabular text-sm">{formatDate(r.last_payment_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="tabular text-sm">{formatDate(r.created_at)}</div>
                      <div className="text-2xs text-muted-foreground">atualizada {formatDate(r.updated_at, "dd/MM")}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableView>
        </>
      )}
    </div>
  );
}
