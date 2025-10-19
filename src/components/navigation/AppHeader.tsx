import { Search, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function AppHeader({ 
  title, 
  subtitle, 
  onLogout, 
  className, 
  rightSlot,
  onMenuClick,
  showMenuButton = false 
}: HeaderProps) {
  return (
    <header className={cn("flex h-16 items-center justify-between border-b border-border bg-card/50 px-4 lg:px-6 backdrop-blur-sm", className)}>
      <div className="flex items-center gap-3">
        {showMenuButton && onMenuClick && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-lg lg:text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-xs lg:text-sm text-muted-foreground hidden lg:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
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


