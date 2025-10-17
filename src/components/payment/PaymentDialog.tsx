import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, CreditCard, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PaymentData } from '@/hooks/use-payment';
import { useEffect } from 'react';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentData: PaymentData | null;
}

export function PaymentDialog({ open, onOpenChange, paymentData }: PaymentDialogProps) {
  const { toast } = useToast();

  // Redirecionar automaticamente para o link de pagamento quando abrir
  useEffect(() => {
    if (open && paymentData?.url) {
      // Esperar um pouco antes de redirecionar para dar tempo de ver o dialog
      const timer = setTimeout(() => {
        window.open(paymentData.url, '_blank');
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [open, paymentData]);

  if (!paymentData) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleOpenPaymentLink = () => {
    if (paymentData.url) {
      window.open(paymentData.url, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Finalizar Pagamento
          </DialogTitle>
          <DialogDescription>
            Redirecionando para a página de pagamento segura...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Ícone de sucesso */}
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>

          {/* Informações */}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Cobrança Criada com Sucesso!</h3>
            <p className="text-sm text-muted-foreground">
              Valor: <span className="font-semibold text-foreground">{formatCurrency(paymentData.value)}</span>
            </p>
          </div>

          {/* Botão de pagamento */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleOpenPaymentLink}
          >
            <ExternalLink className="mr-2 h-5 w-5" />
            Ir para Página de Pagamento
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

          {/* Link manual caso não redirecione */}
          <div className="text-center text-xs text-muted-foreground">
            Não redirecionou?{' '}
            <button 
              onClick={handleOpenPaymentLink}
              className="text-primary hover:underline"
            >
              Clique aqui
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

