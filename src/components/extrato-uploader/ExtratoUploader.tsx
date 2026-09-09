import React, { useState, useCallback, useEffect } from 'react';
import { FileText, AlertCircle, CheckCircle, Brain } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IntelligentTransactionClassifier } from './IntelligentTransactionClassifier';
import { ConfirmationDialog } from './ConfirmationDialog';
import { CSVParser } from './CSVParser';
import { StatementParser } from './StatementParser';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { processPdfFile } from '@/integrations/parser_api';

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_CSV_SIZE = 10 * 1024 * 1024; // 10MB

async function detectRealFileType(file: File): Promise<'csv' | 'pdf' | null> {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const isPDF = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
  if (isPDF) return 'pdf';
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
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
    // Fallback: exportações bancárias BR costumam vir em ISO-8859-1/Windows-1252
    return new TextDecoder('windows-1252').decode(bytes);
  }
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
    setProgress(0);
    setErrors([]);
    setProcessingStats(null);

    try {
      const fileType = await detectRealFileType(file);

      if (!fileType) {
        throw new Error('Arquivo inválido: selecione um CSV ou PDF real (o conteúdo não corresponde à extensão).');
      }
      if (fileType === 'pdf' && file.size > MAX_PDF_SIZE) {
        throw new Error(`PDF excede o limite de ${MAX_PDF_SIZE / 1024 / 1024}MB.`);
      }
      if (fileType === 'csv' && file.size > MAX_CSV_SIZE) {
        throw new Error(`CSV excede o limite de ${MAX_CSV_SIZE / 1024 / 1024}MB.`);
      }

      setProgress(10);

      let rawTransactions: any[] = [];

      if (fileType === 'csv') {
        // Para arquivos CSV, usar processamento existente
        const csvData = await parseCSVFile(file);
        setProgress(30);

        const csvParser = new CSVParser();
        const parseResult = csvParser.parseCSVData(csvData);
        rawTransactions = parseResult.transactions;

      } else if (fileType === 'pdf') {
        // Para arquivos PDF, usar novo processamento com OCR
        setProgress(20);

        // Extrair texto do PDF (com OCR para PDFs de imagem)
        const extractedText = await processPdfFile(file, (ocrProgress) => {
          // Mapear progresso do OCR (20-60) para a barra de progresso geral
          const mappedProgress = 20 + (ocrProgress * 0.4);
          setProgress(mappedProgress);
        });
        
        // LOG TEMPORÁRIO: Ver texto extraído
        console.log('📄 TEXTO EXTRAÍDO DO PDF (primeiros 2000 chars):');
        console.log(extractedText.substring(0, 2000));
        console.log('...');
        console.log('📄 TEXTO EXTRAÍDO DO PDF (últimos 1000 chars):');
        console.log(extractedText.substring(extractedText.length - 1000));
        
        setProgress(65);

        // Usar StatementParser para interpretar texto bruto
        const statementParser = new StatementParser();
        rawTransactions = await statementParser.parseRawTextStatement(extractedText);
        
        setProgress(75);
      }

      // Verificar se há transações para processar
      if (rawTransactions.length === 0) {
        throw new Error('Nenhuma transação foi detectada no arquivo. Verifique o formato do extrato.');
      }

      // Processar transações com IA (fluxo comum para ambos os tipos)
      const results = await processTransactionsWithAI(rawTransactions, classifier);

      setProgress(90);

      // Preparar para confirmação
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

  const processTransactionsWithAI = async (parsedTransactions: any[], _classifier: IntelligentTransactionClassifier) => {
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

    // 🚀 OTIMIZAÇÃO: Classificar TODAS as transações em UMA única request via Edge Function
    try {
      // Importar BatchClassifier dinamicamente
      const { BatchTransactionClassifier } = await import('./BatchClassifier');
      const batchClassifier = new BatchTransactionClassifier('SP', 100);

      // Preparar transações para classificação em batch
      const transactionsToClassify = parsedTransactions.map(t => ({
        description: t.description,
        type: t.type,
        amount: t.value,
        date: t.date
      }));

      console.log('🤖 Enviando para IA:', transactionsToClassify.length, 'transações');
      console.log('Primeira transação:', transactionsToClassify[0]);

      // ⚡ UMA ÚNICA REQUEST classifica TODAS as transações
      const batchResponse = await batchClassifier.classifyBatch(transactionsToClassify);
      
      console.log('📥 Resposta da IA:', batchResponse.results.length, 'classificações');
      console.log('Primeira classificação:', batchResponse.results[0]);

      // Processar resultados
      for (let i = 0; i < parsedTransactions.length; i++) {
        const parsedTransaction = parsedTransactions[i];
        const classification = batchResponse.results[i];
        
        stats.total++;
        stats.processed++;

        // Normalizar categoria usando aliases
        let normalizedCategory = classification.category.toLowerCase();

        // Aplicar mapeamentos de aliases
        if (categoryAliases[normalizedCategory]) {
          normalizedCategory = categoryAliases[normalizedCategory].toLowerCase();
        }

        // Mapear categoria para ID
        const mappedCategory = categoryMap[normalizedCategory];
        let category_id = mappedCategory && mappedCategory.type === parsedTransaction.type ? mappedCategory.id : undefined;

        // Log de mapeamento
        if (i === 0) {
          console.log('🗺️ Mapeamento de categoria:', {
            categoria_ia: classification.category,
            normalizada: normalizedCategory,
            mapeada: mappedCategory,
            category_id,
            tipo_transacao: parsedTransaction.type
          });
        }

        // Se não encontrou categoria específica, usar categoria padrão baseada no tipo
        if (!category_id) {
          const defaultCategoryName = parsedTransaction.type === 'income'
            ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)'
            : 'Outros';
          const defaultCategory = categoryMap[defaultCategoryName.toLowerCase()];
          category_id = defaultCategory?.id;
        }

        const transaction = {
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
          installments: parsedTransaction.installments,
          installment_number: parsedTransaction.installment_number
        };

        transactions.push(transaction);

        // Atualizar estatísticas
        if (classification.confidence >= 90) stats.withHighConfidence++;
        else if (classification.confidence >= 70) stats.withMediumConfidence++;
        else stats.withLowConfidence++;

        if (classification.learned_from_user) stats.learned++;
        if (classification.method === 'ml_prediction') stats.mlPredictions++;
        if (classification.method === 'merchant_specific' || classification.method === 'banking_pattern') stats.dictionaryMatches++;
        if (classification.method === 'hybrid') stats.hybridDecisions++;
      }
    } catch (error) {
      console.error('❌ Erro na classificação em batch:', error);
      throw error;
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
            Selecione um arquivo CSV ou PDF do seu banco. Nossa IA analisará e categorizará automaticamente as transações.
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
              accept=".csv,.pdf"
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
                    : 'Arraste e solte seu arquivo CSV ou PDF aqui ou clique para selecionar'
                  }
                </p>

                <p className="text-sm text-muted-foreground">
                  {isInitializingClassifier
                    ? 'Carregando padrões de classificação e modelos de IA...'
                    : 'Formatos suportados: CSV, PDF'
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
                    {progress < 65 && uploadedFile?.name.toLowerCase().includes('.pdf')
                      ? 'Extraindo texto do PDF (OCR)...'
                      : progress < 80
                      ? 'Interpretando transações...'
                      : 'Classificando com IA...'
                    }
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

