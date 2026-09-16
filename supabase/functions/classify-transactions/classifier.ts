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
}

export interface CategoryRow {
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
  private byKey = new Map<string, { name: string; type: Direction }>();

  constructor(rows: CategoryRow[] | null | undefined) {
    const source = rows && rows.length ? [...SYSTEM_CATEGORIES, ...rows] : SYSTEM_CATEGORIES;
    for (const row of source) {
      if (!row?.name) continue;
      const type: Direction = row.category_type === 'income' ? 'income' : 'expense';
      this.byKey.set(categoryKey(row.name), { name: row.name, type });
    }
  }

  /**
   * Categoria válida para o lançamento, ou null.
   * `adjusted` = despesa em crédito virou "Outras Receitas" (estorno).
   */
  resolve(name: string | null | undefined, direction: Direction): { name: string; adjusted: boolean } | null {
    if (!name) return null;
    const key = categoryKey(name);
    const found = this.byKey.get(key) ?? this.byKey.get(categoryKey(CATEGORY_ALIASES[key] ?? ''));
    if (!found) return null;
    if (found.type === direction) return { name: found.name, adjusted: false };
    if (direction === 'income') return { name: this.fallback('income'), adjusted: true };
    return null;
  }

  fallback(direction: Direction): string {
    const name = direction === 'income' ? CAT.OUTRAS_RECEITAS : CAT.OUTROS;
    return this.byKey.get(categoryKey(name))?.name ?? name;
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
  const { residual, primary } = applyContextRules(norm.text, direction);
  if (!primary) return '';
  const tokens = tokenize(residual);
  return tokens.some((t) => t.length >= 3) ? tokens.join(' ') : '';
}

export class LearnedPatterns {
  private bySignature = new Map<string, IndexedPattern>();
  private byResidual = new Map<string, IndexedPattern>();
  private byToken = new Map<string, IndexedPattern[]>();
  readonly size: number;

  constructor(rows: LearnedPatternRow[] | null | undefined) {
    let count = 0;
    for (const row of rows ?? []) {
      const source = row?.description || row?.normalized_description;
      if (!source || !row.category) continue;
      const baseConfidence = Math.min(Math.max(Number(row.confidence ?? 85) || 85, 50), 98);
      if (baseConfidence < 60) continue;

      const norm = normalizeDescription(source);
      if (!norm.signature) continue;
      const pattern: IndexedPattern = {
        row,
        tokens: new Set(norm.tokens),
        baseConfidence,
        usage: Math.max(Number(row.usage_count ?? 1) || 1, 1),
      };

      keepStronger(this.bySignature, norm.signature, pattern);
      for (const direction of ['income', 'expense'] as Direction[]) {
        const residual = residualSignature(norm, direction);
        if (residual) keepStronger(this.byResidual, `${direction}|${residual}`, pattern);
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

    const exact = this.bySignature.get(norm.signature);
    if (exact) {
      return { pattern: exact, confidence: Math.min(Math.max(exact.baseConfidence, 90) + Math.min(exact.usage, 5), 99), how: 'exact' };
    }

    const residual = residualSignature(norm, direction);
    const viaResidual = residual ? this.byResidual.get(`${direction}|${residual}`) : undefined;
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
        if (seen.has(candidate) || candidate.tokens.size < 2) continue;
        seen.add(candidate);
        let intersection = 0;
        for (const t of candidate.tokens) if (query.has(t)) intersection++;
        const score = intersection / (query.size + candidate.tokens.size - intersection);
        if (score >= 0.8 && (!best || score > best.score || (score === best.score && candidate.usage > best.pattern.usage))) {
          best = { pattern: candidate, score };
        }
      }
    }
    return best ? { pattern: best.pattern, confidence: Math.round(Math.min(best.pattern.baseConfidence, 90) * best.score), how: 'similar' } : null;
  }
}

function keepStronger(map: Map<string, IndexedPattern>, key: string, pattern: IndexedPattern) {
  const current = map.get(key);
  if (!current || pattern.usage > current.usage) map.set(key, pattern);
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
    const resolved = ctx.categories.resolve(learned.pattern.row.category, direction);
    if (resolved && !resolved.adjusted) {
      return {
        description: input.description,
        category: resolved.name,
        subcategory: learned.pattern.row.subcategory ?? undefined,
        confidence: learned.confidence,
        method: 'user_learned',
        features_used: [...base, `user_learned:${learned.how}`],
        learned_from_user: true,
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
      };
    }
  }

  // 3) canal + entidade -----------------------------------------------------
  const context = applyContextRules(norm.text, direction);
  const residualTokens = context.primary ? tokenize(context.residual) : norm.tokens;
  const features = [...base, ...context.ids.map((id) => `context:${id}`)];

  let entity: MerchantMatch | null = null;
  if (ctx.index && (residualTokens.length || norm.hints.length)) {
    entity = ctx.index.match(residualTokens, { hints: norm.hints, location: ctx.location });
  }

  if (entity) {
    const isTransfer = context.primary && TRANSFER_CONTEXTS.has(context.primary.id);
    // Em PIX/TED o resíduo costuma ser NOME DE PESSOA: exige evidência forte.
    // Uma única palavra casando dentro de um nome composto ("MARIA LUZ") é
    // quase sempre coincidência.
    const singleWordInName = entity.matched.split(' ').length === 1 && residualTokens.length >= 2;
    let required = isTransfer
      ? entity.method === 'keyword_analysis' || singleWordInName ? 88 : 75
      : ACCEPT_THRESHOLD;

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
      const key = `${direction}|${normalizeDescription(input.description ?? '').text}`;
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
