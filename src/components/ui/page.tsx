import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Primitivos de arquitetura de página do Orbi.
 *
 * A regra que estes componentes existem para impor: **o título de uma página
 * não mora dentro de um Card**. Card é uma superfície de conteúdo; embrulhar o
 * cabeçalho num Card cria uma caixa que não delimita nada e achata a
 * hierarquia — era o "layout em bloco" que todas as telas repetiam.
 *
 * A arquitetura passa a ser sempre a mesma, em três faixas:
 *
 *   PageHeader   eyebrow → título → lede, com as ações ancoradas à direita
 *                no desktop. Fecha com um hairline de 1px.
 *   PageToolbar  busca, filtros e alternância de visão, soltos sobre a página.
 *   conteúdo     as superfícies reais (cards, tabelas, listas).
 *
 * Nada de ícone dentro de quadradinho colorido ao lado do título: a identidade
 * da tela é carregada pelo eyebrow, não por um bloco de cor.
 */

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Micro-caps acima do título. É o que situa a tela na navegação. */
  eyebrow?: React.ReactNode;
  /** Ícone opcional, discreto, ao lado do eyebrow. Nunca um bloco de cor. */
  icon?: LucideIcon;
  title: React.ReactNode;
  /** Uma linha. Explica o que a tela faz, não o que ela é. */
  description?: React.ReactNode;
  /** Ações primárias da tela (normalmente um único botão). */
  actions?: React.ReactNode;
  /** Remove o hairline inferior quando a faixa seguinte já separa. */
  bare?: boolean;
}

export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ eyebrow, icon: Icon, title, description, actions, bare = false, className, children, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10",
        !bare && "border-b border-border-subtle pb-4 md:pb-5",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {(eyebrow || Icon) && (
          <p className="label-eyebrow flex items-center gap-1.5">
            {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden />}
            {eyebrow}
          </p>
        )}
        <h1
          className={cn(
            "min-w-0 font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground md:text-2xl",
            (eyebrow || Icon) && "mt-1.5",
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
        )}
        {children}
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  ),
);
PageHeader.displayName = "PageHeader";

/**
 * Faixa de controles da página: busca, filtros, alternância de visão.
 * Fica solta sobre o fundo — nunca dentro de um Card.
 */
export const PageToolbar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3", className)}
      {...props}
    />
  ),
);
PageToolbar.displayName = "PageToolbar";

/** Empurra o que vem depois para a direita dentro da toolbar. */
export const ToolbarSpacer = () => <div className="hidden flex-1 sm:block" />;

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

/** Cabeçalho de uma seção dentro da página. Um degrau abaixo do PageHeader. */
export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ eyebrow, title, description, actions, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow && <p className="label-eyebrow">{eyebrow}</p>}
        {title && (
          <h2 className={cn("font-display text-base font-semibold tracking-[-0.015em] text-foreground", eyebrow && "mt-1")}>
            {title}
          </h2>
        )}
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  ),
);
SectionHeader.displayName = "SectionHeader";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Nível do título. Use "h1" quando o estado vazio ocupa a página inteira (sem PageHeader). */
  titleAs?: "p" | "h1" | "h2" | "h3";
}

/**
 * Estado vazio: hairline tracejado, ícone pequeno numa caixa de 1px, uma
 * frase. Sem círculo gigante de fundo cinza.
 */
export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon, title, description, action, titleAs: Title = "p", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center md:py-16",
        className,
      )}
      {...props}
    >
      {Icon && (
        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </span>
      )}
      <Title className="font-display text-base font-semibold tracking-[-0.015em] text-foreground text-balance">{title}</Title>
      {description && (
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";

/** Espaçamento vertical padrão de uma página do app. */
export const PageBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("min-w-0 space-y-5 md:space-y-7", className)} {...props} />
  ),
);
PageBody.displayName = "PageBody";
