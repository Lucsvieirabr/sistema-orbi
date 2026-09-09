import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Botao. Uma unica acao de destaque por tela usa `default`.
 *
 * Resposta tatil (as tres camadas):
 *   hover  -> a cor se aproxima 1 degrau, em 200ms;
 *   active -> o botao cede 2% de escala em 100ms (so com motion-safe);
 *   focus  -> anel de 2px separado da borda por um offset do fundo.
 * O anel de foco e obrigatorio. Nunca remova.
 */
const buttonVariants = cva(
  [
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 ease-swift",
    "motion-safe:active:scale-[0.98] motion-safe:active:duration-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-primary",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border bg-transparent text-foreground hover:border-ring/45 hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        subtle: "bg-transparent text-muted-foreground hover:text-foreground",
      },
      /**
       * Mobile-first: a base e a medida do dedo (44px = h-11, WCAG 2.5.5) e
       * `md:` reduz para a densidade de mouse. Nunca o contrario.
       */
      size: {
        default: "h-11 px-4 py-2 md:h-10",
        sm: "h-10 rounded-md px-3 text-[0.8125rem] md:h-9",
        lg: "h-12 rounded-lg px-6 text-base md:h-11",
        icon: "h-11 w-11 md:h-10 md:w-10",
        "icon-sm": "h-11 w-11 rounded-md md:h-8 md:w-8 md:[&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...(asChild ? {} : { type: type ?? "button" })}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
