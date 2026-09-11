import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Segmented control: trilho afundado sem altura fixa. A altura nasce do
      // item (h-10 / md:h-8) + p-1 + 1px de borda, então o gutter de 4px é
      // idêntico nos quatro lados. Antes o trilho travava em h-11 enquanto o
      // item pedia min-h-9 + py-2.5 — o item transbordava para baixo e o
      // cinza sobrava só em cima e nas laterais.
      "inline-flex items-center justify-center gap-1 rounded-xl border border-border-subtle bg-surface-sunken p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Raio concêntrico: trilho rounded-xl (14px) − p-1 (4px) − borda ≈ rounded-lg.
      // A borda de 1px existe sempre (transparente) para o item ligado ganhar
      // hairline sem deslocar 1px de layout.
      "inline-flex h-10 flex-1 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent px-3 text-sm font-medium md:h-8",
      "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-swift motion-safe:active:scale-[0.98]",
      "hover:text-foreground",
      "data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface-sunken",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
