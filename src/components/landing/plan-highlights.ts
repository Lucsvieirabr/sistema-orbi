import type { SubscriptionPlan } from "@/hooks/use-subscription";

export interface PlanLine {
  text: string;
  included: boolean;
}

export interface PlanHighlights {
  lead?: string;
  lines: PlanLine[];
}

const CAPACITY_KEYS = ["max_contas", "max_cartoes", "max_transacoes_mes", "max_categorias", "max_pessoas"] as const;

const numberFormat = new Intl.NumberFormat("pt-BR");

function plural(count: number, one: string, many: string) {
  return `${numberFormat.format(count)} ${count === 1 ? one : many}`;
}

function isFree(plan: SubscriptionPlan) {
  return Number(plan.price_monthly) === 0 && Number(plan.price_yearly) === 0;
}

function extendsPlan(plan: SubscriptionPlan, base: SubscriptionPlan) {
  const baseFeatures = Object.entries(base.features ?? {}).filter(([, enabled]) => enabled === true);
  return baseFeatures.length > 0 && baseFeatures.every(([key]) => plan.features?.[key] === true);
}

/** Módulos de planejamento — exclusivos Pro e Casal (migrations 20260915161252 e 20260916021503). */
const PLANNING_LINES: Array<{ key: string; text: string }> = [
  { key: "motor_preditivo", text: "Motor Preditivo: alerta do dia em que o caixa aperta" },
  { key: "motor_preditivo", text: "Cenários Hipotéticos para simular compras parceladas" },
  { key: "projetos_vida", text: "Projetos de Vida: casamento, reforma e viagem com orçamento próprio" },
  { key: "inflacao_pessoal", text: "Inflação Pessoal: quanto o seu custo de vida subiu" },
  { key: "contratos_rateio", text: "Contratos de Rateio com compensação automática" },
  { key: "contratos_rateio", text: "Acertos de Viagem com PIX Copia e Cola" },
  { key: "orcamentos", text: "Orçamentos Inteligentes por categoria" },
  { key: "metas", text: "Metas Financeiras com aportes e prazo" },
  { key: "dre_pessoal", text: "DRE Pessoal Avançado no fechamento do mês" },
];

function planningLines(plan: SubscriptionPlan): PlanLine[] {
  return PLANNING_LINES.map((line) => ({ text: line.text, included: plan.features?.[line.key] === true }));
}

function familyLines(plan: SubscriptionPlan): PlanLine[] {
  const members = Number(plan.limits?.max_membros_familia ?? 0);
  if (plan.features?.familia_compartilhada !== true) return [];

  // No Casal, os módulos de planejamento também valem na visão a dois.
  const planning = PLANNING_LINES.every((line) => plan.features?.[line.key] === true)
    ? [
        { text: "Motor Preditivo e Cenários Hipotéticos com o saldo do casal", included: true },
        { text: "Projetos de Vida a dois, do casamento ao enxoval", included: true },
        { text: "Contratos de Rateio e Acertos de Viagem entre vocês", included: true },
        { text: "Orçamentos Inteligentes, Metas Financeiras e DRE Pessoal Avançado na visão Casal", included: true },
      ]
    : [];

  return [
    { text: `${members + 1} acessos com uma única assinatura`, included: true },
    { text: "Alternância entre visão Pessoal e Casal", included: true },
    { text: "Contas, cartões e lançamentos compartilhados", included: true },
    ...planning,
  ];
}

export function buildPlanHighlights(plan: SubscriptionPlan, all: SubscriptionPlan[]): PlanHighlights {
  const limits = plan.limits ?? {};
  const features = plan.features ?? {};

  const base = [...all]
    .filter((candidate) => candidate.slug !== plan.slug)
    .filter((candidate) => candidate.display_order < plan.display_order && !isFree(candidate))
    .sort((a, b) => b.display_order - a.display_order)[0];

  if (base && extendsPlan(plan, base)) {
    const extra = familyLines(plan);
    if (extra.length > 0) {
      return { lead: `Tudo do ${base.name}, e mais:`, lines: extra };
    }
  }

  const lines: PlanLine[] = [];
  const unlimited = CAPACITY_KEYS.every((key) => Number(limits[key]) === -1);

  if (unlimited) {
    lines.push({ text: "Contas, cartões e lançamentos ilimitados", included: true });
  } else {
    const contas = Number(limits.max_contas ?? 0);
    const cartoes = Number(limits.max_cartoes ?? 0);
    const transacoes = Number(limits.max_transacoes_mes ?? 0);
    const categorias = Number(limits.max_categorias ?? 0);
    const pessoas = Number(limits.max_pessoas ?? 0);

    lines.push({
      text: `${contas === -1 ? "Contas ilimitadas" : plural(contas, "conta", "contas")} e ${
        cartoes === -1 ? "cartões ilimitados" : plural(cartoes, "cartão", "cartões")
      }`,
      included: true,
    });
    lines.push({
      text: transacoes === -1 ? "Lançamentos ilimitados" : `${plural(transacoes, "lançamento", "lançamentos")} por mês`,
      included: true,
    });
    lines.push({
      text: `${categorias === -1 ? "Categorias ilimitadas" : plural(categorias, "categoria", "categorias")} e ${
        pessoas === -1 ? "pessoas ilimitadas" : plural(pessoas, "pessoa", "pessoas")
      }`,
      included: true,
    });
  }

  if (features.extrato) {
    lines.push({
      text: features.cartoes_faturas ? "Extrato mensal e faturas de cartão" : "Extrato mensal",
      included: true,
    });
  }

  lines.push({ text: "IA classificadora de extratos", included: features.ia_classificador === true });
  lines.push({ text: "Importação de extratos bancários", included: features.transacoes_importar_csv === true });

  if (features.ia_classificacao_automatica) {
    lines.push({ text: "Aprende com cada correção sua", included: true });
  }

  if (features.dashboard) {
    lines.push({
      text: features.dashboard_assinaturas ? "Dashboard e painel de assinaturas" : "Dashboard completo",
      included: true,
    });
  }

  lines.push(...planningLines(plan));

  const retention = Number(limits.retencao_dados_meses);
  if (retention === -1) {
    lines.push({ text: "Histórico sem prazo de expiração", included: true });
  } else if (retention > 0) {
    lines.push({ text: `Histórico dos últimos ${retention} meses`, included: true });
  }

  lines.push(...familyLines(plan));

  return {
    lines: [...lines.filter((line) => line.included), ...lines.filter((line) => !line.included)],
  };
}

export const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: "",
    name: "Free",
    slug: "basic",
    description: "Gestão financeira essencial: lançamento manual, extrato mensal e saldo das contas.",
    price_monthly: 0,
    price_yearly: 0,
    is_active: true,
    is_featured: false,
    display_order: 0,
    features: {
      extrato: true,
      cartoes_faturas: true,
      ia_classificador: false,
      transacoes_importar_csv: false,
      ia_classificacao_automatica: false,
      dashboard: false,
      dashboard_assinaturas: false,
      orcamentos: false,
      metas: false,
      dre_pessoal: false,
      motor_preditivo: false,
      contratos_rateio: false,
      projetos_vida: false,
      inflacao_pessoal: false,
      familia_compartilhada: false,
    },
    limits: {
      max_contas: 1,
      max_cartoes: 1,
      max_transacoes_mes: 100,
      max_pessoas: 2,
      max_categorias: 10,
      max_membros_familia: 0,
      retencao_dados_meses: 6,
    },
  },
  {
    id: "",
    name: "Pro",
    slug: "pro",
    description:
      "Automatização e planejamento: IA classificadora, importação de extrato, Motor Preditivo, Projetos de Vida, Inflação Pessoal, orçamentos, metas e rateios.",
    price_monthly: 10.99,
    price_yearly: 109.99,
    is_active: true,
    is_featured: true,
    display_order: 1,
    features: {
      extrato: true,
      cartoes_faturas: true,
      ia_classificador: true,
      transacoes_importar_csv: true,
      ia_classificacao_automatica: true,
      dashboard: true,
      dashboard_assinaturas: true,
      orcamentos: true,
      metas: true,
      dre_pessoal: true,
      motor_preditivo: true,
      contratos_rateio: true,
      projetos_vida: true,
      inflacao_pessoal: true,
      familia_compartilhada: false,
    },
    limits: {
      max_contas: -1,
      max_cartoes: -1,
      max_transacoes_mes: -1,
      max_pessoas: -1,
      max_categorias: -1,
      max_membros_familia: 0,
      retencao_dados_meses: -1,
    },
  },
  {
    id: "",
    name: "Casal",
    slug: "casal",
    description:
      "Tudo do Pro e mais um acesso: Projetos de Vida, Inflação Pessoal e todo o planejamento a dois, com uma única assinatura.",
    price_monthly: 16.99,
    price_yearly: 169.99,
    is_active: true,
    is_featured: false,
    display_order: 2,
    features: {
      extrato: true,
      cartoes_faturas: true,
      ia_classificador: true,
      transacoes_importar_csv: true,
      ia_classificacao_automatica: true,
      dashboard: true,
      dashboard_assinaturas: true,
      orcamentos: true,
      metas: true,
      dre_pessoal: true,
      motor_preditivo: true,
      contratos_rateio: true,
      projetos_vida: true,
      inflacao_pessoal: true,
      familia_compartilhada: true,
    },
    limits: {
      max_contas: -1,
      max_cartoes: -1,
      max_transacoes_mes: -1,
      max_pessoas: -1,
      max_categorias: -1,
      max_membros_familia: 1,
      retencao_dados_meses: -1,
    },
  },
];
