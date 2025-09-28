import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts } from "@/hooks/use-accounts";

export default function Accounts() {
  const queryClient = useQueryClient();
  const { accountsWithBalance, createAccount, updateAccount, deleteAccount, isLoading } = useAccounts();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("Corrente");
  const [initialBalance, setInitialBalance] = useState(0);
  const [color, setColor] = useState("#4f46e5");

  const title = useMemo(() => (editingId ? "Editar Conta" : "Nova Conta"), [editingId]);

  const onSubmit = async () => {
    if (!name.trim()) return;
    const payload = { name, type, initial_balance: initialBalance, color };
    if (editingId) {
      await updateAccount(editingId, payload);
    } else {
      await createAccount(payload);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Contas</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Nova Conta</Button>
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
                <Input id="initial_balance" type="number" value={initialBalance} onChange={(e) => setInitialBalance(parseFloat(e.target.value || "0"))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Cor</Label>
                <Input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={onSubmit}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {isLoading && <div>Carregando...</div>}
            {accountsWithBalance.map((a) => (
              <div key={a.id} className="flex items-center justify-between border rounded p-2" style={{ borderLeft: `4px solid ${a.color ?? "#e5e7eb"}` }}>
                <div className="flex flex-col">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-sm text-muted-foreground">{a.type}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">{formatCurrency(a.current_balance ?? 0)}</span>
                  <Button variant="outline" onClick={() => onEdit(a.id)}>Editar</Button>
                  <Button variant="destructive" onClick={() => onDelete(a.id)}>Excluir</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


