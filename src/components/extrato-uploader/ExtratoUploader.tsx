import React, { useState, useCallback } from 'react';
import { FileText, AlertCircle, CheckCircle, Brain } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { mapClassification, type ReviewTransaction } from './classification';
import { assertUuid } from '@/lib/utils';
import { ConfirmationDialog } from './ConfirmationDialog';
import { CSVParser, type ParsedTransaction } from './CSVParser';
import { StatementParser, type StatementParseDiagnostics } from './StatementParser';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MAX_DOCUMENT_BYTES } from '@/integrations/parser_api';
import { BatchTransactionClassifier } from './BatchClassifier';

const MAX_CSV_SIZE = 10 * 1024 * 1024;
const SNIFF_BYTES = 4096;
const ACCEPTED_EXTENSIONS = '.csv,.ofx,.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff';

type ImportFileType = 'csv' | 'document';
type ProcessingStage = 'reading' | 'extracting' | 'classifying';

const STAGE_LABELS: Record<ProcessingStage, string> = {
  reading: 'Lendo o arquivo...',
  extracting: 'Extraindo transações do documento...',
  classifying: 'Classificando com IA...',
};

const IMAGE_SIGNATURES: number[][] = [
  [0x89, 0x50, 0x4e, 0x47],
  [0xff, 0xd8, 0xff],
  [0x49, 0x49, 0x2a, 0x00],
  [0x4d, 0x4d, 0x00, 0x2a],
];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

async function detectImportFileType(file: File): Promise<ImportFileType | null> {
  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  const text = new TextDecoder('windows-1252').decode(head);

  if (text.slice(0, 1024).includes('%PDF-')) return 'document';
  if (IMAGE_SIGNATURES.some(signature => startsWith(head, signature))) return 'document';
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return 'document';
  if (/OFXHEADER|<OFX>|<\?OFX/i.test(text)) return 'document';
  if (file.name.toLowerCase().endsWith('.csv')) return 'csv';
  return null;
}

async function decodeCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.slice(3));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function buildNoTransactionsMessage(
  fileType: ImportFileType,
  diagnostics: StatementParseDiagnostics | null,
): string {
  if (fileType === 'csv') {
    return 'Nenhuma transação foi detectada no CSV. Verifique se o arquivo tem as colunas de data, descrição e valor.';
  }

  if (!diagnostics) {
    return 'Não foi possível ler o documento. Baixe o arquivo original pelo aplicativo do banco e tente novamente.';
  }

  if (diagnostics.source === 'ofx') {
    return 'O arquivo OFX foi lido, mas não contém lançamentos válidos no período exportado.';
  }

  if (diagnostics.source === 'pdf_ocr' || diagnostics.source === 'image_ocr') {
    return `O documento foi lido por OCR (${diagnostics.pages} página(s)), mas nenhuma linha de transação foi reconhecida. ` +
      'Envie uma imagem mais nítida, o PDF original do banco ou o OFX do mesmo período.';
  }

  return `O texto do PDF foi extraído (${diagnostics.pages} página(s), ${diagnostics.lines} linhas), ` +
    `mas nenhuma linha foi reconhecida como transação (${diagnostics.candidateLines} linha(s) com data). ` +
    'Se possível, importe o OFX ou CSV do mesmo período.';
}

interface ExtratoUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionsImported: () => void;
  userLocation?: string;
}

interface ProcessingStats {
  total: number;
  processed: number;
  withHighConfidence: number;
  withMediumConfidence: number;
  withLowConfidence: number;
  learned: number;
  mlPredictions: number;
  dictionaryMatches: number;
  hybridDecisions: number;
}

export function ExtratoUploader({ open, onOpenChange, onTransactionsImported, userLocation }: ExtratoUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stage, setStage] = useState<ProcessingStage>('reading');
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processedTransactions, setProcessedTransactions] = useState<ReviewTransaction[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const { toast } = useToast();

  const processFile = async (file: File) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setStage('reading');
    setProgress(0);
    setErrors([]);
    setProcessingStats(null);

    try {
      const fileType = await detectImportFileType(file);

      if (!fileType) {
        throw new Error('Arquivo inválido: selecione um CSV, OFX, PDF ou imagem (JPG, PNG) — o conteúdo não corresponde a nenhum desses formatos.');
      }
      if (fileType === 'document' && file.size > MAX_DOCUMENT_BYTES) {
        throw new Error(`O arquivo excede o limite de ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB.`);
      }
      if (fileType === 'csv' && file.size > MAX_CSV_SIZE) {
        throw new Error(`CSV excede o limite de ${MAX_CSV_SIZE / 1024 / 1024}MB.`);
      }

      setProgress(10);

      let rawTransactions: ParsedTransaction[] = [];
      let diagnostics: StatementParseDiagnostics | null = null;

      if (fileType === 'csv') {
        const csvData = await parseCSVFile(file);
        setProgress(30);
        rawTransactions = new CSVParser().parseCSVData(csvData).transactions;
      } else {
        setStage('extracting');
        setProgress(25);

        const result = await new StatementParser().parseDocument(file);
        rawTransactions = result.transactions;
        diagnostics = result.diagnostics;

        console.info('[ExtratoUploader] documento interpretado:', diagnostics);
        setProgress(70);
      }

      if (rawTransactions.length === 0) {
        throw new Error(buildNoTransactionsMessage(fileType, diagnostics));
      }

      if (diagnostics && (diagnostics.source === 'pdf_ocr' || diagnostics.source === 'image_ocr')) {
        toast({
          title: "Documento lido por OCR",
          description: "Revise datas, valores e descrições antes de salvar: digitalizações podem conter erros de leitura.",
        });
      }

      setStage('classifying');
      const results = await processTransactionsWithAI(rawTransactions);

      setProgress(90);

      setProcessedTransactions(results.transactions);
      setProcessingStats(results.stats);
      setShowConfirmation(true);

      setProgress(100);
      setUploadedFile(file);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar arquivo.';
      setErrors([errorMessage]);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const parseCSVFile = async (file: File): Promise<Record<string, string>[]> => {
    const csvText = await decodeCsvFile(file);
    return new Promise((resolve, reject) => {
      import('papaparse').then(({ default: Papa }) => {
        Papa.parse<Record<string, string>>(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => {
            return header.trim();
          },
          transform: (value: string) => {
            return value ? value.trim() : '';
          },
          complete: (results) => {
            if (results.data.length === 0) {
              reject(new Error('Arquivo CSV vazio ou sem dados válidos.'));
              return;
            }

            resolve(results.data);
          },
          error: (error: Error) => {
            reject(new Error(`Erro ao ler arquivo: ${error.message}`));
          }
        });
      }).catch(reject);
    });
  };

  const processTransactionsWithAI = async (parsedTransactions: ParsedTransaction[]) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Sessão expirada. Faça login novamente para importar.');
    const userId = assertUuid(user.id, 'user_id');
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, category_type, user_id, is_system')
      .or(`is_system.eq.true,user_id.eq.${userId}`)
      .order('id');
    if (categoriesError) throw new Error('Não foi possível carregar suas categorias. Tente novamente.');

    const response = await new BatchTransactionClassifier(userLocation, 500).classifyBatch(
      parsedTransactions.map(t => ({ description: t.description, type: t.type, amount: t.value, date: t.date })),
    );
    const transactions = parsedTransactions.map((t, i) => mapClassification(t, response.results[i], categories ?? [], userId));
    const stats: ProcessingStats = {
      total: transactions.length, processed: transactions.length,
      withHighConfidence: transactions.filter(t => t.confidence >= 90).length,
      withMediumConfidence: transactions.filter(t => t.confidence >= 70 && t.confidence < 90).length,
      withLowConfidence: transactions.filter(t => t.confidence < 70).length,
      learned: transactions.filter(t => t.learned_from_user).length,
      mlPredictions: transactions.filter(t => t.method === 'merchant_fuzzy').length,
      dictionaryMatches: transactions.filter(t => ['merchant_entity', 'merchant_specific', 'banking_pattern', 'keyword_analysis'].includes(t.method)).length,
      hybridDecisions: transactions.filter(t => t.method === 'hybrid').length,
    };
    if (response.failures.length > 0) {
      const count = response.failures.reduce((sum, failure) => sum + failure.count, 0);
      toast({
        title: 'Classificação parcialmente indisponível',
        description: `${count} transação(ões) precisam de revisão. As classificações dos demais lotes foram preservadas.`,
        variant: 'destructive',
      });
    }
    return { transactions, stats };
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleTransactionsSaved = (complete = true) => {
    onTransactionsImported();
    if (!complete) return;
    setShowConfirmation(false);
    setProcessedTransactions([]);
    setUploadedFile(null);
    setProcessingStats(null);
    setProgress(0);
    setErrors([]);
    onOpenChange(false);

  };

  const handleDialogClose = (open: boolean) => {
    if (isProcessing) return;
    if (!open) {
      // Limpar todos os dados quando fechar
      setShowConfirmation(false);
      setProcessedTransactions([]);
      setUploadedFile(null);
      setProcessingStats(null);
      setProgress(0);
      setErrors([]);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[95vh] overflow-y-auto p-4 lg:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base lg:text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Importar Extrato Bancário com IA
          </DialogTitle>
          <DialogDescription className="text-xs lg:text-sm text-muted-foreground">
            Selecione o extrato ou a fatura do seu banco em CSV, OFX, PDF ou imagem. Nossa IA analisará e categorizará automaticamente as transações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 lg:space-y-4">

          {/* Área de Drop */}
          <div
            className={`
              relative border border-dashed rounded-lg p-4 lg:p-8 text-center transition-colors
              ${isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-border'
              }
              ${isProcessing ? 'pointer-events-none opacity-50' : ''}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />

            <div className="space-y-4">
              <div className="flex justify-center">
                {uploadedFile ? (
                  <CheckCircle className="h-12 w-12 text-success" />
                ) : (
                  <FileText className="h-12 w-12 text-muted-foreground" />
                )}
              </div>

              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {uploadedFile
                    ? `Arquivo carregado: ${uploadedFile.name}`
                    : 'Arraste e solte seu extrato ou fatura aqui ou clique para selecionar'
                  }
                </p>

                <p className="text-sm text-muted-foreground">
                  Formatos suportados: CSV, OFX, PDF e imagem (JPG, PNG)
                </p>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Brain className="h-4 w-4 animate-pulse" />
                    {STAGE_LABELS[stage]}
                  </p>
                  <Progress value={progress} className="w-full" />
                  <p className="text-xs text-muted-foreground text-center">
                    {Math.round(progress)}%
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Alertas */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Inteligência Artificial Personalizada:</strong>
              Você pode treinar a IA do seu jeito corrigindo classificações - criando basicamente sua própria IA personalizada.
            </AlertDescription>
          </Alert>

          {/* Alertas de erro */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium">Erros encontrados:</div>
                  {errors.map((error, index) => (
                    <div key={index} className="text-sm">{error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Dialog de confirmação */}
          <ConfirmationDialog
            open={showConfirmation}
            onOpenChange={setShowConfirmation}
            transactions={processedTransactions}
            onTransactionsSaved={handleTransactionsSaved}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
