import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionAccess = "allowed" | "blocked" | "pending_payment" | "no_plan" | "unauthenticated";
export type SubscriptionStatus =
  | "pending"
  | "trial"
  | "active"
  | "past_due"
  | "past_due_grace"
  | "canceled"
  | "expired";

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

export interface SubscriptionStatusPayload {
  access: SubscriptionAccess;
  has_subscription: boolean;
  subscription_id?: string;
  status?: SubscriptionStatus;
  raw_status?: string;
  plan_id?: string;
  plan_slug?: string;
  plan_name?: string;
  billing_cycle?: "monthly" | "yearly";
  features?: Record<string, boolean>;
  limits?: Record<string, number>;
  current_period_end?: string;
  grace_period_end?: string | null;
  next_due_date?: string | null;
  trial_end?: string | null;
  blocked_reason?: string | null;
  cancel_at_period_end?: boolean;
}

const EMPTY: SubscriptionStatusPayload = { access: "no_plan", has_subscription: false };

export const SUBSCRIPTION_QUERY_KEY = ["subscription-status"] as const;

/**
 * Fonte da verdade do plano: RPC SECURITY DEFINER no backend.
 * O cliente nunca deriva acesso a partir de linhas que ele mesmo poderia escrever.
 */
export function useSubscriptionStatus() {
  return useQuery<SubscriptionStatusPayload>({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { access: "unauthenticated", has_subscription: false };

      const { data, error } = await supabase.rpc("get_my_subscription_status");
      if (error) throw error;

      return (data as unknown as SubscriptionStatusPayload) ?? EMPTY;
    },
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useSubscription() {
  const { data, isLoading, error, refetch } = useSubscriptionStatus();
  const status = data ?? EMPTY;

  const features = status.features ?? {};
  const limits = status.limits ?? {};

  // Shape de compatibilidade para consumidores existentes (useFeature/useLimit)
  const subscription = status.has_subscription
    ? {
        id: status.subscription_id,
        status: status.status,
        billing_cycle: status.billing_cycle,
        current_period_end: status.current_period_end,
        trial_end: status.trial_end,
        cancel_at_period_end: status.cancel_at_period_end ?? false,
        subscription_plans: {
          id: status.plan_id,
          name: status.plan_name,
          slug: status.plan_slug,
          features,
          limits,
        },
      }
    : null;

  const hasFeature = (featureKey: string): boolean => features[featureKey] === true;

  const getLimit = (limitKey: string): number => limits[limitKey] ?? 0;

  const checkLimit = (limitKey: string, currentCount: number): boolean => {
    if (!status.has_subscription) return false;
    const limit = limits[limitKey];
    if (limit === -1) return true;
    if (limit === undefined) return false;
    return currentCount < limit;
  };

  const isPlan = (planSlug: string): boolean => status.plan_slug === planSlug;

  const trialDaysRemaining = (): number => {
    if (!status.trial_end) return 0;
    const diff = new Date(status.trial_end).getTime() - Date.now();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  };

  return {
    subscription,
    status,
    plan: subscription?.subscription_plans ?? null,
    isLoading,
    error,
    refetch,

    hasFeature,
    checkLimit,
    getLimit,
    isPlan,

    access: status.access,
    isFree: isPlan("free") || isPlan("basic"),
    isPro: isPlan("pro"),
    isPremium: isPlan("premium"),
    isTrial: status.status === "trial",
    isActive: status.status === "active",
    isExpired: status.status === "expired",
    isPastDue: status.status === "past_due" || status.status === "past_due_grace",
    isPendingPayment: status.access === "pending_payment",
    isBlocked: status.access === "blocked",
    hasActivePlan: status.access === "allowed",
    hasAnyPlan: status.has_subscription,
    blockedReason: status.blocked_reason ?? null,

    trialDaysRemaining,
  };
}

export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      return data as unknown as SubscriptionPlan[];
    },
    staleTime: 10 * 60 * 1000,
  });
}
