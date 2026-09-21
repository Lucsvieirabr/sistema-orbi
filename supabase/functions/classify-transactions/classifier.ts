/**
 * ORQUESTRADOR DO CLASSIFICADOR v2 (módulo puro, sem I/O)
 *
 * Pipeline por transação — cada camada só roda se a anterior não decidiu:
 *
 *   0. Normalização      acento, gateway (IFD*, PAG*), datas/parcelas/códigos
 *   1. Aprendido         o que o PRÓPRIO usuário corrigiu (assinatura exata →
 *                        resíduo sem canal → similaridade de conjunto ≥ 0.8)
 *   2. Regra terminal    siglas bancárias com direção (TAR, IOF, CRED SAL, APLIC CDB…)
 *   3. Canal + entidade  remove o canal (PIX/TED/boleto/compra no cartão) e busca
 *                        a entidade no resto, no índice em memória do dicionário
 *   4. Default do canal  PIX/TED sem entidade → Transferências
 *   5. Fallback seguro   dúvida (< ACCEPT_THRESHOLD) = "Outros" / "Outras Receitas"
 *                        com subcategoria "A Classificar". Nunca lança, nunca
 *                        descarta a linha.
 *
 * Toda categoria devolvida passa pelo CategoryResolver: existe para o usuário
 * (sistema ou própria) e tem o MESMO tipo do lançamento. Categoria de despesa
 * em crédito vira receita de estorno; categoria de receita em débito é
 * descartada. Antes o front recebia nomes que não existiam ("Educação",
 * "Compras") e jogava tudo em "Outros" em silêncio.
 */

import { foldAccents, normalizeDescription, tokenize, type NormalizedDescription } from './description-cleaner.ts';
import { applyContextRules, CAT, findTerminalRule, type Direction } from './banking-rules.ts';
import type { MerchantIndex, MerchantMatch } from './merchant-index.ts';

export const ACCEPT_THRESHOLD = 60;
export const UNCLASSIFIED_SUBCATEGORY = 'A Classificar';

export interface ClassifierInput {
  description: string;
  type: Direction;
  amount?: number;
  date?: string;
}

export interface ClassificationResult {
  description: string;
  category: string;
  subcategory?: string;
  confidence: number;
  method: string;
  features_used: string[];
  learned_from_user?: boolean;
  category_id?: string;
  needs_review: boolean;
}

export interface CategoryRow {
  id?: string;
  is_system?: boolean;
  name: string;
  category_type: string;
}

export interface LearnedPatternRow {
  description: string | null;
  normalized_description: string | null;
  category: string;
  subcategory: string | null;
  confidence: number | string | null;
  usage_count: number | null;
  last_used_at?: string | null;
  is_active?: boolean | null;
  metadata?: { transaction_type?: string; category_id?: string } | null;
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

/** Categorias de sistema (seed global) — usadas se a leitura falhar. */
const SYSTEM_CATEGORIES: CategoryRow[] = [
  ...[
    'Alimentação', 'Assinaturas', 'Bem Estar / Beleza', 'Casa', 'Despesas Pessoais',
    'Diarista / Prestadores Serv.', 'Empréstimos / Financiamentos', 'Estudos',
    'Férias / Viagens', 'Filhos / Dependentes', 'Gastos com PJ / Profissionais Autônomos',
    'Investimentos (pelo menos 20% da receita)', 'Lazer', 'Outros', 'Pet',
    'Presentes / Compras', 'Proteção Pessoal / Saúde / Farmácia', 'Refeição',
    'Roupas e acessórios', 'Tarifas Bancárias / Juros / Impostos / Taxas', 'Transporte',
  ].map((name) => ({ name, category_type: 'expense' })),
  ...[
    'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'Participação de Lucros / Comissões',
    'Pró Labore', 'Renda de Investimentos', 'Salário / 13° Salário / Férias',
  ].map((name) => ({ name, category_type: 'income' })),
];

/** Nomes legados do dicionário/ML que não existem como categoria. */
const CATEGORY_ALIASES: Record<string, string> = {
  educacao: 'Estudos',
  compras: 'Presentes / Compras',
  moradia: 'Casa',
  saude: 'Proteção Pessoal / Saúde / Farmácia',
  farmacia: 'Proteção Pessoal / Saúde / Farmácia',
  beleza: 'Bem Estar / Beleza',
  vestuario: 'Roupas e acessórios',
  viagens: 'Férias / Viagens',
  tarifas: CAT.TARIFAS,
  impostos: CAT.TARIFAS,
  salario: CAT.SALARIO,
  investimentos: CAT.INVESTIMENTOS,
};

const categoryKey = (name: string) => foldAccents(name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export class CategoryResolver {
  private byKey = new Map<string, { id?: string; name: string; type: Direction; isSystem: boolean }>();
  private byId = new Map<string, CategoryRow>();

  constructor(rows: CategoryRow[] | null | undefined) {
    // An explicit empty catalog means unavailable: do not invent destinations.
    const source = rows ?? SYSTEM_CATEGORIES;
    for (const row of source) {
      if (!row?.name || (row.category_type !== 'income' && row.category_type !== 'expense')) continue;
      const type = row.category_type;
      if (row.id) this.byId.set(row.id, row);
      const key = `${type}|${categoryKey(row.name)}`;
      const current = this.byKey.get(key);
      // Same name can exist in both directions and in system/custom catalogs.
      // Prefer the user's category deterministically, irrespective of row order.
      if (current && ((!current.isSystem && row.is_system) ||
        (current.isSystem === !!row.is_system && (current.id ?? '') < (row.id ?? '')))) continue;
      this.byKey.set(key, { id: row.id, name: row.name, type, isSystem: !!row.is_system });
    }
  }

  /**
   * Categoria válida para o lançamento, ou null.
   * `adjusted` = despesa em crédito virou "Outras Receitas" (estorno).
   */
  resolve(name: string | null | undefined, direction: Direction): { id?: string; name: string; adjusted: boolean } | null {
    if (!name) return null;
    const key = categoryKey(name);
    const find = (type: Direction) => this.byKey.get(`${type}|${key}`) ??
      this.byKey.get(`${type}|${categoryKey(CATEGORY_ALIASES[key] ?? '')}`);
    const found = find(direction);
    if (found) return { id: found.id, name: found.name, adjusted: false };
    const opposite = find(direction === 'income' ? 'expense' : 'income');
    if (opposite && direction === 'income') return { name: this.fallback('income'), adjusted: true };
    return null;
  }

  fallback(direction: Direction): string {
    const name = direction === 'income' ? CAT.OUTRAS_RECEITAS : CAT.OUTROS;
    return this.byKey.get(`${direction}|${categoryKey(name)}`)?.name ?? name;
  }

  resolveLearned(row: LearnedPatternRow, direction: Direction) {
    if (row.metadata?.category_id) {
      const category = this.byId.get(row.metadata.category_id);
      return category?.category_type === direction
        ? { id: category.id, name: category.name, adjusted: false } : null;
    }
    return this.resolve(row.category, direction);
  }
}

// ---------------------------------------------------------------------------
// Padrões aprendidos do usuário
// ---------------------------------------------------------------------------

interface IndexedPattern {
  row: LearnedPatternRow;
  tokens: Set<string>;
  baseConfidence: number;
  usage: number;
}

function residualSignature(norm: NormalizedDescription, direction: Direction): string {
  const { residual } = applyContextRules(norm.text, direction);
  const tokens = tokenize(residual);
  return tokens.some((t) => t.length >= 3) ? tokens.join(' ') : '';
}

export class LearnedPatterns {
  private bySignature = new Map<string, IndexedPattern[]>();
  private byResidual = new Map<string, IndexedPattern[]>();
  private byToken = new Map<string, IndexedPattern[]>();
  readonly size: number;

  constructor(rows: LearnedPatternRow[] | null | undefined, private categories = new CategoryResolver(undefined)) {
    let count = 0;
    for (const row of rows ?? []) {
      const source = row?.description || row?.normalized_description;
      if (!source || !row.category || row.is_active === false) continue;
      const rawConfidence = Number(row.confidence ?? 85);
      const baseConfidence = Number.isFinite(rawConfidence) ? Math.min(Math.max(rawConfidence, 0), 98) : 0;
      if (baseConfidence < 60) continue;

      const norm = normalizeDescription(source);
      if (!norm.signature) continue;
      const pattern: IndexedPattern = {
        row,
        tokens: new Set(norm.tokens),
        baseConfidence,
        usage: Math.max(Number(row.usage_count ?? 1) || 1, 1),
      };

      appendPattern(this.bySignature, norm.signature, pattern);
      for (const direction of ['income', 'expense'] as Direction[]) {
        const residual = residualSignature(norm, direction);
        if (residual) appendPattern(this.byResidual, `${direction}|${residual}`, pattern);
        if (norm.signature) appendPattern(this.byResidual, `${direction}|${norm.signature}`, pattern);
      }
      for (const token of pattern.tokens) {
        if (token.length < 3) continue;
        const list = this.byToken.get(token);
        if (list) list.push(pattern);
        else this.byToken.set(token, [pattern]);
      }
      count++;
    }
    this.size = count;
  }

  lookup(norm: NormalizedDescription, direction: Direction): { pattern: IndexedPattern; confidence: number; how: string } | null {
    if (this.size === 0 || !norm.signature) return null;

    const compatible = (pattern: IndexedPattern) => {
      if (pattern.row.metadata?.transaction_type && pattern.row.metadata.transaction_type !== direction) return false;
      const resolved = this.categories.resolveLearned(pattern.row, direction);
      return resolved && !resolved.adjusted;
    };
    const choose = (patterns: IndexedPattern[] | undefined) =>
      choosePattern((patterns ?? []).filter(compatible));
    const exact = choose(this.bySignature.get(norm.signature));
    if (exact) {
      return { pattern: exact, confidence: Math.min(Math.max(exact.baseConfidence, 90) + Math.min(exact.usage, 5), 99), how: 'exact' };
    }

    const residual = residualSignature(norm, direction);
    const viaResidual = residual ? choose(this.byResidual.get(`${direction}|${residual}`)) : undefined;
    if (viaResidual) {
      return { pattern: viaResidual, confidence: Math.min(Math.max(viaResidual.baseConfidence, 88) + Math.min(viaResidual.usage, 4), 95), how: 'residual' };
    }

    // Similaridade de conjunto (Jaccard) — só entre descrições com ≥ 2 tokens,
    // para "UBER TRIP HELP" não herdar de "UBER".
    if (norm.tokens.length < 2) return null;
    const query = new Set(norm.tokens);
    const seen = new Set<IndexedPattern>();
    let best: { pattern: IndexedPattern; score: number } | null = null;
    for (const token of query) {
      for (const candidate of this.byToken.get(token) ?? []) {
        if (seen.has(candidate) || candidate.tokens.size < 2 || !compatible(candidate)) continue;
        seen.add(candidate);
        let intersection = 0;
        for (const t of candidate.tokens) if (query.has(t)) intersection++;
        const score = intersection / (query.size + candidate.tokens.size - intersection);
        if (score >= 0.8 && (!best || score > best.score || (score === best.score && candidate.usage > best.pattern.usage))) {
          best = { pattern: candidate, score };
        }
      }
    }
    if (!best) return null;
    // Do not guess between equally similar examples with different labels.
    for (const candidate of seen) {
      if (candidate.row.category === best.pattern.row.category) continue;
      let intersection = 0;
      for (const token of candidate.tokens) if (query.has(token)) intersection++;
      if (intersection / (query.size + candidate.tokens.size - intersection) >= best.score - 0.03) return null;
    }
    return { pattern: best.pattern, confidence: Math.round(Math.min(best.pattern.baseConfidence, 90) * best.score), how: 'similar' };
  }
}

function appendPattern(map: Map<string, IndexedPattern[]>, key: string, pattern: IndexedPattern) {
  const current = map.get(key) ?? [];
  if (!current.includes(pattern)) current.push(pattern);
  map.set(key, current);
}

function choosePattern(patterns: IndexedPattern[]): IndexedPattern | null {
  const updated = (pattern: IndexedPattern) => Date.parse(pattern.row.last_used_at ?? '') || 0;
  const ranked = [...patterns].sort((a, b) => updated(b) - updated(a) || b.usage - a.usage);
  if (!ranked.length) return null;
  // Recent explicit corrections supersede old high-frequency rules. With no
  // recency evidence, conflicting labels must be reviewed rather than guessed.
  if (ranked.some(p => p.row.category !== ranked[0].row.category && updated(p) === updated(ranked[0]))) return null;
  return ranked[0];
}

// ---------------------------------------------------------------------------
// Classificação
// ---------------------------------------------------------------------------

export interface ClassifierContext {
  index: MerchantIndex | null;
  learned: LearnedPatterns;
  categories: CategoryResolver;
  location?: string;
}

const TRANSFER_CONTEXTS = new Set(['pix_enviado', 'pix_recebido', 'ted_doc', 'transferencia_propria']);

export function fallbackResult(input: ClassifierInput, categories: CategoryResolver | null, features: string[] = [], confidence = 40): ClassificationResult {
  const direction: Direction = input.type === 'income' ? 'income' : 'expense';
  return {
    description: input.description,
    category: categories ? categories.fallback(direction) : direction === 'income' ? CAT.OUTRAS_RECEITAS : CAT.OUTROS,
    subcategory: UNCLASSIFIED_SUBCATEGORY,
    confidence: Math.min(Math.max(Math.round(confidence), 0), ACCEPT_THRESHOLD - 1),
    method: 'default_fallback',
    features_used: ['safe_fallback', ...features],
    learned_from_user: false,
    category_id: categories?.resolve(categories.fallback(direction), direction)?.id,
    needs_review: true,
  };
}

export function classifyTransaction(input: ClassifierInput, ctx: ClassifierContext): ClassificationResult {
  const direction: Direction = input.type === 'income' ? 'income' : 'expense';
  const norm = normalizeDescription(input.description ?? '');
  const base: string[] = [];
  if (norm.gateways.length) base.push(`gateway:${norm.gateways.join('+')}`);
  if (norm.hints.length) base.push(`hint:${norm.hints.join('+')}`);

  if (!norm.text) return fallbackResult(input, ctx.categories, [...base, 'empty_description'], 20);

  // 1) aprendido do usuário -------------------------------------------------
  const learned = ctx.learned.lookup(norm, direction);
  if (learned && learned.confidence >= ACCEPT_THRESHOLD) {
    const resolved = ctx.categories.resolveLearned(learned.pattern.row, direction);
    if (resolved && !resolved.adjusted) {
      return {
        description: input.description,
        category: resolved.name,
        subcategory: learned.pattern.row.subcategory ?? undefined,
        confidence: learned.confidence,
        method: 'user_learned',
        features_used: [...base, `user_learned:${learned.how}`],
        learned_from_user: true,
        category_id: resolved.id,
        needs_review: learned.confidence < 80,
      };
    }
  }

  // 2) regra bancária terminal ----------------------------------------------
  const terminal = findTerminalRule(norm.text, direction);
  if (terminal) {
    const resolved = ctx.categories.resolve(terminal.category, direction);
    if (resolved) {
      return {
        description: input.description,
        category: resolved.name,
        subcategory: terminal.subcategory,
        confidence: terminal.confidence,
        method: 'banking_pattern',
        features_used: [...base, `banking_rule:${terminal.id}`],
        learned_from_user: false,
        category_id: resolved.id,
        needs_review: resolved.adjusted || terminal.confidence < 80,
      };
    }
  }

  // 3) canal + entidade -----------------------------------------------------
  const context = applyContextRules(norm.text, direction);
  if (/\b99\s*pay\b/.test(context.residual)) {
    return fallbackResult(input, ctx.categories, [...base, 'payment_intermediary']);
  }
  const residualTokens = context.primary ? tokenize(context.residual) : norm.tokens;
  const features = [...base, ...context.ids.map((id) => `context:${id}`)];

  let entity: MerchantMatch | null = null;
  if (ctx.index && (residualTokens.length || norm.hints.length)) {
    entity = ctx.index.match(residualTokens, {
      hints: norm.hints, location: ctx.location,
      acceptsCategory: name => {
        const resolved = ctx.categories.resolve(name, direction);
        // A merchant in an incoming PIX is not proof of a refund or salary.
        return !!resolved && !resolved.adjusted;
      },
    });
  }

  if (entity) {
    const isTransfer = context.primary && TRANSFER_CONTEXTS.has(context.primary.id);
    // Em PIX/TED o resíduo costuma ser NOME DE PESSOA: exige evidência forte.
    // Uma única palavra casando dentro de um nome composto ("MARIA LUZ") é
    // quase sempre coincidência.
    const singleWordInName = entity.matched.split(' ').length === 1 && residualTokens.length >= 2;
    const commercial = /\b(restaurantes?|supermercados?|hipermercados?|atacadista|drogaria|farmacia|lanchonete|pizzaria|padaria|acougue|pet\s*shop|clinica|hospital|posto\s+(de\s+)?(combustivel|gasolina)|auto\s+posto)\b/.test(context.residual);
    const personalName = /^(maria|joao|jose|ana|antonio|francisco|carlos|paulo|pedro|lucas|luiz|luis|marcos|julia|juliana|fernanda|rafael|rodrigo|gabriel|bruno)\b/.test(context.residual);
    let required = isTransfer
      ? commercial ? 65 : singleWordInName ? 88 : 75
      : ACCEPT_THRESHOLD;
    if (isTransfer && personalName && singleWordInName && !commercial) required = 101;
    if (isTransfer && singleWordInName && !commercial && residualTokens[0] !== entity.matched) required = 101;

    const resolved = ctx.categories.resolve(entity.category, direction);
    // Despesa em crédito só vira estorno com entidade inequívoca.
    if (resolved?.adjusted) required = Math.max(required, 85);
    if (resolved && entity.confidence >= required) {
      const confidence = resolved.adjusted ? Math.round(entity.confidence * 0.85) : entity.confidence;
      if (confidence >= ACCEPT_THRESHOLD) {
        return {
          description: input.description,
          category: resolved.name,
          subcategory: resolved.adjusted ? 'Reembolsos / Estornos / Vendas' : entity.subcategory ?? undefined,
          confidence,
          method: entity.method,
          features_used: [...features, `entity:${entity.entryKey}`, `matched:${entity.matched}`],
          learned_from_user: false,
          category_id: resolved.id,
          needs_review: confidence < 80,
        };
      }
    }
    features.push(`weak_entity:${entity.entryKey}:${entity.confidence}`);
  }

  // 4) default do canal -----------------------------------------------------
  if (context.primary && context.primary.confidence >= ACCEPT_THRESHOLD) {
    const resolved = ctx.categories.resolve(context.primary.category, direction);
    if (resolved) {
      return {
        description: input.description,
        category: resolved.name,
        subcategory: context.primary.subcategory,
        confidence: resolved.adjusted ? context.primary.confidence - 3 : context.primary.confidence,
        method: 'banking_pattern',
        features_used: [...features, `channel_default:${context.primary.id}`],
        learned_from_user: false,
        category_id: resolved.id,
        needs_review: true,
      };
    }
  }

  // 5) fallback seguro ------------------------------------------------------
  return fallbackResult(input, ctx.categories, [...features, 'no_confident_match'], context.primary?.confidence ?? entity?.confidence ?? 40);
}

/**
 * Classifica um lote com memoização: extratos repetem muito a mesma descrição
 * (assinaturas, apps de transporte). Um erro em uma linha vira fallback DAQUELA
 * linha — o lote nunca falha por causa de um item.
 */
export function classifyBatch(inputs: ClassifierInput[], ctx: ClassifierContext): ClassificationResult[] {
  const memo = new Map<string, ClassificationResult>();
  return inputs.map((input) => {
    try {
      const direction = input.type === 'income' ? 'income' : 'expense';
      const norm = normalizeDescription(input.description ?? '');
      const key = JSON.stringify([direction, norm.text, norm.hints, norm.gateways]);
      const cached = memo.get(key);
      if (cached) return { ...cached, description: input.description, features_used: [...cached.features_used] };
      const result = classifyTransaction(input, ctx);
      memo.set(key, result);
      return result;
    } catch (_error) {
      return fallbackResult(input, ctx.categories, ['classifier_error']);
    }
  });
}
