import * as React from "react";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Ações flutuantes do Orbi (FAB).
 *
 * Por que um componente e não duas classes soltas por tela:
 *
 *  1. **Colisão.** Antes cada botão tinha o seu próprio `right-*` fixo
 *     (`right-4`, `right-[4.75rem]`). Quando um deles some — `FeatureGuard`
 *     esconde o de importar em planos sem CSV — o outro ficava com um buraco
 *     ao lado, e qualquer terceiro botão precisava de mais um número mágico.
 *     Aqui os botões vivem num *flex* ancorado à direita: a fila se refaz
 *     sozinha.
 *
 *  2. **Empilhamento.** O z-index sai do arbítrio de cada tela e passa a vir
 *     da escala do design system (`z-fab` = 45): acima da barra inferior
 *     (`z-bottom-nav` = 40) e **abaixo** de qualquer overlay Radix
 *     (`z-overlay` = 50) — modal, sheet e drawer continuam cobrindo o FAB
 *     independentemente da ordem no DOM.
 *
 *  3. **Recorte do aparelho.** A âncora é `--bottom-nav-offset`, que já soma
 *     `env(safe-area-inset-bottom)`. No iPhone o botão nunca encosta na barra
 *     de gestos; no desktop (`lg`, onde a altura da barra vira 0) sobra só o
 *     respiro da tela.
 */

/** Container fixo. Renderize um por tela, no fim da árvore da página. */
export const FabStack = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      /* `inset-x-0` + `justify-end` em vez de `right-*`: o balão de onboarding
         pode crescer para a esquerda sem nunca estourar a largura da tela.
         `pointer-events-none` na faixa, `auto` só na fila — a área vazia à
         esquerda continua clicável. */
      className={cn(
        "pointer-events-none fixed inset-x-0 z-fab flex justify-end px-4 lg:px-6",
        "bottom-[calc(var(--bottom-nav-offset)+0.75rem)] lg:bottom-[calc(var(--bottom-nav-offset)+1.5rem)]",
        className,
      )}
      {...props}
    >
      <div className="pointer-events-auto relative flex items-center gap-2.5">{children}</div>
    </div>
  ),
);
FabStack.displayName = "FabStack";

export interface FabActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Texto do rótulo acessível e do tooltip. Obrigatório: o ícone sozinho não fala. */
  label: string;
  icon: LucideIcon;
  /** `primary` = ação principal da tela (uma só). `secondary` = apoio. */
  variant?: "primary" | "secondary";
  /**
   * Pulso de luz ao redor do botão. Exclusivo de telas em que a ação precisa
   * ser *descoberta* (ver `FabHint`) — nunca ligado por padrão.
   */
  highlight?: boolean;
}

/**
 * Botão flutuante. `forwardRef` + spread completo para funcionar como
 * `asChild` de `DialogTrigger`.
 */
export const FabAction = React.forwardRef<HTMLButtonElement, FabActionProps>(
  ({ label, icon: Icon, variant = "primary", highlight = false, className, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          className={cn(
            /* 56px no toque, 48px no mouse — acima do mínimo de 44px. */
            "press flex h-14 w-14 items-center justify-center rounded-full lg:h-12 lg:w-12",
            "transition-colors duration-200 ease-swift",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            variant === "primary"
              ? "bg-primary text-primary-foreground shadow-primary hover:bg-primary-hover"
              : "border border-border bg-card text-muted-foreground shadow-md hover:border-ring/50 hover:text-foreground",
            /* O glow é `box-shadow`: não reflui layout e não empurra o vizinho. */
            highlight && "motion-safe:animate-fab-pulse",
            className,
          )}
          {...props}
        >
          <Icon className="h-5 w-5 lg:h-[1.125rem] lg:w-[1.125rem]" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  ),
);
FabAction.displayName = "FabAction";

/**
 * Estado do aviso de onboarding, persistido por tela.
 *
 * Fica fora do componente para que a página possa usar o mesmo `visible`
 * também no `highlight` do botão — aviso e brilho nascem e morrem juntos.
 */
export function useFabHint(storageKey: string, { delay = 650 }: { delay?: number } = {}) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(storageKey) === "1";
    } catch {
      /* modo privativo / storage bloqueado: mostra o aviso, só não lembra. */
    }
    if (dismissed) return;

    /* Pequeno atraso: o balão entra depois que a tela assentou, senão compete
       com o carregamento dos dados. */
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [storageKey, delay]);

  const dismiss = React.useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* idem */
    }
  }, [storageKey]);

  return { visible, dismiss };
}

export interface FabHintProps {
  open: boolean;
  onDismiss: () => void;
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
}

/**
 * Balão de onboarding ancorado ao FAB.
 *
 * Popover, não modal: não escurece a tela, não trava o foco, não bloqueia
 * nada. A largura é `min(18rem, 100vw - 2rem)` — em telefone estreito ele
 * encolhe em vez de vazar. A seta aponta para o centro do botão da direita
 * (28px de meio em `h-14`, 24px em `lg:h-12`).
 */
export function FabHint({ open, onDismiss, eyebrow, title, description }: FabHintProps) {
  if (!open) return null;

  return (
    <div
      role="status"
      className="absolute bottom-full right-0 mb-3 w-[min(18rem,calc(100vw-2rem))] animate-rise"
    >
      <div className="relative rounded-xl border border-border bg-card p-3.5 shadow-lg motion-safe:animate-hint-float">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar aviso"
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 ease-swift hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>

        {eyebrow && <p className="label-eyebrow">{eyebrow}</p>}
        <p className={cn("pr-7 text-sm font-medium leading-snug text-foreground", eyebrow && "mt-1")}>{title}</p>
        {description && (
          <p className="mt-1.5 text-xs leading-relaxed text-pretty text-muted-foreground">{description}</p>
        )}

        {/* Ponteiro: quadrado girado 45°, com as duas bordas de baixo visíveis
            para emendar no hairline do balão. */}
        <span
          aria-hidden
          className="absolute -bottom-[0.4rem] right-[1.375rem] h-3 w-3 rotate-45 rounded-[2px] border-b border-r border-border bg-card lg:right-[1.125rem]"
        />
      </div>
    </div>
  );
}
