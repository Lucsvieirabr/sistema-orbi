import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
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

interface AdminHeaderProps {
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

export function AdminHeader({ onMenuClick, menuOpen = false }: AdminHeaderProps = {}) {
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
    <header className="sticky top-0 z-30 flex h-header shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-background/90 px-2 backdrop-blur-[2px] md:px-4 lg:h-header-lg lg:gap-4 lg:px-8">
      <div className="flex min-w-0 items-center gap-1 md:gap-3">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            className="shrink-0 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold tracking-tight text-foreground md:text-xl lg:text-2xl">
            {pageInfo.title}
          </h1>
          <p className="hidden truncate text-xs text-muted-foreground md:block md:text-sm">{pageInfo.description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 md:gap-2 lg:gap-4">
        <AdminSearchPopover />
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sair" className="md:hidden">
          <LogOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden gap-2 md:inline-flex">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}

