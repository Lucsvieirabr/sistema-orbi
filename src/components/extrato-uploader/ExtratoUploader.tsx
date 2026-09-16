import React, { useState, useCallback, useEffect } from 'react';
import { FileText, AlertCircle, CheckCircle, Brain } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IntelligentTransactionClassifier } from './IntelligentTransactionClassifier';
import { ConfirmationDialog } from './ConfirmationDialog';
import { CSVParser, type ParsedTransaction } from './CSVParser';
import { StatementParser, type StatementParseDiagnostics } from './StatementParser';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MAX_DOCUMENT_BYTES } from '@/integrations/parser_api';
import type { ClassificationResult } from './BatchClassifier';

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

export function ExtratoUploader({ open, onOpenChange, onTransactionsImported }: ExtratoUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stage, setStage] = useState<ProcessingStage>('reading');
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processedTransactions, setProcessedTransactions] = useState<any[]>([]);
  const [classifier, setClassifier] = useState<IntelligentTransactionClassifier | null>(null);
  const [isInitializingClassifier, setIsInitializingClassifier] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const { toast } = useToast();

  // Inicializa o classificador inteligente
  useEffect(() => {
    const initializeClassifier = async () => {
      setIsInitializingClassifier(true);
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error('Erro ao buscar usuário:', userError);
          toast({
            title: "Erro de autenticação",
            description: "Não foi possível verificar o usuário. Faça login novamente.",
            variant: "destructive"
          });
          setIsInitializingClassifier(false);
          return;
        }

        if (!user) {
          console.error('Usuário não autenticado');
          toast({
            title: "Erro de autenticação",
            description: "Você precisa estar autenticado para importar transações.",
            variant: "destructive"
          });
          setIsInitializingClassifier(false);
          return;
        }

        const intelligentClassifier = new IntelligentTransactionClassifier('SP', user.id, true, true);

        // Pré-carrega padrões frequentes
        await intelligentClassifier.preloadFrequentPatterns();

        setClassifier(intelligentClassifier);
      } catch (error) {
        console.error('Erro ao inicializar classificador:', error);
        toast({
          title: "Erro na inicialização",
          description: "Não foi possível inicializar o sistema de classificação. Tente recarregar a página.",
          variant: "destructive"
        });
      } finally {
        setIsInitializingClassifier(false);
      }
    };

    if (open) {
      initializeClassifier();
    }
  }, [open, toast]);

  const processFile = useCallback(async (file: File) => {
    if (!classifier) {
      toast({
        title: "Erro",
        description: "Classificador não inicializado. Tente novamente.",
        variant: "destructive"
      });
      return;
    }

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
      const results = await processTransactionsWithAI(rawTransactions, classifier);

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
  }, [classifier, toast]);

  const parseCSVFile = async (file: File): Promise<any[]> => {
    const csvText = await decodeCsvFile(file);
    return new Promise((resolve, reject) => {
      import('papaparse').then(({ default: Papa }) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => {
            return header.trim();
          },
          transform: (value: string) => {
            return value ? value.trim() : '';
          },
          complete: (results: any) => {
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
      });
    });
  };

  const processTransactionsWithAI = async (parsedTransactions: ParsedTransaction[], _classifier: IntelligentTransactionClassifier) => {
    const stats: ProcessingStats = {
      total: 0,
      processed: 0,
      withHighConfidence: 0,
      withMediumConfidence: 0,
      withLowConfidence: 0,
      learned: 0,
      mlPredictions: 0,
      dictionaryMatches: 0,
      hybridDecisions: 0
    };

    const transactions: any[] = [];

    // Buscar categorias do banco para mapear nomes para IDs
    const { data: categoriesData } = await supabase
      .from('categories')
      .select('id, name, category_type')
      .order('name');

    const categoryMap: { [key: string]: { id: string; type: 'income' | 'expense' } } = {};
    const categoryAliases: { [key: string]: string } = {
      // Mapeamentos de categorias alternativas para categorias padrão
      'moradia': 'Casa',
      'energia': 'Casa',
      'água/saneamento': 'Casa',
      'gás': 'Casa',
      'assinaturas': 'Assinaturas',
      'streaming': 'Assinaturas',
      'telefonia': 'Assinaturas',
      'internet': 'Assinaturas',
      'telefonia móvel': 'Assinaturas',
      'telefonia fixa': 'Assinaturas',
      'refeição': 'Alimentação',
      'comida': 'Alimentação',
      'supermercado': 'Alimentação',
      'mercado': 'Alimentação',
      'restaurante': 'Alimentação',
      'lanchonete': 'Alimentação',
      'fast food': 'Alimentação',
      'delivery': 'Alimentação',
      'combustível': 'Transporte',
      'gasolina': 'Transporte',
      'etanol': 'Transporte',
      'diesel': 'Transporte',
      'uber': 'Transporte',
      '99': 'Transporte',
      'taxi': 'Transporte',
      'farmácia': 'Proteção Pessoal / Saúde / Farmácia',
      'saúde': 'Proteção Pessoal / Saúde / Farmácia',
      'beleza': 'Bem Estar / Beleza',
      'cabelo': 'Bem Estar / Beleza',
      'estética': 'Bem Estar / Beleza',
      'roupas': 'Roupas e acessórios',
      'roupas e acessórios': 'Roupas e acessórios',
      'vestuário': 'Roupas e acessórios',
      'educação': 'Outros',
      'curso': 'Outros',
      'livros': 'Outros',
      'lazer': 'Lazer',
      'entretenimento': 'Lazer',
      'jogos': 'Lazer',
      'pet': 'Pet',
      'animais': 'Pet',
      'veterinário': 'Pet',
      'presentes': 'Presentes / Compras',
      'compras': 'Presentes / Compras',
      'despesas pessoais': 'Despesas Pessoais',
      'pessoais': 'Despesas Pessoais',
      'transferências': 'Outros',
      'pix enviado': 'Outros',
      'pix recebido': 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
      'salário': 'Salário / 13° Salário / Férias',
      'pró labore': 'Pró Labore',
      'comissões': 'Participação de Lucros / Comissões',
      'investimentos': 'Renda de Investimentos',
      'aluguel': 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
      'reembolso': 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
      'tarifas': 'Tarifas Bancárias / Juros / Impostos / Taxas',
      'juros': 'Tarifas Bancárias / Juros / Impostos / Taxas',
      'taxas': 'Tarifas Bancárias / Juros / Impostos / Taxas',
      'impostos': 'Tarifas Bancárias / Juros / Impostos / Taxas'
    };

    if (categoriesData) {
      categoriesData.forEach(cat => {
        categoryMap[cat.name.toLowerCase()] = {
          id: cat.id,
          type: cat.category_type as 'income' | 'expense'
        };
      });
    }

    // Classificação no servidor (classify-transactions v2). Uma request por
    // até 500 linhas: cada chamada consome a cota horária de rate limit.
    //
    // FALLBACK SEGURO: se a Edge Function falhar (rede, 429, 5xx) ou devolver
    // menos resultados, NENHUMA linha é perdida e a importação não aborta — a
    // linha segue como "Outros"/"Outras Receitas" com confiança 0 para revisão.
    let classifications: ClassificationResult[] = [];
    let classifierUnavailable = false;
    try {
      const { BatchTransactionClassifier } = await import('./BatchClassifier');
      const batchClassifier = new BatchTransactionClassifier('SP', 500);
      const batchResponse = await batchClassifier.classifyBatch(
        parsedTransactions.map(t => ({
          description: t.description,
          type: t.type,
          amount: t.value,
          date: t.date,
        })),
      );
      classifications = Array.isArray(batchResponse?.results) ? batchResponse.results : [];
    } catch (error) {
      classifierUnavailable = true;
      console.error('Classificação automática indisponível:', error instanceof Error ? error.message : error);
    }

    const fallbackCategoryName = (type: 'income' | 'expense') =>
      type === 'income' ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)' : 'Outros';

    let fallbackCount = 0;

    for (let i = 0; i < parsedTransactions.length; i++) {
      const parsedTransaction = parsedTransactions[i];
      const received = classifications[i];
      const classification: ClassificationResult = received && typeof received.category === 'string'
        ? received
        : {
            description: parsedTransaction.description,
            category: fallbackCategoryName(parsedTransaction.type),
            subcategory: 'A Classificar',
            confidence: 0,
            method: 'default_fallback',
            features_used: ['client_fallback'],
            learned_from_user: false,
          };

      stats.total++;
      stats.processed++;

      // Normalizar categoria usando aliases
      let normalizedCategory = classification.category.toLowerCase();
      if (categoryAliases[normalizedCategory]) {
        normalizedCategory = categoryAliases[normalizedCategory].toLowerCase();
      }

      // Mapear categoria para ID (só vale se o tipo bate com o lançamento)
      const mappedCategory = categoryMap[normalizedCategory];
      let category_id = mappedCategory && mappedCategory.type === parsedTransaction.type ? mappedCategory.id : undefined;

      // Sem categoria específica: categoria genérica do tipo, nunca descartar a linha
      if (!category_id) {
        category_id = categoryMap[fallbackCategoryName(parsedTransaction.type).toLowerCase()]?.id;
      }

      if (classification.method === 'default_fallback') fallbackCount++;

      transactions.push({
        id: parsedTransaction.id,
        date: parsedTransaction.date,
        description: parsedTransaction.description,
        value: parsedTransaction.value,
        type: parsedTransaction.type,
        category_id,
        category_name: classification.category,
        subcategory: classification.subcategory,
        confidence: classification.confidence,
        method: classification.method,
        learned_from_user: classification.learned_from_user,
        payment_method: parsedTransaction.payment_method,
        card_last4: parsedTransaction.card_last4,
        installments: parsedTransaction.installments,
        installment_number: parsedTransaction.installment_number
      });

      // Atualizar estatísticas
      if (classification.confidence >= 90) stats.withHighConfidence++;
      else if (classification.confidence >= 70) stats.withMediumConfidence++;
      else stats.withLowConfidence++;

      if (classification.learned_from_user) stats.learned++;
      if (classification.method === 'merchant_fuzzy') stats.mlPredictions++;
      if (['merchant_entity', 'merchant_specific', 'banking_pattern', 'keyword_analysis'].includes(classification.method)) stats.dictionaryMatches++;
      if (classification.method === 'hybrid') stats.hybridDecisions++;
    }

    if (classifierUnavailable) {
      toast({
        title: 'Classificação automática indisponível',
        description: 'As transações foram mantidas como "Outros"/"Outras Receitas". Revise as categorias antes de salvar.',
      });
    } else if (fallbackCount > 0) {
      console.info(`[ExtratoUploader] ${fallbackCount} transação(ões) sem categoria confiável — marcadas para revisão.`);
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    e.target.value = '';
  }, [processFile]);

  const handleTransactionsSaved = () => {
    setShowConfirmation(false);
    setProcessedTransactions([]);
    setUploadedFile(null);
    setProcessingStats(null);
    setProgress(0);
    setErrors([]);
    onTransactionsImported();
    onOpenChange(false);

    toast({
      title: "Sucesso",
      description: "Transações importadas com sucesso!",
    });
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      // Limpar todos os dados quando fechar
      setShowConfirmation(false);
      setProcessedTransactions([]);
      setUploadedFile(null);
      setProcessingStats(null);
      setProgress(0);
      setErrors([]);
      setClassifier(null);
      setIsInitializingClassifier(true);
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
          <p className="text-xs lg:text-sm text-muted-foreground">
            Selecione o extrato ou a fatura do seu banco em CSV, OFX, PDF ou imagem. Nossa IA analisará e categorizará automaticamente as transações.
          </p>
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
              ${isProcessing || isInitializingClassifier ? 'pointer-events-none opacity-50' : ''}
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
              disabled={isProcessing || isInitializingClassifier}
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
                  {isInitializingClassifier
                    ? 'Inicializando sistema de classificação inteligente...'
                    : uploadedFile
                    ? `Arquivo carregado: ${uploadedFile.name}`
                    : 'Arraste e solte seu extrato ou fatura aqui ou clique para selecionar'
                  }
                </p>

                <p className="text-sm text-muted-foreground">
                  {isInitializingClassifier
                    ? 'Carregando padrões de classificação e modelos de IA...'
                    : 'Formatos suportados: CSV, OFX, PDF e imagem (JPG, PNG)'
                  }
                </p>
              </div>

              {isInitializingClassifier && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Brain className="h-4 w-4 animate-pulse text-primary" />
                    Preparando classificador inteligente...
                  </p>
                  <Progress value={50} className="w-full animate-pulse" />
                </div>
              )}

              {isProcessing && !isInitializingClassifier && (
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

