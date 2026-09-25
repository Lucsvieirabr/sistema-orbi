import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { Ban, Loader2, LockOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import { sanitizeSingleLine } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";
import {
  StatusBadge,
  cycleLabel,
  formatBRL,
  formatDate,
  formatInt,
  formatRelative,
  rpcErrorMessage,
} from "@/admin/lib/admin-ui";

interface UserDetail {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  blocked_until: string | null;
  is_admin: boolean;
  subscription: {
    plan_name: string;
    plan_slug: string;
    status: string;
    billing_cycle: string;
    period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  usage: { accounts: number; transactions: number; last_activity: string | null };
  payments: { amount: number; status: string; payment_method: string | null; due_date: string | null; paid_at: string | null; created_at: string }[];
  audit: { action: string; created_at: string; new_data: Record<string, unknown> | null }[];
}

interface PlanOption { id: string; name: string; price_monthly: number }

const BLOCK_OPTIONS = [
  { value: "1", label: "24 horas" },
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

const AUDIT_LABEL: Record<string, string> = {
  user_block: "Conta bloqueada",
  user_unblock: "Bloqueio removido",
  plan_activate: "Plano ativado pelo suporte",
  admin_create: "Acesso de admin criado",
  admin_promote: "Promovido a admin",
  admin_activate: "Acesso de admin reativado",
  admin_deactivate: "Acesso de admin desativado",
};

const PAYMENT_TONE: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  confirmed: "success",
  received: "success",
  pending: "warning",
  overdue: "destructive",
  refunded: "secondary",
};

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <h3 className="label-eyebrow">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function UserDetailDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [planId, setPlanId] = useState("");
  const [blockDays, setBlockDays] = useState("7");
  const [reason, setReason] = useState("");

  const { data: user, isLoading } = useQuery<UserDetail | null>({
    queryKey: ["admin-user-details", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_user_details", { p_user_id: userId! });
      if (error) throw error;
      return (data ?? null) as unknown as UserDetail | null;
    },
    enabled: !!userId && open,
  });

  const { data: plans = [] } = useQuery<PlanOption[]>({
    queryKey: ["admin-plans-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, price_monthly")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as PlanOption[];
    },
    enabled: open,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
    queryClient.invalidateQueries({ queryKey: ["admin-user-details", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard-metrics"] });
  };

  const onError = (title: string) => (error: unknown) =>
    toast({ title, description: rpcErrorMessage(error), variant: "destructive" });

  const activatePlan = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_activate_plan_for_user", { p_user_id: userId!, p_plan_id: planId });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      setPlanId("");
      toast({ title: "Plano ativado", description: "A troca ficou registrada na auditoria." });
    },
    onError: onError("Não foi possível ativar o plano"),
  });

  const setBlock = useMutation({
    mutationFn: async (block: boolean) => {
      const { error } = await supabase.rpc("admin_set_user_block", {
        p_user_id: userId!,
        p_until: block ? addDays(new Date(), Number(blockDays)).toISOString() : null,
        p_reason: block ? sanitizeSingleLine(reason).slice(0, 200) || null : null,
      });
      if (error) throw error;
    },
    onSuccess: (_, block) => {
      refresh();
      setReason("");
      toast({
        title: block ? "Conta bloqueada" : "Bloqueio removido",
        description: block ? "As sessões abertas foram encerradas." : "A pessoa já pode entrar de novo.",
      });
    },
    onError: onError("Não foi possível alterar o bloqueio"),
  });

  const sub = user?.subscription;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {isLoading ? "Carregando…" : user?.full_name || user?.email || "Usuário"}
            {user?.is_admin && <Badge variant="info">Admin</Badge>}
            {user?.blocked_until && <Badge variant="destructive">Bloqueado até {formatDate(user.blocked_until, "dd/MM HH:mm")}</Badge>}
          </DialogTitle>
          <DialogDescription className="truncate">{user?.email ?? "Suporte, plano e bloqueio temporário."}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !user ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Usuário não encontrado.</p>
        ) : (
          <div className="space-y-7">
            {/* Resumo */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <Field label="Cadastro">{formatDate(user.created_at)}</Field>
              <Field label="Último acesso">{formatRelative(user.last_sign_in_at)}</Field>
              <Field label="Contas">{formatInt(user.usage.accounts)}</Field>
              <Field label="Lançamentos">
                <span className="tabular">{formatInt(user.usage.transactions)}</span>
                {user.usage.last_activity && (
                  <span className="block text-2xs text-muted-foreground">último {formatRelative(user.usage.last_activity)}</span>
                )}
              </Field>
            </dl>

            <Section title="Assinatura vigente" className="border-t border-border-subtle pt-6">
              {sub ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                  <Field label="Plano">{sub.plan_name}</Field>
                  <Field label="Status"><StatusBadge status={sub.status} /></Field>
                  <Field label="Ciclo">{cycleLabel(sub.billing_cycle)}</Field>
                  <Field label="Período até">
                    <span className="tabular">{formatDate(sub.period_end)}</span>
                    {sub.cancel_at_period_end && <span className="block text-2xs text-warning">encerra nessa data</span>}
                  </Field>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Sem assinatura registrada.</p>
              )}

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger className="sm:flex-1" aria-label="Plano a ativar">
                    <SelectValue placeholder="Trocar plano (suporte)" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {formatBRL(p.price_monthly)}/mês
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ConfirmationDialog
                  title="Ativar plano manualmente?"
                  description="A assinatura atual é encerrada no Orbi e um novo ciclo mensal de 30 dias começa agora. A cobrança no Asaas não é alterada."
                  confirmText="Ativar plano"
                  onConfirm={() => activatePlan.mutate()}
                >
                  <Button variant="outline" disabled={!planId || activatePlan.isPending}>
                    {activatePlan.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    Ativar
                  </Button>
                </ConfirmationDialog>
              </div>
            </Section>

            <Section title="Pagamentos recentes" className="border-t border-border-subtle pt-6">
              {user.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma cobrança registrada.</p>
              ) : (
                <ul className="divide-y divide-border-subtle rounded-lg border border-border">
                  {user.payments.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="figure-sm tabular">{formatBRL(p.amount)}</p>
                        <p className="text-2xs text-muted-foreground">
                          vence {formatDate(p.due_date)}{p.paid_at ? ` · pago ${formatDate(p.paid_at)}` : ""}
                          {p.payment_method ? ` · ${p.payment_method.toLowerCase()}` : ""}
                        </p>
                      </div>
                      <Badge variant={PAYMENT_TONE[p.status?.toLowerCase()] ?? "outline"}>{p.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Bloqueio temporário" className="border-t border-border-subtle pt-6">
              {user.blocked_until ? (
                <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive-soft p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-destructive">
                    Login suspenso até {formatDate(user.blocked_until, "dd 'de' MMM 'às' HH:mm")}.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setBlock.mutate(false)} disabled={setBlock.isPending}>
                    <LockOpen className="h-4 w-4" aria-hidden />
                    Remover bloqueio
                  </Button>
                </div>
              ) : user.is_admin ? (
                <p className="text-sm text-muted-foreground">Administradores ativos não podem ser bloqueados. Desative o acesso primeiro.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="block-days">Duração</Label>
                    <Select value={blockDays} onValueChange={setBlockDays}>
                      <SelectTrigger id="block-days"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BLOCK_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="block-reason">Motivo (fica na auditoria)</Label>
                    <Input
                      id="block-reason"
                      maxLength={200}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ex.: suspeita de uso indevido"
                    />
                  </div>
                  <ConfirmationDialog
                    title="Bloquear esta conta?"
                    description="A pessoa sai de todas as sessões e não consegue entrar até o fim do prazo. Nenhum dado é apagado."
                    confirmText="Bloquear"
                    variant="destructive"
                    onConfirm={() => setBlock.mutate(true)}
                  >
                    <Button
                      variant="outline"
                      disabled={setBlock.isPending}
                      className="hover:border-destructive/40 hover:bg-destructive-soft hover:text-destructive"
                    >
                      <Ban className="h-4 w-4" aria-hidden />
                      Bloquear
                    </Button>
                  </ConfirmationDialog>
                </div>
              )}
            </Section>

            {user.audit.length > 0 && (
              <Section title="Auditoria" className="border-t border-border-subtle pt-6">
                <ol className="space-y-2.5">
                  {user.audit.map((a, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        {AUDIT_LABEL[a.action] ?? a.action}
                        {typeof a.new_data?.reason === "string" && (
                          <span className="text-muted-foreground"> — {a.new_data.reason}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs tabular text-muted-foreground">{formatDate(a.created_at, "dd/MM/yy HH:mm")}</span>
                    </li>
                  ))}
                </ol>
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
