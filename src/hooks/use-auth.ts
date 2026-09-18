import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { SUBSCRIPTION_QUERY_KEY, SubscriptionStatusPayload } from "@/hooks/use-subscription";
import { syncSubscriptionStatus } from "@/hooks/use-payment";
import { buildSignupConsentMetadata } from "@/lib/legal";
import { describeAuthError, hasAuthErrorCode } from "@/lib/auth/auth-errors";
import { assuranceFromSession } from "@/lib/auth/assurance";
import { AUTH_ROUTES, mfaChallengePath, readNextParam, safeInternalPath } from "@/lib/auth/redirect";
import { confirmationRedirectUrl, forgetPendingEmail, rememberPendingEmail } from "@/services/auth/email-confirmation";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Resolve a rota de destino a partir do status validado no backend.
 * Nunca confia em flag local — sempre RPC SECURITY DEFINER.
 *
 * `preferred` é o `?next=` de um fluxo interrompido (ex.: a pessoa clicou em um
 * plano sem sessão). Ele só vale quando o backend NÃO está exigindo
 * regularização: cobrança pendente sempre ganha de qualquer destino guardado.
 */
export async function resolvePostAuthRoute(preferred?: string | null): Promise<string> {
  await syncSubscriptionStatus();

  // Falha transitória da RPC não pode rebaixar uma conta ativa para /pricing.
  // Uma retentativa e, persistindo o erro, o usuário segue para /sistema —
  // o SubscriptionGuard reavalia com o backend antes de renderizar dados.
  let { data, error } = await supabase.rpc("get_my_subscription_status");

  if (error) {
    ({ data, error } = await supabase.rpc("get_my_subscription_status"));
  }

  const next = safeInternalPath(preferred);

  if (error) return next ?? AUTH_ROUTES.app;

  const status = data as unknown as SubscriptionStatusPayload;

  switch (status?.access) {
    case "allowed":
      return next ?? AUTH_ROUTES.app;
    case "blocked":
    case "pending_payment":
      // Regularização é inegociável: ignora o `next`.
      return AUTH_ROUTES.billing;
    default:
      // Conta nova, ainda sem plano: a escolha da assinatura vem antes do
      // dashboard. É o mesmo destino de um `next=/pricing`, então não há
      // conflito a resolver aqui.
      return AUTH_ROUTES.pricing;
  }
}

export interface LoginHandlers {
  /** `email_not_confirmed`: a senha estava certa, falta ativar a conta. */
  onEmailNotConfirmed?: (email: string) => void;
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

  /** `captchaToken`: Turnstile, uso único — o formulário reseta o widget após cada tentativa. */
  const login = async (email: string, password: string, captchaToken?: string, handlers?: LoginHandlers) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });

    if (error) {
      // Conta criada mas nunca ativada. Isso não é "falha no login": é um
      // passo pendente, e a tela resolve no lugar (modal com reenvio) em vez
      // de cuspir um toast vermelho que não leva a lugar nenhum.
      const notConfirmed =
        hasAuthErrorCode(error, "email_not_confirmed") ||
        (error.status === 400 && /email\s*not\s*confirmed/i.test(error.message ?? ""));

      if (notConfirmed && handlers?.onEmailNotConfirmed) {
        rememberPendingEmail(email);
        handlers.onEmailNotConfirmed(email);
        return false;
      }

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

    forgetPendingEmail();
    queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });

    // `?next=` de um fluxo interrompido (clicou num plano sem sessão).
    const route = await resolvePostAuthRoute(readNextParam());
    await queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });

    if (route === AUTH_ROUTES.billing) {
      toast({
        title: "Acesso bloqueado",
        description: "Regularize sua assinatura para continuar usando o Orbi.",
        variant: "destructive",
      });
    } else if (route === AUTH_ROUTES.pricing) {
      toast({ title: "Bem-vindo ao Orbi!", description: "Escolha seu plano para liberar o sistema." });
    } else {
      toast({ title: "Login realizado com sucesso!", description: "Redirecionando..." });
    }

    navigate(route, { replace: true });
    return true;
  };

  const register = async (email: string, password: string, fullName: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // O aceite dos Termos e da Política é gravado junto da criação da conta
      // (data, hora e versão dos documentos) — prova do consentimento exigida
      // pelo art. 8º, §1º, da LGPD. A UI só chama `register` após o opt-in.
      options: {
        data: { full_name: fullName, ...buildSignupConsentMetadata() },
        captchaToken,
        // Onde o link do e-mail devolve a pessoa. Precisa estar na allowlist
        // "Redirect URLs" do painel do Supabase (e em supabase/config.toml).
        emailRedirectTo: confirmationRedirectUrl(),
      },
    });

    if (error) {
      toast({ title: "Erro ao criar conta", description: describeAuthError(error, "signup"), variant: "destructive" });
      return false;
    }

    if (!data.user) return false;

    // Confirmação de e-mail DESLIGADA no projeto: a sessão já vem pronta e o
    // próximo passo é escolher o plano.
    if (data.session) {
      toast({ title: "Conta criada com sucesso!", description: "Escolha um plano para começar." });
      forgetPendingEmail();
      queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      navigate(AUTH_ROUTES.pricing, { replace: true });
      return true;
    }

    // Confirmação LIGADA: `signUp` devolve `user` sem `session`.
    //
    // `identities: []` é o usuário-fantasma que o GoTrue devolve quando o
    // e-mail JÁ existe — proteção anti-enumeração. A resposta da interface é
    // exatamente a mesma nos dois casos (nenhuma pista de que a conta existe),
    // e o reenvio da tela de espera resolve o caso legítimo.
    rememberPendingEmail(email);
    queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    navigate(AUTH_ROUTES.verifyEmail, { replace: true, state: { email } });
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    forgetPendingEmail();
    queryClient.clear();
    toast({ title: "Logout realizado", description: "Até logo!" });
    navigate(AUTH_ROUTES.pricing, { replace: true });
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
