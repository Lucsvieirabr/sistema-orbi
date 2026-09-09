import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Toggle / item de ToggleGroup.
 *
 * O estado ligado e uma superficie elevada (card) sobre o trilho afundado, com
 * hairline e sombra curta — o mesmo vocabulario de um segmented control nativo.
 * Ligado e desligado tem sempre `foreground` explicito: nunca herdam a cor do
 * pai, que era como o rotulo sumia quando o trilho mudava de tom.
 */
const toggleVariants = cva(
  [
    "inline-flex select-none items-center justify-center gap-2 rounded-md text-sm font-medium",
    "transition-[background-color,color,box-shadow,transform] duration-200 ease-swift",
    "motion-safe:active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "text-muted-foreground hover:text-foreground",
    "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ variant, size, className }))} {...props} />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
