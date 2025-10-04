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

// Função para arredondar valores monetários com precisão de 2 casas decimais
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// Função para calcular valor de parcela com redistribuição precisa
export function calculateInstallmentValue(totalValue: number, totalInstallments: number): number {
  if (totalInstallments <= 0) return 0;
  return roundCurrency(totalValue / totalInstallments);
}

// Função para redistribuir valores entre parcelas com precisão
export function redistributeInstallmentValues(
  totalValue: number, 
  editedInstallments: Array<{ id: string; value: number }>,
  nonEditedCount: number
): { editedValues: Array<{ id: string; value: number }>, nonEditedValue: number } {
  const editedTotal = editedInstallments.reduce((sum, installment) => sum + installment.value, 0);
  const availableValue = totalValue - editedTotal;
  const nonEditedValue = nonEditedCount > 0 ? roundCurrency(availableValue / nonEditedCount) : 0;
  
  return {
    editedValues: editedInstallments.map(installment => ({
      ...installment,
      value: roundCurrency(installment.value)
    })),
    nonEditedValue
  };
}

// Função para validar se um valor monetário é válido
export function isValidCurrencyValue(value: number): boolean {
  return !isNaN(value) && isFinite(value) && value >= 0;
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
