import type { ParsedTransaction } from './CSVParser';

export interface ClassificationInput {
  description: string;
  type: 'income' | 'expense';
  amount?: number;
  date?: string;
}

export interface ClassificationResult {
  description: string;
  category: string;
  category_id?: string;
  subcategory?: string;
  confidence: number;
  method: string;
  features_used: string[];
  needs_review: boolean;
  learned_from_user?: boolean;
}

export interface ReviewTransaction extends ParsedTransaction {
  subcategory?: string;
  confidence?: number;
  method?: string;
  features_used?: string[];
  needs_review?: boolean;
  reviewed?: boolean;
  learned_from_user?: boolean;
}

export interface ClassifierCategory {
  id: string;
  name: string;
  category_type: string;
  user_id: string | null;
  is_system: boolean | null;
}

export const fallbackCategoryName = (type: ClassificationInput['type']) =>
  type === 'income' ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)' : 'Outros';

export function fallbackClassification(input: ClassificationInput): ClassificationResult {
  return {
    description: input.description, category: fallbackCategoryName(input.type),
    confidence: 0, method: 'default_fallback', features_used: ['client_fallback'], needs_review: true,
  };
}

const normalizeName = (name: string) => name.trim().toLocaleLowerCase('pt-BR');

export function eligibleCategories(categories: ClassifierCategory[], type: ClassificationInput['type'], userId: string) {
  return categories.filter(c => c.category_type === type && (c.user_id === userId || (c.is_system === true && c.user_id === null)))
    .sort((a, b) => Number(b.user_id === userId) - Number(a.user_id === userId) || a.id.localeCompare(b.id));
}

export function mapClassification(input: ParsedTransaction, result: ClassificationResult, categories: ClassifierCategory[], userId: string): ReviewTransaction {
  const eligible = eligibleCategories(categories, input.type, userId);
  // An explicit invalid ID is not silently replaced with a same-name category.
  const selected = result.category_id
    ? eligible.find(c => c.id === result.category_id)
    : eligible.find(c => normalizeName(c.name) === normalizeName(result.category));
  const category = selected ?? eligible.find(c => normalizeName(c.name) === normalizeName(fallbackCategoryName(input.type)));
  return {
    ...input,
    category_id: category?.id,
    category_name: category?.name,
    subcategory: selected ? result.subcategory : undefined,
    confidence: selected ? result.confidence : 0,
    method: result.method,
    features_used: result.features_used,
    learned_from_user: selected ? result.learned_from_user : false,
    needs_review: !selected || result.needs_review || result.confidence < 70 || result.method === 'default_fallback',
    reviewed: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Positional Edge contract: reject ambiguous/truncated chunks instead of shifting rows. */
export function validateChunk(payload: unknown, inputs: ClassificationInput[]): ClassificationResult[] {
  if (!isRecord(payload) || !Array.isArray(payload.results) || payload.results.length !== inputs.length) {
    throw new Error('Quantidade de classificações incompatível com o lote.');
  }
  if (payload.results.some((r, i) => !isRecord(r) || r.description !== inputs[i].description.trim())) {
    throw new Error('Ordem das classificações incompatível com o lote.');
  }
  return payload.results.map((r: Record<string, unknown>, i) => {
    if (typeof r.category !== 'string' || !r.category.trim() || typeof r.confidence !== 'number' ||
        !Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 100 || typeof r.method !== 'string' ||
        (r.category_id !== undefined && (typeof r.category_id !== 'string' || !r.category_id)) ||
        (r.needs_review !== undefined && typeof r.needs_review !== 'boolean')) return fallbackClassification(inputs[i]);
    return {
      description: inputs[i].description, category: r.category, category_id: r.category_id as string | undefined,
      subcategory: typeof r.subcategory === 'string' ? r.subcategory : undefined,
      confidence: r.confidence, method: r.method,
      features_used: Array.isArray(r.features_used) ? r.features_used.filter((f): f is string => typeof f === 'string') : [],
      needs_review: r.needs_review === true || r.confidence < 70 || r.method === 'default_fallback',
      learned_from_user: r.learned_from_user === true,
    };
  });
}

export async function classifyChunks(inputs: ClassificationInput[], batchSize: number, invoke: (chunk: ClassificationInput[]) => Promise<unknown>) {
  const results: ClassificationResult[] = [];
  const failures: { start: number; count: number; message: string }[] = [];
  const size = Number.isFinite(batchSize) ? Math.max(1, Math.min(500, Math.floor(batchSize))) : 100;
  for (let start = 0; start < inputs.length; start += size * 3) {
    const chunks = Array.from({ length: Math.min(3, Math.ceil((inputs.length - start) / size)) }, (_, i) => inputs.slice(start + i * size, start + (i + 1) * size));
    const responses = await Promise.allSettled(chunks.map(async chunk => validateChunk(await invoke(chunk), chunk)));
    responses.forEach((response, i) => {
      if (response.status === 'fulfilled') results.push(...response.value);
      else {
        failures.push({ start: start + i * size, count: chunks[i].length, message: response.reason instanceof Error ? response.reason.message : 'Falha ao classificar lote.' });
        results.push(...chunks[i].map(fallbackClassification));
      }
    });
  }
  return { results, failures };
}

export function requiresReview(t: ReviewTransaction): boolean {
  return !t.reviewed && (t.needs_review === true || (t.confidence !== undefined && t.confidence < 70) || !t.category_id);
}

export function duplicateKey(t: Pick<ParsedTransaction, 'date' | 'value' | 'description' | 'type' | 'account_id' | 'credit_card_id'>): string {
  return JSON.stringify([t.date, Math.round((Math.abs(t.value) + Number.EPSILON) * 100), t.description.trim().toLowerCase().replace(/\s+/g, ' '), t.type, t.account_id || null, t.credit_card_id || null]);
}

export function partitionDuplicates<T extends Parameters<typeof duplicateKey>[0]>(items: T[], existingRows: Parameters<typeof duplicateKey>[0][], handled: Parameters<typeof duplicateKey>[0][] = []) {
  const counts = new Map<string, number>();
  existingRows.forEach(t => counts.set(duplicateKey(t), (counts.get(duplicateKey(t)) ?? 0) + 1));
  // On retry, an identical row saved in this session must not consume the failed row's slot.
  handled.forEach(t => counts.set(duplicateKey(t), Math.max(0, (counts.get(duplicateKey(t)) ?? 0) - 1)));
  const novas: T[] = [], duplicadas: T[] = [];
  items.forEach(t => {
    const key = duplicateKey(t), count = counts.get(key) ?? 0;
    if (count > 0) { counts.set(key, count - 1); duplicadas.push(t); }
    else novas.push(t);
  });
  return { novas, duplicadas };
}

export interface LearningCorrection {
  id: string;
  p_description: string;
  p_category: string;
  p_subcategory?: string;
  p_confidence: number;
}

/** Only changed, persisted categories are training examples; editing back is a no-op. */
export function prepareCorrections(items: ReviewTransaction[], originals: ReadonlyMap<string, ReviewTransaction>, savedIds: ReadonlySet<string>, categories: ClassifierCategory[], userId: string) {
  const corrections: LearningCorrection[] = [];
  const errors: string[] = [];
  for (const item of items) {
    const original = originals.get(item.id);
    if (!savedIds.has(item.id) || !original || !item.category_id || item.category_id === original.category_id) continue;
    const category = eligibleCategories(categories, item.type, userId).find(c => c.id === item.category_id);
    const description = item.description.trim();
    if (!category || description.length < 2 || description.length > 300 || category.name.length > 120 || /[\p{Cc}]/u.test(description + category.name)) {
      errors.push(`Não foi possível aprender a correção de "${description}": descrição ou categoria inválida.`);
      continue;
    }
    // A subcategory inferred for the old category is no longer applicable.
    const subcategory = item.subcategory?.trim();
    corrections.push({ id: item.id, p_description: description, p_category: category.name,
      p_subcategory: subcategory && subcategory !== original.subcategory && subcategory.length <= 120 && !/[\p{Cc}]/u.test(subcategory) ? subcategory : undefined,
      p_confidence: 95 });
  }
  // The existing RPC is keyed only by description, not type. Do not train contradictory examples.
  const groups = new Map<string, LearningCorrection[]>();
  for (const correction of corrections) {
    const key = correction.p_description.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), correction]);
  }
  const unique: LearningCorrection[] = [];
  for (const group of groups.values()) {
    if (new Set(group.map(c => JSON.stringify([c.p_category, c.p_subcategory]))).size > 1) {
      errors.push(`Aprendizado não enviado para "${group[0].p_description}": correções conflitantes para a mesma descrição.`);
    } else unique.push(group[0]);
  }
  return { corrections: unique, errors };
}
