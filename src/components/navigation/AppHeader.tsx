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
  showMenuButton?: boolean;
}

/**
 * Header: uma faixa de respiro. Hairline no lugar de borda pesada,
 * sem blur nem sombra, título em display para ancorar a página.
 */
export function AppHeader({
  title,
  subtitle,
  onLogout,
  className,
  rightSlot,
  onMenuClick,
  showMenuButton = false,
}: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-header shrink-0 items-center justify-between gap-4",
        "border-b border-border-subtle bg-background/90 px-4 backdrop-blur-[2px] lg:px-8",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {showMenuButton && onMenuClick && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} aria-label="Abrir menu" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-semibold tracking-tight text-foreground lg:text-xl">
            {title}
          </h1>
          {subtitle && <p className="hidden truncate text-xs text-muted-foreground lg:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 lg:gap-2">
        <SearchPopover />
        {rightSlot}
        <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          <span className="hidden lg:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}
