import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { parseDecimalBR, toEditable } from "@/lib/money-input";

interface NumericInputProps extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  value?: number | null;
  onChange?: (value: number | null) => void;
  currency?: boolean;
  integer?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Aceita "-" à esquerda (ex.: saldo inicial de conta no negativo). */
  allowNegative?: boolean;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, value, onChange, currency = true, integer = false, placeholder, min, max, step, allowNegative = false, onFocus, onBlur, onMouseUp, ...props }, ref) => {
    // Definir placeholder padrão baseado no tipo
    const defaultPlaceholder = integer ? "0" : currency ? "0,00" : "0";
    const finalPlaceholder = placeholder || defaultPlaceholder;
    const [displayValue, setDisplayValue] = React.useState<string>("");
    const [isFocused, setIsFocused] = React.useState<boolean>(false);
    // Foco por clique: o mouseup logo depois colapsaria a seleção no ponto clicado.
    const selectOnFocusRef = React.useRef(false);

    // Formatar valor para exibição
    const formatValue = React.useCallback((num: number | null) => {
      if (num === null || num === undefined || num === 0) return "";

      if (currency) {
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL"
        }).format(num);
      }

      if (integer) {
        return Math.floor(num).toString();
      }

      return num.toString();
    }, [currency, integer]);

    // Converter string para número
    const parseValue = React.useCallback((str: string): number | null => {
      if (!str || str.trim() === "") return null;

      if (integer) {
        // Para números inteiros, apenas remover caracteres não numéricos
        const cleaned = str.replace(/[^\d-]/g, "");
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? null : parsed;
      }

      return parseDecimalBR(str);
    }, [integer]);

    // Atualizar display quando o valor muda. Focado, só quando a mudança veio
    // de fora (o texto digitado já não representa `value`): o Dialog foca o
    // campo ao abrir, ANTES do form carregar o valor do item — sem isso o
    // campo ficava com o valor do item aberto anteriormente.
    React.useEffect(() => {
      if (!isFocused) {
        setDisplayValue(formatValue(value));
        return;
      }
      setDisplayValue((current) =>
        parseValue(current) === (value ?? null) ? current : value ? toEditable(value, currency, integer) : "",
      );
    }, [value, formatValue, isFocused, parseValue, currency, integer]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      selectOnFocusRef.current = false;
      const inputValue = e.target.value;

      // Se o campo está vazio, definir valor como null
      if (inputValue === "" || (allowNegative && inputValue === "-")) {
        setDisplayValue(inputValue);
        onChange?.(null);
        return;
      }

      // Validar entrada baseado no tipo
      if (integer) {
        // Para números inteiros, apenas dígitos
        const integerRegex = allowNegative ? /^-?[0-9]*$/ : /^[0-9]*$/;
        if (!integerRegex.test(inputValue)) {
          return;
        }
      } else {
        // Para moeda, permitir dígitos, vírgula e ponto
        const numberRegex = allowNegative ? /^-?[0-9.,]*$/ : /^[0-9.,]*$/;
        if (!numberRegex.test(inputValue)) {
          return;
        }
      }

      // Manter o valor como está sendo digitado
      setDisplayValue(inputValue);
      const parsedValue = parseValue(inputValue);
      onChange?.(parsedValue);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setDisplayValue(formatValue(value));
      onBlur?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      // Mostra o valor cru (vírgula decimal, sem milhar) e SELECIONA TUDO:
      // digitar substitui o valor em vez de concatenar no fim (antes
      // R$ 5.000,00 + "800" virava 50.000.800,00).
      // Tudo síncrono, antes de qualquer tecla: escreve o valor cru direto no
      // DOM e seleciona já. Com requestAnimationFrame o select() chegava depois
      // do 1º keystroke (Tab + digitar rápido) e engolia a tecla: "75" → "5".
      // O re-render com o mesmo valor não mexe no DOM, então a seleção fica.
      const editable = value ? toEditable(value, currency, integer) : "";
      const input = e.currentTarget;
      input.value = editable;
      input.select();
      selectOnFocusRef.current = true;
      setDisplayValue(editable);
      onFocus?.(e);
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
      if (selectOnFocusRef.current) {
        selectOnFocusRef.current = false;
        e.preventDefault();
      }
      onMouseUp?.(e);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onMouseUp={handleMouseUp}
        inputMode={allowNegative ? "text" : integer ? "numeric" : "decimal"}
        placeholder={finalPlaceholder}
        className={cn("tabular", className)}
        min={min}
        max={max}
        step={step}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";

export { NumericInput };