import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface PaymentData {
  id: string;
  url: string;
  value: number;
  active: boolean;
  chargeType: string;
  subscriptionCycle?: string;
  redirectUrl?: string;
}

export interface CreatePaymentParams {
  planId: string;
  billingCycle: 'monthly' | 'annual';
}

export interface PaymentResponse {
  success: boolean;
  subscription?: any;
  payment?: PaymentData;
  free_plan?: boolean;
  error?: string;
}

export function usePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const { toast } = useToast();

  const createPayment = async (params: CreatePaymentParams): Promise<PaymentResponse> => {
    setIsLoading(true);
    setPaymentData(null);

    try {
      // Obter sessão do usuário
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Você precisa estar autenticado para criar um pagamento');
      }

      // Chamar Edge Function para criar pagamento
      const { data, error } = await supabase.functions.invoke('asaas-create-payment', {
        body: params,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error creating payment:', error);
        throw new Error(error.message || 'Erro ao criar pagamento');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao criar pagamento');
      }

      // Se for plano gratuito, não há dados de pagamento
      if (data.free_plan) {
        toast({
          title: 'Plano ativado!',
          description: 'Seu plano gratuito foi ativado com sucesso.',
        });
        
        return {
          success: true,
          subscription: data.subscription,
          free_plan: true,
        };
      }

      // Armazenar dados do pagamento
      if (data.payment) {
        setPaymentData(data.payment);
        
        toast({
          title: 'Pagamento criado!',
          description: 'Seu pagamento foi criado. Complete o pagamento para ativar sua assinatura.',
        });
      }

      return {
        success: true,
        subscription: data.subscription,
        payment: data.payment,
      };
    } catch (error: any) {
      console.error('Error in createPayment:', error);
      
      toast({
        title: 'Erro ao criar pagamento',
        description: error.message || 'Ocorreu um erro ao processar seu pagamento',
        variant: 'destructive',
      });

      return {
        success: false,
        error: error.message,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const clearPaymentData = () => {
    setPaymentData(null);
  };

  return {
    createPayment,
    clearPaymentData,
    isLoading,
    paymentData,
  };
}

