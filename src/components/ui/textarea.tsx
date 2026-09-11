import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-base leading-relaxed text-foreground md:text-sm md:leading-relaxed",
        "scroll-py-2.5",
        "transition-[border-color,box-shadow] duration-200 ease-swift",
        "placeholder:text-muted-foreground hover:border-ring/45",
        "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/25",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
