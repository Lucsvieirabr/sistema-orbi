import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Receipt, 
  Settings,
  Shield,
  ArrowLeft,
  Bug
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar } from "@/components/ui/sidebar";
import orbiLogo from "@/assets/orbi-logo_white.png";

interface SidebarItem {
  title: string;
  icon: any;
  path: string;
  badge?: string;
}

const menuItems: SidebarItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { title: "Usuários", icon: Users, path: "/admin/users" },
  { title: "Assinaturas", icon: CreditCard, path: "/admin/subscriptions" },
  { title: "Planos", icon: Receipt, path: "/admin/plans" },
  { title: "Administradores", icon: Shield, path: "/admin/admins" },
  { title: "Defeitos & Sugestões", icon: Bug, path: "/admin/bug-reports" },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const items = useMemo(() => menuItems, []);

  return (
    <Sidebar collapsible="none" className="border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <img src={orbiLogo} alt="Orbi" className="h-6 w-6" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-destructive">Orbi Admin</span>
            <span className="text-xs text-muted-foreground">Painel Administrativo</span>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <nav className="flex-1 px-4 py-4 overflow-auto">
        <div className="space-y-2"> 

          {items.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 transition-all duration-300 border border-transparent",
                  isActive
                    ? "border-destructive/30 text-destructive bg-destructive/10 hover:border-destructive/30 hover:text-destructive hover:bg-destructive/10"
                    : "text-sidebar-foreground hover:border-destructive/30 hover:text-destructive hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                onClick={() => navigate(item.path)}
              >
                <Icon className="h-4 w-4" />
                {item.title}
                {item.badge && (
                  <span className="ml-auto text-xs bg-destructive text-white px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </nav>
    </Sidebar>
  );
}

