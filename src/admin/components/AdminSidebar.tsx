import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Receipt, 
  Settings,
  Shield,
  ArrowLeft
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
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const items = useMemo(() => menuItems, []);

  return (
    <Sidebar collapsible="none" className="border-r border-sidebar-border bg-gradient-to-b from-red-950/20 to-background">
      <div className="flex h-16 items-center justify-between px-6 border-b border-red-900/20">
        <div className="flex items-center gap-2">
          <img src={orbiLogo} alt="Orbi" className="h-6 w-6" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-red-500">Orbi Admin</span>
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
                    ? "border-red-500 text-red-500 bg-red-500/10 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10"
                    : "text-sidebar-foreground hover:border-red-400 hover:text-red-400 hover:bg-red-400/5 active:border-red-400 active:text-red-400 active:bg-red-400/5",
                )}
                onClick={() => navigate(item.path)}
              >
                <Icon className="h-4 w-4" />
                {item.title}
                {item.badge && (
                  <span className="ml-auto text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
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

