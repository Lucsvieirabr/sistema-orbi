/**
 * WIP: Sistema migrado para user_learned_patterns apenas
 * TODO: Futuro - adicionar sistema de admin para ensino global
 * 
 * BankDictionary V2 - Versão com Banco de Dados
 * Features:
 * - Cache LRU inteligente
 * - Fallbacks essenciais em memória
 * - Busca no Supabase (merchants_dictionary)
 * - Pré-carregamento de merchants frequentes
 */

import { supabase } from '@/integrations/supabase/client';
import { getMerchantCache, CachedMerchant } from './MerchantCache';

/**
 * Tokeniza descrição da transação
 */
function tokenizeDescription(description: string): string[] {
  return description.toLowerCase().split(/\s+/).filter(token => token.length > 2);
}

export interface DictionaryEntry {
  keywords: (string | RegExp)[];
  category: string;
  subcategory?: string;
  entity_name?: string;
  confidence_modifier: number;
  frequency?: number;
  priority?: number;
  context_sensitive?: boolean;
}

export interface MerchantEntry {
  entity_name: string;
  category: string;
  subcategory?: string;
  aliases: string[];
  confidence_modifier: number;
  priority: number;
  state_specific?: boolean;
  states?: string[];
}

export interface BankingPattern {
  patterns: (string | RegExp)[];
  category: string;
  subcategory?: string;
  confidence_modifier: number;
  priority: number;
}

/**
 * Merchants essenciais para fallback (offline/erro)
 */
const ESSENTIAL_MERCHANTS: Record<string, MerchantEntry> = {
        'ifood': {
          entity_name: 'iFood',
          category: 'Alimentação',
          subcategory: 'Delivery',
    aliases: ['ifood', 'i food'],
    confidence_modifier: 1.0,
          priority: 100
        },
        'uber': {
          entity_name: 'Uber',
          category: 'Transporte',
    subcategory: 'Transporte por Aplicativo',
    aliases: ['uber', 'uber trip'],
    confidence_modifier: 1.0,
          priority: 100
        },
        'netflix': {
          entity_name: 'Netflix',
    category: 'Assinaturas',
    subcategory: 'Streaming',
    aliases: ['netflix'],
    confidence_modifier: 1.0,
          priority: 100
        },
        'spotify': {
          entity_name: 'Spotify',
    category: 'Assinaturas',
    subcategory: 'Streaming',
    aliases: ['spotify'],
    confidence_modifier: 1.0,
          priority: 100
        },
  'carrefour': {
    entity_name: 'Carrefour',
    category: 'Alimentação',
    subcategory: 'Hipermercado',
    aliases: ['carrefour', 'carfour'],
          confidence_modifier: 0.95,
          priority: 100
        },
  'pix': {
    entity_name: 'PIX',
          category: 'Outros',
    subcategory: 'Transferências',
    aliases: ['pix', 'transferencia pix'],
    confidence_modifier: 1.0,
          priority: 100
        }
};

export class BankDictionary {
  private cache = getMerchantCache();
  private userLocation?: string;
  private userId?: string;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  
  // Padrões aprendidos (mantido em memória para compatibilidade)
  private learnedPatterns: Record<string, { 
    category: string; 
    subcategory?: string; 
    confidence: number; 
    count: number; 
    last_seen: string 
  }> = {};
  
  // Estatísticas de uso
  private usageStats: Record<string, { count: number; accuracy: number }> = {};

  constructor(userLocation?: string, userId?: string) {
    this.userLocation = userLocation;
    this.userId = userId;
    
    // Inicializa de forma assíncrona
    this.initialize();
  }

  /**
   * Inicializa o dicionário (carrega cache, padrões aprendidos, etc)
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized || this.initPromise) {
      return this.initPromise || Promise.resolve();
    }

    this.initPromise = (async () => {
      try {
        // Passo 1: Carregar padrões aprendidos do usuário
        await this.loadLearnedPatterns();
        
        // Passo 2: Pré-carregar merchants mais usados
        await this.preloadTopMerchants();
        
        this.isInitialized = true;
      } catch (error) {
        console.error('Erro ao inicializar BankDictionary:', error);
        // Continua com fallbacks mesmo se falhar
        this.isInitialized = true;
      }
    })();

    return this.initPromise;
  }

  /**
   * Garante que está inicializado antes de usar
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Carrega padrões aprendidos do usuário
   */
  private async loadLearnedPatterns(): Promise<void> {
    try {
      const { data: patterns } = await supabase
        .from('user_learned_patterns')
        .select('description, category, subcategory, confidence, usage_count, last_used_at')
        .gte('confidence', 75.00)
        .order('usage_count', { ascending: false })
        .limit(200);

      if (patterns && Array.isArray(patterns) && patterns.length > 0) {
        patterns.forEach((pattern: any) => {
          this.learnedPatterns[pattern.description] = {
            category: pattern.category,
            subcategory: pattern.subcategory,
            confidence: pattern.confidence,
            count: pattern.usage_count,
            last_seen: pattern.last_used_at
          };
        });
      }
    } catch (error) {
      console.error('Erro ao carregar padrões aprendidos:', error);
    }
  }

  /**
   * Pré-carrega merchants mais usados no cache
   */
  private async preloadTopMerchants(): Promise<void> {
    try {
      const { data: merchants } = await supabase
        .rpc('get_top_merchants', { p_limit: 100 }) as { data: any[] | null };

      if (merchants && merchants.length > 0) {
        const cachedMerchants: CachedMerchant[] = merchants.map(m => ({
          id: m.id,
          merchant_key: m.merchant_key,
          entity_name: m.entity_name,
          category: m.category,
          subcategory: m.subcategory,
          aliases: m.aliases || [],
          confidence_modifier: m.confidence_modifier,
          priority: m.priority,
          entry_type: m.entry_type,
          states: m.states,
          context: m.context,
          metadata: m.metadata
        }));

        this.cache.preloadMerchants(cachedMerchants);
      }
    } catch (error) {
      console.error('Erro ao pré-carregar merchants:', error);
    }
  }

  /**
   * Busca merchant no banco de dados
   */
  private async searchMerchantInDB(description: string): Promise<CachedMerchant | null> {
    try {
      const { data: results } = await supabase
        .rpc('search_merchant', {
          p_description: description,
          p_user_location: this.userLocation,
          p_limit: 1
        }) as { data: any[] | null };

      if (results && results.length > 0) {
        const merchant = results[0];
        
        // Converte para CachedMerchant e armazena no cache
        const cachedMerchant: CachedMerchant = {
          id: merchant.id,
          merchant_key: merchant.merchant_key,
          entity_name: merchant.entity_name,
          category: merchant.category,
          subcategory: merchant.subcategory,
          aliases: [], // Será populado no próximo fetch se necessário
          confidence_modifier: merchant.confidence_modifier,
          priority: merchant.priority,
          entry_type: 'merchant'
        };

        this.cache.setMerchantByDescription(description, cachedMerchant);
        
        return cachedMerchant;
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar merchant no DB:', error);
      return null;
    }
  }

  /**
   * Busca padrão bancário no banco de dados
   */
  private async searchBankingPatternInDB(description: string): Promise<CachedMerchant | null> {
    try {
      const { data: results } = await supabase
        .rpc('search_banking_pattern', {
          p_description: description,
          p_context: null
        }) as { data: any[] | null };

      if (results && results.length > 0) {
        const pattern = results[0];
        
        const cachedPattern: CachedMerchant = {
          id: pattern.id,
          merchant_key: pattern.merchant_key,
          entity_name: pattern.merchant_key,
          category: pattern.category,
          subcategory: pattern.subcategory,
          aliases: [],
          confidence_modifier: pattern.confidence_modifier,
          priority: pattern.priority,
          entry_type: 'banking_pattern'
        };

        return cachedPattern;
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar padrão bancário no DB:', error);
      return null;
    }
  }

  /**
   * Busca por palavra-chave no banco de dados
   */
  private async searchKeywordInDB(description: string, type: 'income' | 'expense'): Promise<CachedMerchant | null> {
    try {
      const { data: results } = await supabase
        .rpc('search_by_keywords', {
          p_description: description,
          p_type: type
        }) as { data: any[] | null };

      if (results && results.length > 0) {
        const keyword = results[0];
        
        const cachedKeyword: CachedMerchant = {
          id: keyword.id,
          merchant_key: keyword.merchant_key,
          entity_name: keyword.merchant_key,
          category: keyword.category,
          subcategory: keyword.subcategory,
          aliases: [],
          confidence_modifier: keyword.confidence_modifier,
          priority: keyword.priority,
          entry_type: 'keyword'
        };

        return cachedKeyword;
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar palavra-chave no DB:', error);
      return null;
    }
  }

  /**
   * Busca merchant (com cache e fallback)
   */
  async findMerchant(description: string): Promise<{ 
    category: string; 
    subcategory?: string; 
    confidence: number;
    entity_name?: string;
    priority: number;
  } | null> {
    await this.ensureInitialized();

    const descLower = description.toLowerCase();

    // 1. Busca no cache
    let cached = this.cache.getMerchantByDescription(descLower);
    if (cached) {
      return {
        category: cached.category,
        subcategory: cached.subcategory,
        confidence: cached.confidence_modifier * 100,
        entity_name: cached.entity_name,
        priority: cached.priority
      };
    }

    // 2. Busca no banco de dados
    cached = await this.searchMerchantInDB(descLower);
    if (cached) {
      return {
        category: cached.category,
        subcategory: cached.subcategory,
        confidence: cached.confidence_modifier * 100,
        entity_name: cached.entity_name,
        priority: cached.priority
      };
    }

    // 3. Fallback para merchants essenciais
    for (const [key, merchant] of Object.entries(ESSENTIAL_MERCHANTS)) {
      if (descLower.includes(key)) {
        return {
          category: merchant.category,
          subcategory: merchant.subcategory,
          confidence: merchant.confidence_modifier * 100,
          entity_name: merchant.entity_name,
          priority: merchant.priority
        };
      }
    }

    return null;
  }

  /**
   * Busca padrão bancário
   */
  async findBankingPattern(description: string): Promise<{
    category: string;
    subcategory?: string;
    confidence: number;
    priority: number;
  } | null> {
    await this.ensureInitialized();

    const descLower = description.toLowerCase();

    // 1. Busca no cache
    const cachedPatterns = this.cache.getBankingPatterns(descLower);
    if (cachedPatterns && cachedPatterns.length > 0) {
      const pattern = cachedPatterns[0];
      return {
        category: pattern.category,
        subcategory: pattern.subcategory,
        confidence: pattern.confidence_modifier * 100,
        priority: pattern.priority
      };
    }

    // 2. Busca no banco de dados
    const pattern = await this.searchBankingPatternInDB(descLower);
    if (pattern) {
      return {
        category: pattern.category,
        subcategory: pattern.subcategory,
        confidence: pattern.confidence_modifier * 100,
        priority: pattern.priority
      };
    }

    return null;
  }

  /**
   * Busca por palavras-chave
   */
  async findByKeywords(description: string, type: 'income' | 'expense'): Promise<{
    category: string;
    subcategory?: string;
    confidence: number;
    priority: number;
  } | null> {
    await this.ensureInitialized();

    const keyword = await this.searchKeywordInDB(description, type);
    if (keyword) {
      return {
        category: keyword.category,
        subcategory: keyword.subcategory,
        confidence: keyword.confidence_modifier * 100,
        priority: keyword.priority
      };
    }

    return null;
  }

  /**
   * Categoriza transação (método principal)
   */
  categorize(description: string, type: 'income' | 'expense'): { 
    category: string; 
    subcategory?: string; 
    confidence: number; 
    entity_name?: string; 
    learned?: boolean; 
    method?: string 
  } {
    // Versão síncrona para compatibilidade - retorna default e busca assíncrono em background
    const defaultResult = {
      category: type === 'income' 
        ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)' 
        : 'Outros',
      confidence: 50,
      learned: false,
      method: 'default_fallback'
    };

    // Busca assíncrona em background (não bloqueia)
    this.categorizeAsync(description, type).then(result => {
      // Resultado será usado na próxima vez via cache
    });

    // Por enquanto retorna default (será melhorado via cache nas próximas chamadas)
    return defaultResult;
  }

  /**
   * Versão assíncrona da categorização (preferida)
   */
  async categorizeAsync(description: string, type: 'income' | 'expense'): Promise<{
    category: string;
    subcategory?: string;
    confidence: number;
    entity_name?: string;
    learned?: boolean;
    method?: string;
  }> {
    await this.ensureInitialized();

    const candidates: Array<{
      category: string;
      subcategory?: string;
      confidence: number;
      entity_name?: string;
      learned?: boolean;
      method: string;
      priority: number;
    }> = [];

    // 1. Padrões aprendidos
    const learnedMatch = this.learnedPatterns[description];
    if (learnedMatch && learnedMatch.confidence >= 75) {
      candidates.push({
        category: learnedMatch.category,
        subcategory: learnedMatch.subcategory,
        confidence: learnedMatch.confidence,
        learned: true,
        method: 'learned_pattern',
        priority: 100
      });
    }

    // 2. Merchants específicos
    const merchant = await this.findMerchant(description);
    if (merchant && merchant.confidence >= 60) {
      candidates.push({
        ...merchant,
        method: 'merchant_specific'
      });
    }

    // 3. Padrões bancários
    const bankingPattern = await this.findBankingPattern(description);
    if (bankingPattern && bankingPattern.confidence >= 70) {
      candidates.push({
        ...bankingPattern,
        method: 'banking_pattern'
      });
    }

    // 4. Palavras-chave
    const keywordPattern = await this.findByKeywords(description, type);
    if (keywordPattern && keywordPattern.confidence >= 50) {
      candidates.push({
        ...keywordPattern,
        method: 'keyword_match'
      });
    }

    // 5. Escolher a melhor opção
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        if (b.priority !== a.priority) return b.priority - a.priority;
          return (b.learned ? 1 : 0) - (a.learned ? 1 : 0);
      });

      const bestMatch = candidates[0];
      this.updateUsageStats(bestMatch.category);
      
      return {
        category: bestMatch.category,
        subcategory: bestMatch.subcategory,
        confidence: bestMatch.confidence,
        entity_name: bestMatch.entity_name,
        learned: bestMatch.learned,
        method: bestMatch.method
      };
    }

    // 6. Default fallback
    const defaultCategory = type === 'income'
      ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)'
      : 'Outros';
    
    this.updateUsageStats(defaultCategory);

    return {
      category: defaultCategory,
      confidence: 50,
      learned: false,
      method: 'default_fallback'
    };
  }

  /**
   * Aprende com correção do usuário - mantém apenas padrões locais em memória
   * A persistência é feita pelo IntelligentTransactionClassifier
   */
  async learnFromCorrection(description: string, category: string, subcategory?: string, confidence: number = 90): Promise<void> {
    await this.ensureInitialized();

    this.learnedPatterns[description] = {
      category,
      subcategory,
      confidence,
      count: (this.learnedPatterns[description]?.count || 0) + 1,
      last_seen: new Date().toISOString()
    };

    this.cache.clearSearchResults();
  }

  /**
   * Adiciona padrão aprendido ao dicionário local
   */
  addLearnedPattern(description: string, category: string, subcategory?: string, confidence: number = 90, timestamp: string = new Date().toISOString()): void {
    this.learnedPatterns[description] = {
      category,
      subcategory,
      confidence,
      count: (this.learnedPatterns[description]?.count || 0) + 1,
      last_seen: timestamp
    };
  }

  /**
   * Atualiza estatísticas de uso
   */
  private updateUsageStats(category: string): void {
    if (!this.usageStats[category]) {
      this.usageStats[category] = { count: 0, accuracy: 0 };
    }
    this.usageStats[category].count++;
  }

  /**
   * Retorna estatísticas
   */
  getStats(): any {
    return {
      learnedPatterns: Object.keys(this.learnedPatterns).length,
      usageStats: this.usageStats,
      cacheStats: this.cache.getStats(),
      isInitialized: this.isInitialized
    };
  }

  /**
   * Exporta dicionário (compatibilidade)
   */
  exportDictionary(): any {
    return {
      learnedPatterns: this.learnedPatterns,
      usageStats: this.usageStats
    };
  }

  /**
   * Importa dicionário (compatibilidade)
   */
  importDictionary(dictionary: any): void {
    if (dictionary.learnedPatterns) {
      this.learnedPatterns = dictionary.learnedPatterns;
    }
    if (dictionary.usageStats) {
      this.usageStats = dictionary.usageStats;
    }
  }

  /**
   * Define localização do usuário
   */
  setUserLocation(location: string): void {
    this.userLocation = location;
  }
}

