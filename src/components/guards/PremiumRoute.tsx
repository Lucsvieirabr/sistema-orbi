/**
 * ============================================================================
 * COMPONENT: PremiumRoute
 * ============================================================================
 * Gate de rota dos módulos de planejamento (Orçamentos, Metas, Fechamento do
 * mês) — exclusivos dos planos Pro e Casal.
 *
 * Isto é UX. A autoridade está no banco (migration 20260915150000): as
 * policies de RLS, os triggers e as RPCs exigem a mesma feature. Um usuário
 * Free que chame a API direto recebe P0005, não dados.
 *
 * Sem a feature, a rota não redireciona: mostra a tela do módulo com o que ele
 * faz, uma prévia com dados de exemplo e os planos que o incluem. Quem clicou
 * em "Orçamentos" entende o que está comprando no mesmo lugar onde clicou.
 */

import { ReactNode, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageBody, PageHeader, SectionHeader } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeature } from "@/hooks/use-feature";
import { useSubscription, useSubscriptionPlans } from "@/hooks/use-subscription";
// Garante o catálogo registrado antes do primeiro useFeature, sem depender da ordem de imports do App.
import "@/lib/features/orbi-features";
import {
  PREMIUM_MODULES,
  UPGRADE_PATH,
  type PremiumModule,
  type PremiumModuleKey,
} from "@/lib/features/premium-modules";

import { PremiumPreview } from "./PremiumPreview";

interface PremiumRouteProps {
  module: PremiumModuleKey;
  children: ReactNode;
}

export function PremiumRoute({ module, children }: PremiumRouteProps) {
  const config = PREMIUM_MODULES[module];
  const { hasFeature, isLoading } = useFeature(config.feature);

  if (isLoading) return <PremiumRouteSkeleton />;
  if (!hasFeature) return <PremiumUpgrade module={config} />;
  return <>{children}</>;
}

function PremiumRouteSkeleton() {
  return (
    <PageBody aria-busy="true">
      <div className="space-y-3 border-b border-border-subtle pb-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </PageBody>
  );
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PremiumUpgrade({ module }: { module: PremiumModule }) {
  const { plan } = useSubscription();
  const { data: plans } = useSubscriptionPlans();
  const Icon = module.icon;

  // Planos que incluem o módulo, direto do catálogo (admin pode mudar sem deploy).
  const includedIn = useMemo(
    () =>
      [...(plans ?? [])]
        .filter((candidate) => candidate.features?.[module.feature] === true)
        .sort((a, b) => a.display_order - b.display_order),
    [plans, module.feature],
  );

  const target = includedIn[0];
  const ctaLabel = target ? `Fazer upgrade para o ${target.name}` : "Ver planos";

  return (
    <PageBody className="animate-fade-in">
      <PageHeader
        eyebrow="Disponível no Pro e no Casal"
        icon={Lock}
        title={module.productName}
        description={module.pitch}
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link to={UPGRADE_PATH}>
              {ctaLabel}
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:gap-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <SectionHeader
              title="Como fica com os seus lançamentos"
              description="Prévia com valores de exemplo. Com o módulo ativo, os números vêm do seu extrato."
              actions={<Badge variant="outline">Exemplo</Badge>}
            />
          </CardHeader>
          <CardContent>
            <PremiumPreview module={module.key} />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="gap-0 space-y-0">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </span>
              <h2 className="font-display text-base font-semibold tracking-[-0.015em] text-foreground">
                O que o módulo faz
              </h2>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-5">
            <ul className="space-y-2.5">
              {module.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground">
                  <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                  {benefit}
                </li>
              ))}
            </ul>

            {includedIn.length > 0 && (
              <div className="border-t border-border-subtle pt-4">
                <h3 className="text-xs font-medium text-muted-foreground">Incluído nos planos</h3>
                <ul className="mt-2">
                  {includedIn.map((candidate) => (
                    <li
                      key={candidate.id}
                      className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-2 last:border-b-0"
                    >
                      <span className="text-sm font-medium text-foreground">{candidate.name}</span>
                      <span className="text-sm tabular text-muted-foreground">
                        {money.format(Number(candidate.price_monthly))}
                        <span className="text-xs">/mês</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-auto space-y-2">
              {plan?.name && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Seu plano atual: <span className="font-medium text-foreground">{plan.name}</span>. Nada do que
                  você já lançou muda com o upgrade.
                </p>
              )}
              <Button asChild variant="outline" className="w-full">
                <Link to={UPGRADE_PATH}>Comparar planos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
