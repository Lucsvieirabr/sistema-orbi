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
import { Lock, TrendingUp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

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
              onClick={() => navigate('/pricing')}
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
  showUpgradeMessage = true
}: LimitGuardProps) {
  const { canUse, limit: maxLimit, remaining, isUnlimited } = useLimit(limit, currentValue);
  const navigate = useNavigate();

  if (!canUse) {
    if (showUpgradeMessage) {
      return (
        <Alert variant="destructive" className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
          <Lock className="h-4 w-4" />
          <AlertTitle>Limite Atingido</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Você atingiu o limite de <strong>{maxLimit}</strong> permitido no seu plano.
            </p>
            <Button 
              size="sm" 
              variant="default"
              onClick={() => navigate('/pricing')}
              className="mt-2"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Fazer Upgrade
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    return <>{fallback || null}</>;
  }

  // Mostrar aviso quando estiver perto do limite (80%)
  const isNearLimit = !isUnlimited && remaining <= maxLimit * 0.2;
  
  if (isNearLimit && showUpgradeMessage) {
    return (
      <div className="space-y-4">
        <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              ⚠️ Restam <strong>{remaining}</strong> de <strong>{maxLimit}</strong> disponíveis
            </span>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => navigate('/pricing')}
            >
              Fazer Upgrade
            </Button>
          </AlertDescription>
        </Alert>
        {children}
      </div>
    );
  }

  return <>{children}</>;
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
        <Card className="max-w-2xl w-full border-primary/20 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl">
              {featureInfo?.label || 'Feature Premium'}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {featureInfo?.description || 'Esta funcionalidade não está disponível no seu plano'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Benefícios ao fazer upgrade:
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                <li>✓ Acesso completo a esta funcionalidade</li>
                <li>✓ Recursos avançados de análise</li>
                <li>✓ Suporte prioritário</li>
                <li>✓ Atualizações e melhorias contínuas</li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => navigate(-1)}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button 
                onClick={() => navigate('/pricing')}
                className="flex-1"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Ver Planos e Preços
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

