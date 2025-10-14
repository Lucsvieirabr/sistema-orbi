import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wallet, Receipt, List, CreditCard, Users, Plus, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar } from "@/components/ui/sidebar";
import orbiLogo from "@/assets/orbi-logo_white.png";

interface SidebarItem {
  title: string;
  icon: any;
  path: string;
}

const menuItems: SidebarItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/sistema" },
  { title: "Extrato", icon: Receipt, path: "/sistema/statement" },
  { title: "Contas", icon: Wallet, path: "/sistema/accounts" },
  { title: "Categorias", icon: List, path: "/sistema/categories" },
  { title: "Cartões", icon: CreditCard, path: "/sistema/cards" },
  { title: "Pessoas", icon: Users, path: "/sistema/people" },
  { title: "IA Classificador", icon: Brain, path: "/sistema/my-ai" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const items = useMemo(() => menuItems, []);

  return (
    <Sidebar collapsible="none" className="border-r border-sidebar-border">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <img src={orbiLogo} alt="Orbi" className="h-8 w-8" />
          <span className="text-lg font-bold">Orbi</span>
        </div>
        <ThemeToggle />
      </div>

      <nav className="flex-1 px-4 py-4 overflow-auto">
        <div className="space-y-2">
          {/* Botão de Nova Transação - Movido para o topo */}
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-center gap-3 mb-6 bg-transparent border-2 border-dashed border-blue-400 text-blue-400 hover:bg-blue-400/10 hover:border-blue-300 hover:text-blue-300 shadow-lg font-semibold text-base transition-all duration-300"
            onClick={() => navigate("/sistema/statement?new=1")}
          >
            <Plus className="h-5 w-5" />
            Nova Transação
          </Button>

          {items.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 transition-all duration-300 border border-transparent bg-transparent hover:bg-transparent",
                  isActive
                    ? "border-blue-400 text-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.6),inset_0_0_10px_rgba(96,165,250,0.15)]"
                    : "text-sidebar-foreground hover:border-blue-400 hover:text-blue-400 hover:shadow-[0_0_15px_rgba(96,165,250,0.6),inset_0_0_10px_rgba(96,165,250,0.15)]",
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
    </Sidebar>
  );
}


