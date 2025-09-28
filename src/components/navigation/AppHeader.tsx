import { Search, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onLogout: () => void;
}

export function AppHeader({ title, subtitle, onLogout }: HeaderProps) {
  return (
    <header className="hidden md:flex h-16 items-center justify-between border-b border-border bg-card/50 px-6 backdrop-blur-sm">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." className="w-80 pl-10 transition-smooth focus:ring-primary" />
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}


