import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { FeaturePageGuard, FeatureGuard, LimitGuard, LimitWarningBanner } from "@/components/guards/FeatureGuard";
import { useFeatures, useLimit } from "@/hooks/use-feature";

export default function Cards() {
  return (
    <FeaturePageGuard feature="cartoes">
      <CardsContent />
    </FeaturePageGuard>
  );
}

function CardsContent() {
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
  const [searchTerm, setSearchTerm] = useState("");

  // Verificar permissões
  const features = useFeatures(['cartoes_criar', 'cartoes_editar', 'cartoes_excluir', 'cartoes_faturas']);
  const { canUse: canCreateMore, limit, remaining } = useLimit('max_cartoes', creditCards?.length || 0);

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

  // Filtra cartões por busca
  const filteredCreditCards = creditCards?.filter((card) =>
    card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-shrink-0">{getBrandIcon(card.brand)}</div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-base lg:text-lg truncate">{card.name}</h3>
                {card.brand && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {card.brand}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 justify-end lg:justify-start">
              <FeatureGuard feature="cartoes_editar">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(card.id)}
                  className="h-7 w-7 lg:h-8 lg:w-8 p-0"
                >
                  <Edit className="h-3 w-3 lg:h-4 lg:w-4" />
                </Button>
              </FeatureGuard>
              <FeatureGuard feature="cartoes_excluir">
                <ConfirmationDialog
                  title="Confirmar Exclusão"
                  description="Tem certeza que deseja excluir este cartão? Esta ação não pode ser desfeita."
                  confirmText="Excluir"
                  onConfirm={() => onDelete(card.id)}
                  variant="destructive"
                >
                  <Button variant="destructive" size="sm" className="h-7 w-7 lg:h-8 lg:w-8 p-0">
                    <Trash2 className="h-3 w-3 lg:h-4 lg:w-4" />
                  </Button>
                </ConfirmationDialog>
              </FeatureGuard>
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
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground">Conta Vinculada</p>
                    <p className="font-medium text-xs truncate" title={accountsWithBalance.find(acc => acc.id === card.connected_account_id)?.name}>
                      {accountsWithBalance.find(acc => acc.id === card.connected_account_id)?.name}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2">
            <FeatureGuard feature="cartoes_faturas">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => navigateToCardStatements(card.id)}
              >
                <Receipt className="h-4 w-4" />
                Ver Faturas
              </Button>
            </FeatureGuard>
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
      <div className="p-4 lg:p-6 hover:bg-muted/30 transition-colors">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0">
            <div className="flex-shrink-0">{getBrandIcon(card.brand)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold truncate">{card.name}</h3>
                {card.brand && (
                  <Badge variant="secondary" className="text-xs">{card.brand}</Badge>
                )}
              </div>
              <div className="flex flex-col lg:flex-row lg:items-center lg:gap-4 text-xs lg:text-sm text-muted-foreground gap-1">
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
          <div className="flex items-center gap-1 lg:gap-2 justify-end">
            <FeatureGuard feature="cartoes_editar">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onEdit(card.id)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </FeatureGuard>
            <FeatureGuard feature="cartoes_excluir">
              <ConfirmationDialog
                title="Confirmar Exclusão"
                description="Tem certeza que deseja excluir este cartão? Esta ação não pode ser desfeita."
                confirmText="Excluir"
                onConfirm={() => onDelete(card.id)}
                variant="destructive"
              >
                <Button variant="destructive" size="sm" className="h-8 w-8 p-0 hidden lg:flex">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </ConfirmationDialog>
            </FeatureGuard>
            <FeatureGuard feature="cartoes_faturas">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToCardStatements(card.id)}
                className="gap-2"
              >
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Faturas</span>
              </Button>
            </FeatureGuard>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="container mx-auto p-0 lg:p-4 space-y-4 lg:space-y-6 max-w-full">
      {/* Aviso de Limite */}
      <LimitWarningBanner 
        limit="max_cartoes" 
        currentValue={creditCards?.length || 0}
        resourceName="cartões"
      />
      
      {/* Header Section */}
      <Card className="shadow-lg max-w-full">
        <CardHeader className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between w-full max-w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                <CreditCard className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl lg:text-2xl truncate">Cartões</CardTitle>
                <p className="text-muted-foreground mt-1 text-sm hidden lg:block truncate">
                  Gerencie seus cartões e acompanhe suas faturas mensais
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-48 lg:w-64"
              />
              <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-start">
                <ToggleGroup type="single" value={view} onValueChange={onChangeView} className="hidden sm:flex">
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
                <FeatureGuard feature="cartoes_criar">
                  <LimitGuard limit="max_cartoes" currentValue={creditCards?.length || 0}>
                    <Button onClick={handleOpenDialog} className="gap-2 w-full sm:w-auto">
                      <Plus className="h-4 w-4" />
                      <span className="sm:inline">Novo Cartão</span>
                    </Button>
                  </LimitGuard>
                </FeatureGuard>
              </div>
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
      ) : (
        <>
          {view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCreditCards.length === 0 ? (
                <div className="col-span-full">
                  <Card className="border-dashed border-2 border-muted-foreground/25">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-muted/50 rounded-full mb-4">
                        <CreditCard className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {searchTerm ? "Nenhum cartão encontrado" : "Nenhum cartão cadastrado"}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {searchTerm
                          ? `Nenhum cartão encontrado para "${searchTerm}"`
                          : "Adicione seu primeiro cartão de crédito para começar a acompanhar suas faturas"}
                      </p>
                      {!searchTerm && (
                        <Button onClick={handleOpenDialog} className="gap-2">
                          <Plus className="h-4 w-4" />
                          Adicionar Cartão
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                filteredCreditCards.map((card) => <CreditCardItem key={card.id} card={card} />)
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                {filteredCreditCards.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {searchTerm ? "Nenhum cartão encontrado" : "Nenhum cartão cadastrado"}
                    </h3>
                    <p className="mb-4">
                      {searchTerm
                        ? `Nenhum cartão encontrado para "${searchTerm}"`
                        : "Adicione seu primeiro cartão de crédito para começar"}
                    </p>
                    {!searchTerm && (
                      <Button onClick={handleOpenDialog} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Adicionar Cartão
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredCreditCards.map((card) => <CreditCardListItem key={card.id} card={card} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
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
    </div>
  );
}


