import { useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useAccounts } from "@/hooks/use-accounts";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus, Wallet, Edit, Trash2, Search } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { FeaturePageGuard, FeatureGuard, LimitGuard, LimitWarningBanner } from "@/components/guards/FeatureGuard";
import { useFeatures, useLimit } from "@/hooks/use-feature";
import { useFamilyGroup } from "@/hooks/use-family-group";
import { OwnerMark } from "@/components/family/OwnerMark";
import { PARTNER_READ_ONLY_MESSAGE } from "@/lib/family-access";
import { cn, onColorClass } from "@/lib/utils";
import { EmptyState, PageBody, PageHeader, PageToolbar, ToolbarSpacer } from "@/components/ui/page";

export default function Accounts() {
  return (
    <FeaturePageGuard feature="contas">
      <AccountsContent />
    </FeaturePageGuard>
  );
}

function AccountsContent() {
  const queryClient = useQueryClient();
  const { accountsWithBalance, createAccount, updateAccount, deleteAccount, isLoading } = useAccounts();
  const { isMine } = useFamilyGroup();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("Corrente");
  const [initialBalance, setInitialBalance] = useState(0);
  const [color, setColor] = useState("#4f46e5");
  const [view, setView] = useState<"list" | "cards">("list");
  const [searchTerm, setSearchTerm] = useState("");

  // Verificar permissões
  const features = useFeatures(['contas_criar', 'contas_editar', 'contas_excluir']);
  const { canUse: canCreateMore, limit, remaining } = useLimit('max_contas', accountsWithBalance?.length || 0);

  useEffect(() => {
    const v = (localStorage.getItem("accounts:view") as "list" | "cards") || "list";
    setView(v);
  }, []);

  const onChangeView = (val: string) => {
    const v = (val as "list" | "cards") || "list";
    setView(v);
    localStorage.setItem("accounts:view", v);
  };

  const title = useMemo(() => (editingId ? "Editar conta" : "Nova conta"), [editingId]);

  const [nameError, setNameError] = useState<string | undefined>();

  // Estado de edição é limpo em TODO fechamento (Esc, X, overlay, save).
  // Sem isso, "Nova conta" depois de cancelar uma edição reabria "Editar conta"
  // e o save sobrescrevia a conta anterior.
  const resetForm = () => {
    setNameError(undefined);
    setEditingId(null);
    setName("");
    setType("Corrente");
    setInitialBalance(0);
    setColor("#4f46e5");
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetForm();
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      setNameError("Dê um nome à conta.");
      return;
    }
    const payload = { name, type, initial_balance: initialBalance, color };
    const t = toast({ title: "Salvando…", duration: 2000 });
    try {
      if (editingId) {
        await updateAccount(editingId, payload);
      } else {
        await createAccount(payload);
      }
      t.update({ title: editingId ? "Conta atualizada" : "Conta criada", description: undefined, duration: 2500 });
    } catch (e) {
      t.update({ title: "Erro", description: "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
      return;
    }
    setOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  const onEdit = (id: string) => {
    const acc = accountsWithBalance.find((a) => a.id === id);
    if (!acc) return;
    if (!isMine((acc as any).user_id)) {
      toast({ title: "Somente leitura", description: PARTNER_READ_ONLY_MESSAGE, variant: "destructive" as any });
      return;
    }
    setEditingId(id);
    setName(acc.name);
    setType(acc.type);
    setInitialBalance(acc.initial_balance);
    setColor(acc.color ?? "#4f46e5");
    setOpen(true);
  };

  const onDelete = async (id: string) => {
    const acc = accountsWithBalance.find((a) => a.id === id);
    if (acc && !isMine((acc as any).user_id)) {
      toast({ title: "Somente leitura", description: PARTNER_READ_ONLY_MESSAGE, variant: "destructive" as any });
      return;
    }
    try {
      await deleteAccount(id);
      toast({ title: "Conta excluída", duration: 2500 });
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir a conta", variant: "destructive" as any });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

  // Filtra contas por busca
  const filteredAccounts = accountsWithBalance?.filter((account) =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.type.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const accountDialog = (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Nova conta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Preencha os campos abaixo e salve para confirmar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
              placeholder="Conta corrente"
              required
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "name-error" : undefined}
            />
            {nameError && (
              <p id="name-error" className="text-xs text-destructive">
                {nameError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_type">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="account_type">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Corrente">Corrente</SelectItem>
                <SelectItem value="Poupança">Poupança</SelectItem>
                <SelectItem value="Investimento">Investimento</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="initial_balance">Saldo inicial</Label>
            <NumericInput
              id="initial_balance"
              currency
              allowNegative
              value={initialBalance}
              onChange={(v) => setInitialBalance(v ?? 0)}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Cor</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>Salvar conta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const rowActions = (a: any) => (
    <div className="flex items-center gap-0.5">
      <FeatureGuard feature="contas_editar">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!isMine(a.user_id)}
          onClick={() => onEdit(a.id)}
          aria-label={`Editar ${a.name}`}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </FeatureGuard>
      <FeatureGuard feature="contas_excluir">
        <ConfirmationDialog
          title="Excluir conta"
          description="A conta sai da lista e as transações ligadas a ela perdem o vínculo de saldo. Não dá para desfazer."
          confirmText="Excluir conta"
          onConfirm={() => onDelete(a.id)}
          variant="destructive"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!isMine(a.user_id)}
            aria-label={`Excluir ${a.name}`}
            className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </ConfirmationDialog>
      </FeatureGuard>
    </div>
  );

  const emptyTitle = searchTerm ? "Nenhuma conta encontrada" : "Nenhuma conta cadastrada";
  const emptyDescription = searchTerm
    ? `Nada corresponde a “${searchTerm}”. Tente outro nome ou tipo.`
    : "Cadastre a primeira conta para o Orbi começar a calcular seus saldos.";

  return (
    <PageBody>
      <LimitWarningBanner
        limit="max_contas"
        currentValue={accountsWithBalance?.length || 0}
        resourceName="contas"
      />

      <PageHeader
        eyebrow="Saldos"
        icon={Wallet}
        title="Contas"
        description="Onde o dinheiro está. Cada conta soma seu saldo inicial às transações já pagas. Pendentes só entram quando marcadas como pagas."
        actions={
          <FeatureGuard feature="contas_criar">
            <LimitGuard limit="max_contas" currentValue={accountsWithBalance?.length || 0}>
              {accountDialog}
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
            placeholder="Buscar por nome ou tipo"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            aria-label="Buscar contas"
          />
        </div>
        <ToolbarSpacer />
        <div className="flex items-center gap-3">
          {!isLoading && (
            <span className="hidden text-xs tabular text-muted-foreground sm:inline">
              {filteredAccounts.length}
              {filteredAccounts.length === 1 ? " conta" : " contas"}
            </span>
          )}
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
        </div>
      </PageToolbar>

      {isLoading ? (
        <div className={view === "cards" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-2"}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className={view === "cards" ? "h-40 w-full" : "h-16 w-full"} />
          ))}
        </div>
      ) : filteredAccounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAccounts.map((a, i) => (
            <Card
              key={a.id}
              interactive
              className="flex animate-rise flex-col overflow-hidden"
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              {/* Régua de 1px com a cor da conta: identidade sem bloco de cor. */}
              <span
                aria-hidden
                className="h-0.5 w-full shrink-0"
                style={{ backgroundColor: a.color ?? "hsl(var(--border))" }}
              />
              <CardHeader className="gap-0 space-y-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <OwnerMark userId={a.user_id} />
                      <h2
                        className="truncate font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground"
                        title={a.name}
                      >
                        {a.name}
                      </h2>
                    </div>
                    <p className="label-eyebrow mt-1">{a.type}</p>
                  </div>
                  {rowActions(a)}
                </div>
              </CardHeader>
              <CardContent className="mt-auto">
                <p className="label-eyebrow">Saldo atual</p>
                <p
                  className={cn(
                    "figure-lg mt-1 tabular",
                    (a.current_balance ?? 0) < 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {formatCurrency(a.current_balance ?? 0)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border-subtle">
            {filteredAccounts.map((a) => (
              <li
                key={a.id}
                className="relative flex flex-col gap-2 py-3 pl-5 pr-3 transition-colors duration-200 ease-swift hover:bg-accent/40 md:py-3.5 md:pr-4 lg:flex-row lg:items-center lg:gap-4"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-2 left-2.5 w-0.5 rounded-full"
                  style={{ backgroundColor: a.color ?? "hsl(var(--border))" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <OwnerMark userId={a.user_id} />
                    <p className="truncate text-sm font-medium text-foreground" title={a.name}>
                      {a.name}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.type}</p>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-2 lg:justify-end lg:border-t-0 lg:pt-0">
                  <span
                    className={cn(
                      "figure-sm tabular md:text-base",
                      (a.current_balance ?? 0) < 0 ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {formatCurrency(a.current_balance ?? 0)}
                  </span>
                  {rowActions(a)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageBody>
  );
}
