import React, { useState, useCallback, useEffect } from 'react';
import { FileText, AlertCircle, CheckCircle, Brain } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IntelligentTransactionClassifier } from './IntelligentTransactionClassifier';
import { ConfirmationDialog } from './ConfirmationDialog';
import { CSVParser } from './CSVParser';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [errors, setErrors] = useState<string[]>([]);
  const { toast } = useToast();

  // Inicializa o classificador inteligente
  useEffect(() => {
    const initializeClassifier = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const intelligentClassifier = new IntelligentTransactionClassifier('SP', user.id, true, true);
          setClassifier(intelligentClassifier);
        }
      } catch (error) {
        // Erro ao inicializar classificador
      }
    };

    initializeClassifier();
  }, []);

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
      // Verificar se é um arquivo CSV
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Por favor, selecione apenas arquivos CSV.');
      }

      setProgress(10);

      // Para arquivos CSV, usar papaparse
      const csvData = await parseCSVFile(file);

      setProgress(30);

      // Processar transações com IA
      const results = await processTransactionsWithAI(csvData, classifier);

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
    return new Promise((resolve, reject) => {
      import('papaparse').then(({ default: Papa }) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          encoding: 'utf-8',
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

  const processTransactionsWithAI = async (csvData: any[], classifier: IntelligentTransactionClassifier) => {
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

    // Usar CSVParser para processar os dados
    const csvParser = new CSVParser();
    const parseResult = csvParser.parseCSVData(csvData);

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
      'assinaturas': 'Telefone / Apps',
      'streaming': 'Telefone / Apps',
      'telefonia': 'Telefone / Apps',
      'internet': 'Telefone / Apps',
      'telefonia móvel': 'Telefone / Apps',
      'telefonia fixa': 'Telefone / Apps',
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

    // Processar cada transação parseada
    for (let i = 0; i < parseResult.transactions.length; i++) {
      const parsedTransaction = parseResult.transactions[i];
      stats.total++;
      stats.processed++;

      try {
        // Classificar com IA usando a descrição original
        const classification = await classifier.classifyTransaction(parsedTransaction.description, parsedTransaction.type);

        // Normalizar categoria usando aliases
        let normalizedCategory = classification.category.toLowerCase();

        // Aplicar mapeamentos de aliases
        if (categoryAliases[normalizedCategory]) {
          normalizedCategory = categoryAliases[normalizedCategory].toLowerCase();
        }

        // Mapear categoria para ID
        const mappedCategory = categoryMap[normalizedCategory];
        let category_id = mappedCategory && mappedCategory.type === parsedTransaction.type ? mappedCategory.id : undefined;

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
          ml_prediction: classification.ml_prediction,
          dictionary_result: classification.dictionary_result,
          installments: parsedTransaction.installments,
          installment_number: parsedTransaction.installment_number
        };

        transactions.push(transaction);

        // Atualizar estatísticas
        if (classification.confidence >= 90) stats.withHighConfidence++;
        else if (classification.confidence >= 70) stats.withMediumConfidence++;
        else stats.withLowConfidence++;

        if (classification.learned_from_user) stats.learned++;
        if (classification.ml_prediction) stats.mlPredictions++;
        if (classification.dictionary_result) stats.dictionaryMatches++;
        if (classification.method === 'hybrid') stats.hybridDecisions++;

      } catch (error) {
        // Erro ao processar transação
      }
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
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            Importar Extrato Bancário com IA
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Selecione um arquivo CSV do seu banco. Nossa IA analisará e categorizará automaticamente as transações.
          </p>
        </DialogHeader>

        <div className="space-y-4">

          {/* Área de Drop */}
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 hover:border-gray-400'
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
              accept=".csv"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />

            <div className="space-y-4">
              <div className="flex justify-center">
                {uploadedFile ? (
                  <CheckCircle className="h-12 w-12 text-green-500" />
                ) : (
                  <FileText className="h-12 w-12 text-gray-400" />
                )}
              </div>

              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {uploadedFile
                    ? `Arquivo carregado: ${uploadedFile.name}`
                    : 'Arraste e solte seu arquivo CSV aqui ou clique para selecionar'
                  }
                </p>

                <p className="text-sm text-gray-500">
                  Formatos suportados: CSV
                </p>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 flex items-center justify-center gap-2">
                    <Brain className="h-4 w-4 animate-pulse" />
                    Processando com IA...
                  </p>
                  <Progress value={progress} className="w-full" />
                </div>
              )}
            </div>
          </div>

          {/* Alertas */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Inteligência Artificial:</strong> Nosso sistema usa dicionário inteligente + Machine Learning
              para categorizar automaticamente suas transações com alta precisão (95%+). Você pode revisar e editar
              antes de importar.
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
