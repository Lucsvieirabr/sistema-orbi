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

// Função para obter a data mínima permitida (início do ano passado)
export function getMinAllowedDate(): string {
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  return `${lastYear}-01-01`;
}

// Função para obter a data máxima permitida (fim do ano atual)
export function getMaxAllowedDate(): string {
  const currentYear = new Date().getFullYear();
  return `${currentYear}-12-31`;
}

/**
 * Calcula o período de fatura de um cartão de crédito baseado na data de fechamento (statement_date)
 * 
 * @param statementDay - Dia do mês em que a fatura fecha (1-31)
 * @param referenceDate - Data de referência para calcular o período (geralmente a data da transação ou data atual)
 * @returns Objeto com startDate e endDate do período da fatura
 * 
 * Lógica padrão do mercado de cartões:
 * - Se cartão fecha dia 10:
 *   - Transações entre 11/09 e 10/10 pertencem à fatura de outubro (vence em outubro)
 *   - Transações entre 11/10 e 10/11 pertencem à fatura de novembro (vence em novembro)
 * 
 * @example
 * // Se hoje é 15/10 e o cartão fecha dia 10:
 * // - Período: 11/10 a 10/11
 * // - Fatura: novembro/2024
 * 
 * // Se hoje é 05/10 e o cartão fecha dia 10:
 * // - Período: 11/09 a 10/10
 * // - Fatura: outubro/2024
 */
export function getCardStatementPeriod(statementDay: number, referenceDate: Date): {
  startDate: Date;
  endDate: Date;
  billingMonth: number; // Mês da fatura (1-12)
  billingYear: number;  // Ano da fatura
} {
  // Data de fechamento do mês de referência
  const closingDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    statementDay
  );

  let periodStart: Date;
  let periodEnd: Date;
  let billingMonth: number;
  let billingYear: number;

  // Se a data de referência é ANTES do fechamento, pertence à fatura do mês atual (que fecha neste mês)
  if (referenceDate < closingDate) {
    // Período do mês anterior
    periodEnd = new Date(closingDate);
    periodEnd.setDate(periodEnd.getDate() - 1); // Dia anterior ao fechamento
    
    periodStart = new Date(closingDate);
    periodStart.setMonth(periodStart.getMonth() - 1); // Último fechamento
    
    // A fatura é do mês do fechamento (mês da referência)
    billingMonth = referenceDate.getMonth() + 1;
    billingYear = referenceDate.getFullYear();
  } else {
    // Período atual - se a data é igual ou depois do fechamento, pertence à próxima fatura
    periodStart = new Date(closingDate);
    
    periodEnd = new Date(closingDate);
    periodEnd.setMonth(periodEnd.getMonth() + 1); // Próximo fechamento
    periodEnd.setDate(periodEnd.getDate() - 1); // Dia anterior ao fechamento
    
    // A fatura é do próximo mês
    const nextMonth = new Date(referenceDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    billingMonth = nextMonth.getMonth() + 1;
    billingYear = nextMonth.getFullYear();
  }

  return {
    startDate: periodStart,
    endDate: periodEnd,
    billingMonth,
    billingYear,
  };
}

/**
 * Verifica se uma transação de cartão pertence a um determinado mês/ano de referência
 * 
 * @param transactionDate - Data da transação (string YYYY-MM-DD ou Date)
 * @param statementDay - Dia do fechamento da fatura
 * @param referenceYear - Ano de referência
 * @param referenceMonth - Mês de referência (1-12)
 * @returns true se a transação pertence ao período da fatura daquele mês/ano
 */
export function isTransactionInBillingPeriod(
  transactionDate: string | Date,
  statementDay: number,
  referenceYear: number,
  referenceMonth: number
): boolean {
  const txDate = typeof transactionDate === 'string' 
    ? new Date(transactionDate + 'T00:00:00') 
    : transactionDate;
  
  const period = getCardStatementPeriod(statementDay, txDate);
  
  return period.billingYear === referenceYear && period.billingMonth === referenceMonth;
}
