import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchPopover } from "./SearchPopover";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onLogout: () => void;
  className?: string;
  rightSlot?: React.ReactNode;
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

/**
 * Header: uma faixa de respiro. Hairline no lugar de borda pesada,
 * sem blur nem sombra, título em display para ancorar a página.
 *
 * Mobile-first: 3.5rem de altura no telefone (cada pixel vertical conta),
 * 4.5rem a partir de `lg`. O hambúrguer existe em toda a faixa abaixo de `lg`
 * — é o único caminho para a navegação completa fora do desktop.
 */
export function AppHeader({
  title,
  subtitle,
  onLogout,
  className,
  rightSlot,
  onMenuClick,
  menuOpen = false,
}: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-header flex h-header shrink-0 items-center justify-between gap-2 lg:h-header-lg lg:gap-4",
        "border-b border-border-subtle bg-background/90 px-2 backdrop-blur-[2px] md:px-4 lg:px-8",
        className,
      )}
    >
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
          {/* <p>, não <h1>: o único h1 da tela é o PageHeader da página. */}
          <p className="truncate font-display text-base font-semibold tracking-tight text-foreground md:text-lg lg:text-xl">
            {title}
          </p>
          {subtitle && <p className="hidden truncate text-xs text-muted-foreground lg:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 md:gap-1 lg:gap-2">
        <SearchPopover />
        {rightSlot}
        <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Sair" className="lg:hidden">
          <LogOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onLogout} className="hidden gap-2 lg:inline-flex">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}
