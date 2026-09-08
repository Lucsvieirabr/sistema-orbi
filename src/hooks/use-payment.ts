import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { SUBSCRIPTION_QUERY_KEY } from './use-subscription';

export interface PaymentData {
  id: string;
  url: string;
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

  const cancelSubscription = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      await invoke('asaas-manage-subscription', { action: 'cancel' });
      invalidate();
      toast({ title: 'Assinatura cancelada', description: 'A renovação automática foi desativada.' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao cancelar', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const clearPaymentData = () => setPaymentData(null);

  return { createPayment, fetchOpenInvoice, cancelSubscription, clearPaymentData, isLoading, paymentData };
}

/** Reconciliação com o Asaas — backend é a autoridade sobre o status. */
export async function syncSubscriptionStatus(): Promise<void> {
  try {
    await invoke('asaas-sync-subscription');
  } catch (error) {
    console.error('Falha ao sincronizar assinatura:', error);
  }
}
