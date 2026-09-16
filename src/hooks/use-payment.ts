import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { SUBSCRIPTION_QUERY_KEY } from './use-subscription';
import { QUOTA_QUERY_KEY } from './use-quota';

export interface PaymentData {
  id: string;
  url: string | null;
  value: number;
  dueDate?: string;
  billingType?: string;
}

export interface CreatePaymentParams {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  cpfCnpj?: string;
  mobilePhone?: string;
}

export interface PaymentResponse {
  success: boolean;
  subscription?: any;
  payment?: PaymentData | null;
  free_plan?: boolean;
  upgraded?: boolean;
  error?: string;
}

export interface ManageSubscriptionResponse {
  success: boolean;
  subscription?: any;
  /** true = encerrada na hora (cobrança pendente/em atraso); false = vale até o fim do período. */
  immediate?: boolean;
  access_until?: string | null;
}

async function invoke<T>(fn: string, body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Você precisa estar autenticado');

  const { data, error } = await supabase.functions.invoke(fn, {
    body: body ?? {},
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    const detail = await (error as any)?.context?.json?.().catch(() => null);
    throw new Error(detail?.error || error.message || 'Falha na comunicação com o servidor');
  }
  if (data && (data as any).success === false) {
    throw new Error((data as any).error || 'Operação não concluída');
  }

  return data as T;
}

export function usePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });

  const createPayment = async (params: CreatePaymentParams): Promise<PaymentResponse> => {
    setIsLoading(true);
    setPaymentData(null);

    try {
      const data = await invoke<PaymentResponse>('asaas-create-payment', params);
      invalidate();

      if (data.free_plan) {
        toast({ title: 'Plano ativado!', description: 'Seu plano gratuito foi ativado com sucesso.' });
        return { success: true, subscription: data.subscription, free_plan: true };
      }

      if (data.payment) {
        setPaymentData(data.payment);
        toast({
          title: data.upgraded ? 'Plano alterado!' : 'Cobrança criada!',
          description: 'Conclua o pagamento para liberar o acesso.',
        });
      }

      return { success: true, ...data };
    } catch (error: any) {
      toast({
        title: 'Erro ao processar pagamento',
        description: error.message,
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOpenInvoice = async (): Promise<PaymentData | null> => {
    setIsLoading(true);
    try {
      const data = await invoke<{ payment: PaymentData }>('asaas-manage-subscription', { action: 'invoice' });
      setPaymentData(data.payment);
      return data.payment;
    } catch (error: any) {
      toast({ title: 'Nenhuma cobrança disponível', description: error.message, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const invalidateAfterPlanChange = () =>
    Promise.all([invalidate(), queryClient.invalidateQueries({ queryKey: QUOTA_QUERY_KEY })]);

  /**
   * Cancela a renovação automática. Com período pago em curso, o acesso segue
   * até `current_period_end` (cancel_at_period_end); cobrança pendente ou em
   * atraso encerra na hora. A decisão é do backend (asaas-manage-subscription).
   */
  const cancelSubscription = async (): Promise<ManageSubscriptionResponse | null> => {
    setIsLoading(true);
    try {
      const data = await invoke<ManageSubscriptionResponse>('asaas-manage-subscription', { action: 'cancel' });
      await invalidateAfterPlanChange();
      toast({
        title: 'Assinatura cancelada',
        description: data.immediate
          ? 'A cobrança recorrente foi encerrada.'
          : 'A renovação automática foi desligada. Seu plano continua valendo até o fim do período pago.',
      });
      return data;
    } catch (error: any) {
      toast({ title: 'Assinatura não cancelada', description: error.message, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /** Desfaz um cancelamento agendado: a próxima cobrança volta para o fim do período. */
  const reactivateSubscription = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      await invoke<ManageSubscriptionResponse>('asaas-manage-subscription', { action: 'reactivate' });
      await invalidateAfterPlanChange();
      toast({
        title: 'Assinatura retomada',
        description: 'A renovação automática voltou a valer. Nada é cobrado antes do fim do período atual.',
      });
      return true;
    } catch (error: any) {
      toast({ title: 'Assinatura não retomada', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const clearPaymentData = () => setPaymentData(null);

  return {
    createPayment,
    fetchOpenInvoice,
    cancelSubscription,
    reactivateSubscription,
    clearPaymentData,
    isLoading,
    paymentData,
  };
}

/** Reconciliação com o Asaas — backend é a autoridade sobre o status. */
export async function syncSubscriptionStatus(): Promise<void> {
  try {
    await invoke('asaas-sync-subscription');
  } catch (error) {
    console.error('Falha ao sincronizar assinatura:', error);
  }
}
