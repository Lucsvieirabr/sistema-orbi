import { Search, LogOut } from "lucide-react";
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
}

export function AppHeader({ title, subtitle, onLogout, className, rightSlot }: HeaderProps) {
  return (
    <header className={cn("flex h-16 items-center justify-between border-b border-border bg-card/50 px-6 backdrop-blur-sm", className)}>
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-muted-foreground hidden md:block">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <SearchPopover />
        {rightSlot}
        <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}


