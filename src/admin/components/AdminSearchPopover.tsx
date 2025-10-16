import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LayoutDashboard, Users, CreditCard, Receipt, Settings, Shield, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface SearchItem {
  title: string;
  icon: any;
  path: string;
}

const searchItems: SearchItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { title: "Usuários", icon: Users, path: "/admin/users" },
  { title: "Assinaturas", icon: CreditCard, path: "/admin/subscriptions" },
  { title: "Planos", icon: Receipt, path: "/admin/plans" },
  { title: "Pagamentos", icon: FileText, path: "/admin/payments" },
  { title: "Analytics", icon: BarChart3, path: "/admin/analytics" },
  { title: "Administradores", icon: Shield, path: "/admin/admins" },
  { title: "Configurações", icon: Settings, path: "/admin/settings" },
];

export function AdminSearchPopover() {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const navigate = useNavigate();

  const filteredItems = searchItems.filter(item =>
    item.title.toLowerCase().includes(searchValue.toLowerCase()) ||
    item.path.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    setOpen(false);
    setSearchValue("");
  };

  // Atalho de teclado Ctrl+K para abrir a busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-40 md:w-80 justify-start text-muted-foreground">
          <Search className="mr-2 h-4 w-4" />
          <span className="hidden md:inline">Buscar páginas...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 hidden md:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 md:w-80 p-0" align="start" sideOffset={4}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar páginas..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>Nenhuma página encontrada.</CommandEmpty>
            {filteredItems.length > 0 && (
              <CommandGroup heading="Páginas Administrativas">
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.path}
                      value={item.path}
                      onSelect={() => handleSelect(item.path)}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

