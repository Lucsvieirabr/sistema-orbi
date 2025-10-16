/**
 * ============================================================================
 * SISTEMA DE FEATURES/PERMISSÕES EXPANSIVO
 * ============================================================================
 * 
 * Este sistema permite:
 * 1. Registrar features de forma declarativa
 * 2. Associar features a rotas/componentes
 * 3. Verificar permissões em tempo de execução
 * 4. Gerenciar features dinamicamente no admin
 * 5. Escalar automaticamente quando novas telas/entidades são criadas
 */

export type FeatureCategory = 
  | 'core'           // Funcionalidades centrais
  | 'financial'      // Funcionalidades financeiras
  | 'analytics'      // Análises e relatórios
  | 'automation'     // Automações
  | 'integration'    // Integrações
  | 'collaboration'  // Colaboração
  | 'customization'  // Personalizações
  | 'support';       // Suporte

export interface Feature {
  key: string;                    // Identificador único (ex: 'accounts_create')
  label: string;                  // Nome amigável (ex: 'Criar Contas')
  description: string;            // Descrição detalhada
  category: FeatureCategory;      // Categoria da feature
  route?: string;                 // Rota associada (opcional)
  dependencies?: string[];        // Features que dependem desta (opcional)
  isCore?: boolean;               // Se true, não pode ser desativada
  metadata?: Record<string, any>; // Dados extras
}

export interface FeatureLimit {
  key: string;                    // Identificador único (ex: 'max_accounts')
  label: string;                  // Nome amigável (ex: 'Máximo de Contas')
  description: string;            // Descrição
  category: FeatureCategory;      // Categoria
  defaultValue: number;           // Valor padrão
  minValue?: number;              // Valor mínimo permitido
  maxValue?: number;              // Valor máximo permitido
  unit?: string;                  // Unidade de medida (ex: 'contas', 'MB', 'dias')
}

/**
 * Classe que gerencia o registro de features
 */
class FeatureRegistry {
  private features: Map<string, Feature> = new Map();
  private limits: Map<string, FeatureLimit> = new Map();

  /**
   * Registra uma nova feature
   */
  registerFeature(feature: Feature): void {
    if (this.features.has(feature.key)) {
      console.warn(`Feature "${feature.key}" já está registrada. Sobrescrevendo.`);
    }
    this.features.set(feature.key, feature);
  }

  /**
   * Registra múltiplas features de uma vez
   */
  registerFeatures(features: Feature[]): void {
    features.forEach(feature => this.registerFeature(feature));
  }

  /**
   * Registra um novo limite
   */
  registerLimit(limit: FeatureLimit): void {
    if (this.limits.has(limit.key)) {
      console.warn(`Limit "${limit.key}" já está registrado. Sobrescrevendo.`);
    }
    this.limits.set(limit.key, limit);
  }

  /**
   * Registra múltiplos limites de uma vez
   */
  registerLimits(limits: FeatureLimit[]): void {
    limits.forEach(limit => this.registerLimit(limit));
  }

  /**
   * Obtém uma feature pelo key
   */
  getFeature(key: string): Feature | undefined {
    return this.features.get(key);
  }

  /**
   * Obtém um limite pelo key
   */
  getLimit(key: string): FeatureLimit | undefined {
    return this.limits.get(key);
  }

  /**
   * Obtém todas as features
   */
  getAllFeatures(): Feature[] {
    return Array.from(this.features.values());
  }

  /**
   * Obtém todas as features por categoria
   */
  getFeaturesByCategory(category: FeatureCategory): Feature[] {
    return this.getAllFeatures().filter(f => f.category === category);
  }

  /**
   * Obtém todos os limites
   */
  getAllLimits(): FeatureLimit[] {
    return Array.from(this.limits.values());
  }

  /**
   * Obtém todos os limites por categoria
   */
  getLimitsByCategory(category: FeatureCategory): FeatureLimit[] {
    return this.getAllLimits().filter(l => l.category === category);
  }

  /**
   * Verifica se uma feature está registrada
   */
  hasFeature(key: string): boolean {
    return this.features.has(key);
  }

  /**
   * Verifica se um limite está registrado
   */
  hasLimit(key: string): boolean {
    return this.limits.has(key);
  }

  /**
   * Remove uma feature
   */
  unregisterFeature(key: string): boolean {
    return this.features.delete(key);
  }

  /**
   * Remove um limite
   */
  unregisterLimit(key: string): boolean {
    return this.limits.delete(key);
  }

  /**
   * Limpa todos os registros (útil para testes)
   */
  clear(): void {
    this.features.clear();
    this.limits.clear();
  }

  /**
   * Exporta configuração para o formato usado pelo backend
   */
  exportForPlanDialog(): {
    features: Array<{ key: string; label: string; description: string; category: string }>;
    limits: Array<{ key: string; label: string; description: string; defaultValue: number; unit?: string }>;
  } {
    return {
      features: this.getAllFeatures().map(f => ({
        key: f.key,
        label: f.label,
        description: f.description,
        category: f.category,
      })),
      limits: this.getAllLimits().map(l => ({
        key: l.key,
        label: l.label,
        description: l.description,
        defaultValue: l.defaultValue,
        unit: l.unit,
      })),
    };
  }
}

// Instância singleton do registry
export const featureRegistry = new FeatureRegistry();

/**
 * Helper para criar feature de forma mais concisa
 */
export function defineFeature(
  key: string,
  label: string,
  description: string,
  category: FeatureCategory,
  options?: Partial<Omit<Feature, 'key' | 'label' | 'description' | 'category'>>
): Feature {
  return {
    key,
    label,
    description,
    category,
    ...options,
  };
}

/**
 * Helper para criar limite de forma mais concisa
 */
export function defineLimit(
  key: string,
  label: string,
  description: string,
  category: FeatureCategory,
  defaultValue: number,
  options?: Partial<Omit<FeatureLimit, 'key' | 'label' | 'description' | 'category' | 'defaultValue'>>
): FeatureLimit {
  return {
    key,
    label,
    description,
    category,
    defaultValue,
    ...options,
  };
}

