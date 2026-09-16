import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { SelectWithAddButton } from '@/components/ui/select-with-add-button';
import { SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RecordCard, RecordCardList, TableView } from '@/components/ui/record-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Save, AlertCircle, CheckCircle, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { useIsCompact } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ParsedTransaction } from './CSVParser';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/use-categories';
import { useAccounts } from '@/hooks/use-accounts';
import { useCreditCards } from '@/hooks/use-credit-cards';
import { diagnoseLimitError } from '@/lib/limits';
import { roundCurrency } from '@/lib/utils';
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

interface CreditCardOption {
  id: string;
  name: string;
}

/** Resultado detalhado de uma importação — o que entrou, o que não entrou e por quê. */
interface SaveReport {
  saved: number;
  duplicates: number;
  failures: { description: string; date: string; reason: string }[];
}

/**
 * Tamanho do bloco de INSERT.
 *
 * O insert era uma única chamada com TODAS as linhas. Como os gatilhos de cota
 * (`check_transactions_limit`) e as CHECK constraints rodam por linha, UMA
 * linha ruim derrubava a fatura inteira — 72 lançamentos viravam zero, com a
 * mensagem genérica "Erro ao salvar transações". Em blocos, uma falha isola no
 * máximo um bloco, que é então reprocessado linha a linha.
 */
const CHUNK_SIZE = 50;

/** Chave de identidade de um lançamento, para não reimportar a mesma fatura. */
function duplicateKey(date: string, value: number, description: string): string {
  const desc = description.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${date}|${Math.abs(roundCurrency(value)).toFixed(2)}|${desc}`;
}

/**
 * Soma meses a uma data `YYYY-MM-DD` sem passar por `new Date(string)`.
 *
 * Dois bugs de uma vez:
 *  1. FUSO — `new Date('2026-07-31')` é meia-noite UTC; em UTC-3 o `getMonth()`
 *     devolve o mês anterior e `toISOString()` devolve o dia anterior.
 *  2. TRANSBORDO — `setMonth(0 + 1)` sobre 31/jan produz 03/mar, porque 31/fev
 *     não existe. Aqui o dia é preso ao último dia do mês de destino.
 */
function addMonthsISO(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetMonthIndex = (m - 1) + months;
  const year = y + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12; // 0-11
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Traduz o erro do Postgres/PostgREST em algo acionável.
 *
 * Antes, TODO erro virava "Erro ao salvar transações. Tente novamente." — cota
 * de plano estourada, assinatura inativa, violação de RLS e descrição fora do
 * formato eram indistinguíveis, e nenhum deles se resolve "tentando de novo".
 */
function describeSaveError(error: unknown): string {
  const diagnosis = diagnoseLimitError(error);
  if (diagnosis.kind !== 'unknown') return diagnosis.message;

  const err = (error ?? {}) as Record<string, any>;
  const code = String(err.code ?? '');
  const message = String(err.message ?? '');

  if (code === '23505') return 'Já existe um lançamento idêntico registrado.';
  if (code === '23503') {
    return 'A conta, o cartão ou a categoria escolhida não existe mais. Recarregue a página e refaça a seleção.';
  }
  if (code === '23514' || /check constraint/i.test(message)) {
    return 'Algum campo está fora do formato aceito pelo banco (descrição acima de 300 caracteres, data inválida ou valor fora da faixa).';
  }
  if (code === '23502') return 'Um campo obrigatório ficou em branco.';
  if (code === '42501' || /row-level security/i.test(message)) {
    return 'O banco recusou a gravação por permissão (RLS). Faça login novamente.';
  }
  if (/failed to fetch|networkerror/i.test(message)) {
    return 'Sem conexão com o servidor. Verifique a internet e tente novamente.';
  }

  return message || 'Erro desconhecido ao salvar.';
}

export function ConfirmationDialog({ open, onOpenChange, transactions, onTransactionsSaved }: ConfirmationDialogProps) {
  const [editedTransactions, setEditedTransactions] = useState<ParsedTransaction[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveReport, setSaveReport] = useState<SaveReport | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [classifier, setClassifier] = useState<IntelligentTransactionClassifier | null>(null);
  const [correctionsDetected, setCorrectionsDetected] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  // Usar hooks do React Query para carregar categorias, contas e cartões (auto-refresh)
  const { categories: allCategories } = useCategories();
  const { accountsWithBalance } = useAccounts();
  const { creditCards } = useCreditCards();

  const categories = (allCategories || []) as Category[];
  const accountsList = (accountsWithBalance || []) as Account[];
  const cardsList = (creditCards || []) as CreditCardOption[];

  useEffect(() => {
    if (open && transactions.length > 0) {
      // Pré-seleção: fatura de cartão com UM cartão cadastrado não tem ambiguidade.
      // Sem isso, os 72 lançamentos de uma fatura entravam com `credit_card_id`
      // nulo e sumiam da tela de faturas — "importou e não apareceu".
      const onlyCard = cardsList.length === 1 ? cardsList[0].id : undefined;

      setEditedTransactions(
        transactions.map(t => {
          if (t.payment_method !== 'credit') return { ...t };
          return {
            ...t,
            credit_card_id: t.credit_card_id || onlyCard,
            account_id: undefined,
          };
        }),
      );

      // Inicializa o classificador para aprendizado
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
    } else if (!open) {
      // Limpar dados quando fechar
      setEditedTransactions([]);
      setCorrectionsDetected(new Set());
      setErrors([]);
      setSaveReport(null);
    }
    // `cardsList` fora das deps de propósito: a pré-seleção é do momento em que
    // o diálogo abre, não deve reescrever edições do usuário a cada refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transactions]);

  const updateTransaction = (
    index: number,
    field: keyof ParsedTransaction,
    value: ParsedTransaction[keyof ParsedTransaction],
    additionalUpdates?: Partial<ParsedTransaction>,
  ) => {
    const updated = [...editedTransactions];
    const originalTransaction = updated[index];

    updated[index] = {
      ...originalTransaction,
      [field]: value,
      ...additionalUpdates,
    };

    // Detecta correções de categoria
    if (field === 'category_id' && originalTransaction.category_id !== value) {
      const newCorrections = new Set(correctionsDetected);
      newCorrections.add(index);
      setCorrectionsDetected(newCorrections);
    }

    setEditedTransactions(updated);
  };

  /**
   * Destino é exclusivo: ou conta, ou cartão.
   *
   * Uma transação com `payment_method='credit'` e `credit_card_id` nulo é
   * órfã — `use-monthly-transactions` a filtra pela data-calendário em vez do
   * período de fatura, e a tela de faturas nunca a enxerga.
   */
  const setAccount = (index: number, accountId: string) => {
    updateTransaction(index, 'account_id', accountId || undefined, {
      credit_card_id: undefined,
      payment_method: editedTransactions[index].type === 'expense' ? 'debit' : undefined,
    });
  };

  const setCard = (index: number, cardId: string) => {
    updateTransaction(index, 'credit_card_id', cardId || undefined, {
      account_id: undefined,
      payment_method: 'credit',
    });
  };

  /** Aplica um destino/categoria a TODAS as linhas de uma vez. */
  const applyToAll = (patch: Partial<ParsedTransaction>) => {
    setEditedTransactions(prev => prev.map(t => ({ ...t, ...patch })));
  };

  const removeTransaction = (index: number) => {
    setEditedTransactions(editedTransactions.filter((_, i) => i !== index));
  };

  /** Monta a linha de INSERT a partir da transação revisada. */
  const buildRow = (transaction: ParsedTransaction, userId: string, seriesId?: string) => ({
    user_id: userId,
    description: transaction.description.trim().slice(0, 300),
    value: Math.abs(roundCurrency(transaction.value)),
    date: transaction.date,
    type: transaction.type,
    category_id: transaction.category_id || null,
    account_id: transaction.account_id || null,
    credit_card_id: transaction.credit_card_id || null,
    payment_method: transaction.credit_card_id
      ? 'credit'
      : transaction.payment_method || (transaction.type === 'expense' ? 'debit' : null),
    installment_number: transaction.installment_number || null,
    series_id: seriesId || null,
    is_fixed: false,
    status: 'PENDING',
  });

  /**
   * Separa o que já existe no banco do que é novo.
   *
   * Multiconjunto, não conjunto: uma fatura pode ter DUAS compras idênticas no
   * mesmo dia (a fatura de exemplo tem "Cei - Parcela 2/6 R$ 106,93" duas
   * vezes). Contar ocorrências evita descartar a segunda como duplicata.
   */
  const splitDuplicates = async (
    items: ParsedTransaction[],
    userId: string,
  ): Promise<{ novas: ParsedTransaction[]; duplicadas: ParsedTransaction[] }> => {
    if (!skipDuplicates || items.length === 0) return { novas: items, duplicadas: [] };

    const dates = items.map(t => t.date).sort();

    const { data, error } = await supabase
      .from('transactions')
      .select('date, value, description')
      .eq('user_id', userId)
      .gte('date', dates[0])
      .lte('date', dates[dates.length - 1]);

    // Falha aqui não pode bloquear a importação: sem o comparativo, importa tudo.
    if (error) {
      console.warn('[ConfirmationDialog] não foi possível checar duplicatas:', error);
      return { novas: items, duplicadas: [] };
    }

    const existing = new Map<string, number>();
    for (const row of data ?? []) {
      const key = duplicateKey(row.date as string, Number(row.value), String(row.description ?? ''));
      existing.set(key, (existing.get(key) ?? 0) + 1);
    }

    const novas: ParsedTransaction[] = [];
    const duplicadas: ParsedTransaction[] = [];

    for (const item of items) {
      const key = duplicateKey(item.date, item.value, item.description);
      const remaining = existing.get(key) ?? 0;
      if (remaining > 0) {
        existing.set(key, remaining - 1);
        duplicadas.push(item);
      } else {
        novas.push(item);
      }
    }

    return { novas, duplicadas };
  };

  /**
   * Cria uma `series` para cada lançamento parcelado detectado ("Parcela 3/6").
   *
   * Sem isso o total de parcelas era perdido no salvamento: só
   * `installment_number` era gravado e `use-monthly-transactions` — que lê
   * `series(total_installments)` — devolvia `totalInstallments: null`, de modo
   * que o selo "3/6" nunca aparecia.
   *
   * Devolve o mapa transação → series_id e a lista de series criadas (para
   * limpeza caso o INSERT das transações falhe).
   */
  const createSeriesForInstallments = async (
    items: ParsedTransaction[],
    userId: string,
  ): Promise<{ map: Map<string, string>; createdIds: string[] }> => {
    const parceladas = items.filter(t => (t.installments ?? 0) > 1);
    const map = new Map<string, string>();
    if (parceladas.length === 0) return { map, createdIds: [] };

    const rows = parceladas.map(t => {
      const seriesId = crypto.randomUUID();
      map.set(t.id, seriesId);
      return {
        id: seriesId,
        user_id: userId,
        description: t.description.trim().slice(0, 300),
        total_value: roundCurrency(Math.abs(t.value) * (t.installments as number)),
        total_installments: t.installments as number,
        is_fixed: false,
        frequency: 'monthly',
        start_date: t.date,
        end_date: null,
        category_id: t.category_id || null,
      };
    });

    const { error } = await supabase.from('series').insert(rows);

    // Série é acessório: se não der para criar, a transação ainda deve entrar.
    if (error) {
      console.warn('[ConfirmationDialog] não foi possível criar as séries de parcelamento:', error);
      return { map: new Map(), createdIds: [] };
    }

    return { map, createdIds: rows.map(r => r.id) };
  };

  /**
   * INSERT em blocos, com reprocessamento linha a linha quando um bloco falha.
   *
   * O objetivo é sempre gravar o máximo possível e dizer com precisão o que
   * ficou de fora — em vez de perder a importação inteira por causa de uma
   * linha.
   */
  const insertInChunks = async (
    rows: ReturnType<typeof buildRow>[],
    originals: ParsedTransaction[],
  ): Promise<{ saved: number; failures: SaveReport['failures'] }> => {
    let saved = 0;
    const failures: SaveReport['failures'] = [];

    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
      const chunk = rows.slice(start, start + CHUNK_SIZE);
      const { data, error } = await supabase.from('transactions').insert(chunk).select('id');

      if (!error) {
        saved += data?.length ?? chunk.length;
        continue;
      }

      // Bloco recusado: descobre QUAIS linhas são o problema.
      for (let offset = 0; offset < chunk.length; offset++) {
        const { error: rowError } = await supabase.from('transactions').insert(chunk[offset]);

        if (rowError) {
          const original = originals[start + offset];
          failures.push({
            description: original?.description ?? chunk[offset].description,
            date: original?.date ?? chunk[offset].date,
            reason: describeSaveError(rowError),
          });

          // Cota estourada / assinatura inativa valem para TODAS as próximas:
          // insistir só gera N chamadas fadadas ao mesmo erro.
          const kind = diagnoseLimitError(rowError).kind;
          if (kind === 'plan_quota' || kind === 'no_subscription' || kind === 'rate_limit') {
            for (let rest = start + offset + 1; rest < rows.length; rest++) {
              failures.push({
                description: originals[rest]?.description ?? rows[rest].description,
                date: originals[rest]?.date ?? rows[rest].date,
                reason: 'Não enviada: o limite acima interrompeu a importação.',
              });
            }
            return { saved, failures };
          }
        } else {
          saved += 1;
        }
      }
    }

    return { saved, failures };
  };

  /**
   * Transação fixa importada: cria a série e 6 meses de lançamentos futuros.
   */
  const createSmartFixedTransaction = async (transaction: ParsedTransaction, userId: string) => {
    const seriesId = crypto.randomUUID();
    const monthsToGenerate = 6;
    const value = Math.abs(roundCurrency(transaction.value));

    const { error: seriesError } = await supabase.from('series').insert({
      id: seriesId,
      user_id: userId,
      description: transaction.description.trim().slice(0, 300),
      total_value: roundCurrency(value * (monthsToGenerate + 1)),
      total_installments: monthsToGenerate + 1,
      is_fixed: true,
      category_id: transaction.category_id || null,
      frequency: 'monthly',
      start_date: transaction.date,
      end_date: null,
    });

    if (seriesError) throw seriesError;

    const base = {
      user_id: userId,
      type: transaction.type,
      account_id: transaction.account_id || null,
      category_id: transaction.category_id || null,
      value,
      description: transaction.description.trim().slice(0, 300),
      payment_method: transaction.credit_card_id
        ? 'credit'
        : transaction.payment_method || (transaction.type === 'expense' ? 'debit' : null),
      credit_card_id: transaction.credit_card_id || null,
      person_id: null,
      series_id: seriesId,
      is_fixed: true,
      status: 'PENDING',
    };

    // Atual + futuras numa única chamada: menos ida-e-volta e nada de série
    // pela metade quando a segunda chamada falhava.
    const rows = [
      { ...base, date: transaction.date, installment_number: 1 },
      ...Array.from({ length: monthsToGenerate }, (_, i) => ({
        ...base,
        date: addMonthsISO(transaction.date, i + 1),
        installment_number: i + 2,
      })),
    ];

    const { error: transactionError } = await supabase.from('transactions').insert(rows);

    if (transactionError) {
      // Rollback manual: sem transação atômica no client, a série órfã ficaria
      // visível na tela de parcelamentos sem nenhum lançamento.
      await supabase.from('series').delete().eq('id', seriesId);
      throw transactionError;
    }

    return rows.length;
  };

  const handleSave = async () => {
    if (editedTransactions.length === 0) {
      toast({ title: 'Erro', description: 'Nenhuma transação para salvar.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setSaveReport(null);

    try {
      const validationErrors = validateTransactions();
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setIsSaving(false);
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Sessão expirada. Faça login novamente para importar.');

      const { novas, duplicadas } = await splitDuplicates(editedTransactions, user.id);

      if (novas.length === 0) {
        setSaveReport({ saved: 0, duplicates: duplicadas.length, failures: [] });
        toast({
          title: 'Nada a importar',
          description: `As ${duplicadas.length} transações do arquivo já estavam registradas.`,
        });
        setIsSaving(false);
        return;
      }

      const fixedTransactions = novas.filter(t => t.is_fixed);
      const normalTransactions = novas.filter(t => !t.is_fixed);

      let totalSaved = 0;
      const failures: SaveReport['failures'] = [];

      if (normalTransactions.length > 0) {
        const { map: seriesMap, createdIds } = await createSeriesForInstallments(normalTransactions, user.id);
        const rows = normalTransactions.map(t => buildRow(t, user.id, seriesMap.get(t.id)));

        const result = await insertInChunks(rows, normalTransactions);
        totalSaved += result.saved;
        failures.push(...result.failures);

        // Nenhuma transação entrou: as séries criadas acima ficariam órfãs.
        if (result.saved === 0 && createdIds.length > 0) {
          await supabase.from('series').delete().in('id', createdIds);
        }
      }

      for (const transaction of fixedTransactions) {
        try {
          totalSaved += await createSmartFixedTransaction(transaction, user.id);
        } catch (error) {
          failures.push({
            description: transaction.description,
            date: transaction.date,
            reason: describeSaveError(error),
          });
        }
      }

      setSaveReport({ saved: totalSaved, duplicates: duplicadas.length, failures });

      // APRENDIZADO AUTOMÁTICO DAS CORREÇÕES
      if (classifier && correctionsDetected.size > 0) {
        const learningPromises = Array.from(correctionsDetected).map(async (index) => {
          const transaction = editedTransactions[index];
          const category = categories.find(c => c.id === transaction.category_id);

          if (category) {
            try {
              await classifier.learnFromUserCorrection(
                transaction.description,
                category.name,
                transaction.category_name,
                transaction.type,
              );
            } catch (error) {
              // Erro no aprendizado não invalida a importação.
            }
          }
        });

        await Promise.allSettled(learningPromises);
      }

      if (totalSaved === 0) {
        // Não fecha o diálogo: o usuário precisa ver o motivo e poder corrigir.
        toast({
          title: 'Nenhuma transação foi salva',
          description: failures[0]?.reason ?? 'O banco recusou todos os lançamentos.',
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      const extras = [
        duplicadas.length > 0 ? `${duplicadas.length} já existiam` : null,
        failures.length > 0 ? `${failures.length} falharam` : null,
        fixedTransactions.length > 0 ? `${fixedTransactions.length} fixas com recorrência mensal` : null,
      ].filter(Boolean);

      toast({
        title: failures.length > 0 ? 'Importação parcial' : 'Sucesso',
        description: `${totalSaved} transações importadas${extras.length ? ` (${extras.join(', ')})` : ''}.`,
        variant: failures.length > 0 ? 'destructive' : undefined,
      });

      // Com falhas, o diálogo fica aberto mostrando exatamente o que ficou de fora.
      if (failures.length > 0) {
        setEditedTransactions(prev =>
          prev.filter(t => failures.some(f => f.description === t.description && f.date === t.date)),
        );
        setIsSaving(false);
        onTransactionsSaved();
        return;
      }

      onTransactionsSaved();
      onOpenChange(false);
    } catch (error) {
      const reason = describeSaveError(error);
      console.error('[ConfirmationDialog] falha ao salvar transações:', error);
      setErrors([reason]);
      toast({ title: 'Erro ao salvar', description: reason, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const validateTransactions = (): string[] => {
    const errors: string[] = [];

    editedTransactions.forEach((transaction, index) => {
      const rotulo = `Transação ${index + 1} (${transaction.description || 'sem descrição'})`;

      if (!transaction.description?.trim()) {
        errors.push(`${rotulo}: descrição obrigatória`);
      } else if (transaction.description.trim().length > 300) {
        errors.push(`${rotulo}: descrição acima de 300 caracteres (limite do banco)`);
      }

      if (!transaction.value || transaction.value <= 0) {
        errors.push(`${rotulo}: valor deve ser maior que zero`);
      }

      if (!transaction.date || !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) {
        errors.push(`${rotulo}: data obrigatória no formato AAAA-MM-DD`);
      }

      // Sem destino, o lançamento entra no banco mas não aparece em saldo
      // nenhum nem em fatura nenhuma — o "importei e sumiu".
      if (!transaction.account_id && !transaction.credit_card_id) {
        errors.push(`${rotulo}: escolha uma conta OU um cartão`);
      }
      if (transaction.account_id && transaction.credit_card_id) {
        errors.push(`${rotulo}: escolha conta OU cartão, não os dois`);
      }

      if (transaction.installments && transaction.installment_number) {
        if (transaction.installment_number > transaction.installments) {
          errors.push(`${rotulo}: número da parcela não pode ser maior que o total`);
        }
      }
    });

    return errors;
  };

  const getCategoryOptions = (transactionType: 'income' | 'expense') => {
    return categories.filter(cat => cat.category_type === transactionType);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  /** Quantas linhas ainda estão sem destino — o erro mais comum da importação. */
  const semDestino = useMemo(
    () => editedTransactions.filter(t => !t.account_id && !t.credit_card_id).length,
    [editedTransactions],
  );

  const totalReceitas = useMemo(
    () => editedTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.value, 0),
    [editedTransactions],
  );

  const totalDespesas = useMemo(
    () => editedTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.value, 0),
    [editedTransactions],
  );

  /**
   * Abaixo de `lg` a lista vira cards empilhados; de `lg` para cima, tabela.
   * Troca por JS (e não só por CSS) porque cada `SelectWithAddButton` monta
   * hooks de dados próprios — renderizar as duas versões dobraria esse custo.
   */
  const isCompact = useIsCompact();

  const renderCategorySelect = (transaction: ParsedTransaction, index: number) => (
    <SelectWithAddButton
      entityType="categories"
      value={transaction.category_id || ''}
      onValueChange={(value) => {
        const category = categories.find(c => c.id === value);
        updateTransaction(index, 'category_id', value, { category_name: category?.name });
      }}
      placeholder="Categoria"
    >
      {getCategoryOptions(transaction.type).map((category) => (
        <SelectItem key={category.id} value={category.id}>
          {category.name}
        </SelectItem>
      ))}
    </SelectWithAddButton>
  );

  const renderAccountSelect = (transaction: ParsedTransaction, index: number) => (
    <SelectWithAddButton
      entityType="accounts"
      value={transaction.account_id || ''}
      onValueChange={(value) => setAccount(index, value)}
      placeholder="Conta"
    >
      {accountsList.map((account) => (
        <SelectItem key={account.id} value={account.id}>
          {account.name}
        </SelectItem>
      ))}
    </SelectWithAddButton>
  );

  const renderCardSelect = (transaction: ParsedTransaction, index: number) => (
    <SelectWithAddButton
      entityType="creditCards"
      value={transaction.credit_card_id || ''}
      onValueChange={(value) => setCard(index, value)}
      placeholder="Cartão"
    >
      {cardsList.map((card) => (
        <SelectItem key={card.id} value={card.id}>
          {card.name}
        </SelectItem>
      ))}
    </SelectWithAddButton>
  );

  const numberFieldClass =
    'px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  const renderInstallmentInputs = (transaction: ParsedTransaction, index: number, widthClass: string) => (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        inputMode="numeric"
        min="1"
        max="99"
        value={transaction.installment_number || ''}
        onChange={(e) => updateTransaction(index, 'installment_number', parseInt(e.target.value) || undefined)}
        placeholder="Nº"
        aria-label={`Número da parcela da transação ${index + 1}`}
        className={cn(numberFieldClass, widthClass)}
      />
      <span className="text-sm text-muted-foreground" aria-hidden>
        /
      </span>
      <Input
        type="number"
        inputMode="numeric"
        min="1"
        max="99"
        value={transaction.installments || ''}
        onChange={(e) => updateTransaction(index, 'installments', parseInt(e.target.value) || undefined)}
        placeholder="Tot"
        aria-label={`Total de parcelas da transação ${index + 1}`}
        className={cn(numberFieldClass, widthClass)}
      />
    </div>
  );

  const renderTypeIcon = (transaction: ParsedTransaction) => {
    const isIncome = transaction.type === 'income';
    return (
      <span
        className={cn(
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          isIncome ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive',
        )}
      >
        {isIncome ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        <span className="sr-only">{isIncome ? 'Receita' : 'Despesa'}</span>
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Casca em coluna: cabeçalho e rodapé fixos, só o corpo rola.
          'flex flex-col gap-0 overflow-hidden p-0 sm:p-0',
          'w-[calc(100vw-1rem)] max-w-7xl sm:w-[calc(100vw-2rem)]',
          'max-h-[calc(100svh-1rem)] sm:max-h-[calc(100svh-2rem)] lg:max-h-[90svh]',
        )}
      >
        {/* Cabeçalho */}
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 pb-3 pt-4 text-left sm:px-6 sm:pt-5">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 shrink-0 text-success" />
            Confirmar Importação de Transações
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Revise e edite as transações antes de importar. Cada lançamento precisa de uma conta OU de um cartão.
          </DialogDescription>
        </DialogHeader>

        {/* Corpo rolável */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4">
          {/* Aplicar a todas — com dezenas de linhas, ajustar uma a uma é inviável */}
          <section className="rounded-lg border border-border bg-surface-sunken p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-foreground">Aplicar a todas as transações</span>
              {semDestino > 0 && (
                <Badge variant="destructive" className="tabular">
                  {semDestino} sem destino
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <SelectWithAddButton
                entityType="accounts"
                value=""
                onValueChange={(value) =>
                  applyToAll({ account_id: value, credit_card_id: undefined, payment_method: 'debit' })
                }
                placeholder="Conta para todas"
              >
                {accountsList.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectWithAddButton>

              <SelectWithAddButton
                entityType="creditCards"
                value=""
                onValueChange={(value) =>
                  applyToAll({ credit_card_id: value, account_id: undefined, payment_method: 'credit' })
                }
                placeholder="Cartão para todas"
              >
                {cardsList.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}
                  </SelectItem>
                ))}
              </SelectWithAddButton>

              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 md:h-10">
                <Switch checked={skipDuplicates} onCheckedChange={setSkipDuplicates} />
                <span className="text-sm text-foreground">Ignorar já registradas</span>
              </label>
            </div>
          </section>

          {/* Alertas de erro */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="max-h-40 space-y-1 overflow-y-auto overscroll-contain">
                  {errors.map((error, index) => (
                    <div key={index} className="text-sm">{error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Relatório da última tentativa */}
          {saveReport && saveReport.failures.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium tabular">
                    {saveReport.saved} salvas · {saveReport.failures.length} não salvas
                    {saveReport.duplicates > 0 ? ` · ${saveReport.duplicates} já existiam` : ''}
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto overscroll-contain">
                    {saveReport.failures.slice(0, 20).map((failure, index) => (
                      <div key={index} className="text-sm">
                        {failure.date} — {failure.description}: {failure.reason}
                      </div>
                    ))}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {cardsList.length === 0 && editedTransactions.some(t => t.payment_method === 'credit') && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Este arquivo é uma fatura de cartão, mas não há cartão cadastrado. Use o botão <strong>+</strong> ao
                lado de "Cartão para todas" para criar um — sem isso os lançamentos não aparecem na tela de faturas.
              </AlertDescription>
            </Alert>
          )}

          {editedTransactions.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhuma transação na lista. Feche e importe o arquivo novamente.
            </p>
          )}

          {/* Lista de transações */}
          {editedTransactions.length > 0 && isCompact && (
            /* Telefone e tablet: cards empilhados (1 coluna → 2 colunas em md) */
            <RecordCardList className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
              {editedTransactions.map((transaction, index) => {
                const faltaDestino = !transaction.account_id && !transaction.credit_card_id;

                return (
                  <RecordCard
                    key={transaction.id}
                    accent={transaction.type === 'income' ? 'positive' : 'negative'}
                    className="flex flex-col gap-3"
                  >
                    {/* Topo: tipo, posição, final do cartão e remover */}
                    <div className="-mt-1 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {renderTypeIcon(transaction)}
                        <span className="text-xs font-medium text-muted-foreground tabular">#{index + 1}</span>
                        {transaction.card_last4 && (
                          <Badge variant="secondary" className="tabular">
                            •••• {transaction.card_last4}
                          </Badge>
                        )}
                        {faltaDestino && <Badge variant="destructive">Sem destino</Badge>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeTransaction(index)}
                        aria-label={`Remover transação ${index + 1}`}
                        className="-mr-2 shrink-0 text-destructive hover:bg-destructive-soft hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>

                    <CardField label="Descrição">
                      <Input
                        value={transaction.description}
                        onChange={(e) => updateTransaction(index, 'description', e.target.value)}
                        placeholder="Descrição da transação"
                        aria-label={`Descrição da transação ${index + 1}`}
                      />
                    </CardField>

                    <div className="grid grid-cols-2 gap-2">
                      <CardField label="Data">
                        <Input
                          type="date"
                          value={transaction.date}
                          onChange={(e) => updateTransaction(index, 'date', e.target.value)}
                          aria-label={`Data da transação ${index + 1}`}
                          className="min-w-0 appearance-none px-2 [&::-webkit-date-and-time-value]:text-left"
                        />
                      </CardField>
                      <CardField label="Valor">
                        <NumericInput
                          currency
                          value={transaction.value}
                          onChange={(value) => updateTransaction(index, 'value', value)}
                          placeholder="0,00"
                          aria-label={`Valor da transação ${index + 1}`}
                          className="px-2 font-medium tabular"
                        />
                      </CardField>
                    </div>

                    <CardField label="Categoria">{renderCategorySelect(transaction, index)}</CardField>

                    <CardField label="Destino · conta ou cartão">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1">
                        {renderAccountSelect(transaction, index)}
                        {renderCardSelect(transaction, index)}
                      </div>
                    </CardField>

                    <div className="flex items-end justify-between gap-3 border-t border-border-subtle pt-3">
                      <CardField label="Parcela">{renderInstallmentInputs(transaction, index, 'w-14')}</CardField>
                      <label className="flex h-11 shrink-0 cursor-pointer items-center gap-2 pl-2">
                        <span className="text-sm font-medium text-foreground">Fixa</span>
                        <Switch
                          checked={transaction.is_fixed || false}
                          onCheckedChange={(checked) => updateTransaction(index, 'is_fixed', checked)}
                        />
                      </label>
                    </div>
                  </RecordCard>
                );
              })}
            </RecordCardList>
          )}

          {editedTransactions.length > 0 && !isCompact && (
            /* Desktop: tabela. Scroll horizontal, se houver, fica dentro da tabela. */
            <TableView className="block overflow-hidden">
              <Table className="min-w-[58rem]">
                <TableHeader className="bg-surface-sunken">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="label-eyebrow h-10 w-[4rem] pl-3 pr-2">#</TableHead>
                    <TableHead className="label-eyebrow h-10 px-2">Descrição · categoria</TableHead>
                    <TableHead className="label-eyebrow h-10 w-[9rem] px-2">Data</TableHead>
                    <TableHead className="label-eyebrow h-10 w-[8rem] px-2 text-right">Valor</TableHead>
                    <TableHead className="label-eyebrow h-10 w-[11rem] px-2">Conta ou cartão</TableHead>
                    <TableHead className="label-eyebrow h-10 w-[7.5rem] px-2">Parcela</TableHead>
                    <TableHead className="label-eyebrow h-10 w-[3.5rem] px-2 text-center">Fixa</TableHead>
                    <TableHead className="h-10 w-[3.5rem] pl-2 pr-3">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editedTransactions.map((transaction, index) => {
                    const faltaDestino = !transaction.account_id && !transaction.credit_card_id;
                    const cell = 'px-2 py-2.5 align-top md:px-2 md:py-2.5';

                    return (
                      <TableRow key={transaction.id} className="hover:bg-muted/30">
                        <TableCell className={cn(cell, 'pl-3 md:pl-3')}>
                          <div className="flex flex-col items-start gap-1.5 pt-2">
                            <div className="flex items-center gap-1.5">
                              {renderTypeIcon(transaction)}
                              <span className="text-xs font-medium text-muted-foreground tabular">#{index + 1}</span>
                            </div>
                            {transaction.card_last4 && (
                              <span className="text-2xs text-muted-foreground tabular">•••• {transaction.card_last4}</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className={cell}>
                          <div className="flex flex-col gap-1.5">
                            <Input
                              value={transaction.description}
                              onChange={(e) => updateTransaction(index, 'description', e.target.value)}
                              placeholder="Descrição da transação"
                              aria-label={`Descrição da transação ${index + 1}`}
                            />
                            {renderCategorySelect(transaction, index)}
                          </div>
                        </TableCell>

                        <TableCell className={cell}>
                          <Input
                            type="date"
                            value={transaction.date}
                            onChange={(e) => updateTransaction(index, 'date', e.target.value)}
                            aria-label={`Data da transação ${index + 1}`}
                            className="px-2"
                          />
                        </TableCell>

                        <TableCell className={cell}>
                          <NumericInput
                            currency
                            value={transaction.value}
                            onChange={(value) => updateTransaction(index, 'value', value)}
                            placeholder="0,00"
                            aria-label={`Valor da transação ${index + 1}`}
                            className="px-2 text-right font-medium tabular"
                          />
                        </TableCell>

                        <TableCell className={cell}>
                          <div className="flex flex-col gap-1.5">
                            {renderAccountSelect(transaction, index)}
                            {renderCardSelect(transaction, index)}
                            {faltaDestino && (
                              <span className="text-2xs font-medium text-destructive">Sem destino</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className={cell}>{renderInstallmentInputs(transaction, index, 'w-10')}</TableCell>

                        <TableCell className={cn(cell, 'text-center')}>
                          <div className="flex h-10 items-center justify-center">
                            <Switch
                              checked={transaction.is_fixed || false}
                              onCheckedChange={(checked) => updateTransaction(index, 'is_fixed', checked)}
                              aria-label={`Transação ${index + 1} fixa`}
                            />
                          </div>
                        </TableCell>

                        <TableCell className={cn(cell, 'pr-3 md:pr-3')}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeTransaction(index)}
                            aria-label={`Remover transação ${index + 1}`}
                            className="mt-1 text-destructive hover:bg-destructive-soft hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableView>
          )}
        </div>

        {/* Rodapé fixo: resumo + ações sempre ao alcance do polegar */}
        <div className="shrink-0 space-y-3 border-t border-border bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4 lg:flex lg:items-center lg:justify-between lg:gap-6 lg:space-y-0">
          <div className="min-w-0 space-y-1.5">
            <dl className="grid grid-cols-[auto_1fr_1fr] gap-x-3 sm:flex sm:gap-x-8">
              <div className="min-w-0">
                <dt className="label-eyebrow">Transações</dt>
                <dd className="figure-sm tabular text-foreground">{editedTransactions.length}</dd>
              </div>
              <div className="min-w-0">
                <dt className="label-eyebrow">Receitas</dt>
                <dd className="figure-sm tabular whitespace-nowrap text-success">{formatCurrency(totalReceitas)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="label-eyebrow">Despesas</dt>
                <dd className="figure-sm tabular whitespace-nowrap text-destructive">{formatCurrency(totalDespesas)}</dd>
              </div>
            </dl>
            <p
              role="status"
              aria-live="polite"
              className={cn(
                'flex items-center gap-1.5 text-xs',
                semDestino > 0 ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {semDestino > 0 ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
              )}
              {semDestino > 0
                ? `${semDestino} transação(ões) ainda sem conta ou cartão`
                : 'Tudo pronto para importar'}
            </p>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-2 sm:flex sm:justify-end lg:shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving} className="sm:px-6">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || editedTransactions.length === 0} className="sm:px-6">
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
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
      </DialogContent>
    </Dialog>
  );
}

/** Rótulo visível acima do campo: o placeholder some quando o campo é preenchido. */
function CardField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <span className="label-eyebrow block">{label}</span>
      {children}
    </div>
  );
}
