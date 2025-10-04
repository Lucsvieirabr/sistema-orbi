import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { calculateInstallmentValue, roundCurrency } from '@/lib/utils';

export type Series = Tables<'series'>;
export type SeriesInsert = TablesInsert<'series'>;
export type SeriesUpdate = TablesUpdate<'series'>;
export type SeriesSummary = Tables<'series_summary'>;

export interface InstallmentData {
  id: string;
  value: number;
  date: string;
  status: 'PAID' | 'PENDING';
  installment_number: number;
}

export interface CreateSeriesParams {
  description: string;
  totalValue: number;
  totalInstallments: number;
  startDate: string;
  categoryId?: string;
  accountId?: string;
  creditCardId?: string;
  personId?: string;
  paymentMethod?: string;
  type?: string;
  isFixed?: boolean;
}

export interface UpdateSeriesParams {
  seriesId: string;
  newTotalValue?: number;
  newTotalInstallments?: number;
  newDescription?: string;
  scope?: 'future' | 'all';
}

export function useSeries() {
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar todas as séries do usuário com resumo
  const fetchSeries = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('series_summary')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSeries(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar séries');
    } finally {
      setLoading(false);
    }
  };

  // Buscar parcelas de uma série específica
  const fetchSeriesInstallments = async (seriesId: string): Promise<InstallmentData[]> => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, value, date, status, installment_number')
        .eq('series_id', seriesId)
        .order('date', { ascending: true });

      if (error) throw error;

      return (data || []).map((txn) => ({
        id: txn.id,
        value: txn.value,
        date: txn.date,
        status: txn.status as 'PAID' | 'PENDING',
        installment_number: txn.installment_number || 1
      }));
    } catch (err) {
      throw err;
    }
  };

  // Criar nova série de parcelas
  const createSeries = async (params: CreateSeriesParams): Promise<string> => {
    try {
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Calcular valor preciso das parcelas
      const installmentValue = calculateInstallmentValue(params.totalValue, params.totalInstallments);

      // Criar série usando a função do banco
      const { data, error } = await supabase.rpc('create_installment_series', {
        p_user_id: user.id,
        p_description: params.description,
        p_total_value: roundCurrency(params.totalValue),
        p_total_installments: params.totalInstallments,
        p_start_date: params.startDate,
        p_category_id: params.categoryId || null,
        p_account_id: params.accountId || null,
        p_credit_card_id: params.creditCardId || null,
        p_family_member_id: params.personId || null,
        p_payment_method: params.paymentMethod || 'credit',
        p_type: params.type || 'expense',
        p_is_fixed: params.isFixed || false
      });

      if (error) throw error;

      // Recarregar séries
      await fetchSeries();

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar série';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Atualizar série existente
  const updateSeries = async (params: UpdateSeriesParams): Promise<void> => {
    try {
      setError(null);

      // Para atualizar série individual, precisamos buscar as parcelas atuais
      const currentInstallments = await fetchSeriesInstallments(params.seriesId);
      
      // Preparar dados das parcelas para o backend
      const installmentsData = currentInstallments.map(installment => ({
        value: installment.value,
        date: installment.date,
        status: installment.status
      }));

      const { error } = await supabase.rpc('update_installment_series', {
        p_installments_data: installmentsData,
        p_series_id: params.seriesId,
        p_user_id: user.id
      });

      if (error) throw error;

      // Recarregar séries
      await fetchSeries();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar série';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Atualizar status de uma parcela específica
  const updateInstallmentStatus = async (
    transactionId: string, 
    status: 'PAID' | 'PENDING'
  ): Promise<void> => {
    try {
      setError(null);

      const { error } = await supabase
        .from('transactions')
        .update({ status })
        .eq('id', transactionId);

      if (error) throw error;

      // Recarregar séries para atualizar os resumos
      await fetchSeries();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar status da parcela';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Atualizar valor de uma parcela específica
  const updateInstallmentValue = async (
    transactionId: string, 
    value: number
  ): Promise<void> => {
    try {
      setError(null);

      const { error } = await supabase
        .from('transactions')
        .update({ value: roundCurrency(value) })
        .eq('id', transactionId);

      if (error) throw error;

      // Recarregar séries para atualizar os resumos
      await fetchSeries();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar valor da parcela';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Atualizar data de uma parcela específica
  const updateInstallmentDate = async (
    transactionId: string, 
    date: string
  ): Promise<void> => {
    try {
      setError(null);

      const { error } = await supabase
        .from('transactions')
        .update({ date })
        .eq('id', transactionId);

      if (error) throw error;

      // Recarregar séries para atualizar os resumos
      await fetchSeries();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar data da parcela';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Deletar série (cascata deleta todas as transações)
  const deleteSeries = async (seriesId: string): Promise<void> => {
    try {
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.rpc('delete_installment_series', {
        p_series_id: seriesId,
        p_user_id: user.id
      });

      if (error) throw error;

      // Recarregar séries
      await fetchSeries();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar série';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Limpar séries órfãs
  const cleanupOrphanedSeries = async (): Promise<number> => {
    try {
      setError(null);

      const { data, error } = await supabase.rpc('cleanup_orphaned_series');

      if (error) throw error;

      // Recarregar séries
      await fetchSeries();

      return data || 0;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao limpar séries órfãs';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Buscar séries ao montar o componente
  useEffect(() => {
    fetchSeries();
  }, []);

  return {
    series,
    loading,
    error,
    fetchSeries,
    fetchSeriesInstallments,
    createSeries,
    updateSeries,
    updateInstallmentStatus,
    updateInstallmentValue,
    updateInstallmentDate,
    deleteSeries,
    cleanupOrphanedSeries,
    refreshSeries: fetchSeries
  };
}
