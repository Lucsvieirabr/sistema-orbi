import * as React from "react";

import { cn } from "@/lib/utils";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** yyyy-MM-dd real (mês 1–12, dia existente). Senão o navegador avisa e rejeita. */
function isValidDateKey(value: unknown): boolean {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Campo date só recebe valor válido ou vazio — evita o warning nativo "does not conform". */
function sanitizeDateValue<T>(type: string | undefined, value: T): T | "" {
  if (type !== "date" || value == null || value === "") return value;
  return isValidDateKey(value) ? value : "";
}

/**
 * Campo de texto. O foco nao pisca de cor: a borda assume o anel e um halo de
 * 25% cresce por fora — resposta clara sem barulho visual.
 * `text-base md:text-sm`: fonte < 16px faz o iOS dar zoom ao focar.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, defaultValue, ...props }, ref) => {
    const safeValue = sanitizeDateValue(type, value) as typeof value;
    const safeDefault = sanitizeDateValue(type, defaultValue) as typeof defaultValue;
    return (
      <input
        type={type}
        {...(value !== undefined ? { value: safeValue } : {})}
        {...(defaultValue !== undefined ? { defaultValue: safeDefault } : {})}
        className={cn(
          "flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground md:h-10 md:text-sm",
          "transition-[border-color,box-shadow,background-color] duration-200 ease-swift",
          "placeholder:text-muted-foreground",
          "hover:border-ring/45",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/25",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
