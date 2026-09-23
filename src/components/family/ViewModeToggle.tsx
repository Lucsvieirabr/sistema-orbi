import { useRef, type KeyboardEvent } from "react";
import { User } from "lucide-react";
import { AuthorAvatar } from "@/components/family/AuthorTag";
import type { FamilyAuthor } from "@/hooks/use-family-group";
import { useSpace } from "@/hooks/use-space";
import type { ViewMode } from "@/hooks/use-view-mode";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ViewMode; label: string; short: string }[] = [
  { value: "personal", label: "Meu espaço", short: "Meu" },
  { value: "couple", label: "Nosso espaço", short: "Nosso" },
];

/**
 * Seletor global Me-Space × We-Space (vive no AppHeader).
 *
 * Segmentado com um "puck" que desliza entre os lados (transform, 300ms,
 * curva swift) — o gesto é o mesmo do espaço que se abre: da esquerda
 * (eu) para a direita (nós). Sem Framer Motion de propósito: a política de
 * pacotes bloqueia `framer-motion` e a CSP proíbe carregar de fora; CSS no
 * compositor entrega o mesmo movimento com zero KB.
 *
 * Acessível como radiogroup (setas trocam, Tab entra só no item ativo).
 * Só aparece com parceiro vinculado.
 */
export function ViewModeToggle({ className }: { className?: string }) {
  const { mode, isLinked, me, partner, setSpace } = useSpace();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!isLinked) return null;

  const activeIndex = mode === "couple" ? 1 : 0;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : activeIndex === 0 ? 1 : 0;
    setSpace(OPTIONS[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Espaço financeiro"
      onKeyDown={onKeyDown}
      className={cn(
        "relative grid h-9 shrink-0 grid-cols-2 items-center rounded-full bg-muted/70 p-0.5 ring-1 ring-inset ring-border-subtle",
        className,
      )}
    >
      {/* Puck: metade exata do trilho, desliza por translateX(100%). */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full bg-background shadow-sm ring-1 ring-inset",
          "transition-transform duration-300 ease-swift will-change-transform",
          activeIndex === 1 ? "translate-x-full ring-chart-6/25" : "translate-x-0 ring-border-subtle",
        )}
      />

      {OPTIONS.map((option, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={option.value}
            ref={(node) => (refs.current[index] = node)}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            tabIndex={active ? 0 : -1}
            onClick={() => setSpace(option.value)}
            className={cn(
              "press relative z-10 inline-flex h-8 min-w-touch items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-medium sm:px-3",
              // Área de toque de 44px sem engordar o trilho visual (WCAG 2.5.5).
              "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
              "outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.value === "personal" ? (
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <CoupleGlyph me={me} partner={partner} active={active} />
            )}
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sm:hidden">{option.short}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Dois avatares sobrepostos (foto → iniciais → glifo): o "nós" em forma de glifo. */
function CoupleGlyph({ me, partner, active }: { me: FamilyAuthor | null; partner: FamilyAuthor | null; active: boolean }) {
  const face = "h-4 w-4 text-[0.4375rem] ring-2 ring-background";
  return (
    <span aria-hidden className="flex shrink-0 -space-x-1.5">
      {me && <AuthorAvatar author={me} className={face} />}
      {partner && (
        <AuthorAvatar
          author={partner}
          className={cn(face, "transition-opacity duration-300", active ? "opacity-100" : "opacity-60")}
        />
      )}
    </span>
  );
}

/** Nome novo; `ViewModeToggle` segue exportado para não quebrar imports. */
export { ViewModeToggle as SpaceSwitch };
