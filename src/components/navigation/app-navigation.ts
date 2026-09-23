import {
  Brain,
  CreditCard,
  LayoutDashboard,
  List,
  Receipt,
  Settings,
  StickyNote,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { PREMIUM_MODULES, type PremiumModule } from "@/lib/features/premium-modules";

export interface AppNavigationItem {
  title: string;
  icon: LucideIcon;
  path: string;
  /** Feature de plano exigida (módulos premium). Sem ela, o item mostra um cadeado. */
  feature?: string;
}

export interface AppNavigationGroup {
  id: string;
  /** Sem label = grupo fixo, sempre aberto (destinos de maior tráfego). */
  label?: string;
  items: AppNavigationItem[];
}

const fromModule = (module: PremiumModule): AppNavigationItem => ({
  title: module.navLabel,
  icon: module.icon,
  path: module.path,
  feature: module.feature,
});

/**
 * Fonte única dos destinos exibidos na navegação principal e na busca global.
 * Ao adicionar uma página à barra lateral, ela passa a ser pesquisável sem
 * precisar manter uma segunda lista em sincronia.
 */
export const APP_NAVIGATION_GROUPS: AppNavigationGroup[] = [
  {
    id: "core",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/sistema" },
      { title: "Extrato", icon: Receipt, path: "/sistema/statement" },
      { title: "Contas", icon: Wallet, path: "/sistema/accounts" },
      { title: "Cartões", icon: CreditCard, path: "/sistema/cards" },
    ],
  },
  {
    id: "plan",
    label: "Planejar",
    items: [PREMIUM_MODULES.budgets, PREMIUM_MODULES.goals, PREMIUM_MODULES.projects, PREMIUM_MODULES.ledgers].map(
      fromModule,
    ),
  },
  {
    id: "insights",
    label: "Analisar",
    items: [PREMIUM_MODULES.forecast, PREMIUM_MODULES.analytics, PREMIUM_MODULES.inflation].map(fromModule),
  },
  {
    id: "setup",
    label: "Cadastros",
    items: [
      { title: "Categorias", icon: List, path: "/sistema/categories" },
      { title: "Pessoas", icon: Users, path: "/sistema/people" },
      { title: "Notas", icon: StickyNote, path: "/sistema/notes" },
      { title: "Classificação automática", icon: Brain, path: "/sistema/my-ai" },
    ],
  },
];

export const SETTINGS_NAVIGATION_ITEM: AppNavigationItem = {
  title: "Configurações",
  icon: Settings,
  path: "/sistema/settings",
};

export const APP_NAVIGATION_ITEMS: AppNavigationItem[] = [
  ...APP_NAVIGATION_GROUPS.flatMap((group) => group.items),
  SETTINGS_NAVIGATION_ITEM,
];
