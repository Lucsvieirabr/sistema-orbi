import { forwardRef } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { TOTP_CODE_LENGTH } from "@/services/auth/mfa";
import { cn } from "@/lib/utils";

interface TotpCodeInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Disparado ao completar os 6 dígitos (digitando, colando ou via autofill). */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
  autoFocus?: boolean;
  label?: string;
  /** `start` alinha à esquerda (dentro de formulários de Configurações). */
  align?: "center" | "start";
}

const slotClass =
  "h-12 w-11 text-lg font-medium tabular-nums text-foreground md:h-11 md:w-10 transition-[box-shadow,border-color] duration-150 ease-swift";

/**
 * Seis dígitos em dois grupos de três (como os apps autenticadores exibem).
 * Um único `<input>` real por baixo: colar "123 456", autofill de SMS/senhas
 * (`one-time-code`) e leitor de tela funcionam sem tratamento por caixa.
 */
export const TotpCodeInput = forwardRef<HTMLInputElement, TotpCodeInputProps>(function TotpCodeInput(
  { id, value, onChange, onComplete, disabled, error, autoFocus, label = "Código de 6 dígitos", align = "center" },
  ref,
) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <InputOTP
        ref={ref}
        id={id}
        name="totp"
        maxLength={TOTP_CODE_LENGTH}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        value={value}
        onChange={(next) => onChange(next.replace(/\D/g, ""))}
        onComplete={onComplete}
        disabled={disabled}
        pushPasswordManagerStrategy="none"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        containerClassName={cn("gap-3", align === "center" ? "justify-center" : "justify-start")}
      >
        <InputOTPGroup>
          {[0, 1, 2].map((index) => (
            <InputOTPSlot key={index} index={index} className={cn(slotClass, error && "border-destructive/60")} />
          ))}
        </InputOTPGroup>
        <span aria-hidden className="h-px w-3 bg-border" />
        <InputOTPGroup>
          {[3, 4, 5].map((index) => (
            <InputOTPSlot key={index} index={index} className={cn(slotClass, error && "border-destructive/60")} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <p
        id={errorId}
        className={cn("min-h-4 text-xs text-destructive", align === "center" && "text-center")}
        aria-live="assertive"
      >
        {error ?? ""}
      </p>
    </div>
  );
});
