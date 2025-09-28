import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useAccounts } from "@/hooks/use-accounts";

export default function Transactions() {
  const queryClient = useQueryClient();
  const { transactions, createTransaction, deleteTransaction, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { accountsWithBalance } = useAccounts();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useSearchParams();
  const [type, setType] = useState<'income' | 'expense'>("income");
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [value, setValue] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [isFixed, setIsFixed] = useState(false);

  useEffect(() => {
    setAccountId((prev) => prev ?? accountsWithBalance[0]?.id);
    setCategoryId((prev) => prev ?? categories[0]?.id);
  }, [accountsWithBalance, categories]);

  const title = useMemo(() => "Nova Transação", []);

  useEffect(() => {
    if (search.get('new') === '1') {
      setOpen(true);
      setSearch((prev) => { prev.delete('new'); return prev; });
    }
  }, [search, setSearch]);

  const onSubmit = async () => {
    if (!accountId || !categoryId || !description.trim()) return;
    await createTransaction({
      type,
      account_id: accountId,
      category_id: categoryId,
      value,
      description,
      date,
      payment_method: 'debit',
      credit_card_id: null,
      is_fixed: isFixed,
    });
    setOpen(false);
    setDescription("");
    setValue(0);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Transações</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Nova Transação</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={type === 'income'} onCheckedChange={(checked) => setType(checked ? 'income' : 'expense')} />
                    <span>{type === 'income' ? 'Ganho' : 'Gasto'}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsWithBalance.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" value={value} onChange={(e) => setValue(parseFloat(e.target.value || '0'))} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fixo</Label>
                <Switch checked={isFixed} onCheckedChange={setIsFixed} />
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
          <CardTitle>Extrato (mês atual)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {isLoading && <div>Carregando...</div>}
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between border rounded p-2">
                <div className="flex flex-col">
                  <span className="font-medium">{t.description}</span>
                  <span className="text-sm text-muted-foreground">{new Date(t.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={t.type === 'income' ? 'text-[#28A745] font-semibold' : 'text-[#DC3545] font-semibold'}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(t.value))}
                  </span>
                  <Button variant="destructive" onClick={() => deleteTransaction(t.id)}>Excluir</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


