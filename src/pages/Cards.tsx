import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectWithAddButton } from "@/components/ui/select-with-add-button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { useAccounts } from "@/hooks/use-accounts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus, CreditCard } from "lucide-react";

export default function Cards() {
  const queryClient = useQueryClient();
  const { creditCards, createCreditCard, updateCreditCard, deleteCreditCard, isLoading } = useCreditCards();
  const { accountsWithBalance } = useAccounts();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [limit, setLimit] = useState(0);
  const [statementDate, setStatementDate] = useState(1);
  const [dueDate, setDueDate] = useState(1);
  const [connectedAccountId, setConnectedAccountId] = useState<string>("none");
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

  const onSubmit = async () => {
    if (!name.trim()) return;
    if (limit <= 0) {
      toast({ title: "Erro", description: "O limite deve ser maior que zero", variant: "destructive" });
      return;
    }
    if (statementDate < 1 || statementDate > 31) {
      toast({ title: "Erro", description: "A data de fechamento deve estar entre 1 e 31", variant: "destructive" });
      return;
    }
    if (dueDate < 1 || dueDate > 31) {
      toast({ title: "Erro", description: "A data de vencimento deve estar entre 1 e 31", variant: "destructive" });
      return;
    }

    const payload = { 
      name, 
      brand: brand || null, 
      limit, 
      statement_date: statementDate, 
      due_date: dueDate,
      connected_account_id: connectedAccountId === "none" ? null : connectedAccountId
    };
    const t = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
    try {
      if (editingId) {
        await updateCreditCard(editingId, payload);
      } else {
        await createCreditCard(payload);
      }
      t.update({ title: "Sucesso", description: "Cartão salvo", duration: 2000 });
    } catch (e: any) {
      t.update({ title: "Erro", description: e.message || "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
    }
    setOpen(false);
    setEditingId(null);
    setName("");
    setBrand("");
    setLimit(0);
    setStatementDate(1);
    setDueDate(1);
    setConnectedAccountId("none");
    queryClient.invalidateQueries({ queryKey: ["credit_cards"] });
  };

  const onEdit = (id: string) => {
    const card = creditCards.find((c) => c.id === id);
    if (!card) return;
    setEditingId(id);
    setName(card.name);
    setBrand(card.brand || "");
    setLimit(card.limit);
    setStatementDate(card.statement_date);
    setDueDate(card.due_date);
    setConnectedAccountId(card.connected_account_id || "none");
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

  const formatCurrency = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

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
          <Dialog open={open} onOpenChange={setOpen}>
            <div className="flex items-center gap-2">
              <ToggleGroup type="single" value={view} onValueChange={onChangeView}>
                <ToggleGroupItem value="list" aria-label="Lista" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="cards" aria-label="Cards" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            </div>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Cartão</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Visa Nubank" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Bandeira</Label>
                  <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: Visa, Mastercard, Elo" />
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
                  <div className="space-y-2">
                    <Label htmlFor="statement_date">Dia de Fechamento</Label>
                    <NumericInput
                      id="statement_date"
                      value={statementDate}
                      onChange={(value) => setStatementDate(value || 1)}
                      min={1}
                      max={31}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Dia de Vencimento</Label>
                    <NumericInput
                      id="due_date"
                      value={dueDate}
                      onChange={(value) => setDueDate(value || 1)}
                      min={1}
                      max={31}
                      placeholder="1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="connected_account">Conta Conectada (Opcional)</Label>
                  <SelectWithAddButton
                    entityType="accounts"
                    value={connectedAccountId}
                    onValueChange={setConnectedAccountId}
                    placeholder="Selecione uma conta"
                  >
                    <SelectItem value="none">Nenhuma conta</SelectItem>
                    {accountsWithBalance.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} - {formatCurrency(account.current_balance ?? 0)}
                      </SelectItem>
                    ))}
                  </SelectWithAddButton>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={onSubmit}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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


