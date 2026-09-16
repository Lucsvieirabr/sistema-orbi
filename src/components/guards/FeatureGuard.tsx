/**
 * ============================================================================
 * COMPONENT: FeatureGuard
 * ============================================================================
 * 
 * Componente para proteger partes da UI baseado em features
 */

import { ReactNode } from 'react';
import { useFeature, useLimit } from '@/hooks/use-feature';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, Lock, TrendingUp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { UPGRADE_PATH } from '@/lib/features/premium-modules';

interface FeatureGuardProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradeMessage?: boolean;
  loadingFallback?: ReactNode;
}

/**
 * Guard que mostra conteúdo apenas se o usuário tiver a feature
 * 
 * @example
 * <FeatureGuard feature="accounts_create">
 *   <Button>Criar Conta</Button>
 * </FeatureGuard>
 */
export function FeatureGuard({ 
  feature, 
  children, 
  fallback,
  showUpgradeMessage = false,
  loadingFallback
}: FeatureGuardProps) {
  const { hasFeature, isLoading, feature: featureInfo } = useFeature(feature);
  const navigate = useNavigate();

  if (isLoading) {
    return <>{loadingFallback || null}</>;
  }

  if (!hasFeature) {
    if (showUpgradeMessage && featureInfo) {
      return (
        <Alert className="border-primary/50 bg-primary/5">
          <Lock className="h-4 w-4" />
          <AlertTitle>Feature Premium</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              <strong>{featureInfo.label}</strong> não está disponível no seu plano atual.
            </p>
            <p className="text-sm text-muted-foreground">
              {featureInfo.description}
            </p>
            <Button 
              size="sm" 
              onClick={() => navigate(UPGRADE_PATH)}
              className="mt-2"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Ver Planos
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    return <>{fallback || null}</>;
  }

  return <>{children}</>;
}

interface LimitGuardProps {
  limit: string;
  currentValue: number;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradeMessage?: boolean;
}

/**
 * Guard que mostra conteúdo apenas se não atingiu o limite
 * 
 * @example
 * <LimitGuard limit="max_accounts" currentValue={accountsCount}>
 *   <Button>Adicionar Conta</Button>
 * </LimitGuard>
 */
export function LimitGuard({ 
  limit, 
  currentValue, 
  children, 
  fallback,
  showUpgradeMessage = false // Mudado para false por padrão para não quebrar layout
}: LimitGuardProps) {
  const { canUse } = useLimit(limit, currentValue);

  // Se não pode usar, simplesmente não mostra o componente
  if (!canUse) {
    return <>{fallback || null}</>;
  }

  // Se pode usar, mostra o conteúdo normalmente
  return <>{children}</>;
}

/**
 * Banner de aviso de limite que fica fixo no topo da página
 * Use este componente no topo da página para mostrar avisos de limites
 */
interface LimitWarningBannerProps {
  limit: string;
  currentValue: number;
  resourceName?: string; // Nome do recurso para mensagem personalizada
}

export function LimitWarningBanner({ limit, currentValue, resourceName }: LimitWarningBannerProps) {
  const { canUse, limit: maxLimit, remaining, isUnlimited } = useLimit(limit, currentValue);
  const navigate = useNavigate();

  // Não mostra nada se for ilimitado
  if (isUnlimited) {
    return null;
  }

  // Limite atingido
  if (!canUse) {
    return (
      <Alert variant="destructive" className="mb-4">
        <Lock className="h-4 w-4" />
        <AlertTitle>Limite Atingido</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <span>
            Você atingiu o limite de <strong>{maxLimit} {resourceName || 'itens'}</strong> do seu plano.
          </span>
          <Button 
            size="sm" 
            variant="default"
            onClick={() => navigate(UPGRADE_PATH)}
            className="w-full lg:w-auto flex-shrink-0"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Fazer Upgrade
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Próximo do limite (80%)
  const isNearLimit = remaining <= maxLimit * 0.2;
  
  if (isNearLimit) {
    return (
      <Alert variant="warning" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <span className="text-sm">
            Restam <strong className="tabular font-semibold">{remaining}</strong> de{' '}
            <strong className="tabular font-semibold">{maxLimit}</strong> {resourceName || 'itens'} no seu plano.
          </span>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate(UPGRADE_PATH)}
            className="w-full lg:w-auto flex-shrink-0"
          >
            Fazer Upgrade
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

interface FeaturePageGuardProps {
  feature: string;
  children: ReactNode;
}

/**
 * Guard para páginas inteiras - mostra página de upgrade se não tiver feature
 * 
 * @example
 * <FeaturePageGuard feature="reports_advanced">
 *   <AdvancedReportsPage />
 * </FeaturePageGuard>
 */
export function FeaturePageGuard({ feature, children }: FeaturePageGuardProps) {
  const { hasFeature, isLoading, feature: featureInfo } = useFeature(feature);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 space-y-4">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasFeature) {
    return (
      <div className="container mx-auto p-8 flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Card variant="elevated" className="w-full max-w-xl animate-rise">
          <CardHeader className="gap-0 space-y-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-sunken">
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
            <p className="label-eyebrow mt-5">Disponível em outro plano</p>
            <CardTitle className="mt-2 text-2xl">
              {featureInfo?.label || 'Recurso premium'}
            </CardTitle>
            <CardDescription className="mt-2">
              {featureInfo?.description || 'Esta funcionalidade não está disponível no seu plano.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="border-t border-border-subtle pt-5">
              <p className="label-eyebrow flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" aria-hidden />
                O que o upgrade libera
              </p>
              <ul className="mt-3 space-y-2">
                {[
                  'Acesso completo a esta funcionalidade',
                  'Recursos avançados de análise',
                  'Suporte prioritário',
                  'Atualizações e melhorias contínuas',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button onClick={() => navigate(UPGRADE_PATH)} className="sm:flex-1">
                <TrendingUp className="h-4 w-4" />
                Ver planos
              </Button>
              <Button variant="ghost" onClick={() => navigate(-1)} className="sm:flex-1">
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

