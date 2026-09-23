import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus, CreditCard, Receipt, Edit, Trash2, Search } from "lucide-react";
import { FeaturePageGuard, FeatureGuard, LimitGuard, LimitWarningBanner } from "@/components/guards/FeatureGuard";
import { useFeatures, useLimit } from "@/hooks/use-feature";
import { useFamilyGroup } from "@/hooks/use-family-group";
import { OwnerMark } from "@/components/family/OwnerMark";
import { PARTNER_READ_ONLY_MESSAGE } from "@/lib/family-access";
import { cn, deleteErrorMessage, roundCurrency } from "@/lib/utils";
import { formatPct } from "@/components/planning/planning-utils";
import { EmptyState, PageBody, PageHeader, PageToolbar, ToolbarSpacer } from "@/components/ui/page";

export default function Cards() {
  return (
    <FeaturePageGuard feature="cartoes">
      <CardsContent />
    </FeaturePageGuard>
  );
}

/** 0,2% em vez de "0%" quando há algo comprometido num limite alto. */
const limitPct = (pct: number) => formatPct(pct, { digits: pct > 0 && pct < 10 ? 1 : 0 });

function CardsContent() {
  const { isMine } = useFamilyGroup();
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

  const title = useMemo(() => (editingId ? "Editar cartão" : "Novo cartão"), [editingId]);

  const onEdit = (id: string) => {
    const card = creditCards.find((c) => c.id === id);
    if (!card) return;
    if (!isMine((card as any).user_id)) {
      toast({ title: "Somente leitura", description: PARTNER_READ_ONLY_MESSAGE, variant: "destructive" });
      return;
    }
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
    const card = creditCards.find((c) => c.id === id);
    if (card && !isMine((card as any).user_id)) {
      toast({ title: "Somente leitura", description: PARTNER_READ_ONLY_MESSAGE, variant: "destructive" });
      return;
    }
    try {
      await deleteCreditCard(id);
      toast({ title: "Cartão excluído", description: card ? `"${card.name}" foi removido.` : undefined });
      queryClient.invalidateQueries({ queryKey: ["credit_cards"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
    } catch (e: unknown) {
      toast({ title: "Não foi possível excluir", description: deleteErrorMessage(e), variant: "destructive" });
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

  const getBrandIcon = (brand: string | null) => {
    if (!brand) return <CreditCard className="h-5 w-5" />;
    const brandLower = brand.toLowerCase();
    if (brandLower.includes('visa')) return <CreditCard className="h-5 w-5 text-primary" />;
    if (brandLower.includes('mastercard')) return <CreditCard className="h-5 w-5 text-destructive" />;
    if (brandLower.includes('elo')) return <CreditCard className="h-5 w-5 text-warning" />;
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

  /* Tom do medidor de fatura: gastar não é "sucesso". Neutro até a metade do
     limite, alerta a partir de 50%, crítico a partir de 85%. */
  const usageTone = (pct: number) =>
    pct >= 85 ? "destructive" : pct >= 50 ? "warning" : "neutral";

  const meterBar = "h-1 rounded-full transition-[width] duration-500 ease-swift";
  const meterColor: Record<string, string> = {
    neutral: "bg-primary",
    warning: "bg-warning",
    destructive: "bg-destructive",
  };
  const meterText: Record<string, string> = {
    neutral: "text-muted-foreground",
    warning: "text-warning",
    destructive: "text-destructive",
  };

  const cardActions = (card: any) => (
    <div className="flex items-center gap-0.5">
      <FeatureGuard feature="cartoes_editar">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!isMine(card.user_id)}
          onClick={() => onEdit(card.id)}
          aria-label={`Editar ${card.name}`}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </FeatureGuard>
      <FeatureGuard feature="cartoes_excluir">
        <ConfirmationDialog
          title="Excluir cartão"
          description="As transações lançadas neste cartão perdem o vínculo com a fatura. Não dá para desfazer."
          confirmText="Excluir cartão"
          onConfirm={() => onDelete(card.id)}
          variant="destructive"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!isMine(card.user_id)}
            aria-label={`Excluir ${card.name}`}
            className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </ConfirmationDialog>
      </FeatureGuard>
    </div>
  );

  /**
   * Tile de cartão. A fatura em aberto é o protagonista — é o número que o
   * usuário veio conferir. Limite, fechamento e vencimento entram como lista
   * de definição, separados por hairline.
   */
  const CreditCardItem = ({ card }: { card: any }) => {
    const { data: usageData } = useCardUsage({ cardId: card.id, statementDay: card.statement_date });
    const usage = usageData?.used || 0;
    const committed = usageData?.committed || 0;
    const pct = card.limit > 0 ? (committed / card.limit) * 100 : 0;
    // "Fatura em aberto" é só o período corrente; o % e o disponível usam o
    // limite comprometido (todas as PENDING, inclusive parcelas futuras).
    // A diferença precisa aparecer, senão os números se contradizem.
    const futureCommitted = Math.max(0, roundCurrency(committed - usage));
    const tone = usageTone(pct);
    const linkedAccount = accountsWithBalance.find((acc) => acc.id === card.connected_account_id);

    return (
      <Card interactive className="flex flex-col overflow-hidden">
        <span aria-hidden className={cn("h-px w-full shrink-0", meterColor[tone])} />

        <CardHeader className="gap-0 space-y-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="shrink-0">{getBrandIcon(card.brand)}</span>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <OwnerMark userId={card.user_id} />
                  <h2
                    className="truncate font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground"
                    title={card.name}
                  >
                    {card.name}
                  </h2>
                </div>
                {card.brand && <p className="label-eyebrow mt-0.5">{card.brand}</p>}
              </div>
            </div>
            {cardActions(card)}
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-5">
          <div>
            <p className="label-eyebrow">Fatura em aberto</p>
            <p className={cn("figure-xl mt-1 tabular", tone === "neutral" ? "text-foreground" : meterText[tone])}>
              {formatCurrency(usage)}
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div className={cn(meterBar, meterColor[tone])} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className={cn("tabular font-medium", meterText[tone])}>{limitPct(pct)} do limite</span>
              <span className="tabular text-muted-foreground">
                {formatCurrency(Math.max(card.limit - committed, 0))} disponível
              </span>
            </div>
            {futureCommitted > 0 && (
              <p className="mt-1 text-xs tabular text-muted-foreground">
                O limite também desconta {formatCurrency(futureCommitted)} de parcelas das próximas faturas.
              </p>
            )}
          </div>

          <dl className="mt-auto">
            <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-1.5">
              <dt className="text-xs text-muted-foreground">Limite</dt>
              <dd className="text-xs font-medium tabular text-foreground">{formatCurrency(card.limit)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-1.5">
              <dt className="text-xs text-muted-foreground">Fecha</dt>
              <dd className="text-xs font-medium tabular text-foreground">dia {card.statement_date}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="text-xs text-muted-foreground">Vence</dt>
              <dd className="text-xs font-medium tabular text-foreground">dia {card.due_date}</dd>
            </div>
            {linkedAccount && (
              <div className="flex items-baseline justify-between gap-3 border-t border-border-subtle py-1.5">
                <dt className="text-xs text-muted-foreground">Paga com</dt>
                <dd className="min-w-0 truncate text-xs font-medium text-foreground" title={linkedAccount.name}>
                  {linkedAccount.name}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>

        <FeatureGuard feature="cartoes_faturas">
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigateToCardStatements(card.id)}
              aria-label={`Ver faturas de ${card.name}`}
            >
              <Receipt className="h-4 w-4" />
              Ver faturas
            </Button>
          </CardFooter>
        </FeatureGuard>
      </Card>
    );
  };

  /** Linha da visão em lista: mesma informação, densidade de tabela. */
  const CreditCardListItem = ({ card }: { card: any }) => {
    const { data: usageData } = useCardUsage({ cardId: card.id, statementDay: card.statement_date });
    const usage = usageData?.used || 0;
    const committed = usageData?.committed || 0;
    const pct = card.limit > 0 ? (committed / card.limit) * 100 : 0;
    const tone = usageTone(pct);

    return (
      <li className="flex flex-col gap-3 px-3 py-3 transition-colors duration-200 ease-swift hover:bg-accent/40 md:px-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="shrink-0">{getBrandIcon(card.brand)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <OwnerMark userId={card.user_id} />
              <p className="truncate text-sm font-medium text-foreground" title={card.name}>
                {card.name}
              </p>
              {card.brand && <span className="label-eyebrow shrink-0">{card.brand}</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-sunken">
                <div className={cn(meterBar, meterColor[tone])} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <span
                className={cn("text-xs tabular font-medium", meterText[tone])}
                title={
                  committed > usage
                    ? `Inclui ${formatCurrency(roundCurrency(committed - usage))} de parcelas das próximas faturas`
                    : undefined
                }
              >
                {limitPct(pct)}
              </span>
              <span className="hidden text-xs tabular text-muted-foreground sm:inline">
                de {formatCurrency(card.limit)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-2 lg:justify-end lg:border-t-0 lg:pt-0">
          <div className="text-left lg:text-right">
            <p className="label-eyebrow">Fatura</p>
            <p className={cn("figure-sm tabular md:text-base", tone === "neutral" ? "text-foreground" : meterText[tone])}>
              {formatCurrency(usage)}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <FeatureGuard feature="cartoes_faturas">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigateToCardStatements(card.id)}
                aria-label={`Faturas de ${card.name}`}
                title="Ver faturas"
              >
                <Receipt className="h-4 w-4" />
              </Button>
            </FeatureGuard>
            {cardActions(card)}
          </div>
        </div>
      </li>
    );
  };

  return (
    <PageBody>
      <LimitWarningBanner
        limit="max_cartoes"
        currentValue={creditCards?.length || 0}
        resourceName="cartões"
      />

      <PageHeader
        eyebrow="Saldos"
        icon={CreditCard}
        title="Cartões"
        description="Quanto já foi para a fatura de cada cartão no período corrente, e quanto do limite ainda sobra."
        actions={
          <FeatureGuard feature="cartoes_criar">
            <LimitGuard limit="max_cartoes" currentValue={creditCards?.length || 0}>
              <Button onClick={handleOpenDialog} className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Novo cartão
              </Button>
            </LimitGuard>
          </FeatureGuard>
        }
      />

      <PageToolbar>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder="Buscar cartão"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            aria-label="Buscar cartões"
          />
        </div>
        <ToolbarSpacer />
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={onChangeView}
          aria-label="Visualização"
          className="hidden rounded-lg border border-border bg-surface-sunken p-1 sm:flex"
        >
          <ToggleGroupItem value="list" aria-label="Lista" size="sm">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="cards" aria-label="Cartões" size="sm">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </PageToolbar>

      {isLoading ? (
        <div className={view === "cards" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-2"}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className={view === "cards" ? "h-72 w-full" : "h-20 w-full"} />
          ))}
        </div>
      ) : filteredCreditCards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={searchTerm ? "Nenhum cartão encontrado" : "Nenhum cartão cadastrado"}
          description={
            searchTerm
              ? `Nada corresponde a “${searchTerm}”.`
              : "Cadastre um cartão para o Orbi acompanhar a fatura e o limite disponível."
          }
          action={
            !searchTerm ? (
              <FeatureGuard feature="cartoes_criar">
                <Button onClick={handleOpenDialog}>
                  <Plus className="h-4 w-4" />
                  Novo cartão
                </Button>
              </FeatureGuard>
            ) : undefined
          }
        />
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCreditCards.map((card) => (
            <CreditCardItem key={card.id} card={card} />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border-subtle">
            {filteredCreditCards.map((card) => (
              <CreditCardListItem key={card.id} card={card} />
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={open} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">Preencha os campos abaixo e salve para confirmar.</DialogDescription>
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
              <SelectWithAddButton entityType="accounts" placeholder="Selecione uma conta">
                <SelectItem value="none">Nenhuma conta</SelectItem>
                {accountsWithBalance.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} — {formatCurrency(account.current_balance ?? 0)}
                  </SelectItem>
                ))}
              </SelectWithAddButton>
            }
          />
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
