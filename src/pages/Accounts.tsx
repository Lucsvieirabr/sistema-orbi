import { useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useAccounts } from "@/hooks/use-accounts";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus, Wallet, Edit, Trash2 } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { FeaturePageGuard, FeatureGuard, LimitGuard, LimitWarningBanner } from "@/components/guards/FeatureGuard";
import { useFeatures, useLimit } from "@/hooks/use-feature";

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

  const title = useMemo(() => (editingId ? "Editar Conta" : "Nova Conta"), [editingId]);

  const onSubmit = async () => {
    if (!name.trim()) return;
    const payload = { name, type, initial_balance: initialBalance, color };
    const t = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
    try {
      if (editingId) {
        await updateAccount(editingId, payload);
      } else {
        await createAccount(payload);
      }
      t.update({ title: "Sucesso", description: "Conta salva", duration: 2000 });
    } catch (e) {
      t.update({ title: "Erro", description: "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
    }
    setOpen(false);
    setEditingId(null);
    setName("");
    setType("Corrente");
    setInitialBalance(0);
    setColor("#4f46e5");
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  const onEdit = (id: string) => {
    const acc = accountsWithBalance.find((a) => a.id === id);
    if (!acc) return;
    setEditingId(id);
    setName(acc.name);
    setType(acc.type);
    setInitialBalance(acc.initial_balance);
    setColor(acc.color ?? "#4f46e5");
    setOpen(true);
  };

  const onDelete = async (id: string) => {
    // show custom modal in real app; MVP direct
    await deleteAccount(id);
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

  const truncateText = (text: string, maxLength: number = 15) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Filtra contas por busca
  const filteredAccounts = accountsWithBalance?.filter((account) =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.type.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="container mx-auto p-0 lg:p-4 space-y-4 lg:space-y-6 max-w-full">
      {/* Aviso de Limite */}
      <LimitWarningBanner 
        limit="max_contas" 
        currentValue={accountsWithBalance?.length || 0}
        resourceName="contas"
      />
      
      {/* Header Section */}
      <Card className="shadow-lg max-w-full">
        <CardHeader className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between w-full max-w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                <Wallet className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl lg:text-2xl truncate">Contas</CardTitle>
                <p className="text-muted-foreground mt-1 text-sm hidden lg:block truncate">
                  Gerencie suas contas bancárias e acompanhe seus saldos
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
                <FeatureGuard feature="contas_criar">
                  <LimitGuard limit="max_contas" currentValue={accountsWithBalance?.length || 0}>
                    <Dialog open={open} onOpenChange={setOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2 w-full sm:w-auto">
                          <Plus className="h-4 w-4" />
                          <span className="sm:inline">Nova Conta</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{title}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Nome</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={type} onValueChange={setType}>
                              <SelectTrigger>
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
                            <Label htmlFor="initial_balance">Saldo Inicial</Label>
                            <NumericInput
                              id="initial_balance"
                              currency
                              value={initialBalance}
                              onChange={setInitialBalance}
                              placeholder="0,00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="color">Cor</Label>
                            <ColorPicker value={color} onChange={setColor} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={onSubmit}>Salvar</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </LimitGuard>
                </FeatureGuard>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Accounts Grid/List */}
      {isLoading ? (
        <div className={view === "cards" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6" : "space-y-4"}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className={view === "cards" ? "h-48 w-full" : "h-20 w-full"} />
          ))}
        </div>
      ) : (
        <>
          {view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAccounts.length === 0 ? (
                <div className="col-span-full">
                  <Card className="border-dashed border-2 border-muted-foreground/25">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-muted/50 rounded-full mb-4">
                        <Wallet className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {searchTerm ? "Nenhuma conta encontrada" : "Nenhuma conta cadastrada"}
                      </h3>
                      <p className="text-muted-foreground">
                        {searchTerm 
                          ? `Nenhuma conta encontrada para "${searchTerm}"`
                          : "Adicione sua primeira conta para começar a gerenciar suas finanças"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                filteredAccounts.map((a) => (
                  <Card key={a.id} className="group hover:shadow-lg transition-all duration-200 w-full overflow-hidden" style={{ borderTop: `4px solid ${a.color ?? "#e5e7eb"}` }}>
                    <CardHeader className="pb-3 p-4 w-full overflow-hidden">
                      <div className="flex flex-col gap-3 w-full overflow-hidden">
                        <div className="flex items-center justify-between gap-2 w-full overflow-hidden">
                          <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: a.color ?? "#e5e7eb" }}>
                              <Wallet className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                              <h3 className="font-semibold text-base" title={a.name}>{truncateText(a.name, 20)}</h3>
                              <span className="text-xs text-muted-foreground">{truncateText(a.type, 15)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 justify-end lg:justify-start">
                          <FeatureGuard feature="contas_editar">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(a.id)}
                              className="h-7 w-7 lg:h-8 lg:w-8 p-0"
                            >
                              <Edit className="h-3 w-3 lg:h-4 lg:w-4" />
                            </Button>
                          </FeatureGuard>
                          <FeatureGuard feature="contas_excluir">
                            <ConfirmationDialog
                              title="Confirmar Exclusão"
                              description="Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita e afetará o saldo das transações."
                              confirmText="Excluir"
                              onConfirm={() => onDelete(a.id)}
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
                    <CardContent>
                      <div className="text-left lg:text-right">
                        <p className="text-xs lg:text-sm text-muted-foreground">Saldo Atual</p>
                        <p className="text-xl lg:text-2xl font-bold">{formatCurrency(a.current_balance ?? 0)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0 rounded-lg">
                {filteredAccounts.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Wallet className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {searchTerm ? "Nenhuma conta encontrada" : "Nenhuma conta cadastrada"}
                    </h3>
                    <p>
                      {searchTerm 
                        ? `Nenhuma conta encontrada para "${searchTerm}"`
                        : "Adicione sua primeira conta para começar"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border w-full">
                    {filteredAccounts.map((a) => (
                      <div key={a.id} className="flex flex-col lg:flex-row lg:items-center rounded-lg justify-between p-3 lg:p-4 hover:bg-muted/40 transition-colors gap-3 w-full overflow-hidden" style={{ borderLeft: `4px solid ${a.color ?? "#e5e7eb"}` }}>
                          <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                          <div className="h-8 w-8 rounded-full flex-shrink-0" style={{ backgroundColor: a.color ?? "#e5e7eb" }} />
                          <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                            <span className="font-medium" title={a.name}>{truncateText(a.name, 25)}</span>
                            <span className="text-xs lg:text-sm text-muted-foreground">{truncateText(a.type, 20)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between lg:justify-end gap-2 lg:gap-3">
                          <span className="font-semibold text-sm lg:text-base">{formatCurrency(a.current_balance ?? 0)}</span>
                          <div className="flex items-center gap-1">
                            <FeatureGuard feature="contas_editar">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEdit(a.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </FeatureGuard>
                            <FeatureGuard feature="contas_excluir">
                              <ConfirmationDialog
                                title="Confirmar Exclusão"
                                description="Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita e afetará o saldo das transações."
                                confirmText="Excluir"
                                onConfirm={() => onDelete(a.id)}
                                variant="destructive"
                              >
                                <Button variant="destructive" size="sm" className="h-8 w-8 p-0 hidden lg:flex">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </ConfirmationDialog>
                            </FeatureGuard>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
      </div>
    </div>
  );
}
