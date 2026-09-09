import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Card minimalista.
 * Sem sombra: a superfície é definida por 1px de hairline + whitespace.
 * `elevated` existe apenas para conteúdo que realmente flutua sobre a página.
 */
const cardVariants = cva("rounded-xl bg-card text-card-foreground", {
  variants: {
    variant: {
      default: "border border-border",
      elevated: "border border-border shadow-md",
      ghost: "border border-transparent",
      sunken: "border border-border-subtle bg-surface-sunken",
    },
    interactive: {
      true: "transition-colors duration-200 ease-swift hover:border-ring/40 focus-within:border-ring/60",
      false: "",
    },
  },
  defaultVariants: { variant: "default", interactive: false },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant, interactive, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant, interactive }), className)} {...props} />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1 px-4 pb-3 pt-4 md:px-5 md:pb-4 md:pt-5 lg:px-6 lg:pt-6", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "font-display text-[0.9375rem] font-semibold leading-tight tracking-tight text-foreground md:text-base",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-4 pb-4 md:px-5 md:pb-5 lg:px-6 lg:pb-6", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-stretch gap-2 border-t border-border-subtle px-4 py-3",
        "sm:flex-row sm:items-center sm:gap-3 md:px-5 md:py-4 lg:px-6",
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
