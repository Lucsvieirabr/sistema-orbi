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

// Função para obter data atual no formato YYYY-MM-DD sem problemas de fuso horário
export function getCurrentDateString(): string {
  const now = new Date();
  // Ajustar para o fuso horário local para evitar problemas de UTC
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().split('T')[0];
}

// Função para formatar data para exibição sem problemas de fuso horário
export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

// Função para converter data do backend para exibição
export function formatBackendDate(dateString: string): string {
  // Se a data já está no formato correto, apenas formata para exibição
  if (dateString.includes('T')) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  }
  // Se é apenas a data (YYYY-MM-DD), adiciona horário para evitar problemas de fuso
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
}
