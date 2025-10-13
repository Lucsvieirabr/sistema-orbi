import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Pré-carrega padrões aprendidos globalmente (uma única query)
    const { data: globalPatterns } = await supabaseClient
      .from('global_learned_patterns')
      .select('description, category, subcategory, confidence, usage_count')
      .eq('is_active', true)
      .gte('confidence', 70)
      .gte('usage_count', 2)
      .order('usage_count', { ascending: false })
      .limit(1000);

    // Cria mapa de padrões para lookup rápido
    const patternMap = new Map<string, any>();
    globalPatterns?.forEach(pattern => {
      patternMap.set(pattern.description.toLowerCase(), pattern);
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
 */
async function classifyTransaction(
  transaction: Transaction,
  supabaseClient: any,
  globalPatterns: Map<string, any>,
  userLocation: string
): Promise<ClassificationResult> {
  const { description, type } = transaction;
  const normalizedDesc = description.toLowerCase().trim();

  // Estratégia em camadas:
  // 1. Padrões aprendidos globalmente (pré-carregados)
  // 2. Busca no dicionário de merchants
  // 3. Padrões bancários contextuais
  // 4. Fallback padrão

  // 1. PADRÕES APRENDIDOS GLOBALMENTE (MÁXIMA PRIORIDADE)
  const exactMatch = globalPatterns.get(normalizedDesc);
  if (exactMatch && exactMatch.confidence >= 80) {
    return {
      description,
      category: exactMatch.category,
      subcategory: exactMatch.subcategory,
      confidence: Math.min(exactMatch.confidence + (exactMatch.usage_count * 2), 98),
      method: 'global_exact_match',
      features_used: ['global_learned_exact', 'high_frequency'],
      learned_from_user: true,
    };
  }

  // Busca parcial nos padrões aprendidos
  for (const [patternDesc, pattern] of globalPatterns.entries()) {
    if (
      (normalizedDesc.includes(patternDesc) || patternDesc.includes(normalizedDesc)) &&
      pattern.confidence >= 75
    ) {
      return {
        description,
        category: pattern.category,
        subcategory: pattern.subcategory,
        confidence: Math.min(pattern.confidence + (pattern.usage_count * 1.5), 95),
        method: 'global_partial_match',
        features_used: ['global_learned_partial', 'frequency_boosted'],
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
    features_used: ['type_based_default'],
    learned_from_user: false,
  };
}

/**
 * Classificação por padrões bancários contextuais
 */
function getBankingPatternClassification(
  description: string,
  type: 'income' | 'expense'
): Omit<ClassificationResult, 'description'> | null {
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
    if (description.includes(keyword)) {
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

