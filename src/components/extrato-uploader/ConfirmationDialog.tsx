import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Save, AlertCircle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { ParsedTransaction } from './CSVParser';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { IntelligentTransactionClassifier } from './IntelligentTransactionClassifier';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: ParsedTransaction[];
  onTransactionsSaved: () => void;
}

interface Category {
  id: string;
  name: string;
  category_type: 'income' | 'expense';
}

interface Account {
  id: string;
  name: string;
}

export function ConfirmationDialog({ open, onOpenChange, transactions, onTransactionsSaved }: ConfirmationDialogProps) {
  const [editedTransactions, setEditedTransactions] = useState<ParsedTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [classifier, setClassifier] = useState<IntelligentTransactionClassifier | null>(null);
  const [correctionsDetected, setCorrectionsDetected] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const loadCategoriesAndAccounts = useCallback(async () => {
    try {
      // Carregar categorias
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name, category_type')
        .order('name');

      if (categoriesData) {
        setCategories(categoriesData as Category[]);
      }

      // Carregar contas
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('id, name')
        .order('name');

      if (accountsData) {
        setAccounts(accountsData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar categorias e contas.",
        variant: "destructive"
      });
    }
  }, [toast]);

  useEffect(() => {
    if (open && transactions.length > 0) {
      setEditedTransactions([...transactions]);
      loadCategoriesAndAccounts();

      // Inicializa o classificador para aprendizado
      const initializeClassifier = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const intelligentClassifier = new IntelligentTransactionClassifier('SP', user.id, true, true);
            setClassifier(intelligentClassifier);
          }
        } catch (error) {
          console.error('Erro ao inicializar classificador:', error);
        }
      };

      initializeClassifier();
    }
  }, [open, transactions, loadCategoriesAndAccounts]);

  const updateTransaction = (index: number, field: keyof ParsedTransaction, value: ParsedTransaction[keyof ParsedTransaction]) => {
    const updated = [...editedTransactions];
    const originalTransaction = updated[index];
    updated[index] = { ...originalTransaction, [field]: value };

    // Detecta correções de categoria
    if (field === 'category_id' && originalTransaction.category_id !== value) {
      const newCorrections = new Set(correctionsDetected);
      newCorrections.add(index);
      setCorrectionsDetected(newCorrections);

      console.log(`🔧 Correção detectada na linha ${index + 1}:`, {
        descricao: originalTransaction.description,
        categoria_anterior: originalTransaction.category_name,
        categoria_nova: categories.find(c => c.id === value)?.name
      });
    }

    setEditedTransactions(updated);
  };

  const removeTransaction = (index: number) => {
    const updated = editedTransactions.filter((_, i) => i !== index);
    setEditedTransactions(updated);
  };

  const handleSave = async () => {
    if (editedTransactions.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhuma transação para salvar.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    setErrors([]);

    try {
      // Validar transações
      const validationErrors = validateTransactions();
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setIsSaving(false);
        return;
      }

      // Obter ID do usuário
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Converter para formato do banco
      const transactionsToSave = editedTransactions.map(transaction => ({
        user_id: user.id,
        description: transaction.description,
        value: transaction.type === 'expense' ? -Math.abs(transaction.value) : Math.abs(transaction.value),
        date: transaction.date,
        type: transaction.type,
        category_id: transaction.category_id || null,
        account_id: transaction.account_id || null,
        installments: transaction.installments || null,
        installment_number: transaction.installment_number || null,
        is_fixed: transaction.is_fixed || false,
        payment_method: transaction.payment_method || (transaction.type === 'expense' ? 'debit' : null),
        credit_card_id: transaction.credit_card_id || null
      }));

      // Inserir em lote
      const { data, error } = await supabase
        .from('transactions')
        .insert(transactionsToSave)
        .select();

      if (error) {
        throw error;
      }

      // APRENDIZADO AUTOMÁTICO DAS CORREÇÕES
      if (classifier && correctionsDetected.size > 0) {
        console.log(`🧠 Iniciando aprendizado de ${correctionsDetected.size} correções...`);

        const learningPromises = Array.from(correctionsDetected).map(async (index) => {
          const transaction = editedTransactions[index];
          const category = categories.find(c => c.id === transaction.category_id);

          if (category) {
            try {
              await classifier.learnFromUserCorrection(
                transaction.description,
                category.name,
                transaction.subcategory,
                transaction.type
              );
              console.log(`✅ Aprendido: "${transaction.description}" → ${category.name}`);
            } catch (error) {
              console.error(`❌ Erro no aprendizado de "${transaction.description}":`, error);
            }
          }
        });

        await Promise.allSettled(learningPromises);
        console.log(`🎓 Aprendizado concluído para ${correctionsDetected.size} correções`);
      }

      toast({
        title: "Sucesso",
        description: `${data.length} transações importadas com sucesso!${correctionsDetected.size > 0 ? ` (${correctionsDetected.size} padrões aprendidos)` : ''}`,
      });

      onTransactionsSaved();
      onOpenChange(false);

    } catch (error) {
      console.error('Erro ao salvar transações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar transações. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const validateTransactions = (): string[] => {
    const errors: string[] = [];

    editedTransactions.forEach((transaction, index) => {
      if (!transaction.description?.trim()) {
        errors.push(`Transação ${index + 1}: Descrição obrigatória`);
      }

      if (!transaction.value || transaction.value <= 0) {
        errors.push(`Transação ${index + 1}: Valor deve ser maior que zero`);
      }

      if (!transaction.date) {
        errors.push(`Transação ${index + 1}: Data obrigatória`);
      }

      if (transaction.installments && transaction.installment_number) {
        if (transaction.installment_number > transaction.installments) {
          errors.push(`Transação ${index + 1}: Número da parcela não pode ser maior que total de parcelas`);
        }
      }
    });

    return errors;
  };

  const getCategoryOptions = (transactionType: 'income' | 'expense') => {
    return categories.filter(cat => cat.category_type === transactionType);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Confirmar Importação de Transações
          </DialogTitle>
          <DialogDescription>
            Revise e edite as transações antes de importar. Você pode alterar categorias, valores, datas e marcar como fixas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Alertas de erro */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {errors.map((error, index) => (
                    <div key={index}>{error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Alerta de aprendizado */}
          {correctionsDetected.size > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    <strong>Aprendizado Inteligente:</strong> Detectadas {correctionsDetected.size} correções de categoria.
                    O sistema aprenderá automaticamente com essas correções para melhorar futuras classificações.
                  </span>
                  <span className="text-xs text-muted-foreground">
                    🔧 Correções: {correctionsDetected.size}
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Lista de transações em formato compacto */}
          <ScrollArea className="h-[500px] w-full border rounded-md">
            <div className="divide-y">
              {editedTransactions.map((transaction, index) => (
                <div key={transaction.id} className={`p-4 hover:bg-muted/30 transition-colors ${correctionsDetected.has(index) ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''}`}>
                  {/* Linha 1: Ícone + Descrição + Data + Valor + Excluir */}
                  <div className="grid grid-cols-12 gap-2 items-center mb-2">
                    <div className="col-span-1 flex items-center gap-2">
                      <div className={`p-1.5 rounded-full ${transaction.type === 'income' ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                        {transaction.type === 'income' ? (
                          <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">#{index + 1}</span>
                      {correctionsDetected.has(index) && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="Correção detectada - será aprendida" />
                      )}
                    </div>

                    <div className="col-span-6">
                      <Input
                        value={transaction.description}
                        onChange={(e) => updateTransaction(index, 'description', e.target.value)}
                        placeholder="Descrição da transação"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="col-span-2">
                      <Input
                        type="date"
                        value={transaction.date}
                        onChange={(e) => updateTransaction(index, 'date', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="col-span-2">
                      <NumericInput
                        currency
                        value={transaction.value}
                        onChange={(value) => updateTransaction(index, 'value', value)}
                        placeholder="0,00"
                        className="h-8 text-sm font-medium"
                      />
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTransaction(index)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Linha 2: Categoria + Conta + Parcelas + Fixo */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1"></div>

                    <div className="col-span-3">
                      <Select
                        value={transaction.category_id || ''}
                        onValueChange={(value) => {
                          const category = categories.find(c => c.id === value);
                          updateTransaction(index, 'category_id', value);
                          updateTransaction(index, 'category_name', category?.name);
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {getCategoryOptions(transaction.type).map((category) => (
                            <SelectItem key={category.id} value={category.id} className="text-xs">
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-3">
                      <Select
                        value={transaction.account_id || ''}
                        onValueChange={(value) => updateTransaction(index, 'account_id', value)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id} className="text-xs">
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-5 flex items-center gap-3">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <Input
                          type="number"
                          min="1"
                          max="99"
                          value={transaction.installment_number || ''}
                          onChange={(e) => updateTransaction(index, 'installment_number', parseInt(e.target.value) || undefined)}
                          placeholder="Nº"
                          className="h-8 text-sm w-12 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-xs text-muted-foreground">/</span>
                        <Input
                          type="number"
                          min="1"
                          max="99"
                          value={transaction.installments || ''}
                          onChange={(e) => updateTransaction(index, 'installments', parseInt(e.target.value) || undefined)}
                          placeholder="Tot"
                          className="h-8 text-sm w-12 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Switch
                          checked={transaction.is_fixed || false}
                          onCheckedChange={(checked) => updateTransaction(index, 'is_fixed', checked)}
                          className="scale-75"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Fixa</span>
                      </div>
                    </div>

                    <div className="col-span-1"></div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Resumo melhorado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{editedTransactions.length}</div>
              <div className="text-sm text-muted-foreground">Total de Transações</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(editedTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.value, 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total de Receitas</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(editedTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.value, 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total de Despesas</div>
            </div>
          </div>

          {/* Botões de ação melhorados */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Revise todas as transações antes de salvar
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="px-6"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || editedTransactions.length === 0}
                className="flex items-center gap-2 px-6"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar Transações ({editedTransactions.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
