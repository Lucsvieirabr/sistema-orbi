import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { AuthForm } from "@/components/auth/AuthForm";
import { AdminAuthForm } from "@/admin/components/AdminAuthForm";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { SubscriptionGuard } from "@/components/guards/SubscriptionGuard";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Billing from "./pages/Billing";
import { ThemeProvider } from "@/hooks/use-theme";
import AppLayout from "@/layouts/AppLayout";
import AdminLayout from "@/admin/layouts/AdminLayout";
import Categories from "@/pages/Categories";
import Accounts from "@/pages/Accounts";
import MonthlyStatement from "@/pages/MonthlyStatement";
import Cards from "@/pages/Cards";
import CardStatements from "@/pages/CardStatements";
import People from "@/pages/People";
import PersonDetail from "@/components/people/PersonDetail";
import Settings from "@/pages/Settings";
import MyAI from "@/pages/MyAI";
import Notes from "@/pages/Notes";
import Budgets from "@/pages/Budgets";
import Goals from "@/pages/Goals";
import MonthlyClosing from "@/pages/MonthlyClosing";
import CashForecast from "@/pages/CashForecast";
import Ledgers from "@/pages/Ledgers";
import Projects from "@/pages/Projects";
import PersonalInflation from "@/pages/PersonalInflation";
import { PremiumRoute } from "@/components/guards/PremiumRoute";
import TermsOfUsePage, { TermsOfUseAppPage } from "@/pages/legal/TermsOfUse";
import PrivacyPolicyPage, { PrivacyPolicyAppPage } from "@/pages/legal/PrivacyPolicy";
import AdminDashboard from "@/admin/pages/AdminDashboard";
import PlanManagement from "@/admin/pages/PlanManagement";
import UserManagement from "@/admin/pages/UserManagement";
import SubscriptionManagement from "@/admin/pages/SubscriptionManagement";
import AdminManagement from "@/admin/pages/AdminManagement";
import BugReportsManagement from "@/admin/pages/BugReportsManagement";
import { supabase } from "@/integrations/supabase/client";
import { RouteSeo } from "@/components/seo";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import MfaChallenge from "@/pages/auth/MfaChallenge";
import VerifyEmail from "@/pages/auth/VerifyEmail";
import { stageFromSession, type SessionStage } from "@/lib/auth/assurance";
import { AUTH_ROUTES, loginPath, mfaChallengePath, safeInternalPath } from "@/lib/auth/redirect";
import { syncAuthUser } from "@/hooks/use-current-user";
import { queryClient } from "@/lib/query-client";

/**
 * Rede de segurança do link de recuperação: se o Supabase devolver o usuário
 * ao Site URL (redirect fora da allowlist) em vez de /redefinir-senha, o evento
 * PASSWORD_RECOVERY ainda leva à tela certa. Precisa estar dentro do Router.
 */
function PasswordRecoveryRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && location.pathname !== AUTH_ROUTES.resetPassword) {
        navigate(AUTH_ROUTES.resetPassword, { replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [location.pathname, navigate]);

  return null;
}

/**
 * `/login`.
 *
 * Quem já tem sessão não vai mais, sempre, para `/sistema`: se chegou aqui por
 * um fluxo interrompido (`?next=/pricing`, gravado quando clicou num plano sem
 * estar logado), volta exatamente para onde estava. `safeInternalPath` recusa
 * destino externo e recusa as próprias rotas de autenticação, que criariam laço.
 */
/**
 * Rota protegida sem sessão utilizável.
 *
 * Manda para o login guardando de onde a pessoa veio (`?next=`), para que o
 * login devolva ao destino original em vez de despejar todo mundo em
 * `/sistema`. Com o TOTP pendente, a etapa do código vem antes de tudo.
 */
function SignedOutRedirect({ stage }: { stage: SessionStage }) {
  const location = useLocation();

  if (stage === "mfa_required") {
    return <Navigate to={mfaChallengePath()} replace />;
  }

  return <Navigate to={loginPath(`${location.pathname}${location.search}`)} replace />;
}

function LoginRoute({ stage }: { stage: SessionStage }) {
  const [searchParams] = useSearchParams();

  if (stage === "authenticated") {
    return <Navigate to={safeInternalPath(searchParams.get("next")) ?? AUTH_ROUTES.app} replace />;
  }

  if (stage === "mfa_required") {
    return <Navigate to={mfaChallengePath()} replace />;
  }

  return <AuthForm />;
}

/**
 * App refatorado com fluxo simplificado
 *
 * Jornada canônica:
 *   Landing → Cadastro → /verificar-email → Login → /pricing → Checkout → /sistema
 *
 * Casos de uso:
 * - C1: Cadastro com confirmação de e-mail ligada → /verificar-email
 * - C1b: Cadastro com confirmação desligada (sessão já criada) → /pricing
 * - C2: Login com plano ativo → /sistema
 * - C3: Login com plano inativo → /pricing
 * - C4: Acesso /sistema com plano ativo → /sistema
 * - C5: Acesso /sistema sem plano → /pricing (via SubscriptionGuard)
 * - C6: /pricing não autenticado → visualiza
 * - C7: /pricing clica plano sem auth → /login?next=/pricing (e volta para cá)
 * - C8: Login com MFA (sessão aal1 + TOTP verificado) → /login/verificacao;
 *       nenhuma rota protegida abre antes do código (aal2)
 * - C9: Link de recuperação → /redefinir-senha (pública, independe de sessão)
 * - C10: Link de confirmação do cadastro → /verificar-email (pública, com ou
 *        sem sessão: a própria tela troca o código e segue para os planos)
 */
const App = () => {
  // `mfa_required` = senha certa, código pendente. Conta como NÃO autenticado
  // para qualquer rota protegida. Autoridade real: RLS lendo o claim `aal`.
  const [stage, setStage] = useState<SessionStage>("anonymous");
  const [authReady, setAuthReady] = useState(false);
  const isAuthenticated = stage === "authenticated";
  const mfaPending = stage === "mfa_required";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setStage("anonymous");
  };

  useEffect(() => {
    let isMounted = true;
    
    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      syncAuthUser(data.session);
      setStage(stageFromSession(data.session));
      setAuthReady(true);
    });

    // Escutar mudanças de autenticação. `stageFromSession` é síncrono de
    // propósito: chamar a API do supabase-js aqui dentro trava o lock interno.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      syncAuthUser(session);
      setStage(stageFromSession(session));
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Mostrar loading enquanto verifica autenticação
  if (!authReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* <head> por rota: title, description, canonical, robots, OG, JSON-LD. */}
            <RouteSeo />
            <PasswordRecoveryRedirect />
            <Routes>
              <Route path="/" element={<Landing isAuthenticated={isAuthenticated} />} />

              {/* Recuperação de senha — sempre acessível: o link do e-mail pode
                  abrir com ou sem sessão, e a própria tela trata cada caso. */}
              <Route path={AUTH_ROUTES.forgotPassword} element={<ForgotPassword />} />
              <Route path={AUTH_ROUTES.resetPassword} element={<ResetPassword />} />

              {/* Confirmação do cadastro — sempre acessível. É a tela de espera
                  logo depois do signUp E o destino do link do e-mail, que pode
                  chegar com sessão (mesmo navegador) ou sem (celular). */}
              <Route path={AUTH_ROUTES.verifyEmail} element={<VerifyEmail />} />

              {/* Segunda etapa do login (TOTP). Sem sessão volta ao login; já em
                  aal2 a própria tela segue para o destino. */}
              <Route
                path={AUTH_ROUTES.mfaChallenge}
                element={stage === "anonymous" ? <Navigate to="/login" replace /> : <MfaChallenge />}
              />

              {/* Rotas públicas */}
              <Route path="/pricing" element={<Pricing />} />

              {/* Documentos legais — leitura pública, sem sessão.
                  Os checkboxes de consentimento apontam para cá em nova aba. */}
              <Route path="/legal/termos-de-uso" element={<TermsOfUsePage />} />
              <Route path="/legal/politica-de-privacidade" element={<PrivacyPolicyPage />} />
              <Route path="/termos-de-uso" element={<Navigate to="/legal/termos-de-uso" replace />} />
              <Route
                path="/politica-de-privacidade"
                element={<Navigate to="/legal/politica-de-privacidade" replace />}
              />

              {/* Bloqueio por inadimplência / pagamento pendente */}
              <Route
                path="/billing"
                element={
                  isAuthenticated ? <Billing /> : <SignedOutRedirect stage={stage} />
                }
              />
              <Route path={AUTH_ROUTES.login} element={<LoginRoute stage={stage} />} />

              {/* Atalhos curtos dos módulos de planejamento. */}
              <Route path="/budgets" element={<Navigate to="/sistema/budgets" replace />} />
              <Route path="/goals" element={<Navigate to="/sistema/goals" replace />} />
              <Route path="/analytics" element={<Navigate to="/sistema/analytics" replace />} />
              <Route path="/forecast" element={<Navigate to="/sistema/forecast" replace />} />
              <Route path="/ledgers" element={<Navigate to="/sistema/ledgers" replace />} />
              <Route path="/projects" element={<Navigate to="/sistema/projects" replace />} />
              <Route path="/inflation" element={<Navigate to="/sistema/inflation" replace />} />

              {/* Rota de login admin */}
              <Route 
                path="/admin" 
                element={
                  isAuthenticated ? (
                    <Navigate to="/admin/dashboard" replace />
                  ) : mfaPending ? (
                    <Navigate to={mfaChallengePath("admin")} replace />
                  ) : (
                    <AdminAuthForm />
                  )
                } 
              />

              {/* Rotas protegidas do sistema */}
              <Route
                path="/sistema"
                element={
                  isAuthenticated ? (
                    <SubscriptionGuard>
                      <AppLayout onLogout={handleLogout} />
                    </SubscriptionGuard>
                  ) : (
                    <SignedOutRedirect stage={stage} />
                  )
                }
              >
                <Route index element={<Dashboard onLogout={handleLogout} />} />
                <Route path="statement" element={<MonthlyStatement />} />
                <Route path="categories" element={<Categories />} />
                <Route path="accounts" element={<Accounts />} />
                <Route path="cards" element={<Cards />} />
                <Route path="cards/:cardId/statements" element={<CardStatements />} />
                <Route path="people" element={<People />} />
                <Route path="people/:personId" element={<PersonDetail />} />
                <Route path="my-ai" element={<MyAI />} />
                <Route path="notes" element={<Notes />} />
                <Route path="settings" element={<Settings />} />

                {/* Planejamento — exclusivo Pro e Casal. PremiumRoute troca a
                    tela pelo upgrade quando o plano não inclui a feature; RLS,
                    triggers e RPCs (migration 20260915150000) são a autoridade. */}
                <Route path="budgets" element={<PremiumRoute module="budgets"><Budgets /></PremiumRoute>} />
                <Route path="goals" element={<PremiumRoute module="goals"><Goals /></PremiumRoute>} />
                <Route path="analytics" element={<PremiumRoute module="analytics"><MonthlyClosing /></PremiumRoute>} />
                {/* Motor Preditivo e Rateios/Acertos — migrations 20260916021503/021607. */}
                <Route path="forecast" element={<PremiumRoute module="forecast"><CashForecast /></PremiumRoute>} />
                <Route path="ledgers" element={<PremiumRoute module="ledgers"><Ledgers /></PremiumRoute>} />
                <Route path="projects" element={<PremiumRoute module="projects"><Projects /></PremiumRoute>} />
                <Route path="inflation" element={<PremiumRoute module="inflation"><PersonalInflation /></PremiumRoute>} />

                {/* Mesmos documentos, lidos dentro do sistema. */}
                <Route path="legal/termos-de-uso" element={<TermsOfUseAppPage />} />
                <Route path="legal/politica-de-privacidade" element={<PrivacyPolicyAppPage />} />
              </Route>

              {/* Rotas protegidas do admin */}
              <Route
                path="/admin"
                element={
                  isAuthenticated ? (
                    <AdminLayout />
                  ) : (
                    <Navigate to={mfaPending ? mfaChallengePath("admin") : "/admin"} replace />
                  )
                }
              >
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="plans" element={<PlanManagement />} />
                <Route path="subscriptions" element={<SubscriptionManagement />} />
                <Route path="admins" element={<AdminManagement />} />
                <Route path="bug-reports" element={<BugReportsManagement />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
