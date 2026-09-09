import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge.
 *
 * Duas familias:
 *  - *soft* (padrao): fundo lavado + texto do tom. Rotula sem roubar atencao.
 *  - *-solid*: fundo chapado do tom + o `-foreground` DAQUELE tom.
 *
 * Regra dura: fundo de tom solido so aceita o `-foreground` do proprio tom.
 * `text-white` sobre `bg-success` falha no tema escuro (o verde clareia para
 * L=55%) — era exatamente o defeito da tela de Planos.
 */
const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-medium leading-5",
    "transition-colors duration-200 ease-swift",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        primary: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border text-muted-foreground",
        success: "border-transparent bg-success-soft text-success",
        destructive: "border-transparent bg-destructive-soft text-destructive",
        warning: "border-transparent bg-warning-soft text-warning",
        info: "border-transparent bg-info-soft text-info",
        "success-solid": "border-transparent bg-success text-success-foreground",
        "destructive-solid": "border-transparent bg-destructive text-destructive-foreground",
        "warning-solid": "border-transparent bg-warning text-warning-foreground",
        "info-solid": "border-transparent bg-info text-info-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
