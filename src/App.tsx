import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

const queryClient = new QueryClient();

/**
 * App refatorado com fluxo simplificado
 * 
 * Casos de uso:
 * - C1: Cadastro → /pricing
 * - C2: Login com plano ativo → /sistema
 * - C3: Login com plano inativo → /pricing
 * - C4: Acesso /sistema com plano ativo → /sistema
 * - C5: Acesso /sistema sem plano → /pricing (via SubscriptionGuard)
 * - C6: /pricing não autenticado → visualiza
 * - C7: /pricing clica plano sem auth → /login
 */
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  useEffect(() => {
    let isMounted = true;
    
    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setIsAuthenticated(Boolean(data.session));
      setAuthReady(true);
    });

    // Escutar mudanças de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setIsAuthenticated(Boolean(session));
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
            <Routes>
              <Route
                path="/"
                element={isAuthenticated ? <Navigate to="/sistema" replace /> : <Landing />}
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
                element={isAuthenticated ? <Billing /> : <Navigate to="/login" replace />}
              />
              <Route 
                path="/login" 
                element={isAuthenticated ? <Navigate to="/sistema" replace /> : <AuthForm />} 
              />

              {/* Atalhos curtos dos módulos de planejamento. */}
              <Route path="/budgets" element={<Navigate to="/sistema/budgets" replace />} />
              <Route path="/goals" element={<Navigate to="/sistema/goals" replace />} />
              <Route path="/analytics" element={<Navigate to="/sistema/analytics" replace />} />

              {/* Rota de login admin */}
              <Route 
                path="/admin" 
                element={isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : <AdminAuthForm />} 
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
                    <Navigate to="/login" replace />
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

                {/* Mesmos documentos, lidos dentro do sistema. */}
                <Route path="legal/termos-de-uso" element={<TermsOfUseAppPage />} />
                <Route path="legal/politica-de-privacidade" element={<PrivacyPolicyAppPage />} />
              </Route>

              {/* Rotas protegidas do admin */}
              <Route
                path="/admin"
                element={isAuthenticated ? <AdminLayout /> : <Navigate to="/admin" replace />}
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
