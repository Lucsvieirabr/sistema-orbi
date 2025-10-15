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
import Pricing from "./pages/Pricing";
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
import AdminDashboard from "@/admin/pages/AdminDashboard";
import PlanManagement from "@/admin/pages/PlanManagement";
import UserManagement from "@/admin/pages/UserManagement";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    supabase.auth.signOut().finally(() => setIsAuthenticated(false));
  };

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setIsAuthenticated(Boolean(data.session));
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Default redirect based on auth */}
              <Route path="/" element={authReady ? (<Navigate to={isAuthenticated ? "/sistema" : "/pricing"} replace />) : null} />

              {/* Public routes */}
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/login" element={authReady ? (isAuthenticated ? <Navigate to="/sistema" replace /> : <AuthForm onAuthSuccess={handleAuthSuccess} />) : null} />

              {/* Admin login route */}
              <Route path="/admin" element={authReady ? (isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : <AdminAuthForm onAuthSuccess={handleAuthSuccess} />) : null} />

              {/* Protected app routes under /sistema */}
              <Route
                path="/sistema"
                element={authReady ? (isAuthenticated ? (
                  <SubscriptionGuard>
                    <AppLayout onLogout={handleLogout} />
                  </SubscriptionGuard>
                ) : <Navigate to="/login" replace />) : null}
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
                <Route path="settings" element={<Settings />} />
              </Route>

              {/* Protected admin routes */}
              <Route
                path="/admin"
                element={authReady ? (isAuthenticated ? <AdminLayout /> : <Navigate to="/admin" replace />) : null}
              >
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="plans" element={<PlanManagement />} />
                <Route path="subscriptions" element={<div className="p-8 text-center text-muted-foreground">Em desenvolvimento</div>} />
                <Route path="payments" element={<div className="p-8 text-center text-muted-foreground">Em desenvolvimento</div>} />
                <Route path="analytics" element={<div className="p-8 text-center text-muted-foreground">Em desenvolvimento</div>} />
                <Route path="admins" element={<div className="p-8 text-center text-muted-foreground">Em desenvolvimento</div>} />
                <Route path="settings" element={<div className="p-8 text-center text-muted-foreground">Em desenvolvimento</div>} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
