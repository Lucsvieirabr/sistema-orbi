import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Lock,
  Plus,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar } from "@/components/ui/sidebar";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ReportBugDialog } from "@/components/bugs/ReportBugDialog";
import { useIsCompact } from "@/hooks/use-mobile";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import orbiLogo from "@/assets/orbi-logo_white.png";
import { useSubscription } from "@/hooks/use-subscription";
import {
  APP_NAVIGATION_GROUPS,
  SETTINGS_NAVIGATION_ITEM,
  type AppNavigationGroup,
  type AppNavigationItem,
} from "./app-navigation";

/**
 * Arquitetura da navegação (16 destinos → 4 blocos):
 *
 *   núcleo (fixo)   Dashboard, Extrato, Contas, Cartões
 *   Planejar        o que a pessoa DEFINE: tetos, metas, projetos, rateios
 *   Analisar        o que o Orbi CALCULA: projeção, fechamento, inflação
 *   Cadastros       estrutura de apoio: categorias, pessoas, notas, IA
 *   rodapé          Configurações + Defeitos (utilitários, fora da lista)
 *
 * Os blocos rotulados são recolhíveis e lembram o estado por navegador. O
 * bloco que contém a rota atual abre sozinho — a página ativa nunca fica
 * escondida. Resultado: nenhuma rolagem interna em telas a partir de ~700px.
 */
const STORAGE_KEY = "orbi:sidebar:open-groups";
const DEFAULT_OPEN = ["plan"];

const groupOfPath = (path: string) =>
  APP_NAVIGATION_GROUPS.find((group) => group.label && group.items.some((item) => item.path === path))?.id;

function readOpenGroups(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OPEN;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(0, 10) : DEFAULT_OPEN;
  } catch {
    return DEFAULT_OPEN;
  }
}

function writeOpenGroups(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* modo privado / storage bloqueado: só não lembra */
  }
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";

interface AppSidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Navegação principal.
 *
 * `lg+`  → coluna navy fixa, linhas de 32px.
 * `<lg`  → o mesmo conteúdo dentro de um drawer (Sheet) vindo da esquerda,
 *          com alvos de 44px e respiro para o recorte do aparelho.
 */
export function AppSidebar({ open, onOpenChange }: AppSidebarProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isCompact = useIsCompact();
  const { hasFeature, isLoading: planLoading } = useSubscription();

  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const initial = readOpenGroups();
    const active = groupOfPath(currentPath);
    return active && !initial.includes(active) ? [...initial, active] : initial;
  });

  // Navegou para um item de bloco recolhido (atalho, link interno) → abre o bloco.
  useEffect(() => {
    const active = groupOfPath(currentPath);
    if (!active) return;
    setOpenGroups((prev) => {
      if (prev.includes(active)) return prev;
      const next = [...prev, active];
      writeOpenGroups(next);
      return next;
    });
  }, [currentPath]);

  const toggleGroup = useCallback((id: string, isOpen: boolean) => {
    setOpenGroups((prev) => {
      const next = isOpen ? Array.from(new Set([...prev, id])) : prev.filter((g) => g !== id);
      writeOpenGroups(next);
      return next;
    });
  }, []);

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isCompact && onOpenChange) onOpenChange(false);
  };

  // Enquanto o plano carrega, nada de cadeado piscando.
  const isLocked = (item: AppNavigationItem) => Boolean(item.feature) && !planLoading && !hasFeature(item.feature!);

  const renderItem = (item: AppNavigationItem) => {
    const Icon = item.icon;
    const isActive = currentPath === item.path;
    const locked = isLocked(item);
    return (
      <li key={item.path}>
        <button
          type="button"
          aria-current={isActive ? "page" : undefined}
          onClick={() => handleNavigate(item.path)}
          className={cn(
            "relative flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm lg:h-8 lg:gap-2.5 lg:px-2.5",
            "transition-colors duration-200 ease-swift",
            focusRing,
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
          {locked && (
            <>
              <Lock className="ml-auto h-3 w-3 shrink-0 text-sidebar-muted/80" aria-hidden />
              <span className="sr-only"> (disponível no Pro e no Casal)</span>
            </>
          )}
        </button>
      </li>
    );
  };

  const renderGroup = (group: AppNavigationGroup) => {
    const list = <ul className="space-y-px">{group.items.map(renderItem)}</ul>;

    if (!group.label) {
      return (
        <div key={group.id} className="pb-1">
          {list}
        </div>
      );
    }

    const isOpen = openGroups.includes(group.id);
    const hasActive = group.items.some((item) => item.path === currentPath);
    const allLocked = !planLoading && group.items.every(isLocked);

    return (
      <Collapsible
        key={group.id}
        open={isOpen}
        onOpenChange={(next) => toggleGroup(group.id, next)}
        className="border-t border-sidebar-border/60 pt-2 mt-2 lg:pt-1.5 lg:mt-1.5"
      >
        <CollapsibleTrigger
          className={cn(
            "group/trigger flex h-11 w-full items-center gap-2 rounded-md px-3 lg:h-7 lg:px-2.5",
            "text-2xs font-medium uppercase tracking-eyebrow text-sidebar-muted/70",
            "transition-colors duration-200 ease-swift hover:text-sidebar-accent-foreground",
            focusRing,
          )}
        >
          <span className="truncate">{group.label}</span>
          {!isOpen && hasActive && (
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-marker" />
          )}
          {allLocked && (
            <>
              <Lock className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
              <span className="sr-only"> (disponível no Pro e no Casal)</span>
            </>
          )}
          <ChevronRight
            aria-hidden
            className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200 ease-swift group-data-[state=open]/trigger:rotate-90 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
          <div className="pb-1 pt-0.5">{list}</div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const settingsActive = currentPath === SETTINGS_NAVIGATION_ITEM.path;
  const SettingsIcon = SETTINGS_NAVIGATION_ITEM.icon;

  // Função de render (não componente interno): evita remontar a árvore a cada
  // render do pai, o que reiniciaria as animações dos blocos.
  const renderNav = (drawer = false) => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div className="flex h-header shrink-0 items-center justify-between px-4 lg:h-header-lg lg:px-5">
        <div className="flex items-center gap-2.5">
          <img src={orbiLogo} alt="Logotipo do Orbi" width={28} height={28} decoding="async" className="h-7 w-7" />
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
      <div className="shrink-0 px-3 pb-2">
        <button
          type="button"
          onClick={() => handleNavigate("/sistema/statement?new=1")}
          className={cn(
            "flex h-11 w-full items-center justify-center gap-2 rounded-md lg:h-9",
            "bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground",
            "transition-[background-color,transform] duration-200 ease-swift hover:bg-white/[0.16] active:scale-[0.98]",
            focusRing,
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nova transação
        </button>
      </div>

      {/* Navegação — rolagem só como último recurso (telas muito baixas) */}
      <nav
        aria-label="Navegação principal"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1 [scrollbar-width:thin]"
      >
        {APP_NAVIGATION_GROUPS.map(renderGroup)}
      </nav>

      {/* Utilitários */}
      <div className="flex shrink-0 items-center gap-1 border-t border-sidebar-border px-3 py-2 pb-safe lg:pb-2">
        <button
          type="button"
          aria-current={settingsActive ? "page" : undefined}
          onClick={() => handleNavigate(SETTINGS_NAVIGATION_ITEM.path)}
          className={cn(
            "flex h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-sm lg:h-8 lg:gap-2.5 lg:px-2.5",
            "transition-colors duration-200 ease-swift",
            focusRing,
            settingsActive
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          )}
        >
          <SettingsIcon className={cn("h-4 w-4 shrink-0", !settingsActive && "opacity-80")} aria-hidden />
          <span className="truncate">{SETTINGS_NAVIGATION_ITEM.title}</span>
        </button>
        <ReportBugDialog variant="icon" />
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
            <SheetDescription>Links para as seções do sistema.</SheetDescription>
          </VisuallyHidden>
          {renderNav(true)}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sidebar
      collapsible="none"
      className="hidden border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-svh lg:shrink-0"
    >
      {renderNav()}
    </Sidebar>
  );
}
