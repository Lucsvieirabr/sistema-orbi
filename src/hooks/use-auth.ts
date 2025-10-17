import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Hook centralizado para gerenciar autenticação
 * Simplifica a lógica de login/logout e navegação
 */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        isAuthenticated: !!session,
        isLoading: false,
      });
    });

    // Escutar mudanças de autenticação
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

  /**
   * Realiza login e redireciona baseado no estado do plano
   */
  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Falha no login",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }

    if (data.user) {
      toast({
        title: "Login realizado com sucesso!",
        description: "Redirecionando...",
      });

      // Verificar se tem plano ativo
      const hasActivePlan = await checkUserHasActivePlan(data.user.id);

      if (hasActivePlan) {
        // C2: Login com plano ativo → /sistema
        navigate("/sistema", { replace: true });
      } else {
        // C3: Login com plano inativo → /pricing
        navigate("/pricing", { replace: true });
      }

      return true;
    }

    return false;
  };

  /**
   * Realiza cadastro e redireciona para /pricing
   */
  const register = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }

    if (data.user) {
      toast({
        title: "Conta criada com sucesso!",
        description: "Escolha um plano para começar.",
      });

      // C1: Cadastro → /pricing (sem plano)
      navigate("/pricing", { replace: true });
      return true;
    }

    return false;
  };

  /**
   * Realiza logout
   */
  const logout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
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

/**
 * Verifica se usuário tem plano ativo
 */
async function checkUserHasActivePlan(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("status")
    .eq("user_id", userId)
    .in("status", ["trial", "active", "past_due"])
    .maybeSingle();

  if (error || !data) return false;

  return data.status === "active" || data.status === "trial";
}

