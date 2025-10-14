import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthForm } from "@/components/auth/AuthForm";
import { Dashboard } from "@/components/dashboard/Dashboard";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "@/hooks/use-theme";
import AppLayout from "@/layouts/AppLayout";
import Categories from "@/pages/Categories";
import Accounts from "@/pages/Accounts";
import MonthlyStatement from "@/pages/MonthlyStatement";
import Cards from "@/pages/Cards";
import CardStatements from "@/pages/CardStatements";
import People from "@/pages/People";
import PersonDetail from "@/components/people/PersonDetail";
import Settings from "@/pages/Settings";
import MyAI from "@/pages/MyAI";
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
              <Route path="/" element={authReady ? (<Navigate to={isAuthenticated ? "/sistema" : "/login"} replace />) : null} />

              {/* Login route */}
              <Route path="/login" element={authReady ? (isAuthenticated ? <Navigate to="/sistema" replace /> : <AuthForm onAuthSuccess={handleAuthSuccess} />) : null} />

              {/* Protected app routes under /sistema */}
              <Route
                path="/sistema"
                element={authReady ? (isAuthenticated ? <AppLayout onLogout={handleLogout} /> : <Navigate to="/login" replace />) : null}
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

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
