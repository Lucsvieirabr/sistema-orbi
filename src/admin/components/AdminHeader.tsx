import { useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSearchPopover } from "./AdminSearchPopover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const pageTitles: Record<string, { title: string; description: string }> = {
  "/admin/dashboard": {
    title: "Dashboard",
    description: "Visão geral do sistema e métricas principais"
  },
  "/admin/users": {
    title: "Gerenciar Usuários",
    description: "Visualize e gerencie todos os usuários do sistema"
  },
  "/admin/subscriptions": {
    title: "Assinaturas",
    description: "Gerencie assinaturas e períodos de trial"
  },
  "/admin/plans": {
    title: "Planos",
    description: "Configure planos, preços e features"
  },
  "/admin/payments": {
    title: "Pagamentos",
    description: "Histórico de pagamentos e cobranças"
  },
  "/admin/analytics": {
    title: "Analytics",
    description: "Métricas de negócio e análises avançadas"
  },
  "/admin/admins": {
    title: "Administradores",
    description: "Gerencie permissões de administradores"
  },
  "/admin/settings": {
    title: "Configurações",
    description: "Configurações gerais do sistema"
  },
};

export function AdminHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const pageInfo = pageTitles[location.pathname] || {
    title: "Admin",
    description: "Painel Administrativo"
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/admin");
      toast({
        title: "Logout realizado",
        description: "Você saiu do painel administrativo com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast({
        title: "Erro ao sair",
        description: "Ocorreu um erro ao fazer logout.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm px-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">{pageInfo.title}</h1>
        <p className="text-xs md:text-sm text-muted-foreground hidden md:block">{pageInfo.description}</p>
      </div>

      <div className="flex items-center gap-4">
        <AdminSearchPopover />
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}

