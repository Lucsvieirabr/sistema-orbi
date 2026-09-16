import { forwardRef, useState } from "react";
import { Check, Eye, EyeOff, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PasswordEvaluation, PasswordScore } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

/** Cor do segmento aceso por nível. Tokens semânticos, nunca paleta crua. */
const SCORE_TONE: Record<PasswordScore, string> = {
  0: "bg-border",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-success",
  4: "bg-success",
};

const SCORE_TEXT: Record<PasswordScore, string> = {
  0: "text-muted-foreground",
  1: "text-destructive",
  2: "text-warning",
  3: "text-success",
  4: "text-success",
};

interface PasswordFieldProps extends Omit<React.ComponentProps<typeof Input>, "type"> {
  label: string;
  error?: string | null;
  hint?: React.ReactNode;
}

/** Campo de senha com mostrar/ocultar. Erro e dica ligados por `aria-describedby`. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { id, label, error, hint, className, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn("pr-12 md:pr-11", className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 rounded-l-none hover:bg-transparent"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>
      {hint && <div id={hintId}>{hint}</div>}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});

/** Medidor de 4 segmentos + checklist das regras de `evaluatePassword`. */
export function PasswordStrengthHint({ evaluation }: { evaluation: PasswordEvaluation }) {
  return (
    <div className="space-y-2.5 pt-0.5">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((segment) => (
            <span
              key={segment}
              className={cn(
                "h-1 rounded-full transition-colors duration-300 ease-swift",
                segment <= evaluation.score ? SCORE_TONE[evaluation.score] : "bg-surface-sunken",
              )}
            />
          ))}
        </div>
        <p className={cn("w-16 text-right text-xs font-medium", SCORE_TEXT[evaluation.score])} aria-live="polite">
          {evaluation.label ? (
            <>
              <span className="sr-only">Força da senha: </span>
              {evaluation.label}
            </>
          ) : null}
        </p>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Requisitos da senha">
        {evaluation.rules.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors duration-200 ease-swift",
              rule.met ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {rule.met ? (
              <Check className="h-3.5 w-3.5 text-success" aria-hidden />
            ) : (
              <Minus className="h-3.5 w-3.5" aria-hidden />
            )}
            {rule.label}
            <span className="sr-only">{rule.met ? "(atendido)" : "(pendente)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PasswordMatchHint({ matches }: { matches: boolean }) {
  if (!matches) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-success">
      <Check className="h-3.5 w-3.5" aria-hidden />
      As senhas coincidem
    </p>
  );
}
