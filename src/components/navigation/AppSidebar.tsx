import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  List,
  CreditCard,
  Users,
  Plus,
  Brain,
  StickyNote,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar } from "@/components/ui/sidebar";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ReportBugDialog } from "@/components/bugs/ReportBugDialog";
import { useIsCompact } from "@/hooks/use-mobile";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import orbiLogo from "@/assets/orbi-logo_white.png";

interface SidebarItem {
  title: string;
  icon: typeof LayoutDashboard;
  path: string;
}

/** Agrupado por intenção: o que acontece, onde o dinheiro mora, como classificar. */
const menuGroups: { label: string; items: SidebarItem[] }[] = [
  {
    label: "Visão",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/sistema" },
      { title: "Extrato", icon: Receipt, path: "/sistema/statement" },
    ],
  },
  {
    label: "Saldos",
    items: [
      { title: "Contas", icon: Wallet, path: "/sistema/accounts" },
      { title: "Cartões", icon: CreditCard, path: "/sistema/cards" },
    ],
  },
  {
    label: "Organização",
    items: [
      { title: "Categorias", icon: List, path: "/sistema/categories" },
      { title: "Pessoas", icon: Users, path: "/sistema/people" },
      { title: "Notas", icon: StickyNote, path: "/sistema/notes" },
      { title: "IA Classificador", icon: Brain, path: "/sistema/my-ai" },
      { title: "Configurações", icon: Settings, path: "/sistema/settings" },
    ],
  },
];

interface AppSidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Navegação principal.
 *
 * `lg+`  → coluna navy fixa.
 * `<lg`  → o mesmo conteúdo dentro de um drawer (Sheet) vindo da esquerda,
 *          com alvos de 44px e respiro para o recorte do aparelho.
 */
export function AppSidebar({ open, onOpenChange }: AppSidebarProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isCompact = useIsCompact();

  const groups = useMemo(() => menuGroups, []);

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isCompact && onOpenChange) onOpenChange(false);
  };

  const Nav = ({ drawer = false }: { drawer?: boolean }) => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div className="flex h-header shrink-0 items-center justify-between px-4 lg:h-header-lg lg:px-5">
        <div className="flex items-center gap-2.5">
          <img src={orbiLogo} alt="" aria-hidden className="h-7 w-7" />
          <span className="font-display text-base font-semibold tracking-tight text-sidebar-accent-foreground">Orbi</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
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

      {/* Ação primária — a única com preenchimento sólido na navegação */}
      <div className="shrink-0 px-3 pb-3">
        <button
          type="button"
          onClick={() => handleNavigate("/sistema/statement?new=1")}
          className={cn(
            "flex h-11 w-full items-center justify-center gap-2 rounded-lg lg:h-10",
            "bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground",
            "transition-colors duration-200 ease-swift hover:bg-white/[0.16]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nova transação
        </button>
      </div>

      {/* Navegação */}
      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {groups.map((group, groupIndex) => (
          <div key={group.label} className={cn(groupIndex > 0 && "mt-6 lg:mt-7")}>
            <p className="px-3 pb-2.5 text-2xs font-medium uppercase tracking-eyebrow text-sidebar-muted/70">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;
                return (
                  <li key={item.path}>
                    <button
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => handleNavigate(item.path)}
                      className={cn(
                        "relative flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm lg:h-9",
                        "transition-colors duration-200 ease-swift",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                        isActive
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {isActive && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-marker"
                        />
                      )}
                      <Icon className={cn("h-4 w-4 shrink-0", !isActive && "opacity-70")} aria-hidden />
                      <span className="truncate">{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3 pb-safe lg:pb-3">
        <ReportBugDialog />
      </div>
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
            <SheetTitle>Navegação principal</SheetTitle>
          </VisuallyHidden>
          <Nav drawer />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sidebar collapsible="none" className="hidden border-r border-sidebar-border bg-sidebar lg:flex lg:h-svh">
      <Nav />
    </Sidebar>
  );
}
