import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader, PageToolbar, ToolbarSpacer } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordActions, RecordCard, RecordCardHead, RecordCardList, RecordField, RecordFields, TableView } from "@/components/ui/record-card";
import { UserDetailDialog } from "@/admin/components/UserDetailDialog";
import { cn } from "@/lib/utils";
import { StatusBadge, cycleLabel, daysUntil, formatDate, formatInt, formatRelative } from "@/admin/lib/admin-ui";

export interface AdminUserRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  blocked_until: string | null;
  is_admin: boolean;
  plan_name: string | null;
  plan_slug: string | null;
  subscription_status: string | null;
  billing_cycle: string | null;
  period_end: string | null;
  cancel_at_period_end: boolean | null;
}

/** "Período até": a data real da assinatura vigente, com o que acontece nela. */
function PeriodUntil({ row }: { row: AdminUserRow }) {
  if (!row.period_end) return <span className="text-muted-foreground">—</span>;
  const days = daysUntil(row.period_end);
  const expired = days !== null && days < 0;
  return (
    <div className="min-w-0">
      <div className={cn("tabular text-sm", expired ? "text-destructive" : "text-foreground")}>{formatDate(row.period_end)}</div>
      <div className="text-2xs text-muted-foreground">
        {expired ? "vencido" : row.cancel_at_period_end ? "encerra nessa data" : cycleLabel(row.billing_cycle)}
      </div>
    </div>
  );
}

function Flags({ row }: { row: AdminUserRow }) {
  return (
    <>
      {row.is_admin && <Badge variant="info">Admin</Badge>}
      {row.blocked_until && <Badge variant="destructive">Bloqueado</Badge>}
    </>
  );
}

export default function UserManagement() {
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<AdminUserRow[]>({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return (data ?? []) as AdminUserRow[];
    },
    refetchInterval: 60_000,
  });

  const plans = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => u.plan_slug && map.set(u.plan_slug, u.plan_name ?? u.plan_slug));
    return [...map.entries()];
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) =>
      (plan === "all" || (plan === "none" ? !u.plan_slug : u.plan_slug === plan)) &&
      (!q || u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q)),
    );
  }, [users, plan, search]);

  return (
    <div className="min-w-0 space-y-5 md:space-y-7">
      <PageHeader
        eyebrow="Administração"
        icon={Users}
        title="Usuários"
        description={`${formatInt(users.length)} contas no Orbi. Suporte, troca de plano e bloqueio temporário — nenhuma conta é excluída por aqui.`}
      />

      <PageToolbar>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Buscar usuários"
          />
        </div>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por plano">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {plans.map(([slug, name]) => <SelectItem key={slug} value={slug}>{name}</SelectItem>)}
            <SelectItem value="none">Sem assinatura</SelectItem>
          </SelectContent>
        </Select>
        <ToolbarSpacer />
        <span className="text-xs tabular text-muted-foreground">{formatInt(filtered.length)} no recorte</span>
      </PageToolbar>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum usuário neste recorte"
          description={search ? `Nada corresponde a “${search}”.` : "Ajuste o filtro de plano."}
        />
      ) : (
        <>
          <RecordCardList>
            {filtered.map((u) => (
              <RecordCard key={u.user_id} accent={u.blocked_until ? "negative" : "neutral"}>
                <RecordCardHead title={u.full_name || u.email || "Sem nome"} meta={u.email} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge status={u.subscription_status} />
                  <Flags row={u} />
                </div>
                <RecordFields>
                  <RecordField label="Plano">{u.plan_name ?? "—"}</RecordField>
                  <RecordField label="Período até"><PeriodUntil row={u} /></RecordField>
                  <RecordField label="Último acesso">{formatRelative(u.last_sign_in_at)}</RecordField>
                  <RecordField label="Cadastro">{formatDate(u.created_at)}</RecordField>
                </RecordFields>
                <RecordActions>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(u.user_id)}>
                    Detalhes
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Button>
                </RecordActions>
              </RecordCard>
            ))}
          </RecordCardList>

          <TableView className="overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Período até</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow
                    key={u.user_id}
                    className="group cursor-pointer transition-colors duration-150 ease-swift"
                    onClick={() => setSelected(u.user_id)}
                  >
                    <TableCell className="max-w-[18rem]">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-foreground">{u.full_name || u.email || "Sem nome"}</span>
                        <Flags row={u} />
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{u.plan_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><StatusBadge status={u.subscription_status} /></TableCell>
                    <TableCell><PeriodUntil row={u} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatRelative(u.last_sign_in_at)}</TableCell>
                    <TableCell className="tabular text-sm">{formatDate(u.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Detalhes de ${u.full_name || u.email}`}
                        onClick={(e) => { e.stopPropagation(); setSelected(u.user_id); }}
                        className="text-muted-foreground transition-[color,transform] duration-200 ease-swift group-hover:translate-x-0.5 group-hover:text-foreground"
                      >
                        <ChevronRight aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableView>
        </>
      )}

      <UserDetailDialog userId={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
