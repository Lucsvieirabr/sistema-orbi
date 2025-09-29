import { useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useAccounts } from "@/hooks/use-accounts";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus } from "lucide-react";
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
      <Card className="shadow-md">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Contas</CardTitle>
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
                  <Input id="initial_balance" type="number" value={initialBalance} onChange={(e) => setInitialBalance(parseFloat(e.target.value || "0"))} />
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className={view === "cards" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" : "space-y-3"}>
              <Skeleton className={view === "cards" ? "h-24 w-full" : "h-14 w-full"} />
              <Skeleton className={view === "cards" ? "h-24 w-full" : "h-14 w-full"} />
              <Skeleton className={view === "cards" ? "h-24 w-full" : "h-14 w-full"} />
            </div>
          ) : view === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {accountsWithBalance.length === 0 ? (
                <div className="col-span-full rounded-lg border bg-card p-6 text-center text-muted-foreground">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <LayoutGrid className="h-5 w-5" />
                  </div>
                  Nenhuma conta cadastrada
                </div>
              ) : accountsWithBalance.map((a) => (
                <div key={a.id} className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition" style={{ borderTop: `4px solid ${a.color ?? "#e5e7eb"}` }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full" style={{ backgroundColor: a.color ?? "#e5e7eb" }} />
                      <div className="flex flex-col">
                        <span className="font-medium">{a.name}</span>
                        <span className="text-sm text-muted-foreground">{a.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(a.id)}>Editar</Button>
                      <ConfirmationDialog
                        title="Confirmar Exclusão"
                        description="Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita e afetará o saldo das transações."
                        confirmText="Excluir"
                        onConfirm={() => onDelete(a.id)}
                        variant="destructive"
                      >
                        <Button variant="destructive" size="sm">Excluir</Button>
                      </ConfirmationDialog>
                    </div>
                  </div>
                  <div className="mt-4 text-right font-semibold">{formatCurrency(a.current_balance ?? 0)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md bg-card/40">
              {accountsWithBalance.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <List className="h-5 w-5" />
                  </div>
                  Nenhuma conta cadastrada
                </div>
              ) : accountsWithBalance.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors" style={{ borderLeft: `4px solid ${a.color ?? "#e5e7eb"}` }}>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full" style={{ backgroundColor: a.color ?? "#e5e7eb" }} />
                    <div className="flex flex-col">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-sm text-muted-foreground">{a.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatCurrency(a.current_balance ?? 0)}</span>
                    <Button variant="outline" onClick={() => onEdit(a.id)}>Editar</Button>
                    <ConfirmationDialog
                      title="Confirmar Exclusão"
                      description="Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita e afetará o saldo das transações."
                      confirmText="Excluir"
                      onConfirm={() => onDelete(a.id)}
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


