import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { SUBSCRIPTION_QUERY_KEY, SubscriptionStatusPayload } from "@/hooks/use-subscription";
import { syncSubscriptionStatus } from "@/hooks/use-payment";
import { buildSignupConsentMetadata } from "@/lib/legal";
import { describeAuthError } from "@/lib/auth/auth-errors";
import { assuranceFromSession } from "@/lib/auth/assurance";
import { mfaChallengePath } from "@/lib/auth/redirect";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Resolve a rota de destino a partir do status validado no backend.
 * Nunca confia em flag local — sempre RPC SECURITY DEFINER.
 */
export async function resolvePostAuthRoute(): Promise<string> {
  await syncSubscriptionStatus();

  // Falha transitória da RPC não pode rebaixar uma conta ativa para /pricing.
  // Uma retentativa e, persistindo o erro, o usuário segue para /sistema —
  // o SubscriptionGuard reavalia com o backend antes de renderizar dados.
  let { data, error } = await supabase.rpc("get_my_subscription_status");

  if (error) {
    ({ data, error } = await supabase.rpc("get_my_subscription_status"));
  }

  if (error) return "/sistema";

  const status = data as unknown as SubscriptionStatusPayload;

  switch (status?.access) {
    case "allowed":
      return "/sistema";
    case "blocked":
    case "pending_payment":
      return "/billing";
    default:
      return "/pricing";
  }
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        isAuthenticated: !!session,
        isLoading: false,
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState({
        user: session?.user ?? null,
        isAuthenticated: !!session,
        isLoading: false,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({ title: "Falha no login", description: describeAuthError(error, "login"), variant: "destructive" });
      return false;
    }

    if (!data.user) return false;

    // Senha certa não basta se a conta tem TOTP: a sessão nasce aal1 e só vira
    // aal2 na tela de código. Nada de assinatura/rota antes disso.
    if (assuranceFromSession(data.session).needsChallenge) {
      queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      navigate(mfaChallengePath(), { replace: true });
      return true;
    }

    queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });

    const route = await resolvePostAuthRoute();
    await queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });

    if (route === "/billing") {
      toast({
        title: "Acesso bloqueado",
        description: "Regularize sua assinatura para continuar usando o Orbi.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Login realizado com sucesso!", description: "Redirecionando..." });
    }

    navigate(route, { replace: true });
    return true;
  };

  const register = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // O aceite dos Termos e da Política é gravado junto da criação da conta
      // (data, hora e versão dos documentos) — prova do consentimento exigida
      // pelo art. 8º, §1º, da LGPD. A UI só chama `register` após o opt-in.
      options: { data: { full_name: fullName, ...buildSignupConsentMetadata() } },
    });

    if (error) {
      toast({ title: "Erro ao criar conta", description: describeAuthError(error, "signup"), variant: "destructive" });
      return false;
    }

    if (data.user) {
      toast({ title: "Conta criada com sucesso!", description: "Escolha um plano para começar." });
      queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      navigate("/pricing", { replace: true });
      return true;
    }

    return false;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    toast({ title: "Logout realizado", description: "Até logo!" });
    navigate("/pricing", { replace: true });
  };

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    login,
    register,
    logout,
  };
}
