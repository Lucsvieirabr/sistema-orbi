import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// UTILITÁRIOS DE NORMALIZAÇÃO DE DESCRIÇÕES
// =============================================================================

/**
 * Detecta se uma string está em camelCase
 */
function isCamelCase(text: string): boolean {
  return /[a-z][A-Z]/.test(text);
}

/**
 * Separa camelCase em palavras
 * Exemplo: "DiskAguaEGas" -> "Disk Agua E Gas"
 */
function separateCamelCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .trim();
}

/**
 * Extrai keywords relevantes (remove stopwords)
 */
function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    'de', 'da', 'do', 'dos', 'das', 'e', 'em', 'o', 'a', 'os', 'as',
    'para', 'com', 'sem', 'por', 'na', 'no', 'ao', 'aos', 'pela', 'pelo'
  ]);

  return text
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^\w]/g, ''))
    .filter(word => 
      word.length >= 3 && 
      !stopwords.has(word) && 
      !/^\d+$/.test(word)
    );
}

/**
 * Gera variantes da descrição para tentar classificar
 */
function generateDescriptionVariants(description: string): {
  original: string;
  camelCaseSeparated?: string;
  keywords: string[];
} {
  const variants: any = {
    original: description,
    keywords: []
  };

  // Se tem camelCase, gera versão separada
  if (isCamelCase(description)) {
    variants.camelCaseSeparated = separateCamelCase(description);
    variants.keywords = extractKeywords(variants.camelCaseSeparated);
  } else {
    variants.keywords = extractKeywords(description);
  }

  return variants;
}

interface Transaction {
  description: string;
  type: 'income' | 'expense';
  amount?: number;
  date?: string;
}

interface ClassificationResult {
  description: string;
  category: string;
  subcategory?: string;
  confidence: number;
  method: string;
  features_used: string[];
  learned_from_user?: boolean;
}

interface BatchClassificationRequest {
  transactions: Transaction[];
  user_location?: string;
}

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();

    // Cria cliente Supabase com auth do usuário
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verifica autenticação
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { transactions, user_location = 'SP' }: BatchClassificationRequest = await req.json();

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      throw new Error('Invalid request: transactions array is required');
    }

    // Pré-carrega padrões aprendidos do usuário
    const normalizedDescriptions = transactions.map(t => t.description.toLowerCase().trim());
    const { data: learnedPatterns } = await supabaseClient
      .from('user_learned_patterns')
      .select('description, normalized_description, category, subcategory, confidence, usage_count')
      .in('normalized_description', normalizedDescriptions)
      .gte('confidence', 70);

    // Cria mapa de padrões para lookup rápido
    const patternMap = new Map<string, any>();
    learnedPatterns?.forEach(pattern => {
      patternMap.set(pattern.normalized_description, {
        ...pattern,
        source: 'user',
        confidence: Math.min(pattern.confidence + (pattern.usage_count * 3), 98)
      });
    });

    // Processa todas as transações em paralelo
    const results = await Promise.all(
      transactions.map(async (transaction) => {
        return await classifyTransaction(
          transaction,
          supabaseClient,
          patternMap,
          user_location
        );
      })
    );

    // Calcula estatísticas
    const stats = {
      total: results.length,
      high_confidence: results.filter(r => r.confidence >= 80).length,
      medium_confidence: results.filter(r => r.confidence >= 60 && r.confidence < 80).length,
      low_confidence: results.filter(r => r.confidence < 60).length,
      processing_time_ms: Date.now() - startTime,
    };

    const response: BatchClassificationResponse = {
      results,
      stats,
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in classify-transactions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});

/**
 * Classifica uma única transação usando estratégia híbrida
 * AGORA COM SUPORTE A VARIANTES DE DESCRIÇÃO
 */
async function classifyTransaction(
  transaction: Transaction,
  supabaseClient: any,
  userPatterns: Map<string, any>,
  userLocation: string
): Promise<ClassificationResult> {
  const { description, type } = transaction;
  const normalizedDesc = description.toLowerCase().trim();

  // Gera variantes da descrição (camelCase, keywords, etc)
  const variants = generateDescriptionVariants(description);

  // Estratégia em camadas MELHORADA:
  // 1. Tenta com descrição original
  // 2. Se tem camelCase, tenta com versão separada
  // 3. Se confiança baixa, analisa palavra por palavra
  // 4. Compara resultados e retorna o melhor

  // Array para armazenar todas as tentativas
  const candidates: ClassificationResult[] = [];

  // TENTATIVA 1: Classificação com descrição original
  const result1 = await classifyWithSpecificDescription(
    description,
    normalizedDesc,
    type,
    supabaseClient,
    userPatterns,
    userLocation,
    'original'
  );
  candidates.push(result1);

  // TENTATIVA 2: Se tem camelCase, tenta com versão separada
  if (variants.camelCaseSeparated) {
    const camelCaseDesc = variants.camelCaseSeparated;
    const result2 = await classifyWithSpecificDescription(
      camelCaseDesc,
      camelCaseDesc.toLowerCase().trim(),
      type,
      supabaseClient,
      userPatterns,
      userLocation,
      'camelCase_separated'
    );
    candidates.push(result2);
  }

  // TENTATIVA 3: Se confiança ainda é baixa, analisa palavras individuais
  const bestSoFar = candidates.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );

  if (bestSoFar.confidence < 60 && variants.keywords.length > 0) {
    const result3 = await classifyByKeywords(
      variants.keywords,
      type,
      supabaseClient,
      userPatterns,
      userLocation
    );
    
    if (result3) {
      result3.description = description; // Mantém descrição original
      candidates.push(result3);
    }
  }

  // Escolhe o melhor resultado (maior confiança)
  const bestResult = candidates.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );

  return bestResult;
}

/**
 * Classifica usando uma descrição específica (variante)
 */
async function classifyWithSpecificDescription(
  description: string,
  normalizedDesc: string,
  type: 'income' | 'expense',
  supabaseClient: any,
  userPatterns: Map<string, any>,
  userLocation: string,
  variant: string
): Promise<ClassificationResult> {
  // Estratégia em camadas:
  // 1. Padrões aprendidos do usuário (pré-carregados)
  // 2. Busca no dicionário de merchants
  // 3. Padrões bancários contextuais
  // 4. Fallback padrão

  // 1. PADRÕES APRENDIDOS DO USUÁRIO (MÁXIMA PRIORIDADE)
  const exactMatch = userPatterns.get(normalizedDesc);
  if (exactMatch && exactMatch.confidence >= 80) {
    return {
      description,
      category: exactMatch.category,
      subcategory: exactMatch.subcategory,
      confidence: exactMatch.confidence,
      method: 'user_learned',
      features_used: ['user_learned_exact', 'high_frequency'],
      learned_from_user: true,
    };
  }

  // Busca parcial nos padrões aprendidos
  for (const [patternDesc, pattern] of userPatterns.entries()) {
    if (
      (normalizedDesc.includes(patternDesc) || patternDesc.includes(normalizedDesc)) &&
      pattern.confidence >= 75
    ) {
      return {
        description,
        category: pattern.category,
        subcategory: pattern.subcategory,
        confidence: Math.min(pattern.confidence + (pattern.usage_count * 2), 95),
        method: 'user_learned_partial',
        features_used: ['user_learned_partial', 'frequency_boosted'],
        learned_from_user: true,
      };
    }
  }

  // 2. BUSCA NO DICIONÁRIO DE MERCHANTS
  try {
    const { data: merchantResults, error } = await supabaseClient
      .rpc('search_merchant', {
        p_description: description,
        p_user_location: userLocation,
        p_limit: 1,
      });

    if (!error && merchantResults && merchantResults.length > 0) {
      const merchant = merchantResults[0];
      if (merchant.match_score >= 0.6) {
        const confidence = Math.min(merchant.match_score * 100 * merchant.confidence_modifier, 98);
        return {
          description,
          category: merchant.category,
          subcategory: merchant.subcategory,
          confidence,
          method: 'merchant_specific',
          features_used: ['merchant_dictionary', 'supabase_search'],
        };
      }
    }
  } catch (error) {
    console.error('Error searching merchant:', error);
  }

  // 3. PADRÕES BANCÁRIOS CONTEXTUAIS
  const bankingPattern = getBankingPatternClassification(normalizedDesc, type);
  if (bankingPattern) {
    return {
      description,
      ...bankingPattern,
    };
  }

  // 4. CATEGORIA PADRÃO (FALLBACK)
  const defaultCategory = type === 'income'
    ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)'
    : 'Outros';

  return {
    description,
    category: defaultCategory,
    confidence: 40,
    method: 'default_fallback',
    features_used: ['type_based_default', variant],
    learned_from_user: false,
  };
}

/**
 * Classifica analisando palavras-chave individuais
 * Útil quando a descrição completa falha mas contém palavras relevantes
 * 
 * Exemplo: "CATARINENSE COBRANCAS" -> analisa "COBRANCAS" -> "Taxas"
 * Exemplo: "Empresa De Navegacao Santa" -> analisa "NAVEGACAO" -> "Transporte"
 */
async function classifyByKeywords(
  keywords: string[],
  type: 'income' | 'expense',
  supabaseClient: any,
  userPatterns: Map<string, any>,
  userLocation: string
): Promise<ClassificationResult | null> {
  const keywordResults: Array<{
    keyword: string;
    result: ClassificationResult;
  }> = [];

  // Tenta classificar cada keyword individualmente
  for (const keyword of keywords) {
    // Verifica nos padrões do usuário
    const userMatch = userPatterns.get(keyword.toLowerCase());
    if (userMatch && userMatch.confidence >= 70) {
      keywordResults.push({
        keyword,
        result: {
          description: keyword,
          category: userMatch.category,
          subcategory: userMatch.subcategory,
          confidence: userMatch.confidence * 0.85, // Reduz um pouco (palavra isolada)
          method: 'keyword_analysis',
          features_used: ['individual_keyword', keyword],
          learned_from_user: true,
        }
      });
      continue;
    }

    // Busca no dicionário
    try {
      const { data: dbMatches, error } = await supabaseClient
        .rpc('search_by_keywords', {
          p_description: keyword,
          p_type: type,
        });

      if (!error && dbMatches && dbMatches.length > 0) {
        const match = dbMatches[0];
        if (match.match_score >= 0.7) {
          keywordResults.push({
            keyword,
            result: {
              description: keyword,
              category: match.category,
              subcategory: match.subcategory,
              confidence: Math.min(match.match_score * 100 * match.confidence_modifier * 0.85, 90),
              method: 'keyword_analysis',
              features_used: ['individual_keyword', keyword, 'database_match'],
              learned_from_user: false,
            }
          });
        }
      }
    } catch (error) {
      // Continua para próxima keyword
      continue;
    }
  }

  // Se encontrou resultados, retorna o de maior confiança
  if (keywordResults.length > 0) {
    keywordResults.sort((a, b) => b.result.confidence - a.result.confidence);
    
    const best = keywordResults[0];
    return {
      ...best.result,
      features_used: [
        ...best.result.features_used,
        'keyword_extraction',
        `matched_${best.keyword}`
      ]
    };
  }

  return null;
}

/**
 * Classificação por padrões bancários contextuais
 * Usa apenas palavras-chave genéricas - entidades específicas estão em merchants_dictionary
 */
function getBankingPatternClassification(
  description: string,
  type: 'income' | 'expense'
): Omit<ClassificationResult, 'description'> | null {
  const descLower = description.toLowerCase();

  // Palavras-chave bancárias genéricas
  const bankingKeywords: Record<string, { category: string; subcategory?: string }> = {
    'pix enviado': { category: 'Outros', subcategory: 'Transferências' },
    'pix recebido': {
      category: 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
      subcategory: 'PIX Recebido',
    },
    'pagamento efetuado': { category: 'Outros', subcategory: 'Pagamentos' },
    'transferencia': { category: 'Outros', subcategory: 'Transferências' },
    'debito automatico': { category: 'Outros', subcategory: 'Débitos Automáticos' },
    'juros': {
      category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
      subcategory: 'Juros',
    },
    'multa': {
      category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
      subcategory: 'Multas',
    },
    'taxa': {
      category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
      subcategory: 'Taxas',
    },
    'tarifa': {
      category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
      subcategory: 'Tarifas Bancárias',
    },
    'iof': {
      category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
      subcategory: 'IOF',
    },
    'anuidade': {
      category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
      subcategory: 'Anuidade',
    },
  };

  for (const [keyword, categoryInfo] of Object.entries(bankingKeywords)) {
    if (descLower.includes(keyword)) {
      return {
        category: categoryInfo.category,
        subcategory: categoryInfo.subcategory,
        confidence: 85,
        method: 'banking_pattern',
        features_used: ['banking_keywords', 'contextual_match'],
      };
    }
  }

  return null;
}

