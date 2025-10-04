import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Installment {
  id: string;
  value: number;
  date: string;
  status: 'PAID' | 'PENDING';
  installment_number: number;
}

interface CreateInstallmentSeriesParams {
  description: string;
  type: 'income' | 'expense';
  account_id?: string;
  category_id?: string;
  payment_method?: 'debit' | 'credit';
  credit_card_id?: string;
  person_id?: string;
  is_fixed?: boolean;
  installments: Installment[];
}

interface UpdateInstallmentSeriesParams {
  series_id: string;
  installments: Installment[];
}

export function useInstallments() {
  const queryClient = useQueryClient();

  // Criar série de parcelas
  const createInstallmentSeries = useMutation({
    mutationFn: async (params: CreateInstallmentSeriesParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Preparar dados das parcelas para o backend
      const installmentsData = params.installments.map(installment => ({
        value: installment.value,
        date: installment.date,
        status: installment.status
      }));

      const { data, error } = await supabase.rpc('create_installment_series', {
        p_user_id: user.id,
        p_description: params.description,
        p_type: params.type,
        p_account_id: params.account_id || null,
        p_category_id: params.category_id || null,
        p_payment_method: params.payment_method || 'debit',
        p_credit_card_id: params.credit_card_id || null,
        p_person_id: params.person_id || null,
        p_is_fixed: params.is_fixed || false,
        p_installments_data: installmentsData
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (seriesId) => {
      toast({
        title: "Sucesso",
        description: "Série de parcelas criada com sucesso",
        duration: 3000
      });
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a série de parcelas",
        variant: "destructive"
      });
    }
  });

  // Atualizar série de parcelas
  const updateInstallmentSeries = useMutation({
    mutationFn: async (params: UpdateInstallmentSeriesParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Preparar dados das parcelas para o backend
      const installmentsData = params.installments.map(installment => ({
        value: installment.value,
        date: installment.date,
        status: installment.status
      }));

      const { data, error } = await supabase.rpc('update_installment_series', {
        p_installments_data: installmentsData,
        p_series_id: params.series_id,
        p_user_id: user.id
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedCount) => {
      toast({
        title: "Sucesso",
        description: `${updatedCount} parcelas atualizadas`,
        duration: 3000
      });
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a série de parcelas",
        variant: "destructive"
      });
    }
  });

  // Deletar série de parcelas
  const deleteInstallmentSeries = useMutation({
    mutationFn: async (seriesId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.rpc('delete_installment_series', {
        p_series_id: seriesId,
        p_user_id: user.id
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (deletedCount) => {
      toast({
        title: "Sucesso",
        description: `${deletedCount} parcelas removidas`,
        duration: 3000
      });
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível deletar a série de parcelas",
        variant: "destructive"
      });
    }
  });

  return {
    createInstallmentSeries,
    updateInstallmentSeries,
    deleteInstallmentSeries
  };
}
