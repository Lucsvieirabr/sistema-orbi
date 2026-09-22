import { getCachedAuthUser } from "@/hooks/use-current-user";
/**
 * Modo de visualização: Pessoal (só seus dados) x Casal (você + parceiro).
 * Store externo simples (sem Context/Redux) + persistência em localStorage.
 */
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ViewMode = "personal" | "couple";

const STORAGE_KEY = "orbi:view-mode";

const readInitial = (): ViewMode => {
  try {
    return (localStorage.getItem(STORAGE_KEY) as ViewMode) === "couple" ? "couple" : "personal";
  } catch {
    return "personal";
  }
};

let currentMode: ViewMode = readInitial();
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function getViewMode(): ViewMode {
  return currentMode;
}

export function setViewMode(next: ViewMode) {
  if (next === currentMode) return;
  currentMode = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l());
}

export function useViewMode(): ViewMode {
  return useSyncExternalStore(subscribe, getViewMode, getViewMode);
}

/**
 * user_ids que devem ser lidos nas queries financeiras.
 * Pessoal: [eu]. Casal: [eu, parceiro] (via RPC orbi_family_user_ids).
 */
export async function getScopeUserIds(): Promise<string[]> {
  const { data: { user } } = await getCachedAuthUser();
  const me = user?.id ? [user.id] : [];
  if (currentMode !== "couple" || me.length === 0) return me;

  const { data, error } = await (supabase as any).rpc("orbi_family_user_ids");
  if (error || !Array.isArray(data) || data.length === 0) return me;
  return data as string[];
}
