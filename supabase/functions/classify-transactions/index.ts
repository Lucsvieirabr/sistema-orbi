import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { preflight, jsonFor } from '../_shared/cors.ts';
import { userClient } from '../_shared/auth.ts';
import { gateUser, gateFailure } from '../_shared/gate.ts';
import { parseJson, stripControl, z } from '../_shared/validation.ts';
import { MerchantIndex, type DictionaryRow } from './merchant-index.ts';
import {
  CategoryResolver,
  LearnedPatterns,
  classifyBatch,
  fallbackResult,
  type CategoryRow,
  type ClassificationResult,
  type LearnedPatternRow,
} from './classifier.ts';

// ============================================================================
// classify-transactions — classificador v2
// ============================================================================
// Gargalo da v1: para CADA transação, 1 RPC `search_merchant` (varredura com
// similarity/LIKE em todo o dicionário) + 1 RPC `search_by_keywords` POR
// PALAVRA + 1 RPC extra para variante camelCase. Um extrato de 300 linhas
// gerava ~1.500 round-trips. E a camada de keywords nunca casava: a RPC não
// devolve `match_score`, então `match.match_score >= 0.7` era sempre falso.
//
// v2: 3 leituras por requisição (dicionário em cache por isolate, padrões do
// usuário, categorias do usuário) e toda a classificação em memória —
// normalização → aprendido → regras bancárias BR → canal + entidade (n-grama
// exato/compacto/fuzzy) → fallback seguro. Detalhes em classifier.ts.
// ============================================================================

const MAX_TRANSACTIONS = 500;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_LEARNED_PATTERNS = 2000;
const DICTIONARY_TTL_MS = 15 * 60 * 1000;
const DICTIONARY_PAGE = 1000;
const DICTIONARY_MAX_PAGES = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DICTIONARY_COLUMNS =
  'id, merchant_key, entity_name, category, subcategory, entry_type, aliases, keywords, priority, confidence_modifier, state_specific, states';

const transactionInputSchema = z.object({
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH * 8)
    .transform((v) => stripControl(v).slice(0, MAX_DESCRIPTION_LENGTH)),
  type: z.unknown().transform((v): 'income' | 'expense' => (v === 'income' ? 'income' : 'expense')),
  amount: z.unknown().transform((v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)),
  date: z.unknown().transform((v) =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined,
  ),
});

const batchSchema = z.object({
  transactions: z
    .array(transactionInputSchema)
    .min(1, 'Envie ao menos uma transação.')
    .max(MAX_TRANSACTIONS, `Máximo de ${MAX_TRANSACTIONS} transações por requisição.`),
  user_location: z
    .unknown()
    .transform((v) => (typeof v === 'string' ? stripControl(v).replace(/[^A-Za-z -]/g, '').slice(0, 10) : '') || 'SP'),
});

interface BatchClassificationResponse {
  results: ClassificationResult[];
  stats: {
    total: number;
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
    processing_time_ms: number;
  };
}

// ---------------------------------------------------------------------------
// Dicionário global (leitura pública para authenticated) em cache por isolate
// ---------------------------------------------------------------------------

let dictionaryCache: { index: MerchantIndex; loadedAt: number } | null = null;
let dictionaryLoading: Promise<MerchantIndex | null> | null = null;

function loadDictionary(client: SupabaseClient): Promise<MerchantIndex | null> {
  if (dictionaryCache && Date.now() - dictionaryCache.loadedAt < DICTIONARY_TTL_MS) {
    return Promise.resolve(dictionaryCache.index);
  }
  if (dictionaryLoading) return dictionaryLoading;

  dictionaryLoading = (async () => {
    try {
      const rows: DictionaryRow[] = [];
      for (let page = 0; page < DICTIONARY_MAX_PAGES; page++) {
        const from = page * DICTIONARY_PAGE;
        const { data, error } = await client
          .from('merchants_dictionary')
          .select(DICTIONARY_COLUMNS)
          .eq('is_active', true)
          .order('id')
          .range(from, from + DICTIONARY_PAGE - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as DictionaryRow[]));
        if (!data || data.length < DICTIONARY_PAGE) break;
      }
      const index = new MerchantIndex(rows);
      dictionaryCache = { index, loadedAt: Date.now() };
      return index;
    } catch (error) {
      // Sem dicionário ainda há regras bancárias e padrões do usuário; um
      // índice antigo é melhor que nenhum.
      console.error('classify-transactions: dicionário indisponível:', (error as Error)?.message);
      return dictionaryCache?.index ?? null;
    } finally {
      dictionaryLoading = null;
    }
  })();

  return dictionaryLoading;
}

async function loadLearnedPatterns(client: SupabaseClient, userId: string): Promise<LearnedPatternRow[]> {
  const { data, error } = await client
    .from('user_learned_patterns')
    .select('description, normalized_description, category, subcategory, confidence, usage_count, is_active')
    .eq('user_id', userId)
    .order('usage_count', { ascending: false })
    .limit(MAX_LEARNED_PATTERNS);
  if (error) throw error;
  return ((data ?? []) as Array<LearnedPatternRow & { is_active: boolean | null }>).filter((row) => row.is_active !== false);
}

async function loadCategories(client: SupabaseClient, userId: string): Promise<CategoryRow[]> {
  // Só sistema + próprias: categoria do parceiro (plano Casal) não é destino
  // válido para lançamento deste usuário.
  if (!UUID_RE.test(userId)) return [];
  const { data, error } = await client
    .from('categories')
    .select('name, category_type')
    .or(`is_system.eq.true,user_id.eq.${userId}`);
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

function settled<T>(result: PromiseSettledResult<T>, label: string, fallback: T): T {
  if (result.status === 'fulfilled') return result.value;
  console.error(`classify-transactions: ${label} indisponível:`, (result.reason as Error)?.message);
  return fallback;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);

  try {
    const startTime = Date.now();

    const user = await gateUser(req, {
      bucket: 'classify-transactions',
      ipLimit: 120,
      userLimit: 60,
      windowSeconds: 3600,
      maxBodyBytes: MAX_BODY_BYTES,
    });

    const body = await parseJson(req, batchSchema, { maxBytes: MAX_BODY_BYTES });
    const transactions = body.transactions;
    const client = userClient(req);

    const [dictionary, patterns, categories] = await Promise.allSettled([
      loadDictionary(client),
      loadLearnedPatterns(client, user.id),
      loadCategories(client, user.id),
    ]);

    const categoryResolver = new CategoryResolver(settled(categories, 'categorias', []));

    let results: ClassificationResult[];
    try {
      results = classifyBatch(transactions, {
        index: settled(dictionary, 'dicionário', null),
        learned: new LearnedPatterns(settled(patterns, 'padrões aprendidos', [])),
        categories: categoryResolver,
        location: body.user_location,
      });
    } catch (error) {
      // Defesa final: nunca devolver erro por causa do classificador — cada
      // linha volta como "A Classificar" e a importação segue.
      console.error('classify-transactions: falha no classificador:', (error as Error)?.message);
      results = transactions.map((t) => fallbackResult(t, categoryResolver, ['classifier_unavailable']));
    }

    const response: BatchClassificationResponse = {
      results,
      stats: {
        total: results.length,
        high_confidence: results.filter((r) => r.confidence >= 80).length,
        medium_confidence: results.filter((r) => r.confidence >= 60 && r.confidence < 80).length,
        low_confidence: results.filter((r) => r.confidence < 60).length,
        processing_time_ms: Date.now() - startTime,
      },
    };

    return jsonFor(req, response, 200);
  } catch (error) {
    return gateFailure(req, error, 'classify-transactions');
  }
});
