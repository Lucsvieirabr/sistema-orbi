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

export default function Accounts() {
  const queryClient = useQueryClient();
  const { accountsWithBalance, createAccount, updateAccount, deleteAccount, isLoading } = useAccounts();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("Corrente");
  const [initialBalance, setInitialBalance] = useState(0);
  const [color, setColor] = useState("#4f46e5");
  const [view, setView] = useState<"list" | "cards">("list");

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

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Contas</CardTitle>
                <p className="text-muted-foreground mt-1">
                  Gerencie suas contas bancárias e acompanhe seus saldos
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
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Conta
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
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accountsWithBalance.length === 0 ? (
            <div className="col-span-full">
              <Card className="border-dashed border-2 border-muted-foreground/25">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 bg-muted/50 rounded-full mb-4">
                    <Wallet className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nenhuma conta cadastrada</h3>
                  <p className="text-muted-foreground">
                    Adicione sua primeira conta para começar a gerenciar suas finanças
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            accountsWithBalance.map((a) => (
              <Card key={a.id} className="group hover:shadow-lg transition-all duration-200" style={{ borderTop: `4px solid ${a.color ?? "#e5e7eb"}` }}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: a.color ?? "#e5e7eb" }}>
                        <Wallet className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="font-semibold text-lg">{a.name}</h3>
                        <span className="text-sm text-muted-foreground">{a.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(a.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <ConfirmationDialog
                        title="Confirmar Exclusão"
                        description="Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita e afetará o saldo das transações."
                        confirmText="Excluir"
                        onConfirm={() => onDelete(a.id)}
                        variant="destructive"
                      >
                        <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </ConfirmationDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Saldo Atual</p>
                    <p className="text-2xl font-bold">{formatCurrency(a.current_balance ?? 0)}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 rounded-lg">
            {accountsWithBalance.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Wallet className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma conta cadastrada</h3>
                <p>Adicione sua primeira conta para começar</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {accountsWithBalance.map((a) => (
                <div key={a.id} className="flex items-center rounded-lg justify-between p-4 hover:bg-muted/40 transition-colors" style={{ borderLeft: `4px solid ${a.color ?? "#e5e7eb"}` }}>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full" style={{ backgroundColor: a.color ?? "#e5e7eb" }} />
                    <div className="flex flex-col">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-sm text-muted-foreground">{a.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatCurrency(a.current_balance ?? 0)}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(a.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <ConfirmationDialog
                      title="Confirmar Exclusão"
                      description="Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita e afetará o saldo das transações."
                      confirmText="Excluir"
                      onConfirm={() => onDelete(a.id)}
                      variant="destructive"
                    >
                      <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ConfirmationDialog>
                  </div>
                </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


