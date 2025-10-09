import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SelectItem } from "@/components/ui/select";
import { SelectWithAddButton } from "@/components/ui/select-with-add-button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CreditCardForm } from "@/components/ui/credit-card-form";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { useAccounts } from "@/hooks/use-accounts";
import { useCardUsage } from "@/hooks/use-card-usage";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus, CreditCard, Receipt, TrendingUp, TrendingDown, Calendar, Wallet, Edit, Trash2 } from "lucide-react";

export default function Cards() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  const [view, setView] = useState<"list" | "cards">("cards");

  useEffect(() => {
    const v = (localStorage.getItem("credit_cards:view") as "list" | "cards") || "cards";
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
    try {
      toast({ title: "Excluindo...", description: "Aguarde" });
      await deleteCreditCard(id);
      toast({ title: "Sucesso", description: "Cartão excluído" });
      queryClient.invalidateQueries({ queryKey: ["credit_cards"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Não foi possível excluir", variant: "destructive" });
    }
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

  const navigateToCardStatements = (cardId: string) => {
    navigate(`/sistema/cards/${cardId}/statements`);
  };

  // Calcula o período da fatura atual baseado na data de fechamento
  const getCurrentStatementPeriod = (statementDay: number) => {
    const today = new Date();
    const closingDate = new Date(today.getFullYear(), today.getMonth(), statementDay);
    
    let periodStart: Date;
    let periodEnd: Date;
    
    if (today < closingDate) {
      // Período do mês anterior
      periodEnd = new Date(closingDate);
      periodEnd.setDate(periodEnd.getDate() - 1);
      
      periodStart = new Date(closingDate);
      periodStart.setMonth(periodStart.getMonth() - 1);
    } else {
      // Período atual
      periodStart = new Date(closingDate);
      
      periodEnd = new Date(closingDate);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(periodEnd.getDate() - 1);
    }
    
    return { startDate: periodStart, endDate: periodEnd };
  };

  // Componente para card individual com uso real
  const CreditCardItem = ({ card }: { card: any }) => {
    const { data: usageData } = useCardUsage({
      cardId: card.id,
      statementDay: card.statement_date,
    });

    const usage = usageData?.used || 0;
    const usagePercentage = (usage / card.limit) * 100;

    return (
      <Card className="group hover:shadow-lg transition-all duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {getBrandIcon(card.brand)}
              <div>
                <h3 className="font-semibold text-lg">{card.name}</h3>
                {card.brand && (
                  <Badge variant="secondary" className="mt-1">
                    {card.brand}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(card.id)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <ConfirmationDialog
                title="Confirmar Exclusão"
                description="Tem certeza que deseja excluir este cartão? Esta ação não pode ser desfeita."
                confirmText="Excluir"
                onConfirm={() => onDelete(card.id)}
                variant="destructive"
              >
                <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </ConfirmationDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Usage Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Uso da fatura</span>
              <span className="font-medium">
                {formatCurrency(usage)} / {formatCurrency(card.limit)}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  usagePercentage > 80
                    ? "bg-red-500"
                    : usagePercentage > 50
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{usagePercentage.toFixed(1)}% utilizado</span>
              <span>{formatCurrency(card.limit - usage)} disponível</span>
            </div>
          </div>

          <Separator />

          {/* Card Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Fechamento</p>
                  <p className="font-medium">Dia {card.statement_date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Vencimento</p>
                  <p className="font-medium">Dia {card.due_date}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Limite</p>
                  <p className="font-medium">{formatCurrency(card.limit)}</p>
                </div>
              </div>
              {card.connected_account_id && (
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Conta Vinculada</p>
                    <p className="font-medium text-xs">
                      {accountsWithBalance.find(acc => acc.id === card.connected_account_id)?.name}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => navigateToCardStatements(card.id)}
            >
              <Receipt className="h-4 w-4" />
              Ver Faturas
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Componente para item de lista
  const CreditCardListItem = ({ card }: { card: any }) => {
    const { data: usageData } = useCardUsage({
      cardId: card.id,
      statementDay: card.statement_date,
    });

    const usage = usageData?.used || 0;
    const usagePercentage = (usage / card.limit) * 100;

    return (
      <div className="p-6 hover:bg-muted/30 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getBrandIcon(card.brand)}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{card.name}</h3>
                {card.brand && (
                  <Badge variant="secondary">{card.brand}</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Limite: {formatCurrency(card.limit)}</span>
                <span>Uso: {formatCurrency(usage)}</span>
                <span className={`font-medium ${
                  usagePercentage > 80 ? "text-red-600" :
                  usagePercentage > 50 ? "text-yellow-600" : "text-green-600"
                }`}>
                  {usagePercentage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onEdit(card.id)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <ConfirmationDialog
              title="Confirmar Exclusão"
              description="Tem certeza que deseja excluir este cartão? Esta ação não pode ser desfeita."
              confirmText="Excluir"
              onConfirm={() => onDelete(card.id)}
              variant="destructive"
            >
              <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            </ConfirmationDialog>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateToCardStatements(card.id)}
              className="gap-2"
            >
              <Receipt className="h-4 w-4" />
              Faturas
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Cartões de Crédito</CardTitle>
                <p className="text-muted-foreground mt-1">
                  Gerencie seus cartões e acompanhe suas faturas mensais
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
              <Button onClick={handleOpenDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Cartão
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Cards Grid/List */}
      {isLoading ? (
        <div className={view === "cards" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className={view === "cards" ? "h-48 w-full" : "h-20 w-full"} />
          ))}
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creditCards.length === 0 ? (
            <div className="col-span-full">
              <Card className="border-dashed border-2 border-muted-foreground/25">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 bg-muted/50 rounded-full mb-4">
                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nenhum cartão cadastrado</h3>
                  <p className="text-muted-foreground mb-4">
                    Adicione seu primeiro cartão de crédito para começar a acompanhar suas faturas
                  </p>
                  <Button onClick={handleOpenDialog} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Cartão
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            creditCards.map((card) => <CreditCardItem key={card.id} card={card} />)
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {creditCards.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <CreditCard className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhum cartão cadastrado</h3>
                <p className="mb-4">Adicione seu primeiro cartão de crédito para começar</p>
                <Button onClick={handleOpenDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Cartão
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {creditCards.map((card) => <CreditCardListItem key={card.id} card={card} />)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog for Add/Edit Card */}
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
  );
}


