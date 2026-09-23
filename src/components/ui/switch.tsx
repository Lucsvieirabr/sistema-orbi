import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Caixa real de 44×44 (alvo de toque WCAG 2.5.5); o trilho visível de
      // 44×24 é o ::before. -my-2.5 devolve ao fluxo a mesma altura de 24px.
      "peer relative -my-2.5 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center rounded-full px-0.5 outline-none disabled:cursor-not-allowed disabled:opacity-50",
      "before:absolute before:inset-x-0 before:inset-y-2.5 before:rounded-full before:transition-colors before:duration-200 before:ease-swift before:content-['']",
      "data-[state=checked]:before:bg-primary data-[state=unchecked]:before:bg-input",
      "focus-visible:before:ring-2 focus-visible:before:ring-ring focus-visible:before:ring-offset-2 focus-visible:before:ring-offset-background",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none relative block h-5 w-5 rounded-full bg-card shadow-sm ring-0 transition-transform duration-300 ease-swift data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
