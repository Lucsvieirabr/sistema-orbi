/**
 * ============================================================================
 * HOOK: useFeature
 * ============================================================================
 * 
 * Hook para verificar se o usuário tem acesso a uma feature específica
 */

import { useSubscription } from './use-subscription';
import { featureRegistry } from '@/lib/features/feature-registry';

export interface FeatureCheckResult {
  hasFeature: boolean;
  isLoading: boolean;
  feature?: {
    key: string;
    label: string;
    description: string;
  };
}

/**
 * Verifica se o usuário tem acesso a uma feature
 * 
 * @param featureKey - Chave da feature a verificar (ex: 'accounts_create')
 * @returns Objeto com resultado da verificação
 * 
 * @example
 * const { hasFeature, isLoading } = useFeature('accounts_create');
 * if (hasFeature) {
 *   // Mostrar botão de criar conta
 * }
 */
export function useFeature(featureKey: string): FeatureCheckResult {
  const { subscription, isLoading } = useSubscription();
  
  // Buscar a feature no registry
  const feature = featureRegistry.getFeature(featureKey);
  
  if (!feature) {
    console.warn(`Feature "${featureKey}" não encontrada no registry. Registre-a em orbi-features.ts`);
    return {
      hasFeature: false,
      isLoading: false,
    };
  }

  // Se ainda está carregando a subscription
  if (isLoading) {
    return {
      hasFeature: false,
      isLoading: true,
      feature: {
        key: feature.key,
        label: feature.label,
        description: feature.description,
      },
    };
  }

  // Se não tem subscription ativa, não tem acesso
  if (!subscription) {
    return {
      hasFeature: false,
      isLoading: false,
      feature: {
        key: feature.key,
        label: feature.label,
        description: feature.description,
      },
    };
  }

  // Verificar se o plano tem a feature habilitada
  const planFeatures = subscription.subscription_plans.features || {};
  const hasFeature = planFeatures[featureKey] === true;

  return {
    hasFeature,
    isLoading: false,
    feature: {
      key: feature.key,
      label: feature.label,
      description: feature.description,
    },
  };
}

/**
 * Verifica múltiplas features de uma vez
 * 
 * @param featureKeys - Array de chaves de features
 * @returns Map com resultado de cada feature
 * 
 * @example
 * const features = useFeatures(['accounts_create', 'accounts_edit', 'accounts_delete']);
 * if (features.accounts_create.hasFeature) {
 *   // Pode criar
 * }
 */
export function useFeatures(featureKeys: string[]): Record<string, FeatureCheckResult> {
  const { subscription, isLoading } = useSubscription();
  
  const results: Record<string, FeatureCheckResult> = {};
  
  featureKeys.forEach(featureKey => {
    const feature = featureRegistry.getFeature(featureKey);
    
    if (!feature) {
      console.warn(`Feature "${featureKey}" não encontrada no registry`);
      results[featureKey] = {
        hasFeature: false,
        isLoading: false,
      };
      return;
    }

    if (isLoading) {
      results[featureKey] = {
        hasFeature: false,
        isLoading: true,
        feature: {
          key: feature.key,
          label: feature.label,
          description: feature.description,
        },
      };
      return;
    }

    if (!subscription) {
      results[featureKey] = {
        hasFeature: false,
        isLoading: false,
        feature: {
          key: feature.key,
          label: feature.label,
          description: feature.description,
        },
      };
      return;
    }

    const planFeatures = subscription.subscription_plans.features || {};
    const hasFeature = planFeatures[featureKey] === true;

    results[featureKey] = {
      hasFeature,
      isLoading: false,
      feature: {
        key: feature.key,
        label: feature.label,
        description: feature.description,
      },
    };
  });

  return results;
}

/**
 * Verifica se o usuário atingiu um limite
 * 
 * @param limitKey - Chave do limite (ex: 'max_accounts')
 * @param currentValue - Valor atual do recurso
 * @returns true se pode continuar, false se atingiu o limite
 * 
 * @example
 * const canAddAccount = useLimit('max_accounts', currentAccountsCount);
 * if (!canAddAccount) {
 *   // Mostrar mensagem de upgrade
 * }
 */
export function useLimit(limitKey: string, currentValue: number): {
  canUse: boolean;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  isLoading: boolean;
} {
  const { subscription, isLoading } = useSubscription();
  
  const limitDef = featureRegistry.getLimit(limitKey);
  
  if (!limitDef) {
    console.warn(`Limite "${limitKey}" não encontrado no registry`);
    return {
      canUse: false,
      limit: 0,
      remaining: 0,
      isUnlimited: false,
      isLoading: false,
    };
  }

  if (isLoading) {
    return {
      canUse: false,
      limit: limitDef.defaultValue,
      remaining: 0,
      isUnlimited: false,
      isLoading: true,
    };
  }

  if (!subscription) {
    return {
      canUse: false,
      limit: limitDef.defaultValue,
      remaining: 0,
      isUnlimited: false,
      isLoading: false,
    };
  }

  const planLimits = subscription.subscription_plans.limits || {};
  const limit = planLimits[limitKey] ?? limitDef.defaultValue;

  // -1 significa ilimitado
  const isUnlimited = limit === -1;
  const canUse = isUnlimited || currentValue < limit;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - currentValue);

  return {
    canUse,
    limit,
    remaining,
    isUnlimited,
    isLoading: false,
  };
}

/**
 * Verifica se todas as features passadas estão disponíveis
 * 
 * @param featureKeys - Array de chaves de features
 * @returns true se todas estão disponíveis
 */
export function useHasAllFeatures(featureKeys: string[]): boolean {
  const features = useFeatures(featureKeys);
  return Object.values(features).every(f => f.hasFeature);
}

/**
 * Verifica se pelo menos uma das features está disponível
 * 
 * @param featureKeys - Array de chaves de features
 * @returns true se pelo menos uma está disponível
 */
export function useHasAnyFeature(featureKeys: string[]): boolean {
  const features = useFeatures(featureKeys);
  return Object.values(features).some(f => f.hasFeature);
}

