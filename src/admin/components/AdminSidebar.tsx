import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  Shield,
  Bug,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar } from "@/components/ui/sidebar";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useIsCompact } from "@/hooks/use-mobile";
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

interface AdminSidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Mesma regra do app: coluna fixa em `lg+`, drawer abaixo disso. */
export function AdminSidebar({ open, onOpenChange }: AdminSidebarProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isCompact = useIsCompact();

  const items = useMemo(() => menuItems, []);

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isCompact && onOpenChange) onOpenChange(false);
  };

  const Nav = ({ drawer = false }: { drawer?: boolean }) => (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-header shrink-0 items-center justify-between border-b border-sidebar-border px-4 lg:h-header-lg lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <img src={orbiLogo} alt="Orbi" className="h-6 w-6 shrink-0" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-destructive">Orbi Admin</span>
            <span className="truncate text-2xs text-muted-foreground">Painel Administrativo</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          {drawer && (
            <SheetClose
              aria-label="Fechar menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <X className="h-5 w-5" aria-hidden />
            </SheetClose>
          )}
        </div>
      </div>

      <nav aria-label="Navegação administrativa" className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 lg:px-4">
        <div className="space-y-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <Button
                key={item.path}
                variant="ghost"
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "h-11 w-full justify-start gap-3 border border-transparent lg:h-10",
                  isActive
                    ? "border-destructive/30 bg-destructive/10 text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    : "text-sidebar-foreground hover:border-destructive/30 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                onClick={() => handleNavigate(item.path)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.title}</span>
                {item.badge && (
                  <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-2xs font-medium tabular text-destructive-foreground">
                    {item.badge}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </nav>
    </div>
  );

  if (isCompact && open !== undefined && onOpenChange) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className="w-[min(17.5rem,86vw)] border-sidebar-border bg-sidebar p-0 [&>button]:hidden"
        >
          <VisuallyHidden>
            <SheetTitle>Navegação administrativa</SheetTitle>
          </VisuallyHidden>
          <Nav drawer />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sidebar collapsible="none" className="hidden border-r border-sidebar-border bg-sidebar lg:flex">
      <Nav />
    </Sidebar>
  );
}
