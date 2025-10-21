import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cleanTransactionDescription, hasHighPriorityBankingContext, extractBankingContext, isCleanedDescriptionValid } from './description-cleaner.ts';

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
 * ============================================================================
 * LIMPEZA ESTRATÉGICA EM DUAS PASSAGENS
 * ============================================================================
 * 
 * NOVA ARQUITETURA:
 * 
 * Passagem 1 (CONTEXTO): Usa string ORIGINAL para detectar contexto bancário
 * Passagem 2 (ENTIDADE): Usa string LIMPA para identificar estabelecimento real
 * 
 * PRIORIDADES:
 * - Camada 0 (100): Padrões do Usuário (ABSOLUTA)
 * - Camada 1 (95):  Entidades Nomeadas (merchants_dictionary)
 * - Camada 2 (85):  Padrões Bancários Contextuais
 * - Camada 3 (70):  Keywords genéricos
 * - Fallback (40):  Categoria padrão
 */
async function classifyTransaction(
  transaction: Transaction,
  supabaseClient: any,
  userPatterns: Map<string, any>,
  userLocation: string
): Promise<ClassificationResult> {
  const { description, type } = transaction;
  const normalizedDesc = description.toLowerCase().trim();

  // =========================================================================
  // ETAPA 0: LIMPEZA ESTRATÉGICA
  // =========================================================================
  const cleaningResult = cleanTransactionDescription(description);
  const { cleaned, tokens, removedPatterns } = cleaningResult;

  // Verifica se a descrição limpa é válida
  const hasValidCleanedDesc = isCleanedDescriptionValid(cleaned);

  // =========================================================================
  // ETAPA 1: CAMADA 0 - PADRÕES DO USUÁRIO (PRIORIDADE ABSOLUTA)
  // =========================================================================
  // Testa AMBAS: original e limpa
  const userResultOriginal = await getUserLearnedPattern(normalizedDesc, userPatterns);
  const userResultCleaned = hasValidCleanedDesc 
    ? await getUserLearnedPattern(cleaned.toLowerCase().trim(), userPatterns)
    : null;

  // Se encontrou match do usuário com confiança alta, retorna IMEDIATAMENTE
  const userResult = userResultOriginal || userResultCleaned;
  if (userResult && userResult.confidence >= 80) {
    return {
      description,
      category: userResult.category,
      subcategory: userResult.subcategory,
      confidence: userResult.confidence,
      method: 'user_learned',
      features_used: ['user_learned_absolute_priority', 'layer_0'],
      learned_from_user: true
    };
  }

  // =========================================================================
  // ETAPA 2: PASSAGEM DE CONTEXTO (String ORIGINAL)
  // =========================================================================
  let bankingContextResult: ClassificationResult | null = null;
  
  // Detecta contexto bancário na string original
  const bankingContext = extractBankingContext(description);
  
  if (bankingContext) {
    const contextClassification = getBankingPatternClassification(description, type);
    
    if (contextClassification) {
      bankingContextResult = {
        description,
        ...contextClassification
      };

      // Se é contexto de ALTA PRIORIDADE (TARIFA, JUROS, MULTA), retorna imediatamente
      if (hasHighPriorityBankingContext(description)) {
        return bankingContextResult;
      }
    }
  }

  // =========================================================================
  // ETAPA 3: PASSAGEM DE ENTIDADE (String LIMPA)
  // =========================================================================
  const entityCandidates: Array<ClassificationResult & { priority: number }> = [];

  if (hasValidCleanedDesc) {
    // CAMADA 1: ENTIDADES NOMEADAS (Merchants Dictionary)
    try {
      const merchantResult = await searchMerchantInDB(
        cleaned,
        supabaseClient,
        userLocation
      );

      if (merchantResult && merchantResult.confidence >= 60) {
        entityCandidates.push({
          description,
          category: merchantResult.category,
          subcategory: merchantResult.subcategory,
          confidence: merchantResult.confidence,
          method: 'merchant_entity',
          features_used: ['merchant_dictionary', 'cleaned_description', 'layer_1'],
          priority: 95
        });
      }
    } catch (error) {
      console.error('Error searching merchant:', error);
    }

    // CAMADA 3: KEYWORDS (Busca por palavras-chave nos tokens limpos)
    if (tokens.length > 0) {
      const keywordResult = await classifyByKeywords(
        tokens,
        type,
        supabaseClient,
        userPatterns,
        userLocation
      );

      if (keywordResult) {
        entityCandidates.push({
          ...keywordResult,
          description,
          priority: 70
        });
      }
    }

    // Tenta também com variantes camelCase se aplicável
    const variants = generateDescriptionVariants(cleaned);
    if (variants.camelCaseSeparated) {
      try {
        const camelResult = await searchMerchantInDB(
          variants.camelCaseSeparated,
          supabaseClient,
          userLocation
        );

        if (camelResult && camelResult.confidence >= 60) {
          entityCandidates.push({
            description,
            category: camelResult.category,
            subcategory: camelResult.subcategory,
            confidence: camelResult.confidence * 0.95, // Leve penalidade por ser variante
            method: 'merchant_entity_camel',
            features_used: ['merchant_dictionary', 'camelcase_variant', 'layer_1'],
            priority: 93
          });
        }
      } catch (error) {
        console.error('Error searching camelCase variant:', error);
      }
    }
  }

  // =========================================================================
  // ETAPA 4: DECISÃO FINAL (Escolhe o melhor resultado)
  // =========================================================================
  
  // Adiciona resultado bancário aos candidatos (se houver)
  if (bankingContextResult) {
    entityCandidates.push({
      ...bankingContextResult,
      priority: 85
    });
  }

  // Adiciona resultado do usuário com confiança média (se houver)
  if (userResult) {
    entityCandidates.push({
      description,
      category: userResult.category,
      subcategory: userResult.subcategory,
      confidence: userResult.confidence,
      method: 'user_learned',
      features_used: ['user_learned_medium', 'layer_0'],
      learned_from_user: true,
      priority: 100 // Usuário sempre tem prioridade
    });
  }

  // Se tem candidatos, escolhe o melhor
  if (entityCandidates.length > 0) {
    // Ordena por: 1) Prioridade, 2) Confiança
    entityCandidates.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.confidence - a.confidence;
    });

    const bestMatch = entityCandidates[0];
    const { priority, ...result } = bestMatch;

    return {
      ...result,
      features_used: [
        ...result.features_used,
        `removed_patterns:${removedPatterns.length}`,
        `cleaned_valid:${hasValidCleanedDesc}`
      ]
    };
  }

  // =========================================================================
  // FALLBACK: Categoria padrão
  // =========================================================================
  const defaultCategory = type === 'income'
    ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)'
    : 'Outros';

  return {
    description,
    category: defaultCategory,
    confidence: 40,
    method: 'default_fallback',
    features_used: ['type_based_default', 'no_match_found'],
    learned_from_user: false
  };
}

/**
 * ============================================================================
 * FUNÇÕES AUXILIARES DA NOVA ARQUITETURA
 * ============================================================================
 */

/**
 * CAMADA 0: Busca nos padrões aprendidos do usuário
 */
async function getUserLearnedPattern(
  normalizedDesc: string,
  userPatterns: Map<string, any>
): Promise<{ category: string; subcategory?: string; confidence: number } | null> {
  // Match exato
  const exactMatch = userPatterns.get(normalizedDesc);
  if (exactMatch && exactMatch.confidence >= 70) {
    return {
      category: exactMatch.category,
      subcategory: exactMatch.subcategory,
      confidence: exactMatch.confidence
    };
  }

  // Match parcial (descrição contida ou contém)
  for (const [patternDesc, pattern] of userPatterns.entries()) {
    if (
      (normalizedDesc.includes(patternDesc) || patternDesc.includes(normalizedDesc)) &&
      pattern.confidence >= 70
    ) {
      return {
        category: pattern.category,
        subcategory: pattern.subcategory,
        confidence: Math.min(pattern.confidence + (pattern.usage_count * 2), 95)
      };
    }
  }

  return null;
}

/**
 * CAMADA 1: Busca no dicionário de merchants (Entidades Nomeadas)
 */
async function searchMerchantInDB(
  description: string,
  supabaseClient: any,
  userLocation: string
): Promise<{ category: string; subcategory?: string; confidence: number } | null> {
  try {
    const { data: merchantResults, error } = await supabaseClient
      .rpc('search_merchant', {
        p_description: description,
        p_user_location: userLocation,
        p_limit: 1,
      });

    if (!error && merchantResults && merchantResults.length > 0) {
      const merchant = merchantResults[0];
      if (merchant.match_score >= 0.5) {
        const confidence = Math.min(merchant.match_score * 100 * merchant.confidence_modifier, 98);
        return {
          category: merchant.category,
          subcategory: merchant.subcategory,
          confidence
        };
      }
    }
  } catch (error) {
    console.error('Error searching merchant:', error);
  }

  return null;
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
 * CAMADA 2: Classificação por padrões bancários contextuais
 * Detecta contexto bancário na string ORIGINAL (antes da limpeza)
 */
function getBankingPatternClassification(
  description: string,
  type: 'income' | 'expense'
): Omit<ClassificationResult, 'description'> | null {
  const descLower = description.toLowerCase();

  // Palavras-chave bancárias genéricas (prioridade de matching)
  const bankingKeywords: Record<string, { category: string; subcategory?: string; priority: number }> = {
    // ALTA PRIORIDADE (devem retornar imediatamente)
    'tarifa': {
      category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
      subcategory: 'Tarifas Bancárias',
      priority: 100
    },
    'juros': {
      category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
      subcategory: 'Juros',
      priority: 100
    },
    'multa': {
      category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
      subcategory: 'Multas',
      priority: 100
    },
    'iof': {
      category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
      subcategory: 'IOF',
      priority: 100
    },
    'anuidade': {
      category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
      subcategory: 'Anuidade',
      priority: 100
    },

    // MÉDIA PRIORIDADE (contexto bancário, mas pode ter entidade)
    'pix enviado': { category: 'Outros', subcategory: 'Transferências', priority: 85 },
    'pix recebido': {
      category: 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
      subcategory: 'PIX Recebido',
      priority: 85
    },
    'pagamento efetuado': { category: 'Outros', subcategory: 'Pagamentos', priority: 80 },
    'transferencia': { category: 'Outros', subcategory: 'Transferências', priority: 80 },
    'debito automatico': { category: 'Outros', subcategory: 'Débitos Automáticos', priority: 80 },
  };

  // Busca o primeiro match (ordem importa)
  for (const [keyword, categoryInfo] of Object.entries(bankingKeywords)) {
    if (descLower.includes(keyword)) {
      return {
        category: categoryInfo.category,
        subcategory: categoryInfo.subcategory,
        confidence: 85,
        method: 'banking_pattern',
        features_used: ['banking_keywords', 'contextual_match', 'layer_2'],
      };
    }
  }

  return null;
}

