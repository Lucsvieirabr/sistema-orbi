import { Link } from "react-router-dom";
import { ArrowUpRight, Lock, ShoppingBasket } from "lucide-react";

import { formatMoney, formatPct } from "@/components/planning/planning-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeature } from "@/hooks/use-feature";
import { usePersonalInflation } from "@/hooks/use-personal-inflation";
import { UPGRADE_PATH } from "@/lib/features/premium-modules";
import { cn } from "@/lib/utils";
import "@/lib/features/orbi-features";

import { headlineSentence, inflationTone, toneText } from "./inflation-meta";

export function InflationAlertCard({ className, teaser = true }: { className?: string; teaser?: boolean }) {
  const { hasFeature, isLoading: featureLoading } = useFeature("inflacao_pessoal");
  const { inflation, isLoading } = usePersonalInflation({ enabled: hasFeature });

  if (featureLoading) return null;

  if (!hasFeature) {
    if (!teaser) return null;
    return (
      <section
        aria-label="Inflação pessoal, disponível no Pro e no Casal"
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-dashed border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5",
          className,
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken">
            <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              Quanto o seu custo de vida subiu?
              <Badge variant="outline">Pro e Casal</Badge>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
              A Inflação Pessoal mede o preço do seu mercado, farmácia, combustível e assinaturas mês a mês.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to={UPGRADE_PATH}>
            Ver planos
            <ArrowUpRight aria-hidden />
          </Link>
        </Button>
      </section>
    );
  }

  if (isLoading) return <Skeleton className={cn("h-24 w-full rounded-xl", className)} />;
  if (!inflation || inflation.headlinePct === null || inflation.headlineBasis === null) return null;

  const tone = inflationTone(inflation.headlinePct);
  const sentence = headlineSentence(inflation.headlinePct, inflation.headlineBasis);
  const basis = inflation.headlineBasis;
  const top = [...inflation.categories]
    .filter((category) => category.idx[basis] !== null)
    .sort((a, b) => (b.idx[basis] ?? 0) - (a.idx[basis] ?? 0))[0];

  return (
    <section
      aria-label="Inflação pessoal"
      className={cn("relative isolate overflow-hidden rounded-xl border border-border bg-card animate-fade-in", className)}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-0.5",
          tone === "negative" ? "bg-destructive" : tone === "warning" ? "bg-warning" : tone === "positive" ? "bg-success" : "bg-border",
        )}
      />
      <Link
        to="/sistema/inflation"
        className="group flex flex-col gap-3 px-4 py-4 transition-colors duration-200 ease-swift hover:bg-surface-sunken/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center md:px-5"
      >
        <span className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken">
            <ShoppingBasket className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm text-foreground text-pretty">
              <span className="font-medium">{sentence.lead}</span> {sentence.tail}
            </span>
            {top && (top.idx[basis] ?? 0) > 0.5 && (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Onde mais bateu: {top.name}, <span className="tabular">{formatPct(top.idx[basis], { signed: true })}</span> · custo essencial de{" "}
                <span className="tabular">{formatMoney(inflation.essentialMonthly)}</span>/mês
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
          <span className={cn("figure-md tabular", toneText[tone])}>{formatPct(inflation.headlinePct, { signed: true })}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
            Ver onde subiu
            <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-swift group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </span>
        </span>
      </Link>
    </section>
  );
}
