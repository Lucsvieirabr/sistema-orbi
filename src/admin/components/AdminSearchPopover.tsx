import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LayoutDashboard, Users, CreditCard, Receipt, Shield, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface SearchItem {
  title: string;
  icon: any;
  path: string;
}

const searchItems: SearchItem[] = [
  { title: "Painel", icon: LayoutDashboard, path: "/admin/dashboard" },
  { title: "Usuários", icon: Users, path: "/admin/users" },
  { title: "Assinaturas", icon: CreditCard, path: "/admin/subscriptions" },
  { title: "Planos", icon: Receipt, path: "/admin/plans" },
  { title: "Administradores", icon: Shield, path: "/admin/admins" },
  { title: "Defeitos & sugestões", icon: Bug, path: "/admin/bug-reports" },
];

export function AdminSearchPopover() {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const navigate = useNavigate();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const shortcutLabel = isMac ? "⌘K" : "Ctrl+K";

  const filteredItems = searchItems.filter(item =>
    item.title.toLowerCase().includes(searchValue.toLowerCase()) ||
    item.path.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    setOpen(false);
    setSearchValue("");
  };

  // Atalho nativo da plataforma para abrir a busca.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
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
        <Button
          variant="ghost"
          aria-label="Buscar"
          className="h-11 w-11 justify-center px-0 text-muted-foreground md:h-10 md:w-80 md:justify-start md:border md:border-border md:px-3"
        >
          <Search className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Buscar páginas</span>
          <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground md:flex">
            {shortcutLabel}
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-1.5rem))] p-0" align="start" sideOffset={4}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar páginas"
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
                      className="flex min-h-touch items-center gap-3 px-3 py-2.5 md:min-h-0 md:py-2"
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
