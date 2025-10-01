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
  onSuccess?: () => void;
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
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome do cartão é obrigatório",
        variant: "destructive",
      });
      return;
    }
    if (limit <= 0) {
      toast({
        title: "Erro",
        description: "O limite deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }
    if (statementDate < 1 || statementDate > 31) {
      toast({
        title: "Erro",
        description: "A data de fechamento deve estar entre 1 e 31",
        variant: "destructive",
      });
      return;
    }
    if (dueDate < 1 || dueDate > 31) {
      toast({
        title: "Erro",
        description: "A data de vencimento deve estar entre 1 e 31",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name,
      brand: brand || null,
      limit,
      statement_date: statementDate,
      due_date: dueDate,
      connected_account_id: connectedAccountId === "none" ? null : connectedAccountId,
    };

    const t = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
    try {
      if (editingId) {
        await updateCreditCard(editingId, payload);
      } else {
        await createCreditCard(payload);
      }
      t.update({ title: "Sucesso", description: "Cartão salvo", duration: 2000 });
      
      // Reset form
      setName("");
      setBrand("");
      setLimit(0);
      setStatementDate(1);
      setDueDate(1);
      setConnectedAccountId("none");
      
      queryClient.invalidateQueries({ queryKey: ["credit_cards"] });
      onSuccess?.();
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
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Visa Nubank"
          />
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
            onChange={setLimit}
            placeholder="0,00"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <DaySelector
            id="statement_date"
            label="Dia de Fechamento"
            value={statementDate}
            onChange={setStatementDate}
            placeholder="1"
          />
          <DaySelector
            id="due_date"
            label="Dia de Vencimento"
            value={dueDate}
            onChange={setDueDate}
            placeholder="1"
          />
        </div>
        {accountSelector && (
          <div className="space-y-2">
            <Label htmlFor="connected_account">Conta Conectada (Opcional)</Label>
            {React.cloneElement(accountSelector as React.ReactElement, {
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

