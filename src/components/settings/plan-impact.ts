import type { SubscriptionPlan } from "@/hooks/use-subscription";

/**
 * O que muda na conta quando o plano pago termina.
 *
 * Compara o plano vigente (features/limits vindos da RPC de status) com o
 * plano gratuito ativo em `subscription_plans` — é para onde o usuário vai
 * quando o período pago acaba. Só entram linhas que PIORAM: o modal de
 * cancelamento mostra perda concreta, não uma tabela comparativa inteira.
 */

export interface ImpactRow {
  key: string;
  kind: "feature" | "limit";
  label: string;
  /** Frase com artigo para compor texto corrido ("a IA classificadora"). */
  phrase: string;
  now: string;
  after: string;
  /** Uso atual acima do teto futuro (só limites contáveis). */
  usage?: number;
  overLimit: boolean;
}

export interface CancellationImpact {
  rows: ImpactRow[];
  fallbackPlan: SubscriptionPlan | null;
}

const FEATURES: Array<{ key: string; label: string; phrase: string }> = [
  { key: "ia_classificador", label: "IA classificadora de extratos", phrase: "a IA classificadora" },
  { key: "transacoes_importar_csv", label: "Importação de extratos", phrase: "a importação de extratos" },
  { key: "ia_classificacao_automatica", label: "Aprendizado com suas correções", phrase: "o aprendizado automático" },
  { key: "dashboard", label: "Dashboard", phrase: "o dashboard" },
  { key: "dashboard_assinaturas", label: "Painel de assinaturas", phrase: "o painel de assinaturas" },
  { key: "orcamentos", label: "Orçamentos Inteligentes", phrase: "os orçamentos por categoria" },
  { key: "metas", label: "Metas Financeiras", phrase: "as metas e seus aportes" },
  { key: "dre_pessoal", label: "DRE Pessoal Avançado", phrase: "o fechamento do mês" },
  { key: "familia_compartilhada", label: "Acesso do parceiro", phrase: "o acesso do seu parceiro" },
  { key: "cartoes_faturas", label: "Faturas de cartão", phrase: "as faturas de cartão" },
];

const LIMITS: Array<{ key: string; label: string; countable: boolean }> = [
  { key: "max_contas", label: "Contas", countable: true },
  { key: "max_cartoes", label: "Cartões", countable: true },
  { key: "max_transacoes_mes", label: "Lançamentos por mês", countable: true },
  { key: "max_categorias", label: "Categorias próprias", countable: true },
  { key: "max_pessoas", label: "Pessoas", countable: true },
  { key: "retencao_dados_meses", label: "Histórico", countable: false },
];

const numberFormat = new Intl.NumberFormat("pt-BR");

/** -1 = ilimitado; ausente = sem teto conhecido (trata como ilimitado para comparação). */
const rank = (value: number | undefined) =>
  value === undefined || value === null || Number(value) === -1 ? Number.POSITIVE_INFINITY : Number(value);

function formatLimit(key: string, value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  if (Number(value) === -1) return key === "retencao_dados_meses" ? "Sem prazo" : "Ilimitado";
  if (key === "retencao_dados_meses") return `${numberFormat.format(value)} ${value === 1 ? "mês" : "meses"}`;
  return numberFormat.format(value);
}

export function findFallbackPlan(plans: SubscriptionPlan[] | undefined): SubscriptionPlan | null {
  return (
    [...(plans ?? [])]
      .filter((plan) => plan.is_active && Number(plan.price_monthly) === 0 && Number(plan.price_yearly) === 0)
      .sort((a, b) => a.display_order - b.display_order)[0] ?? null
  );
}

export function buildCancellationImpact(
  current: { features?: Record<string, boolean>; limits?: Record<string, number> },
  plans: SubscriptionPlan[] | undefined,
  usage: Record<string, number | undefined> = {},
): CancellationImpact {
  const fallbackPlan = findFallbackPlan(plans);
  const features = current.features ?? {};
  const limits = current.limits ?? {};
  const rows: ImpactRow[] = [];

  for (const feature of FEATURES) {
    if (features[feature.key] !== true) continue;
    if (fallbackPlan?.features?.[feature.key] === true) continue;
    rows.push({
      key: feature.key,
      kind: "feature",
      label: feature.label,
      phrase: feature.phrase,
      now: "Incluído",
      after: fallbackPlan ? "Não incluído" : "Sem acesso",
      overLimit: false,
    });
  }

  for (const limit of LIMITS) {
    const nowValue = limits[limit.key];
    const afterValue = fallbackPlan ? fallbackPlan.limits?.[limit.key] : 0;
    if (!(rank(afterValue) < rank(nowValue))) continue;

    const used = limit.countable ? usage[limit.key] : undefined;
    const overLimit =
      fallbackPlan !== null && used !== undefined && rank(afterValue) !== Number.POSITIVE_INFINITY && used > Number(afterValue);

    rows.push({
      key: limit.key,
      kind: "limit",
      label: limit.label,
      phrase: limit.label.toLowerCase(),
      now: formatLimit(limit.key, nowValue),
      after: fallbackPlan ? formatLimit(limit.key, afterValue) : "Sem acesso",
      usage: used,
      overLimit,
    });
  }

  return { rows, fallbackPlan };
}

/** "a IA classificadora, a importação de extratos e os limites do plano Pro". */
export function summarizeLoss(rows: ImpactRow[], planName: string): string {
  const parts = rows
    .filter((row) => row.kind === "feature")
    .slice(0, 2)
    .map((row) => row.phrase);

  if (rows.some((row) => row.kind === "limit")) parts.push(`os limites do plano ${planName}`);
  if (parts.length === 0) return `os benefícios do plano ${planName}`;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

/** Datas: timestamptz (com "T") ou `YYYY-MM-DD` sem cair no bug de fuso. */
export function parseBackendDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatShortDate(value?: string | null): string | null {
  return parseBackendDate(value)?.toLocaleDateString("pt-BR") ?? null;
}

export function formatLongDate(value?: string | null): string | null {
  return (
    parseBackendDate(value)?.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) ?? null
  );
}
