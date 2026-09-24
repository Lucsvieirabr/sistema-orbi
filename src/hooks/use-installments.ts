import { getCachedAuthUser } from "@/hooks/use-current-user";
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
  project_id?: string | null;
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
      const { data: { user } } = await getCachedAuthUser();
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

      if (params.project_id && typeof data === "string") {
        const { error: projectError } = await supabase
          .from("transactions")
          .update({ project_id: params.project_id })
          .eq("series_id", data)
          .eq("user_id", user.id);
        if (projectError) throw projectError;
      }

      return data;
    },
    onSuccess: (seriesId) => {
      toast({
        title: "Série de parcelas criada",
        duration: 3000
      });
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível criar a série de parcelas",
        description: error?.message,
        variant: "destructive"
      });
    }
  });

  // Atualizar série de parcelas
  const updateInstallmentSeries = useMutation({
    mutationFn: async (params: UpdateInstallmentSeriesParams) => {
      const { data: { user } } = await getCachedAuthUser();
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
        title: `${updatedCount} parcelas atualizadas`,
        duration: 3000
      });
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível atualizar a série de parcelas",
        description: error?.message,
        variant: "destructive"
      });
    }
  });

  // Deletar série de parcelas
  const deleteInstallmentSeries = useMutation({
    mutationFn: async (seriesId: string) => {
      const { data: { user } } = await getCachedAuthUser();
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
        title: `${deletedCount} parcelas removidas`,
        duration: 3000
      });
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível deletar a série de parcelas",
        description: error?.message,
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
