import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SelectItem } from "@/components/ui/select";
import { SelectWithAddButton } from "@/components/ui/select-with-add-button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CreditCardForm } from "@/components/ui/credit-card-form";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { useAccounts } from "@/hooks/use-accounts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus, CreditCard } from "lucide-react";

export default function Cards() {
  const queryClient = useQueryClient();
  const { creditCards, deleteCreditCard, isLoading } = useCreditCards();
  const { accountsWithBalance } = useAccounts();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{
    name: string;
    brand: string;
    limit: number;
    statementDate: number;
    dueDate: number;
    connectedAccountId: string;
  } | undefined>(undefined);
  const [view, setView] = useState<"list" | "cards">("list");

  useEffect(() => {
    const v = (localStorage.getItem("credit_cards:view") as "list" | "cards") || "list";
    setView(v);
  }, []);

  const onChangeView = (val: string) => {
    const v = (val as "list" | "cards") || "list";
    setView(v);
    localStorage.setItem("credit_cards:view", v);
  };

  const title = useMemo(() => (editingId ? "Editar Cartão" : "Novo Cartão"), [editingId]);

  const onEdit = (id: string) => {
    const card = creditCards.find((c) => c.id === id);
    if (!card) return;
    setEditingId(id);
    setEditingData({
      name: card.name,
      brand: card.brand || "",
      limit: card.limit,
      statementDate: card.statement_date,
      dueDate: card.due_date,
      connectedAccountId: card.connected_account_id || "none",
    });
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingId(null);
    setEditingData(undefined);
  };

  const handleOpenDialog = () => {
    setOpen(true);
  };

  const onDelete = async (id: string) => {
    const t = toast({ title: "Excluindo...", description: "Aguarde", duration: 2000 });
    try {
      await deleteCreditCard(id);
      t.update({ title: "Sucesso", description: "Cartão excluído", duration: 2000 });
    } catch (e: any) {
      t.update({ title: "Erro", description: e.message || "Não foi possível excluir", duration: 3000, variant: "destructive" as any });
    }
    queryClient.invalidateQueries({ queryKey: ["credit_cards"] });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

  const getBrandIcon = (brand: string | null) => {
    if (!brand) return <CreditCard className="h-5 w-5" />;
    const brandLower = brand.toLowerCase();
    if (brandLower.includes('visa')) return <CreditCard className="h-5 w-5 text-blue-600" />;
    if (brandLower.includes('mastercard')) return <CreditCard className="h-5 w-5 text-red-600" />;
    if (brandLower.includes('elo')) return <CreditCard className="h-5 w-5 text-yellow-600" />;
    return <CreditCard className="h-5 w-5" />;
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card className="shadow-md">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Cartões de Crédito</CardTitle>
          <div className="flex items-center gap-2">
            <ToggleGroup type="single" value={view} onValueChange={onChangeView}>
              <ToggleGroupItem
                value="list"
                aria-label="Lista"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="cards"
                aria-label="Cards"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" className="h-8 w-8 p-0" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
            </Button>
            
            <Dialog open={open} onOpenChange={handleCloseDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <CreditCardForm
                  editingId={editingId}
                  initialData={editingData}
                  onSuccess={() => {
                    handleCloseDialog();
                    queryClient.invalidateQueries({ queryKey: ["credit_cards"] });
                  }}
                  showFooter={true}
                  accountSelector={
                    <SelectWithAddButton
                      entityType="accounts"
                      placeholder="Selecione uma conta"
                    >
                      <SelectItem value="none">Nenhuma conta</SelectItem>
                      {accountsWithBalance.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} - {formatCurrency(account.current_balance ?? 0)}
                        </SelectItem>
                      ))}
                    </SelectWithAddButton>
                  }
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className={view === "cards" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" : "space-y-3"}>
              <Skeleton className={view === "cards" ? "h-32 w-full" : "h-16 w-full"} />
              <Skeleton className={view === "cards" ? "h-32 w-full" : "h-16 w-full"} />
              <Skeleton className={view === "cards" ? "h-32 w-full" : "h-16 w-full"} />
            </div>
          ) : view === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {creditCards.length === 0 ? (
                <div className="col-span-full rounded-lg border bg-card p-6 text-center text-muted-foreground">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  Nenhum cartão cadastrado
                </div>
              ) : creditCards.map((card) => (
                <div key={card.id} className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getBrandIcon(card.brand)}
                      <div className="flex flex-col">
                        <span className="font-medium">{card.name}</span>
                        {card.brand && <span className="text-sm text-muted-foreground">{card.brand}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => onEdit(card.id)}>Editar</Button>
                      <ConfirmationDialog
                        title="Confirmar Exclusão"
                        description="Tem certeza que deseja excluir este cartão? Esta ação não pode ser desfeita."
                        confirmText="Excluir"
                        onConfirm={() => onDelete(card.id)}
                        variant="destructive"
                      >
                        <Button variant="destructive" size="sm">Excluir</Button>
                      </ConfirmationDialog>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Limite:</span>
                      <span className="font-semibold">{formatCurrency(card.limit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fechamento:</span>
                      <span>Dia {card.statement_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vencimento:</span>
                      <span>Dia {card.due_date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md bg-card/40">
              {creditCards.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  Nenhum cartão cadastrado
                </div>
              ) : creditCards.map((card) => (
                <div key={card.id} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    {getBrandIcon(card.brand)}
                    <div className="flex flex-col">
                      <span className="font-medium">{card.name}</span>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {card.brand && <span>{card.brand}</span>}
                        <span>Limite: {formatCurrency(card.limit)}</span>
                        <span>Fechamento: Dia {card.statement_date}</span>
                        <span>Vencimento: Dia {card.due_date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => onEdit(card.id)}>Editar</Button>
                    <ConfirmationDialog
                      title="Confirmar Exclusão"
                      description="Tem certeza que deseja excluir este cartão? Esta ação não pode ser desfeita."
                      confirmText="Excluir"
                      onConfirm={() => onDelete(card.id)}
                      variant="destructive"
                    >
                      <Button variant="destructive">Excluir</Button>
                    </ConfirmationDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


