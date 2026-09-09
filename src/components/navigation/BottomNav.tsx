import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Receipt, Wallet, CreditCard, Menu } from "lucide-react";

import { cn } from "@/lib/utils";

interface BottomNavProps {
  /** Abre o drawer com a navegação completa. */
  onMenuClick: () => void;
  menuOpen?: boolean;
}

const destinations = [
  { title: "Início", icon: LayoutDashboard, path: "/sistema" },
  { title: "Extrato", icon: Receipt, path: "/sistema/statement" },
  { title: "Contas", icon: Wallet, path: "/sistema/accounts" },
  { title: "Cartões", icon: CreditCard, path: "/sistema/cards" },
];

/**
 * Barra de navegação inferior — o polegar alcança tudo.
 *
 * Só existe abaixo de `lg`; no desktop a sidebar cumpre o papel. Quatro
 * destinos de maior tráfego + "Menu", que abre o drawer com o resto.
 * Cada alvo tem 44px de altura mínima e respeita o recorte do aparelho.
 */
export function BottomNav({ onMenuClick, menuOpen = false }: BottomNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const itemClass = (isActive: boolean) =>
    cn(
      "relative flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1.5",
      "text-2xs font-medium transition-colors duration-200 ease-swift",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <nav
      aria-label="Navegação rápida"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-t border-border bg-background/95 backdrop-blur-[2px]",
        "pb-safe",
      )}
    >
      <ul className="flex h-bottom-nav items-stretch">
        {destinations.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <li key={item.path} className="flex flex-1">
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => navigate(item.path)}
                className={itemClass(isActive)}
              >
                {isActive && (
                  <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" />
                )}
                <Icon className="h-5 w-5" aria-hidden />
                <span className="truncate">{item.title}</span>
              </button>
            </li>
          );
        })}

        <li className="flex flex-1">
          <button
            type="button"
            onClick={onMenuClick}
            aria-expanded={menuOpen}
            aria-label="Abrir menu completo"
            className={itemClass(menuOpen)}
          >
            <Menu className="h-5 w-5" aria-hidden />
            <span className="truncate">Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
