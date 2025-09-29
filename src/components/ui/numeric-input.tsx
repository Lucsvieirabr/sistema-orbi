import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface NumericInputProps extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  value?: number | null;
  onChange?: (value: number | null) => void;
  currency?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, value, onChange, currency = false, placeholder = "0", min, max, step, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>("");

    // Formatar valor para exibição
    const formatValue = React.useCallback((num: number | null) => {
      if (num === null || num === undefined) return "";

      if (currency) {
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL"
        }).format(num);
      }

      return num.toString();
    }, [currency]);

    // Converter string para número
    const parseValue = React.useCallback((str: string): number | null => {
      if (!str || str.trim() === "") return null;

      // Remove formatação de moeda e converte
      const cleaned = str
        .replace(/R\$\s?/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim();

      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }, []);

    // Atualizar display quando o valor muda
    React.useEffect(() => {
      setDisplayValue(formatValue(value));
    }, [value, formatValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Se o campo está vazio, definir valor como null
      if (inputValue === "") {
        setDisplayValue("");
        onChange?.(null);
        return;
      }

      // Para valores de moeda, permitir apenas dígitos, vírgula, ponto e R$
      if (currency) {
        const currencyRegex = /^[0-9.,\sR$]*$/;
        if (!currencyRegex.test(inputValue)) {
          return;
        }
      } else {
        // Para valores numéricos simples, permitir apenas dígitos, ponto e vírgula
        const numberRegex = /^[0-9.,]*$/;
        if (!numberRegex.test(inputValue)) {
          return;
        }
      }

      setDisplayValue(inputValue);
      const parsedValue = parseValue(inputValue);
      onChange?.(parsedValue);
    };

    const handleBlur = () => {
      // Ao sair do campo, formatar o valor se houver um valor numérico
      if (value !== null && value !== undefined) {
        setDisplayValue(formatValue(value));
      }
    };

    const handleFocus = () => {
      // Ao focar, mostrar o valor sem formatação para facilitar edição
      if (value !== null && value !== undefined) {
        setDisplayValue(value.toString());
      }
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
        placeholder={placeholder}
        className={cn(
          "text-center",
          className
        )}
        min={min}
        max={max}
        step={step}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";

export { NumericInput };
