/**
 * Sistema de Cache LRU Inteligente para Merchants
 * 
 * Implementa cache em memória com estratégia LRU (Least Recently Used)
 * para otimizar performance das buscas no banco de dados.
 * 
 * Features:
 * - LRU eviction policy
 * - TTL (Time To Live) configurável
 * - Pré-carregamento de merchants frequentes
 * - Estatísticas de hit/miss
 * - Invalidação seletiva
 */

export interface CachedMerchant {
  id: string;
  merchant_key: string;
  entity_name: string;
  category: string;
  subcategory?: string;
  aliases: string[];
  confidence_modifier: number;
  priority: number;
  entry_type: 'merchant' | 'banking_pattern' | 'keyword' | 'utility';
  states?: string[];
  context?: string;
  metadata?: any;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  avgHitsPerEntry: number;
}

/**
 * Cache LRU genérico
 */
export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private maxSize: number;
  private ttl: number; // em milissegundos
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(maxSize: number = 500, ttl: number = 24 * 60 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Busca valor no cache
   */
  get(key: K): V | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Verifica se expirou
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Move para o final (mais recente)
    this.cache.delete(key);
    entry.hits++;
    entry.timestamp = now;
    this.cache.set(key, entry);
    
    this.hits++;
    return entry.value;
  }

  /**
   * Insere valor no cache
   */
  set(key: K, value: V): void {
    // Remove se já existe
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Se atingiu o limite, remove o mais antigo (primeiro da Map)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.evictions++;
    }

    // Adiciona novo entry
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * Remove valor do cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Verifica se existe no cache
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Verifica se expirou
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Retorna estatísticas do cache
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    
    let totalHits = 0;
    let entries = 0;
    this.cache.forEach(entry => {
      totalHits += entry.hits;
      entries++;
    });
    const avgHitsPerEntry = entries > 0 ? totalHits / entries : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      evictions: this.evictions,
      avgHitsPerEntry
    };
  }

  /**
   * Retorna todos os valores do cache
   */
  getAll(): V[] {
    const values: V[] = [];
    const now = Date.now();
    
    this.cache.forEach((entry, key) => {
      // Remove expirados
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      } else {
        values.push(entry.value);
      }
    });
    
    return values;
  }

  /**
   * Retorna tamanho do cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Define novo TTL
   */
  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  /**
   * Define novo tamanho máximo
   */
  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize;
    
    // Remove entradas antigas se necessário
    while (this.cache.size > maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.evictions++;
    }
  }
}

/**
 * Cache especializado para Merchants
 */
export class MerchantCache {
  // Cache principal por merchant_key
  private merchantKeyCache: LRUCache<string, CachedMerchant>;
  
  // Cache por descrição (para buscas exatas)
  private descriptionCache: LRUCache<string, CachedMerchant>;
  
  // Cache de resultados de busca (para queries complexas)
  private searchResultsCache: LRUCache<string, CachedMerchant[]>;
  
  // Cache de patterns bancários por contexto
  private bankingPatternCache: LRUCache<string, CachedMerchant[]>;

  constructor() {
    this.merchantKeyCache = new LRUCache<string, CachedMerchant>(500, 24 * 60 * 60 * 1000); // 24h
    this.descriptionCache = new LRUCache<string, CachedMerchant>(1000, 24 * 60 * 60 * 1000); // 24h
    this.searchResultsCache = new LRUCache<string, CachedMerchant[]>(200, 1 * 60 * 60 * 1000); // 1h
    this.bankingPatternCache = new LRUCache<string, CachedMerchant[]>(50, 24 * 60 * 60 * 1000); // 24h
  }

  /**
   * Busca merchant por chave
   */
  getMerchantByKey(key: string): CachedMerchant | null {
    return this.merchantKeyCache.get(key.toLowerCase());
  }

  /**
   * Armazena merchant por chave
   */
  setMerchantByKey(key: string, merchant: CachedMerchant): void {
    this.merchantKeyCache.set(key.toLowerCase(), merchant);
    
    // Também armazena pelos aliases
    merchant.aliases?.forEach(alias => {
      this.merchantKeyCache.set(alias.toLowerCase(), merchant);
    });
  }

  /**
   * Busca por descrição exata
   */
  getMerchantByDescription(description: string): CachedMerchant | null {
    return this.descriptionCache.get(description.toLowerCase());
  }

  /**
   * Armazena resultado de busca por descrição
   */
  setMerchantByDescription(description: string, merchant: CachedMerchant): void {
    this.descriptionCache.set(description.toLowerCase(), merchant);
  }

  /**
   * Busca resultados de search query
   */
  getSearchResults(query: string): CachedMerchant[] | null {
    return this.searchResultsCache.get(query.toLowerCase());
  }

  /**
   * Armazena resultados de search query
   */
  setSearchResults(query: string, results: CachedMerchant[]): void {
    this.searchResultsCache.set(query.toLowerCase(), results);
  }

  /**
   * Busca padrões bancários por contexto
   */
  getBankingPatterns(context: string): CachedMerchant[] | null {
    return this.bankingPatternCache.get(context.toLowerCase());
  }

  /**
   * Armazena padrões bancários por contexto
   */
  setBankingPatterns(context: string, patterns: CachedMerchant[]): void {
    this.bankingPatternCache.set(context.toLowerCase(), patterns);
  }

  /**
   * Pré-carrega merchants frequentes no cache
   */
  preloadMerchants(merchants: CachedMerchant[]): void {
    merchants.forEach(merchant => {
      this.setMerchantByKey(merchant.merchant_key, merchant);
    });
  }

  /**
   * Limpa todo o cache
   */
  clearAll(): void {
    this.merchantKeyCache.clear();
    this.descriptionCache.clear();
    this.searchResultsCache.clear();
    this.bankingPatternCache.clear();
  }

  /**
   * Limpa apenas cache de resultados de busca
   */
  clearSearchResults(): void {
    this.searchResultsCache.clear();
  }

  /**
   * Invalida merchant específico
   */
  invalidateMerchant(merchantKey: string): void {
    this.merchantKeyCache.delete(merchantKey.toLowerCase());
    
    // Também invalida resultados de busca (podem conter este merchant)
    this.clearSearchResults();
  }

  /**
   * Retorna estatísticas consolidadas
   */
  getStats(): {
    merchantKey: CacheStats;
    description: CacheStats;
    searchResults: CacheStats;
    bankingPattern: CacheStats;
    totalSize: number;
    totalHitRate: number;
  } {
    const merchantKeyStats = this.merchantKeyCache.getStats();
    const descriptionStats = this.descriptionCache.getStats();
    const searchResultsStats = this.searchResultsCache.getStats();
    const bankingPatternStats = this.bankingPatternCache.getStats();

    const totalSize = 
      merchantKeyStats.size + 
      descriptionStats.size + 
      searchResultsStats.size + 
      bankingPatternStats.size;

    const totalHits = 
      merchantKeyStats.hits + 
      descriptionStats.hits + 
      searchResultsStats.hits + 
      bankingPatternStats.hits;

    const totalRequests = 
      totalHits + 
      merchantKeyStats.misses + 
      descriptionStats.misses + 
      searchResultsStats.misses + 
      bankingPatternStats.misses;

    const totalHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    return {
      merchantKey: merchantKeyStats,
      description: descriptionStats,
      searchResults: searchResultsStats,
      bankingPattern: bankingPatternStats,
      totalSize,
      totalHitRate
    };
  }

  /**
   * Otimiza cache removendo entradas menos usadas
   */
  optimize(): void {
    // Por enquanto, apenas limpa os caches de menor prioridade
    this.searchResultsCache.clear();
  }

  /**
   * Retorna todos os merchants do cache (para debug)
   */
  getAllMerchants(): CachedMerchant[] {
    return this.merchantKeyCache.getAll();
  }
}

/**
 * Singleton global do cache
 */
let globalMerchantCache: MerchantCache | null = null;

export function getMerchantCache(): MerchantCache {
  if (!globalMerchantCache) {
    globalMerchantCache = new MerchantCache();
  }
  return globalMerchantCache;
}

export function resetMerchantCache(): void {
  globalMerchantCache = null;
}

