import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Tipos para Subscription
export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired';
  billing_cycle: 'monthly' | 'yearly';
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  subscription_plans: SubscriptionPlan;
}

/**
 * Hook para gerenciar a assinatura do usuário atual
 */
export function useSubscription() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar assinatura do usuário
  const { data: subscription, isLoading, error } = useQuery<UserSubscription | null>({
    queryKey: ['user-subscription'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('user_id', user.id)
        .single();

      if (error) {
        // Se não encontrar assinatura, retornar null (não é erro)
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data as unknown as UserSubscription;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Verificar se usuário tem uma feature específica
  const hasFeature = (featureKey: string): boolean => {
    if (!subscription?.subscription_plans) return false;
    return subscription.subscription_plans.features[featureKey] === true;
  };

  // Verificar se usuário está dentro do limite
  const checkLimit = (limitKey: string, currentCount: number): boolean => {
    if (!subscription?.subscription_plans) return false;
    
    const limit = subscription.subscription_plans.limits[limitKey];
    
    // Se limit = -1, é ilimitado
    if (limit === -1) return true;
    
    // Verificar se está dentro do limite
    return currentCount < limit;
  };

  // Obter valor do limite
  const getLimit = (limitKey: string): number => {
    if (!subscription?.subscription_plans) return 0;
    return subscription.subscription_plans.limits[limitKey] || 0;
  };

  // Verificar tipo de plano
  const isPlan = (planSlug: string): boolean => {
    return subscription?.subscription_plans?.slug === planSlug;
  };

  // Shortcuts para verificações comuns
  const isFree = isPlan('free');
  const isPro = isPlan('pro');
  const isPremium = isPlan('premium');
  const isTrial = subscription?.status === 'trial';
  const isActive = subscription?.status === 'active';
  const isExpired = subscription?.status === 'expired';
  const isPastDue = subscription?.status === 'past_due';
  
  // Verificar se usuário tem um plano ativo (trial ou active)
  const hasActivePlan = subscription?.status === 'active' || subscription?.status === 'trial';
  
  // Verificar se usuário tem algum plano (mesmo que expirado)
  const hasAnyPlan = !!subscription;

  // Dias restantes do trial
  const trialDaysRemaining = (): number => {
    if (!subscription?.trial_end) return 0;
    
    const trialEnd = new Date(subscription.trial_end);
    const today = new Date();
    const diffTime = trialEnd.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  };

  // Mutation para upgrade/downgrade de plano
  const changePlanMutation = useMutation({
    mutationFn: async ({ planId, billingCycle }: { planId: string; billingCycle: 'monthly' | 'yearly' }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('user_subscriptions')
        .update({
          plan_id: planId,
          billing_cycle: billingCycle,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription'] });
      toast({
        title: "Plano atualizado",
        description: "Seu plano foi atualizado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar plano",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    subscription,
    plan: subscription?.subscription_plans,
    isLoading,
    error,
    
    // Verificações
    hasFeature,
    checkLimit,
    getLimit,
    isPlan,
    
    // Shortcuts
    isFree,
    isPro,
    isPremium,
    isTrial,
    isActive,
    isExpired,
    isPastDue,
    hasActivePlan,
    hasAnyPlan,
    
    // Utilidades
    trialDaysRemaining,
    
    // Mutations
    changePlan: changePlanMutation.mutate,
    isChangingPlan: changePlanMutation.isPending,
  };
}

/**
 * Hook para buscar todos os planos disponíveis
 */
export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}


