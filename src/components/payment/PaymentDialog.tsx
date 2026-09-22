import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PaymentData, syncSubscriptionStatus } from '@/hooks/use-payment';
import { SUBSCRIPTION_QUERY_KEY } from '@/hooks/use-subscription';
import { QUOTA_QUERY_KEY } from '@/hooks/use-quota';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { openExternalUrl, safePaymentUrl } from '@/lib/safe-url';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentData: PaymentData | null;
}

export function PaymentDialog({ open, onOpenChange, paymentData }: PaymentDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const completedRef = useRef(false);

  const paymentUrl = safePaymentUrl(paymentData?.url);

  useEffect(() => {
    if (open) return;
    setCheckoutStarted(false);
    setPaymentConfirmed(false);
    completedRef.current = false;
  }, [open, paymentData?.id]);

  useEffect(() => {
    if (!open || !checkoutStarted) return;

    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) return;

      if (document.visibilityState === 'hidden') {
        timer = window.setTimeout(poll, 3000);
        return;
      }

      const result = await syncSubscriptionStatus(paymentData.id);
      if (cancelled) return;

      if (result?.status) {
        queryClient.setQueryData(SUBSCRIPTION_QUERY_KEY, result.status);
      }

      if (result?.payment_confirmed && result.status.status === 'active') {
        if (completedRef.current) return;
        completedRef.current = true;
        setPaymentConfirmed(true);

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: QUOTA_QUERY_KEY }),
        ]);

        if (cancelled) return;
        toast({
          title: 'Pagamento confirmado!',
          description: 'Sua assinatura está ativa. Abrindo o painel…',
        });

        timer = window.setTimeout(() => {
          onOpenChange(false);
          navigate('/sistema', { replace: true });
        }, 900);
        return;
      }

      const interval = Date.now() - startedAt < 2 * 60 * 1000 ? 3000 : 60000;
      timer = window.setTimeout(poll, interval);
    };

    timer = window.setTimeout(poll, 3000);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [checkoutStarted, navigate, onOpenChange, open, paymentData?.id, queryClient, toast]);

  if (!paymentData) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleOpenPaymentLink = () => {
    if (openExternalUrl(paymentUrl)) {
      setCheckoutStarted(true);
    } else {
      toast({
        title: 'Link de pagamento indisponível',
        description: 'Gere a cobrança novamente em Configurações → Assinatura.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] p-4 lg:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base lg:text-lg">
            {paymentConfirmed ? <CheckCircle2 className="h-5 w-5 text-success" /> : <CreditCard className="h-5 w-5" />}
            {paymentConfirmed ? 'Pagamento confirmado' : 'Finalizar Pagamento'}
          </DialogTitle>
          <DialogDescription className="text-xs lg:text-sm">
            {paymentConfirmed
              ? 'Sua assinatura foi ativada com sucesso.'
              : checkoutStarted
                ? 'Aguardando a confirmação segura do Asaas…'
                : 'Abra a página segura do Asaas para concluir.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <div className="flex justify-center">
            <div className={paymentConfirmed ? 'rounded-full bg-success-soft p-4' : 'rounded-full bg-primary/10 p-4'}>
              {paymentConfirmed ? (
                <CheckCircle2 className="h-12 w-12 text-success" />
              ) : checkoutStarted ? (
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              ) : (
                <CreditCard className="h-12 w-12 text-primary" />
              )}
            </div>
          </div>

          {/* Informações */}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">
              {paymentConfirmed ? 'Tudo certo!' : checkoutStarted ? 'Aguardando pagamento' : 'Cobrança criada'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Valor: <span className="font-semibold text-foreground">{formatCurrency(paymentData.value)}</span>
            </p>
          </div>

          {/* Botão de pagamento */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleOpenPaymentLink}
            disabled={paymentConfirmed}
          >
            <ExternalLink className="mr-2 h-5 w-5" />
            {checkoutStarted ? 'Abrir página de pagamento novamente' : 'Ir para Página de Pagamento'}
          </Button>

          {/* Informações adicionais */}
          <Alert>
            <AlertDescription className="text-sm space-y-2">
              <p><strong>Formas de pagamento disponíveis:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>PIX (aprovação instantânea)</li>
                <li>Boleto bancário</li>
                <li>Cartão de crédito</li>
              </ul>
              <p className="mt-3">
                <strong>Importante:</strong> Após a confirmação do pagamento, 
                sua assinatura será ativada automaticamente.
              </p>
            </AlertDescription>
          </Alert>

          {checkoutStarted && !paymentConfirmed && (
            <p className="text-center text-xs text-muted-foreground" aria-live="polite">
              Esta tela atualiza sozinha assim que o pagamento for confirmado.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
