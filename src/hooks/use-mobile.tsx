import * as React from "react";

/**
 * Breakpoints espelham a escala do Tailwind. Manter os dois em sincronia é o
 * que evita a "faixa morta" (ex.: sidebar aparecendo só em `lg` enquanto o
 * hambúrguer sumia em `md`, deixando o tablet sem navegação nenhuma).
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/** `true` enquanto a viewport for menor que o breakpoint informado. */
export function useBelowBreakpoint(breakpoint: Breakpoint) {
  const width = BREAKPOINTS[breakpoint];
  const [isBelow, setIsBelow] = React.useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < width,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${width - 0.02}px)`);
    const onChange = (event: MediaQueryListEvent | MediaQueryList) => setIsBelow(event.matches);

    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [width]);

  return isBelow;
}

/** Telefone: abaixo de `md` (768px). Densidade compacta, uma coluna. */
export function useIsMobile() {
  return useBelowBreakpoint("md");
}

/**
 * Telefone **ou** tablet: abaixo de `lg` (1024px) — a faixa em que a sidebar
 * fixa não cabe e a navegação vira drawer + barra inferior.
 */
export function useIsCompact() {
  return useBelowBreakpoint("lg");
}
