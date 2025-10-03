import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface NumericInputProps extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  value?: number | null;
  onChange?: (value: number | null) => void;
  currency?: boolean;
  integer?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, value, onChange, currency = true, integer = false, placeholder, min, max, step, ...props }, ref) => {
    // Definir placeholder padrão baseado no tipo
    const defaultPlaceholder = integer ? "0" : currency ? "0,00" : "0";
    const finalPlaceholder = placeholder || defaultPlaceholder;
    const [displayValue, setDisplayValue] = React.useState<string>("");
    const [isFocused, setIsFocused] = React.useState<boolean>(false);

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
        const cleaned = str.replace(/\D/g, "");
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? null : parsed;
      }

      // Remove formatação de moeda e converte
      const cleaned = str
        .replace(/R\$\s?/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim();

      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }, [integer]);

    // Atualizar display quando o valor muda (apenas se não estiver focado)
    React.useEffect(() => {
      if (!isFocused) {
        setDisplayValue(formatValue(value));
      }
    }, [value, formatValue, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Se o campo está vazio, definir valor como null
      if (inputValue === "") {
        setDisplayValue("");
        onChange?.(null);
        return;
      }

      // Validar entrada baseado no tipo
      if (integer) {
        // Para números inteiros, apenas dígitos
        const integerRegex = /^[0-9]*$/;
        if (!integerRegex.test(inputValue)) {
          return;
        }
      } else {
        // Para moeda, permitir dígitos, vírgula e ponto
        const numberRegex = /^[0-9.,]*$/;
        if (!numberRegex.test(inputValue)) {
          return;
        }
      }

      // Manter o valor como está sendo digitado
      setDisplayValue(inputValue);
      const parsedValue = parseValue(inputValue);
      onChange?.(parsedValue);
    };

    const handleBlur = () => {
      setIsFocused(false);
      // Ao sair do campo, formatar o valor se houver um valor numérico
      if (value !== null && value !== undefined && value !== 0) {
        setDisplayValue(formatValue(value));
      } else {
        // Se o valor for 0, null ou undefined, manter o campo vazio
        setDisplayValue("");
      }
    };

    const handleFocus = () => {
      setIsFocused(true);
      // Ao focar, mostrar o valor sem formatação para facilitar edição
      if (value !== null && value !== undefined && value !== 0) {
        if (currency) {
          // Para moeda, mostrar apenas os números (removendo R$ e formatação)
          const numericValue = value.toString();
          setDisplayValue(numericValue);
        } else if (integer) {
          // Para números inteiros, mostrar apenas o número
          setDisplayValue(Math.floor(value).toString());
        } else {
          setDisplayValue(value.toString());
        }
      } else {
        // Se o valor for 0, null ou undefined, limpar o campo para digitação
        setDisplayValue("");
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
        placeholder={finalPlaceholder}
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