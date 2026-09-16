/**
 * ÍNDICE EM MEMÓRIA DO `merchants_dictionary` (classificador v2)
 *
 * Módulo puro. Substitui a v1, que fazia 1 RPC `search_merchant` + 1 RPC
 * `search_by_keywords` POR PALAVRA de CADA transação (um extrato de 300
 * linhas disparava ~1.500 round-trips ao Postgres, e a camada de keywords
 * nunca casava porque a RPC não devolve `match_score`).
 *
 * Agora o dicionário (~1.3k linhas, leitura pública para `authenticated`) é
 * carregado uma vez por isolate e indexado em:
 *  - phraseMap   frase normalizada        -> postings (match exato de n-grama)
 *  - compactMap  frase sem espaços        -> postings ("smart fit" = "smartfit",
 *                                            "i food" = "ifood", "netflixcom")
 *  - trigramas   token do vocabulário      -> busca fuzzy (erro de OCR/digitação)
 *
 * Match de uma descrição com T tokens: O(T × maxN) lookups de hash + fuzzy só
 * nos tokens que sobraram. Nenhum I/O.
 *
 * Pontuação (0–100) = base do tipo × especificidade da frase × cobertura ×
 * confidence_modifier do dicionário, com penalidade para:
 *  - token genérico/localidade casando sozinho ("porto", "extra", "claro");
 *  - instituição financeira (merchant de categoria Tarifas) fora de contexto de
 *    tarifa — "PIX ENVIADO NUBANK FULANO" não é tarifa bancária;
 *  - frase que aponta para categorias diferentes (ambiguidade).
 */

import { LOCATION_TOKENS, tokenizePhrase } from './description-cleaner.ts';

export interface DictionaryRow {
  id: string;
  merchant_key: string;
  entity_name: string;
  category: string;
  subcategory: string | null;
  entry_type: string;
  aliases: string[] | null;
  keywords: string[] | null;
  priority: number | null;
  confidence_modifier: number | string | null;
  state_specific: boolean | null;
  states: string[] | null;
}

interface Entry {
  id: string;
  key: string;
  category: string;
  subcategory: string | null;
  entryType: 'merchant' | 'utility' | 'banking_pattern' | 'keyword';
  priority: number;
  modifier: number;
  states: Set<string> | null;
  institution: boolean;
}

interface Posting {
  entry: Entry;
  /** Número de tokens da frase (especificidade). */
  n: number;
  /** A frase veio de `keywords` de uma entrada genérica. */
  viaKeyword: boolean;
}

export interface MerchantMatch {
  category: string;
  subcategory: string | null;
  confidence: number;
  method: 'merchant_entity' | 'merchant_fuzzy' | 'keyword_analysis' | 'banking_pattern';
  matched: string;
  entryKey: string;
  entryType: string;
  institution: boolean;
}

const TARIFAS = 'Tarifas Bancárias / Juros / Impostos / Taxas';

/**
 * Palavras comuns do português que também são nomes de merchant no dicionário.
 * Casando SOZINHAS, valem menos (ex.: "EXTRA" em "HORA EXTRA").
 */
const GENERIC_TOKENS = new Set([
  'extra', 'claro', 'light', 'oi', 'tim', 'clear', 'rico', 'azul', 'gol', 'dia', 'max',
  'point', 'gold', 'ponto', 'sub', 'metro', 'seguro', 'seguros', 'caixa', 'inter',
  'nu', 'ticket', 'bilhete', 'ingresso', 'ingressos', 'mercado', 'super', 'casa',
  'shop', 'store', 'center', 'plus', 'prime', 'mais', 'bom', 'boa', 'bem', 'vida',
  'total', 'pay', 'pag', 'bank', 'banco', 'digital', 'online', 'express', 'food',
  'sul', 'norte', 'brasil', 'nacional', 'central', 'popular', 'real', 'nova', 'novo',
  'sao', 'santa', 'santo', 'grande', 'forte', 'fort', 'top', 'master', 'star',
]);

const TYPE_BASE: Record<Entry['entryType'], number> = {
  merchant: 1.0,
  utility: 1.0,
  banking_pattern: 0.96,
  keyword: 0.86,
};

const MAX_PHRASE_TOKENS = 5;
const MIN_COMPACT_LENGTH = 5;

function toEntryType(value: string): Entry['entryType'] {
  return value === 'utility' || value === 'banking_pattern' || value === 'keyword' ? value : 'merchant';
}

function trigrams(token: string): string[] {
  const padded = `  ${token} `;
  const grams: string[] = [];
  for (let i = 0; i < padded.length - 2; i++) grams.push(padded.slice(i, i + 3));
  return grams;
}

/** Damerau-Levenshtein (transposição adjacente) com corte antecipado. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

export class MerchantIndex {
  private phraseMap = new Map<string, Posting[]>();
  private compactMap = new Map<string, Posting[]>();
  private trigramIndex = new Map<string, Set<string>>();
  readonly size: number;

  constructor(rows: DictionaryRow[]) {
    let count = 0;
    for (const row of rows) {
      if (!row?.merchant_key || !row?.category) continue;
      const entryType = toEntryType(row.entry_type);
      const entry: Entry = {
        id: row.id,
        key: row.merchant_key,
        category: row.category,
        subcategory: row.subcategory ?? null,
        entryType,
        priority: Number(row.priority ?? 50),
        modifier: Math.min(Math.max(Number(row.confidence_modifier ?? 0.9) || 0.9, 0.5), 1),
        states: row.state_specific && row.states?.length
          ? new Set(row.states.map((s) => s.toLowerCase()))
          : null,
        institution: entryType === 'merchant' && row.category === TARIFAS,
      };

      const names = new Set<string>();
      // Chaves "bakery_en"/"darf keyword" são técnicas: o nome visível basta.
      if (!/_|\bkeyword\b|\bgenerico\b|\bassinatura\b/.test(row.merchant_key)) names.add(row.merchant_key);
      if (row.entity_name) names.add(row.entity_name);
      for (const alias of row.aliases ?? []) names.add(alias);

      for (const name of names) this.addPhrase(name, entry, false);

      // `keywords` descrevem a CATEGORIA — só valem como frase em entradas
      // genéricas (keyword/banking_pattern). Em merchant ("restaurante",
      // "mercado") fariam qualquer mercado virar o Atacadão.
      if (entryType === 'keyword' || entryType === 'banking_pattern') {
        for (const kw of row.keywords ?? []) this.addPhrase(kw, entry, true);
      }
      count++;
    }
    this.size = count;
  }

  private addPhrase(raw: string, entry: Entry, viaKeyword: boolean) {
    const tokens = tokenizePhrase(raw ?? '');
    if (tokens.length === 0 || tokens.length > MAX_PHRASE_TOKENS) return;
    const phrase = tokens.join(' ');
    // Frase de 1 caractere ou só número ("99" é tratado pela normalização).
    if (phrase.length < 2) return;
    if (tokens.length === 1 && LOCATION_TOKENS.has(phrase)) return;

    const posting: Posting = { entry, n: tokens.length, viaKeyword };
    push(this.phraseMap, phrase, posting);

    const compact = tokens.join('');
    if (compact.length >= MIN_COMPACT_LENGTH) {
      push(this.compactMap, compact, posting);
      for (const gram of trigrams(compact)) {
        let set = this.trigramIndex.get(gram);
        if (!set) this.trigramIndex.set(gram, (set = new Set()));
        set.add(compact);
      }
    }
  }

  /**
   * Melhor entidade para os tokens. `hints` vêm do prefixo do gateway
   * (IFD* -> ifood) e entram como tokens prioritários.
   */
  match(tokens: string[], options: { hints?: string[]; location?: string; feeContext?: boolean } = {}): MerchantMatch | null {
    const location = options.location?.toLowerCase();
    const meaningful = tokens.filter((t) => !LOCATION_TOKENS.has(t));
    const totalChars = Math.max(meaningful.join('').length, 1);
    const scored = new Map<string, { score: number; match: MerchantMatch; categories: Set<string> }>();

    const consider = (postings: Posting[] | undefined, matched: string, n: number, position: number, similarity: number, method: MerchantMatch['method']) => {
      if (!postings?.length) return;
      const phraseCategories = new Set(postings.map((p) => p.entry.category));

      for (const posting of postings) {
        const { entry } = posting;
        if (entry.states && location && !entry.states.has(location)) continue;

        const matchedTokens = matched.split(' ');
        const single = matchedTokens.length === 1;
        const len = matched.replace(/ /g, '').length;

        let specificity: number;
        if (!single || n >= 2) specificity = 1;
        else if (len >= 6) specificity = 0.96;
        else if (len >= 4) specificity = 0.9;
        else if (len === 3) specificity = meaningful.length <= 2 ? 0.86 : 0.74;
        else specificity = meaningful.length === 1 ? 0.8 : 0.55;

        if (single && GENERIC_TOKENS.has(matched)) specificity *= meaningful.length <= 1 ? 0.9 : 0.7;
        if (matchedTokens.every((t) => LOCATION_TOKENS.has(t))) continue;

        const coverage = Math.min(len / totalChars, 1);
        let score = TYPE_BASE[entry.entryType]
          * (posting.viaKeyword ? 0.94 : 1)
          * specificity
          * (0.82 + 0.18 * coverage)
          * (0.8 + 0.2 * entry.modifier)
          * similarity;

        if (position === 0) score *= 1.03;
        if (entry.institution && !options.feeContext) score *= 0.55;
        if (phraseCategories.size > 1) score *= 0.88;
        score += Math.min(entry.priority, 100) / 10_000; // desempate estável

        const confidence = Math.round(Math.min(score, 0.97) * 100);
        const current = scored.get(entry.id);
        if (!current || score > current.score) {
          scored.set(entry.id, {
            score,
            categories: phraseCategories,
            match: {
              category: entry.category,
              subcategory: entry.subcategory,
              confidence,
              method: entry.entryType === 'banking_pattern'
                ? 'banking_pattern'
                : method === 'merchant_fuzzy'
                  ? 'merchant_fuzzy'
                  : entry.entryType === 'keyword' || posting.viaKeyword
                    ? 'keyword_analysis'
                    : 'merchant_entity',
              matched,
              entryKey: entry.key,
              entryType: entry.entryType,
              institution: entry.institution,
            },
          });
        }
      }
    };

    // 0) dicas de prefixo de gateway (IFD*, UBER*, 99APP*)
    for (const hint of options.hints ?? []) {
      consider(this.phraseMap.get(hint), hint, hint.split(' ').length + 1, 0, 1, 'merchant_entity');
    }

    // 1) n-gramas exatos e compactos, do mais longo para o mais curto
    const matchedPositions = new Set<number>();
    const maxN = Math.min(MAX_PHRASE_TOKENS, tokens.length);
    for (let n = maxN; n >= 1; n--) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const slice = tokens.slice(i, i + n);
        const phrase = slice.join(' ');
        const exact = this.phraseMap.get(phrase);
        if (exact) {
          consider(exact, phrase, n, i, 1, 'merchant_entity');
          for (let k = i; k < i + n; k++) matchedPositions.add(k);
        }
        const compact = slice.join('');
        if (compact.length >= MIN_COMPACT_LENGTH) {
          const joined = this.compactMap.get(compact);
          if (joined && !exact) {
            consider(joined, phrase, Math.max(n, 2), i, 0.98, 'merchant_entity');
            for (let k = i; k < i + n; k++) matchedPositions.add(k);
          }
        }
      }
    }

    // 2) prefixo compacto: "netflixcom", "spotifybr", "uberrides"; e artigo
    //    colado no início: "oboticario" -> "boticario"
    tokens.forEach((token, i) => {
      if (matchedPositions.has(i) || token.length < MIN_COMPACT_LENGTH + 1) return;
      if ((token[0] === 'o' || token[0] === 'a') && this.compactMap.has(token.slice(1))) {
        consider(this.compactMap.get(token.slice(1)), token.slice(1), 2, i, 0.95, 'merchant_entity');
        matchedPositions.add(i);
        return;
      }
      for (let cut = token.length - 1; cut >= MIN_COMPACT_LENGTH; cut--) {
        const postings = this.compactMap.get(token.slice(0, cut));
        if (postings) {
          consider(postings, token.slice(0, cut), 2, i, 0.93, 'merchant_entity');
          matchedPositions.add(i);
          break;
        }
      }
    });

    // 3) fuzzy (OCR / digitação) só nos tokens longos que não casaram
    const bestSoFar = Math.max(0, ...[...scored.values()].map((s) => s.match.confidence));
    if (bestSoFar < 80) {
      tokens.forEach((token, i) => {
        if (matchedPositions.has(i) || token.length < 6 || LOCATION_TOKENS.has(token)) return;
        const fuzzy = this.fuzzyLookup(token);
        if (fuzzy) consider(this.compactMap.get(fuzzy.term), fuzzy.term, 2, i, fuzzy.similarity * 0.92, 'merchant_fuzzy');
      });
    }

    if (scored.size === 0) return null;

    const ranked = [...scored.values()].sort((a, b) => b.score - a.score);
    const best = ranked[0];

    // Ambiguidade: 2º colocado quase empatado apontando outra categoria.
    const rival = ranked.find((r) => r.match.category !== best.match.category);
    if (rival && rival.score >= best.score * 0.97) {
      best.match.confidence = Math.round(best.match.confidence * 0.85);
    }

    return best.match;
  }

  /** Termo compacto do vocabulário mais próximo (Dice de trigramas + edição). */
  private fuzzyLookup(token: string): { term: string; similarity: number } | null {
    const grams = trigrams(token);
    const counts = new Map<string, number>();
    for (const gram of grams) {
      const set = this.trigramIndex.get(gram);
      if (!set) continue;
      for (const term of set) counts.set(term, (counts.get(term) ?? 0) + 1);
    }

    let best: { term: string; similarity: number } | null = null;
    const maxEdits = token.length >= 9 ? 2 : 1;
    for (const [term, shared] of counts) {
      if (Math.abs(term.length - token.length) > maxEdits) continue;
      const dice = (2 * shared) / (grams.length + trigrams(term).length);
      if (dice < 0.5) continue;
      const distance = editDistance(token, term, maxEdits);
      if (distance > maxEdits) continue;
      // Primeira letra errada é raro em OCR/digitação e gera falso positivo.
      if (term[0] !== token[0]) continue;
      const similarity = 1 - distance / Math.max(term.length, token.length);
      if (!best || similarity > best.similarity) best = { term, similarity };
    }
    return best && best.similarity >= 0.84 ? best : null;
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
