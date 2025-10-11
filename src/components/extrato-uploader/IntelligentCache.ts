/**
 * Sistema de Cache Inteligente para Classificação de Transações
 *
 * Implementa cache LRU (Least Recently Used) com invalidação inteligente
 * para otimizar performance de consultas frequentes.
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  expiresAt?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

export class IntelligentCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private accessOrder: K[] = [];
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds
  private stats: CacheStats;

  constructor(maxSize: number = 1000, ttl: number = 300000) { // 5 minutos default
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize,
      hitRate: 0
    };
  }

  /**
   * Obtém valor do cache
   */
  get(key: K): V | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Verifica se expirou
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Atualiza estatísticas de acesso
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Move para o final da ordem de acesso (LRU)
    this.updateAccessOrder(key);

    this.stats.hits++;
    this.updateHitRate();

    return entry.value;
  }

  /**
   * Define valor no cache
   */
  set(key: K, value: V, customTTL?: number): void {
    const now = Date.now();
    const entry: CacheEntry<V> = {
      value,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      expiresAt: customTTL ? now + customTTL : now + this.ttl
    };

    // Se cache cheio, remove LRU
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.stats.size = this.cache.size;
  }

  /**
   * Remove entrada do cache
   */
  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      // Remove da ordem de acesso
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Verifica se entrada expirou
   */
  private isExpired(entry: CacheEntry<V>): boolean {
    return entry.expiresAt ? Date.now() > entry.expiresAt : false;
  }

  /**
   * Remove entrada menos recentemente usada (LRU)
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder[0];
    this.delete(lruKey);
    this.stats.evictions++;
  }

  /**
   * Atualiza ordem de acesso (LRU)
   */
  private updateAccessOrder(key: K): void {
    // Remove da posição atual
    const currentIndex = this.accessOrder.indexOf(key);
    if (currentIndex > -1) {
      this.accessOrder.splice(currentIndex, 1);
    }

    // Adiciona no final (mais recentemente usado)
    this.accessOrder.push(key);
  }

  /**
   * Atualiza taxa de acerto
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Limpa cache completamente
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize: this.maxSize,
      hitRate: 0
    };
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Redimensiona cache
   */
  resize(newMaxSize: number): void {
    this.maxSize = newMaxSize;

    // Remove entradas excedentes se necessário
    while (this.cache.size > this.maxSize) {
      this.evictLRU();
    }

    this.stats.maxSize = newMaxSize;
  }

  /**
   * Define TTL padrão
   */
  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  /**
   * Remove entradas expiradas
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Obtém chaves mais frequentemente acessadas
   */
  getMostAccessedKeys(limit: number = 10): Array<{ key: K; accessCount: number }> {
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, accessCount: entry.accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  /**
   * Obtém chaves menos frequentemente acessadas
   */
  getLeastAccessedKeys(limit: number = 10): Array<{ key: K; accessCount: number }> {
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, accessCount: entry.accessCount }))
      .sort((a, b) => a.accessCount - b.accessCount)
      .slice(0, limit);
  }
}

/**
 * Cache Especializado para Padrões de Transações
 */
export class TransactionPatternCache {
  private patternCache: IntelligentCache<string, any>;
  private merchantCache: IntelligentCache<string, any>;
  private categoryCache: IntelligentCache<string, any[]>;

  constructor() {
    // Cache para padrões individuais (5 minutos TTL)
    this.patternCache = new IntelligentCache<string, any>(2000, 300000);

    // Cache para estabelecimentos (10 minutos TTL)
    this.merchantCache = new IntelligentCache<string, any>(1500, 600000);

    // Cache para listas de categorias (15 minutos TTL)
    this.categoryCache = new IntelligentCache<string, any[]>(1000, 900000);
  }

  /**
   * Cache para resultados de classificação de padrões
   */
  getCachedPattern(description: string): any | null {
    const normalized = description.toLowerCase().trim();
    return this.patternCache.get(normalized);
  }

  setCachedPattern(description: string, result: any): void {
    const normalized = description.toLowerCase().trim();
    this.patternCache.set(normalized, result);
  }

  /**
   * Cache para estabelecimentos
   */
  getCachedMerchant(description: string): any | null {
    const normalized = description.toLowerCase().trim();
    return this.merchantCache.get(normalized);
  }

  setCachedMerchant(description: string, result: any): void {
    const normalized = description.toLowerCase().trim();
    this.merchantCache.set(normalized, result);
  }

  /**
   * Cache para listas de categorias
   */
  getCachedCategoryPatterns(category: string): any[] | null {
    return this.categoryCache.get(category);
  }

  setCachedCategoryPatterns(category: string, patterns: any[]): void {
    this.categoryCache.set(category, patterns);
  }

  /**
   * Obtém estatísticas de todos os caches
   */
  getAllStats(): {
    pattern: CacheStats;
    merchant: CacheStats;
    category: CacheStats;
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
  } {
    const patternStats = this.patternCache.getStats();
    const merchantStats = this.merchantCache.getStats();
    const categoryStats = this.categoryCache.getStats();

    const totalHits = patternStats.hits + merchantStats.hits + categoryStats.hits;
    const totalMisses = patternStats.misses + merchantStats.misses + categoryStats.misses;
    const totalRequests = totalHits + totalMisses;

    return {
      pattern: patternStats,
      merchant: merchantStats,
      category: categoryStats,
      totalHits,
      totalMisses,
      overallHitRate: totalRequests > 0 ? totalHits / totalRequests : 0
    };
  }

  /**
   * Limpa todos os caches
   */
  clearAll(): void {
    this.patternCache.clear();
    this.merchantCache.clear();
    this.categoryCache.clear();
  }

  /**
   * Limpeza automática de entradas expiradas
   */
  cleanup(): number {
    return this.patternCache.cleanup() +
           this.merchantCache.cleanup() +
           this.categoryCache.cleanup();
  }

  /**
   * Otimiza cache baseado em padrões de uso
   */
  optimize(): void {
    const stats = this.getAllStats();

    // Se taxa de acerto baixa, aumenta tamanho do cache
    if (stats.overallHitRate < 0.7) {
      this.patternCache.resize(Math.min(this.patternCache.getStats().maxSize * 1.5, 5000));
      this.merchantCache.resize(Math.min(this.merchantCache.getStats().maxSize * 1.5, 3000));
    }

    // Se taxa de acerto alta, pode reduzir tamanho
    if (stats.overallHitRate > 0.9) {
      this.patternCache.resize(Math.max(this.patternCache.getStats().maxSize * 0.8, 1000));
      this.merchantCache.resize(Math.max(this.merchantCache.getStats().maxSize * 0.8, 800));
    }
  }
}

/**
 * Gerenciador de Cache Global para o Sistema
 */
export class GlobalCacheManager {
  private static instance: GlobalCacheManager;
  private patternCache: TransactionPatternCache;
  private cleanupInterval?: NodeJS.Timeout;

  private constructor() {
    this.patternCache = new TransactionPatternCache();

    // Configura limpeza automática a cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.performMaintenance();
    }, 300000);
  }

  static getInstance(): GlobalCacheManager {
    if (!GlobalCacheManager.instance) {
      GlobalCacheManager.instance = new GlobalCacheManager();
    }
    return GlobalCacheManager.instance;
  }

  /**
   * Obtém cache de padrões
   */
  getPatternCache(): TransactionPatternCache {
    return this.patternCache;
  }

  /**
   * Executa manutenção automática
   */
  private performMaintenance(): void {
    const cleaned = this.patternCache.cleanup();

    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: ${cleaned} entradas expiradas removidas`);
    }

    // Otimiza cache baseado em padrões de uso
    this.patternCache.optimize();

    // Log estatísticas se necessário
    const stats = this.patternCache.getAllStats();
    if (stats.totalHits + stats.totalMisses > 1000) { // Log a cada 1000 operações
      console.log(`📊 Cache Stats - Hit Rate: ${(stats.overallHitRate * 100).toFixed(1)}%, Size: ${stats.pattern.size + stats.merchant.size + stats.category.size}`);
    }
  }

  /**
   * Para limpeza automática
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}
