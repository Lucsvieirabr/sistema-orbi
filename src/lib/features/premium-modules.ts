/**
 * ============================================================================
 * MÓDULOS PREMIUM — catálogo de UX
 * ============================================================================
 * Orçamentos, Metas, Fechamento do Mês (DRE), Motor Preditivo e Rateios/Acertos
 * são exclusivos dos planos Pro e Casal. Este arquivo descreve COMO cada módulo aparece (rota, nome, pitch,
 * benefícios). QUEM pode usar vem do plano (`subscription_plans.features`) e
 * é imposto no banco: RLS + triggers + RPCs das migrations 20260915161252
 * (planejamento) e 20260916021503/20260916021607 (projeção e rateios).
 *
 * A mesma chave de feature é usada em:
 *   - orbi-features.ts          (registry — admin liga/desliga por plano)
 *   - PremiumRoute              (gate de rota com tela de upgrade)
 *   - AppSidebar                (cadeado discreto no item)
 *   - Pricing / plan-highlights (benefício no card do plano)
 *   - plan-impact.ts            (o que se perde ao cancelar)
 */

import { Gauge, ScrollText, Split, Target, Telescope, type LucideIcon } from "lucide-react";

export type PremiumModuleKey = "budgets" | "goals" | "analytics" | "forecast" | "ledgers";

export interface PremiumModule {
  key: PremiumModuleKey;
  /** Chave em `subscription_plans.features`. */
  feature: "orcamentos" | "metas" | "dre_pessoal" | "motor_preditivo" | "contratos_rateio";
  path: string;
  /** Nome comercial (cards de plano, tela de upgrade). */
  productName: string;
  /** Nome curto da navegação. */
  navLabel: string;
  icon: LucideIcon;
  /** Uma frase: o que o módulo faz pela pessoa. */
  pitch: string;
  benefits: string[];
}

export const PREMIUM_MODULES: Record<PremiumModuleKey, PremiumModule> = {
  budgets: {
    key: "budgets",
    feature: "orcamentos",
    path: "/sistema/budgets",
    productName: "Orçamentos Inteligentes",
    navLabel: "Orçamentos",
    icon: Gauge,
    pitch: "Defina quanto pode sair por categoria e veja, a cada lançamento, quanto ainda cabe no mês.",
    benefits: [
      "Teto mensal por categoria de gasto",
      "Consumo em tempo real, somando o que já está agendado",
      "Valor sugerido pela sua média dos últimos 3 meses",
      "Tetos do mês anterior copiados com um clique",
    ],
  },
  goals: {
    key: "goals",
    feature: "metas",
    path: "/sistema/goals",
    productName: "Metas Financeiras",
    navLabel: "Metas",
    icon: Target,
    pitch: "Dê valor e prazo a cada objetivo. O Orbi calcula quanto guardar por mês para chegar lá.",
    benefits: [
      "Metas com valor-alvo, prazo, ícone e cor",
      "Aportes e resgates com histórico",
      "Quanto guardar por mês até o prazo",
      "No Plano Casal, as metas ficam visíveis para os dois",
    ],
  },
  analytics: {
    key: "analytics",
    feature: "dre_pessoal",
    path: "/sistema/analytics",
    productName: "DRE Pessoal Avançado",
    navLabel: "Fechamento do mês",
    icon: ScrollText,
    pitch: "O demonstrativo do seu mês: o que entrou, para onde foi e quanto sobrou, comparado ao mês anterior.",
    benefits: [
      "Receitas, despesas fixas, parcelas e variáveis em linhas de DRE",
      "Taxa de poupança e variação contra o mês anterior",
      "Maior despesa do mês e ranking de categorias",
      "Tendência dos últimos 6 meses",
    ],
  },
  forecast: {
    key: "forecast",
    feature: "motor_preditivo",
    path: "/sistema/forecast",
    productName: "Motor Preditivo",
    navLabel: "Projeção de caixa",
    icon: Telescope,
    pitch: "Veja o saldo dos próximos 30, 90 ou 365 dias e o dia exato em que o caixa pode ficar no vermelho.",
    benefits: [
      "Saldo real somado a faturas, parcelas e receitas fixas já agendadas",
      "Ralo diário: a média dos seus gastos variáveis dos últimos 90 dias",
      "Alerta com a data da ruptura e quanto vai faltar",
      "Cenários hipotéticos: simule uma compra parcelada sem lançar nada",
    ],
  },
  ledgers: {
    key: "ledgers",
    feature: "contratos_rateio",
    path: "/sistema/ledgers",
    productName: "Contratos de Rateio e Acertos de Viagem",
    navLabel: "Rateios e acertos",
    icon: Split,
    pitch: "Regras de divisão por pessoa e categoria, e um fechamento único por viagem: quem deve quanto para quem.",
    benefits: [
      "Contratos de rateio: “Pets 50/50”, “Mercado 60/40”",
      "Valor a compensar pré-preenchido no lançamento, sempre editável",
      "Acertos de viagem com um valor consolidado por pessoa",
      "PIX Copia e Cola e liquidação do lote em um clique",
    ],
  },
};

export const PREMIUM_MODULE_LIST: PremiumModule[] = [
  PREMIUM_MODULES.forecast,
  PREMIUM_MODULES.budgets,
  PREMIUM_MODULES.goals,
  PREMIUM_MODULES.ledgers,
  PREMIUM_MODULES.analytics,
];

/** Destino do upgrade. `change=1` impede o /pricing de devolver quem já tem plano para /sistema. */
export const UPGRADE_PATH = "/pricing?change=1";
