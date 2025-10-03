import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type TransactionStatus = 'PENDING' | 'PAID';

export interface StatusSyncOptions {
  transactionId: string;
  newStatus: TransactionStatus;
  userId: string;
}

/**
 * Hook para sincronização de status de transações
 * Atualiza o status e liquidation_date automaticamente
 */
export function useStatusSync() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /**
   * Sincroniza o status de uma transação e transações relacionadas na mesma série E mesma pessoa
   */
  const syncStatus = useCallback(async (transactionId: string, newStatus: TransactionStatus) => {
    try {
      // Buscar a transação atual para obter o series_id e person_id
      const { data: currentTransaction, error: fetchError } = await supabase
        .from('transactions')
        .select('series_id, linked_txn_id, person_id')
        .eq('id', transactionId)
        .single();

      if (fetchError) {
        throw new Error(`Erro ao buscar transação: ${fetchError.message}`);
      }

      // Preparar dados de atualização
      const updateData: any = { status: newStatus };
      
      // Se mudando para PAID, o trigger no banco definirá liquidation_date automaticamente
      // Se mudando de PAID para outro status, liquidation_date será limpo pelo trigger

      // Se a transação tem series_id, atualizar apenas transações da série com a MESMA pessoa
      if (currentTransaction.series_id) {
        const { error: seriesError } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('series_id', currentTransaction.series_id)
          .eq('person_id', currentTransaction.person_id);

        if (seriesError) {
          throw new Error(`Erro ao atualizar série: ${seriesError.message}`);
        }
      } 
      // Se a transação tem linked_txn_id, atualizar a transação principal (mesma pessoa)
      else if (currentTransaction.linked_txn_id) {
        const { error: linkedError } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('id', currentTransaction.linked_txn_id)
          .eq('person_id', currentTransaction.person_id);

        if (linkedError) {
          throw new Error(`Erro ao atualizar transação principal: ${linkedError.message}`);
        }
      }
      // Caso contrário, atualizar apenas a transação atual
      else {
        const { error: singleError } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('id', transactionId);

        if (singleError) {
          throw new Error(`Erro ao atualizar transação: ${singleError.message}`);
        }
      }

      // Invalidar queries relacionadas para atualizar a UI
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["balances"] }),
        queryClient.invalidateQueries({ queryKey: ["projected-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["credit_cards"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] })
      ]);

    } catch (error: any) {
      console.error('Erro na sincronização de status:', error);
      throw error;
    }
  }, [queryClient]);

  return {
    syncStatus
  };
}
