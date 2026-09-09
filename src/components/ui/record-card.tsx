import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Stacked Cards — a forma mobile de uma linha de tabela.
 *
 * Regra do sistema: nenhuma tabela financeira rola a página para os lados.
 * Até `md` cada registro vira um card empilhado (`<RecordCardList>`); de `md`
 * para cima volta a ser tabela (`<TableView>`), que por sua vez rola dentro do
 * próprio contêiner.
 *
 *   <RecordCardList>            → visível só abaixo de `md`
 *   <TableView><Table/></TableView> → visível só de `md` para cima
 */

/** Lista de cards empilhados. Some a partir de `md`. */
export function RecordCardList({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("space-y-2 md:hidden", className)} {...props} />;
}

/** Contêiner da tabela “de verdade”. Aparece só de `md` para cima. */
export function TableView({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("hidden rounded-lg border border-border md:block", className)} {...props} />;
}

export interface RecordCardProps extends React.LiHTMLAttributes<HTMLLIElement> {
  /** Faixa de 2px à esquerda — cor semântica do registro (entrada/saída). */
  accent?: "neutral" | "positive" | "negative" | "warning";
}

const accentBar: Record<NonNullable<RecordCardProps["accent"]>, string> = {
  neutral: "bg-border",
  positive: "bg-success",
  negative: "bg-destructive",
  warning: "bg-warning",
};

/** Um registro. Hairline + whitespace, sem sombra — igual ao resto do sistema. */
export function RecordCard({ accent = "neutral", className, children, ...props }: RecordCardProps) {
  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card p-3 pl-4",
        "transition-colors duration-200 ease-swift",
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-0.5", accentBar[accent])} />
      {children}
    </li>
  );
}

/** Linha de topo do card: título à esquerda, valor à direita. */
export function RecordCardHead({
  title,
  meta,
  value,
  valueClassName,
  valueMeta,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  value?: React.ReactNode;
  valueClassName?: string;
  valueMeta?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        {meta && <div className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</div>}
      </div>
      {value !== undefined && (
        <div className="shrink-0 text-right">
          <div className={cn("figure-sm tabular", valueClassName)}>{value}</div>
          {valueMeta && <div className="text-2xs text-muted-foreground">{valueMeta}</div>}
        </div>
      )}
    </div>
  );
}

/** Pares rótulo/valor que substituem as colunas restantes da tabela. */
export function RecordFields({ className, ...props }: React.HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn("mt-2 grid grid-cols-2 gap-x-3 gap-y-1", className)} {...props} />;
}

export function RecordField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="label-eyebrow">{label}</dt>
      <dd className="truncate text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** Rodapé de ações: alvos de 44px, alinhados à direita. */
export function RecordActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-2 flex items-center justify-end gap-1 border-t border-border-subtle pt-2", className)}
      {...props}
    />
  );
}
