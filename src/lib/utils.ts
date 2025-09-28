import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Design tokens - financial semantics
export const THEME = {
  income: {
    color: "#28A745",
    className: "text-[#28A745]",
  },
  expense: {
    color: "#DC3545",
    className: "text-[#DC3545]",
  },
} as const;

export function formatCurrencyBRL(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}
