import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Check, ChevronDown, Minus, ShieldCheck, Sparkles } from "lucide-react";

import { useSubscriptionPlans, type SubscriptionPlan } from "@/hooks/use-subscription";
import { cn } from "@/lib/utils";

import { buildPlanHighlights, FALLBACK_PLANS, getPlanCardHighlights } from "./plan-highlights";
import { Reveal } from "./Reveal";

type Cycle = "monthly" | "yearly";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const money = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function isFreePlan(plan: SubscriptionPlan) {
  return Number(plan.price_monthly) === 0 && Number(plan.price_yearly) === 0;
}

function yearlySavings(plan: SubscriptionPlan) {
  const monthly = Number(plan.price_monthly);
  const yearly = Number(plan.price_yearly);
  if (monthly <= 0 || yearly <= 0) return null;
  const full = monthly * 12;
  const saved = Math.round((full - yearly) * 100) / 100;
  if (saved <= 0) return null;
  return { saved, percent: Math.round((saved / full) * 100) };
}

export function PricingSection({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const navigate = useNavigate();
  const { data } = useSubscriptionPlans();
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [showComparison, setShowComparison] = useState(false);

  const plans = useMemo(() => {
    const source = data && data.length > 0 ? data : FALLBACK_PLANS;
    return [...source].sort((a, b) => a.display_order - b.display_order);
  }, [data]);

  const maxPercent = plans.reduce((max, plan) => Math.max(max, yearlySavings(plan)?.percent ?? 0), 0);

  const choose = (plan: SubscriptionPlan) => {
    if (!UUID.test(plan.id ?? "")) {
      navigate("/pricing");
      return;
    }

    try {
      localStorage.setItem(
        "orbi_selected_plan",
        JSON.stringify({
          planId: plan.id,
          planSlug: plan.slug,
          billingCycle: cycle,
          isFree: isFreePlan(plan),
          timestamp: Date.now(),
        }),
      );
    } catch {
      navigate("/pricing");
      return;
    }

    navigate(isAuthenticated ? "/pricing?change=1" : "/login?modo=cadastro");
  };

  return (
    <section id="planos" className="lp-section" aria-labelledby="planos-title">
      <div className="lp-container">
        <div className="lp-section__head">
          <div style={{ display: "grid", gap: "1.25rem" }}>
            <Reveal as="h2" className="lp-h2" id="planos-title">
              Comece grátis. Ative a IA quando fizer diferença.
            </Reveal>
            <Reveal as="p" className="lp-lede" delay={100}>
              Sem fidelidade e com cobrança em reais. Troque de plano ou cancele quando quiser, direto pelo sistema.
            </Reveal>
          </div>

          <Reveal className="lp-cycle" delay={160}>
            <div className="lp-seg" role="group" aria-label="Ciclo de cobrança">
              <span className="lp-seg__thumb" data-pos={cycle === "yearly" ? 1 : 0} aria-hidden />
              <button
                type="button"
                className="lp-seg__btn"
                aria-pressed={cycle === "monthly"}
                onClick={() => setCycle("monthly")}
              >
                Mensal
              </button>
              <button
                type="button"
                className="lp-seg__btn"
                aria-pressed={cycle === "yearly"}
                onClick={() => setCycle("yearly")}
              >
                Anual
              </button>
            </div>
            {maxPercent > 0 && <span className="lp-save lp-tabular">Economize até {maxPercent}% no anual</span>}
          </Reveal>
        </div>

        <ul className="lp-plans">
          {plans.map((plan, index) => {
            const free = isFreePlan(plan);
            const featured = plan.is_featured;
            const savings = yearlySavings(plan);
            const perMonth = cycle === "yearly" ? Number(plan.price_yearly) / 12 : Number(plan.price_monthly);
            const [whole, cents] = money.format(perMonth).split(",");
            const highlights = buildPlanHighlights(plan, plans);
            const cardHighlights = getPlanCardHighlights(highlights);
            const remainingCount = Math.max(0, highlights.lines.length - cardHighlights.length);

            return (
              <Reveal as="li" key={plan.slug} delay={index * 110} style={{ display: "flex" }}>
                <article
                  className={cn("lp-plan", featured && "lp-plan--featured lp-space")}
                  aria-labelledby={`plan-${plan.slug}`}
                  style={{ flex: 1 }}
                >
                  {featured && <span className="lp-tile__rule" aria-hidden />}

                  <div className="lp-plan__head">
                    <h3 className="lp-plan__name" id={`plan-${plan.slug}`}>
                      {plan.name}
                      {featured && (
                        <span className="lp-plan__badge">
                          <Sparkles strokeWidth={1.75} aria-hidden />
                          Recomendado
                        </span>
                      )}
                    </h3>
                    {plan.description && <p className="lp-plan__desc">{plan.description}</p>}
                  </div>

                  <div className="lp-price">
                    <div className="lp-price__main" key={`${plan.slug}-${cycle}`}>
                      <span className="lp-price__cur">R$</span>
                      <span className="lp-price__num lp-swap">
                        {free ? "0" : whole}
                        {!free && <span style={{ fontSize: "0.5em", letterSpacing: "-0.02em" }}>,{cents}</span>}
                      </span>
                      <span className="lp-price__per">/mês</span>
                      {!free && cycle === "yearly" && savings && (
                        <span className="lp-save lp-price__save">−{savings.percent}%</span>
                      )}
                    </div>
                    <div className="lp-price__note lp-tabular">
                      {free ? (
                        <span>Para sempre, sem cartão de crédito</span>
                      ) : cycle === "yearly" ? (
                        <span>
                          {currency.format(Number(plan.price_yearly))} por ano
                          {savings ? `, economia de ${currency.format(savings.saved)}` : ""}
                        </span>
                      ) : (
                        <span>Cobrado mensalmente, sem fidelidade</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={cn("lp-btn lp-btn--block", featured ? "lp-btn--primary" : "lp-btn--ghost")}
                    onClick={() => choose(plan)}
                  >
                    {free ? "Começar grátis" : `Assinar ${plan.name}`}
                    {featured && (
                      <span className="lp-btn__icon" aria-hidden>
                        <ArrowUpRight strokeWidth={1.75} />
                      </span>
                    )}
                  </button>

                  <ul className="lp-plan__list">
                    {highlights.lead && <li className="lp-plan__lead">{highlights.lead}</li>}
                    {cardHighlights.map((line) => (
                      <li key={line.text} className="lp-plan__item" data-included={line.included}>
                        <Check strokeWidth={2} aria-hidden />
                        <span>{line.text}</span>
                      </li>
                    ))}
                    {remainingCount > 0 && (
                      <li className="lp-plan__more">+ {remainingCount} recursos na comparação completa</li>
                    )}
                  </ul>
                </article>
              </Reveal>
            );
          })}
        </ul>

        <div className="lp-comparison">
          <button
            type="button"
            className="lp-comparison__trigger"
            aria-expanded={showComparison}
            aria-controls="plan-comparison-details"
            onClick={() => setShowComparison((visible) => !visible)}
          >
            <span>
              <strong>{showComparison ? "Ocultar comparação completa" : "Comparar todos os recursos"}</strong>
              <small>Veja cada recurso incluído antes de escolher.</small>
            </span>
            <span className="lp-comparison__icon" aria-hidden>
              <ChevronDown strokeWidth={1.75} />
            </span>
          </button>

          <div
            id="plan-comparison-details"
            className="lp-comparison__reveal"
            data-open={showComparison}
          >
            <div className="lp-comparison__clip">
              <div className="lp-comparison__grid">
                {plans.map((plan) => {
                  const highlights = buildPlanHighlights(plan, plans);

                  return (
                    <section key={plan.slug} className="lp-comparison__plan" aria-labelledby={`compare-${plan.slug}`}>
                      <div className="lp-comparison__head">
                        <h3 id={`compare-${plan.slug}`}>{plan.name}</h3>
                        {plan.is_featured && <span>Recomendado</span>}
                      </div>
                      {highlights.lead && <p className="lp-comparison__lead">{highlights.lead}</p>}
                      <ul>
                        {highlights.lines.map((line) => (
                          <li key={line.text} data-included={line.included}>
                            {line.included ? (
                              <Check strokeWidth={2} aria-hidden />
                            ) : (
                              <Minus strokeWidth={2} aria-hidden />
                            )}
                            <span>
                              {line.text}
                              <span className="lp-sr"> ({line.included ? "incluído" : "não incluído"})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="lp-plans__foot">
          <p>
            <ShieldCheck strokeWidth={1.5} aria-hidden />
            Pagamento processado pelo Asaas via Pix, boleto ou cartão de crédito.
          </p>
          <div className="lp-inline-links">
            <Link className="lp-link" to="/legal/termos-de-uso">
              Termos de Uso
            </Link>
            <Link className="lp-link" to="/legal/politica-de-privacidade">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
