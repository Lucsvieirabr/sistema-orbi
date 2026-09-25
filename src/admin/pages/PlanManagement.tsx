import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Receipt, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { PlanDialog } from "@/admin/components/PlanDialog";
import { featureRegistry } from "@/lib/features/orbi-features";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatBRL, formatInt, rpcErrorMessage } from "@/admin/lib/admin-ui";
import type { AdminSubscriptionRow } from "@/admin/pages/SubscriptionManagement";

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const LIMITS = featureRegistry.getAllLimits();

function limitValue(v: number | undefined) {
  if (v === undefined || v === null) return "—";
  return v === -1 ? "Ilimitado" : formatInt(v);
}

export default function PlanManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, slug, description, price_monthly, price_yearly, features, limits, is_active, is_featured, display_order, created_at, updated_at")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as Plan[];
    },
  });

  // Mesma fonte da tela de Assinaturas: quantas contas estão em cada plano hoje.
  const { data: subs = [] } = useQuery<AdminSubscriptionRow[]>({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_subscriptions");
      if (error) throw error;
      return (data ?? []) as AdminSubscriptionRow[];
    },
  });

  const subscribers = useMemo(() => {
    const map: Record<string, number> = {};
    subs.forEach((s) => {
      if (s.is_current && s.plan_slug && ["active", "trial", "past_due"].includes(s.status)) {
        map[s.plan_slug] = (map[s.plan_slug] ?? 0) + 1;
      }
    });
    return map;
  }, [subs]);

  // Plano nunca é excluído: assinaturas antigas apontam para ele (histórico/LGPD).
  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("subscription_plans").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      toast({ title: active ? "Plano visível para novas assinaturas" : "Plano ocultado", description: active ? undefined : "Quem já assina continua no plano." });
    },
    onError: (e) => toast({ title: "Não foi possível alterar o plano", description: rpcErrorMessage(e), variant: "destructive" }),
  });

  const openEditor = (plan: Plan | null) => {
    setEditing(plan);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto min-w-0 max-w-[76rem] space-y-5 md:space-y-7">
      <PageHeader
        eyebrow="Administração"
        icon={Receipt}
        title="Planos de assinatura"
        description="Preço, recursos e limites de cada plano. Planos não são excluídos — oculte para parar de vender."
        actions={
          <Button onClick={() => openEditor(null)} className="press w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden />
            Novo plano
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhum plano cadastrado"
          description="Crie o primeiro plano para começar a vender."
          action={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" aria-hidden />Criar plano</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:gap-6">
          {plans.map((plan, i) => {
            const enabled = Object.values(plan.features ?? {}).filter(Boolean).length;
            const total = featureRegistry.getAllFeatures().length;
            return (
              <article
                key={plan.id}
                className={cn(
                  "group relative isolate flex flex-col overflow-hidden rounded-xl border bg-card p-5 animate-rise transition-colors duration-200 ease-swift hover:border-ring/45 md:p-6",
                  plan.is_featured ? "border-primary/40" : "border-border",
                  !plan.is_active && "bg-surface-sunken/40",
                )}
                style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
              >
                <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-0.5", plan.is_featured ? "bg-primary" : "bg-border")} />

                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-semibold tracking-[-0.015em]">{plan.name}</h2>
                      {plan.is_featured && (
                        <Badge variant="primary" className="gap-1"><Star className="h-3 w-3" aria-hidden />Destaque</Badge>
                      )}
                      {!plan.is_active && <Badge variant="outline">Oculto</Badge>}
                    </div>
                    <p className="mt-0.5 font-mono text-2xs text-muted-foreground">{plan.slug}</p>
                  </div>
                  <Switch
                    checked={plan.is_active}
                    onCheckedChange={(v) => setActive.mutate({ id: plan.id, active: v })}
                    aria-label={plan.is_active ? `Ocultar ${plan.name}` : `Publicar ${plan.name}`}
                  />
                </header>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="figure-xl tabular">{formatBRL(plan.price_monthly)}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                <p className="mt-1 text-xs tabular text-muted-foreground">
                  {plan.price_yearly > 0 ? `${formatBRL(plan.price_yearly)}/ano` : "Sem cobrança anual"}
                  {" · "}
                  <span className="text-foreground">{formatInt(subscribers[plan.slug] ?? 0)}</span> assinantes
                </p>

                {plan.description && (
                  <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>
                )}

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border-subtle pt-4">
                  {LIMITS.map((l) => (
                    <div key={l.key} className="min-w-0">
                      <dt className="truncate text-2xs text-muted-foreground">{l.label.replace(/^Máximo de /, "")}</dt>
                      <dd className={cn("text-sm tabular", plan.limits?.[l.key] === -1 ? "text-success" : "text-foreground")}>
                        {limitValue(plan.limits?.[l.key])}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="text-xs tabular text-muted-foreground">
                    {enabled} de {total} recursos
                  </span>
                  <Button variant="outline" size="sm" onClick={() => openEditor(plan)} className="press">
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Editar
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <PlanDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }} plan={editing} />
    </div>
  );
}
