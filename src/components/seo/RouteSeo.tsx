import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

import { resolveRouteSeo } from "@/lib/seo";

import { applySeo } from "./Seo";

/**
 * Aplica o <head> da rota atual a cada navegação. Montado UMA vez dentro do
 * <BrowserRouter> (App.tsx), antes de <Routes>.
 *
 * `useLayoutEffect` roda antes dos `useEffect` das páginas: um <Seo /> pontual
 * dentro de uma página continua tendo a palavra final.
 */
export function RouteSeo() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    applySeo(resolveRouteSeo(pathname));
  }, [pathname]);

  return null;
}
