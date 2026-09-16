import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legal";
import {
  formatCpfCnpj,
  subscriptionCheckoutSchema,
  type SubscriptionCheckoutValues,
} from "@/lib/validation/schemas";

import { LegalConsentCheckbox } from "./LegalConsent";

export interface SubscriptionConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  /** Valor total cobrado no ciclo escolhido. */
  price: number;
  billingCycle: "monthly" | "yearly";
  isProcessing?: boolean;
  /** Recebe o documento já validado (apenas dígitos/letras, sem máscara). */
  onConfirm: (values: SubscriptionCheckoutValues) => void;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

/**
 * Confirmação de assinatura de plano pago com aceite legal explícito.
 *
 * Padrão comercial: antes de sair para o gateway, o usuário vê preço, ciclo,
 * renovação automática e direito de arrependimento, e precisa marcar o aceite
 * — que nunca vem pré-marcado, mesmo que já tenha aceitado no cadastro,
 * porque aqui o objeto do aceite inclui as condições de cobrança.
 */
export function SubscriptionConsentDialog({
  open,
  onOpenChange,
  planName,
  price,
  billingCycle,
  isProcessing = false,
  onConfirm,
}: SubscriptionConsentDialogProps) {
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CPF/CNPJ é exigido pelo Asaas para emitir a cobrança.
  const form = useForm<SubscriptionCheckoutValues>({
    resolver: zodResolver(subscriptionCheckoutSchema),
    defaultValues: { cpfCnpj: "" },
    mode: "onTouched",
  });

  // Reabrir o diálogo sempre recomeça sem aceite marcado. O documento é
  // preservado para não obrigar a redigitar após uma falha no gateway.
  useEffect(() => {
    if (!open) {
      setAccepted(false);
      setError(null);
      form.clearErrors();
    }
  }, [open, form]);

  const cycleLabel = billingCycle === "yearly" ? "anual" : "mensal";
  const renewalLabel = billingCycle === "yearly" ? "a cada 12 meses" : "todo mês";

  const handleConfirm = form.handleSubmit((values) => {
    if (!accepted) {
      setError("Para assinar, é necessário aceitar os Termos de Uso e a Política de Privacidade.");
      return;
    }
    setError(null);
    onConfirm(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] p-5 sm:max-w-[30rem] md:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Confirmar assinatura
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            Revise as condições antes de seguir para o pagamento.
          </DialogDescription>
        </DialogHeader>

        <dl className="mt-1 rounded-xl border border-border-subtle">
          <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle px-4 py-2.5">
            <dt className="text-xs text-muted-foreground">Plano</dt>
            <dd className="text-sm font-medium text-foreground">{planName}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle px-4 py-2.5">
            <dt className="text-xs text-muted-foreground">Ciclo</dt>
            <dd className="text-sm font-medium capitalize text-foreground">{cycleLabel}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <dt className="text-xs text-muted-foreground">Valor</dt>
            <dd className="text-sm font-semibold tabular text-foreground">{formatPrice(price)}</dd>
          </div>
        </dl>

        <Form {...form}>
          <form id="subscription-checkout-form" onSubmit={handleConfirm} noValidate>
            <FormField
              control={form.control}
              name="cpfCnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF ou CNPJ</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => field.onChange(formatCpfCnpj(event.target.value))}
                      placeholder="000.000.000-00"
                      autoComplete="off"
                      maxLength={18}
                      disabled={isProcessing}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Exigido pela Asaas para emitir a cobrança em seu nome.
                  </FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <li>
            A cobrança é processada pela Asaas e renova automaticamente {renewalLabel}, pelo preço vigente,
            até que você cancele.
          </li>
          <li>
            Você pode cancelar quando quiser, sem multa, e desistir em até 7 dias com devolução integral
            (art. 49 do Código de Defesa do Consumidor).
          </li>
          <li>Dados de cartão são digitados no ambiente seguro do gateway — o Orbi não os armazena.</li>
        </ul>

        <LegalConsentCheckbox
          id="subscription-legal-consent"
          checked={accepted}
          onCheckedChange={(value) => {
            setAccepted(value);
            if (value) setError(null);
          }}
          error={error}
          disabled={isProcessing}
          label={
            <>
              Li e concordo com os{" "}
              <a
                href={TERMS_OF_USE.path}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Termos de Uso
              </a>{" "}
              e a{" "}
              <a
                href={PRIVACY_POLICY.path}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Política de Privacidade
              </a>
              , e autorizo a cobrança recorrente descrita acima.
            </>
          }
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button type="submit" form="subscription-checkout-form" disabled={isProcessing || !accepted}>
            {isProcessing ? "Processando…" : "Confirmar e pagar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
