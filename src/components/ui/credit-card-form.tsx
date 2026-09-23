import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { DaySelector } from "@/components/ui/day-selector";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { useQueryClient } from "@tanstack/react-query";

interface CreditCardFormProps {
  editingId?: string | null;
  initialData?: {
    name: string;
    brand: string;
    limit: number;
    statementDate: number;
    dueDate: number;
    connectedAccountId: string;
  };
  onSuccess?: (id?: string) => void;
  onCancel?: () => void;
  showFooter?: boolean;
  accountSelector?: React.ReactNode;
}

export const CreditCardForm: React.FC<CreditCardFormProps> = ({
  editingId = null,
  initialData,
  onSuccess,
  onCancel,
  showFooter = true,
  accountSelector,
}) => {
  const [name, setName] = React.useState(initialData?.name || "");
  const [brand, setBrand] = React.useState(initialData?.brand || "");
  const [limit, setLimit] = React.useState(initialData?.limit || 0);
  const [statementDate, setStatementDate] = React.useState(initialData?.statementDate || 1);
  const [dueDate, setDueDate] = React.useState(initialData?.dueDate || 1);
  const [connectedAccountId, setConnectedAccountId] = React.useState<string>(
    initialData?.connectedAccountId || "none"
  );
  const [errors, setErrors] = React.useState<{ name?: string; limit?: string; statementDate?: string; dueDate?: string }>({});
  const clearError = (key: keyof typeof errors) => setErrors((prev) => ({ ...prev, [key]: undefined }));
  const { createCreditCard, updateCreditCard } = useCreditCards();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setBrand(initialData.brand);
      setLimit(initialData.limit);
      setStatementDate(initialData.statementDate);
      setDueDate(initialData.dueDate);
      setConnectedAccountId(initialData.connectedAccountId);
    }
  }, [initialData]);

  const onSubmit = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Dê um nome ao cartão.";
    if (!limit || limit <= 0) next.limit = "Informe um limite maior que zero.";
    if (!statementDate || statementDate < 1 || statementDate > 31) next.statementDate = "Escolha um dia entre 1 e 31.";
    if (!dueDate || dueDate < 1 || dueDate > 31) next.dueDate = "Escolha um dia entre 1 e 31.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (dueDate < statementDate) {
      toast({
        title: "Vencimento após a virada do mês",
        description: `O dia ${dueDate} vem antes do fechamento no dia ${statementDate}; ele será tratado como vencimento no mês seguinte.`,
      });
    }

    const payload = {
      name,
      brand: brand || null,
      limit,
      statement_date: statementDate,
      due_date: dueDate,
      connected_account_id: connectedAccountId === "none" ? null : connectedAccountId,
    };

    const t = toast({ title: "Salvando…", duration: 2000 });
    try {
      let createdId: string | undefined;
      if (editingId) {
        await updateCreditCard(editingId, payload);
      } else {
        const newCard = await createCreditCard(payload);
        createdId = newCard.id;
      }
      t.update({ title: "Cartão salvo", duration: 2000 });
      
      // Reset form
      setName("");
      setBrand("");
      setLimit(0);
      setStatementDate(1);
      setDueDate(1);
      setConnectedAccountId("none");
      setErrors({});
      
      queryClient.invalidateQueries({ queryKey: ["credit_cards"] });
      onSuccess?.(createdId);
    } catch (e: any) {
      t.update({
        title: "Erro",
        description: e.message || "Não foi possível salvar",
        duration: 3000,
        variant: "destructive" as any,
      });
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Cartão</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
            placeholder="Ex: Visa Nubank"
            required
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <p id="name-error" className="text-xs text-destructive">
              {errors.name}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand">Bandeira</Label>
          <Input
            id="brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Ex: Visa, Mastercard, Elo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="limit">Limite</Label>
          <NumericInput
            id="limit"
            currency
            value={limit}
            onChange={(v) => {
              setLimit(v ?? 0);
              clearError("limit");
            }}
            placeholder="0,00"
            required
            aria-invalid={Boolean(errors.limit)}
            aria-describedby={errors.limit ? "limit-error" : undefined}
          />
          {errors.limit && (
            <p id="limit-error" className="text-xs text-destructive">
              {errors.limit}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <div>
            <DaySelector
              id="statement_date"
              label="Dia de fechamento"
              value={statementDate}
              onChange={(v) => {
                setStatementDate(v);
                clearError("statementDate");
              }}
              placeholder="1"
            />
            {errors.statementDate && <p className="mt-1 text-xs text-destructive" role="alert">{errors.statementDate}</p>}
          </div>
          <div>
            <DaySelector
              id="due_date"
              label="Dia de vencimento"
              value={dueDate}
              onChange={(v) => {
                setDueDate(v);
                clearError("dueDate");
              }}
              placeholder="1"
            />
            {errors.dueDate && <p className="mt-1 text-xs text-destructive" role="alert">{errors.dueDate}</p>}
          </div>
        </div>
        {accountSelector && (
          <div className="space-y-2">
            <Label htmlFor="connected_account">Conta Conectada (Opcional)</Label>
            {React.cloneElement(accountSelector as React.ReactElement, {
              id: "connected_account",
              value: connectedAccountId,
              onValueChange: setConnectedAccountId,
            })}
          </div>
        )}
      </div>
      {showFooter && (
        <DialogFooter>
          <Button onClick={onSubmit}>Salvar</Button>
        </DialogFooter>
      )}
    </>
  );
};
