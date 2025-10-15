import { useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/hooks/use-admin-auth";

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
  const { adminUser } = useAdminAuth();
  
  const pageInfo = pageTitles[location.pathname] || {
    title: "Admin",
    description: "Painel Administrativo"
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'admin':
        return 'default';
      case 'support':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'support':
        return 'Suporte';
      case 'viewer':
        return 'Visualizador';
      default:
        return role;
    }
  };

  return (
    <div className="flex items-center justify-between border-b border-border pb-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{pageInfo.title}</h1>
        <p className="text-muted-foreground">{pageInfo.description}</p>
      </div>
      
      {adminUser && (
        <Badge variant={getRoleBadgeVariant(adminUser.role)}>
          {getRoleLabel(adminUser.role)}
        </Badge>
      )}
    </div>
  );
}

