import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wallet, Banknote, List, CreditCard, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import orbiLogo from "@/assets/orbi-logo_white.png";

interface SidebarItem {
  title: string;
  icon: any;
  path: string;
}

const menuItems: SidebarItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/sistema" },
  { title: "Contas", icon: Wallet, path: "/sistema/accounts" },
  { title: "Transações", icon: Banknote, path: "/sistema/transactions" },
  { title: "Categorias", icon: List, path: "/sistema/categories" },
  { title: "Cartões", icon: CreditCard, path: "/sistema/cards" },
  { title: "Família", icon: Users, path: "/sistema/family-members" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const items = useMemo(() => menuItems, []);

  return (
    <div className="hidden md:flex h-svh w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <img src={orbiLogo} alt="Orbi" className="h-8 w-8" />
          <span className="text-lg font-bold">Orbi</span>
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
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 transition-smooth",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-card"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                onClick={() => navigate(item.path)}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Button>
            );
          })}
        </div>
      </nav>

      <div className="p-4" />
    </div>
  );
}


