import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

const EXTRACTION_FUNCTION = 'extract-pdf-text';

export type DocumentSource = 'pdf_native' | 'pdf_ocr' | 'image_ocr' | 'ofx';
export type DocumentKind = 'card_invoice' | 'bank_statement';
export type ExtractionStrategy = 'columns' | 'lines' | 'ofx';

export interface ExtractedTransaction {
  id: string;
  date: string;
  description: string;
  value: number;
  type: 'income' | 'expense';
  payment_method?: 'debit' | 'credit';
  installments?: number;
  installment_number?: number;
  card_last4?: string;
}

export interface ExtractionDiagnostics {
  strategy: ExtractionStrategy;
  totalLines: number;
  candidateLines: number;
  matchedLines: number;
  skippedLines: number;
  transactions: number;
}

export interface DocumentExtractionResult {
  source: DocumentSource;
  documentKind: DocumentKind;
  pages: number;
  characters: number;
  lines: number;
  transactions: ExtractedTransaction[];
  diagnostics: ExtractionDiagnostics;
  warnings: string[];
}

export class DocumentExtractionError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'DocumentExtractionError';
    this.code = code;
    this.status = status;
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  EMPTY_FILE: 'O arquivo está vazio.',
  FILE_TOO_LARGE: `O arquivo excede o limite de ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB.`,
  UNSUPPORTED_FORMAT: 'Formato não suportado. Envie PDF, OFX ou imagem (JPG, PNG).',
  PDF_PROTECTED: 'O PDF está protegido por senha. Exporte o extrato sem senha pelo aplicativo do banco.',
  PDF_INVALID: 'O PDF está corrompido ou não pôde ser aberto. Baixe o arquivo novamente pelo banco.',
  OFX_INVALID: 'O arquivo OFX está incompleto ou fora do padrão. Exporte-o novamente pelo banco.',
  IMAGE_INVALID: 'A imagem não pôde ser aberta. Envie JPG, PNG, WEBP ou TIFF.',
  NO_TEXT: 'Não foi possível ler o documento. Envie o PDF original do banco ou uma imagem nítida e bem enquadrada.',
  OCR_UNAVAILABLE: 'A leitura de documentos digitalizados está indisponível no momento. Envie o PDF original ou o OFX.',
  EXTRACTOR_UNAVAILABLE: 'O serviço de leitura de documentos está indisponível. Tente novamente em instantes.',
  EXTRACTOR_TIMEOUT: 'A leitura do documento demorou demais. Envie um arquivo com menos páginas.',
  UNAUTHENTICATED: 'Sessão expirada. Faça login novamente para importar documentos.',
};

function failure(code: string, status: number, fallback?: string): DocumentExtractionError {
  return new DocumentExtractionError(code, ERROR_MESSAGES[code] ?? fallback ?? ERROR_MESSAGES.EXTRACTOR_UNAVAILABLE, status);
}

async function toExtractionError(error: unknown): Promise<DocumentExtractionError> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    const payload = await response.json().catch(() => null);

    if (response.status === 401) return failure('UNAUTHENTICATED', 401);

    if (response.status === 429) {
      const minutes = Math.max(1, Math.ceil(Number(payload?.retry_after_seconds ?? 60) / 60));
      return new DocumentExtractionError(
        'RATE_LIMITED',
        `Limite de importações de documentos atingido. Tente novamente em ${minutes} min.`,
        429,
      );
    }

    const code = typeof payload?.code === 'string' ? payload.code : 'EXTRACTOR_UNAVAILABLE';
    const message = typeof payload?.error === 'string' ? payload.error : undefined;
    return failure(code, response.status, message);
  }

  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return failure('EXTRACTOR_UNAVAILABLE', 503);
  }

  return failure('EXTRACTOR_UNAVAILABLE', 500);
}

function isExtractionResult(data: unknown): data is DocumentExtractionResult {
  const candidate = data as DocumentExtractionResult | null;
  return Boolean(
    candidate &&
      Array.isArray(candidate.transactions) &&
      typeof candidate.source === 'string' &&
      typeof candidate.documentKind === 'string' &&
      candidate.diagnostics &&
      typeof candidate.diagnostics.candidateLines === 'number',
  );
}

export async function extractDocument(file: File): Promise<DocumentExtractionResult> {
  if (file.size === 0) throw failure('EMPTY_FILE', 400);
  if (file.size > MAX_DOCUMENT_BYTES) throw failure('FILE_TOO_LARGE', 413);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw failure('UNAUTHENTICATED', 401);

  const { data, error } = await supabase.functions.invoke(EXTRACTION_FUNCTION, { body: file });
  if (error) throw await toExtractionError(error);
  if (!isExtractionResult(data)) throw failure('EXTRACTOR_UNAVAILABLE', 502);

  return { ...data, warnings: Array.isArray(data.warnings) ? data.warnings : [] };
}
