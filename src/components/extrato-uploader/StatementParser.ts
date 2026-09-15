import {
  extractDocument,
  type DocumentExtractionResult,
  type ExtractedTransaction,
} from '@/integrations/parser_api';
import { roundCurrency } from '@/lib/utils';
import type { ParsedTransaction } from './CSVParser';

export interface StatementParseDiagnostics {
  source: DocumentExtractionResult['source'];
  documentKind: DocumentExtractionResult['documentKind'];
  strategy: DocumentExtractionResult['diagnostics']['strategy'];
  pages: number;
  lines: number;
  characters: number;
  candidateLines: number;
  matchedLines: number;
  skippedLines: number;
  rejectedTransactions: number;
  transactions: number;
  warnings: string[];
}

export interface StatementParseResult {
  transactions: ParsedTransaction[];
  diagnostics: StatementParseDiagnostics;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CARD_LAST4 = /^\d{4}$/;

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function toParsedTransaction(item: ExtractedTransaction): ParsedTransaction | null {
  const description = typeof item.description === 'string' ? item.description.trim() : '';
  const value = roundCurrency(Math.abs(Number(item.value)));

  if (!description || !isValidIsoDate(item.date) || !Number.isFinite(value) || value <= 0) return null;
  if (item.type !== 'income' && item.type !== 'expense') return null;

  const hasInstallments =
    Number.isInteger(item.installments) &&
    Number.isInteger(item.installment_number) &&
    item.installment_number >= 1 &&
    item.installment_number <= item.installments;

  return {
    id: item.id,
    date: item.date,
    description,
    value,
    type: item.type,
    payment_method: item.payment_method === 'credit' || item.payment_method === 'debit' ? item.payment_method : undefined,
    installments: hasInstallments ? item.installments : undefined,
    installment_number: hasInstallments ? item.installment_number : undefined,
    card_last4: CARD_LAST4.test(item.card_last4 ?? '') ? item.card_last4 : undefined,
  };
}

export class StatementParser {
  async parseDocument(file: File): Promise<StatementParseResult> {
    const extraction = await extractDocument(file);
    const transactions = extraction.transactions
      .map(toParsedTransaction)
      .filter((transaction): transaction is ParsedTransaction => transaction !== null);

    return {
      transactions,
      diagnostics: {
        source: extraction.source,
        documentKind: extraction.documentKind,
        strategy: extraction.diagnostics.strategy,
        pages: extraction.pages,
        lines: extraction.lines,
        characters: extraction.characters,
        candidateLines: extraction.diagnostics.candidateLines,
        matchedLines: extraction.diagnostics.matchedLines,
        skippedLines: extraction.diagnostics.skippedLines,
        rejectedTransactions: extraction.transactions.length - transactions.length,
        transactions: transactions.length,
        warnings: extraction.warnings,
      },
    };
  }
}
