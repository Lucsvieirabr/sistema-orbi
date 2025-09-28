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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useAccounts } from "@/hooks/use-accounts";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { Skeleton } from "@/components/ui/skeleton";
import { THEME, formatCurrencyBRL } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus, Edit, Trash2, ArrowUpDown, CreditCard, User } from "lucide-react";

export default function Transactions() {
  const queryClient = useQueryClient();
  const { transactions, createTransaction, updateTransaction, deleteTransaction, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { accountsWithBalance } = useAccounts();
  const { creditCards } = useCreditCards();
  const { familyMembers } = useFamilyMembers();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useSearchParams();
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>("income");
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [value, setValue] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [isFixed, setIsFixed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'debit' | 'credit'>('debit');
  const [creditCardId, setCreditCardId] = useState<string | null>(null);
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [installments, setInstallments] = useState<number | null>(null);
  const [fromAccountId, setFromAccountId] = useState<string | undefined>(undefined);
  const [toAccountId, setToAccountId] = useState<string | undefined>(undefined);

  // Calcular valor da parcela automaticamente
  const installmentValue = useMemo(() => {
    if (!value || !installments || installments <= 0) return 0;
    return value / installments;
  }, [value, installments]);
  const [view, setView] = useState<"list" | "cards">("list");

  useEffect(() => {
    const v = (localStorage.getItem("transactions:view") as "list" | "cards") || "list";
    setView(v);
  }, []);

  const onChangeView = (val: string) => {
    const v = (val as "list" | "cards") || "list";
    setView(v);
    localStorage.setItem("transactions:view", v);
  };

  useEffect(() => {
    setAccountId((prev) => prev ?? accountsWithBalance[0]?.id);
    setCategoryId((prev) => prev ?? categories[0]?.id);
    setFromAccountId((prev) => prev ?? accountsWithBalance[0]?.id);
    setToAccountId((prev) => prev ?? accountsWithBalance[1]?.id);
  }, [accountsWithBalance, categories]);

  const title = useMemo(() => (editingId ? "Editar Transação" : "Nova Transação"), [editingId]);

  useEffect(() => {
    if (search.get('new') === '1') {
      setOpen(true);
      setSearch((prev) => { prev.delete('new'); return prev; });
    }
  }, [search, setSearch]);

  const resetForm = () => {
    setEditingId(null);
    setType("income");
    setAccountId(accountsWithBalance[0]?.id);
    setCategoryId(categories[0]?.id);
    setValue(0);
    setDescription("");
    setDate(new Date().toISOString().slice(0,10));
    setIsFixed(false);
    setPaymentMethod('debit');
    setCreditCardId(null);
    setFamilyMemberId(null);
    setInstallments(null);
    setFromAccountId(accountsWithBalance[0]?.id);
    setToAccountId(accountsWithBalance[1]?.id);
  };

  // Reset campos específicos quando tipo muda
  const handleTypeChange = (newType: 'income' | 'expense' | 'transfer') => {
    setType(newType);
    
    // Reset campos específicos baseado no tipo
    if (newType === 'income') {
      // Ganho: limpa campos de pagamento, mantém parcelas
      setPaymentMethod('debit');
      setCreditCardId(null);
      setFromAccountId(undefined);
      setToAccountId(undefined);
      // Parcelas ficam disponíveis para ganhos
    } else if (newType === 'expense') {
      // Gasto: limpa campos de transferência
      setFromAccountId(undefined);
      setToAccountId(undefined);
      // Parcelas serão controladas pelo método de pagamento
    } else if (newType === 'transfer') {
      // Transferência: limpa campos de pagamento, categoria e parcelas
      setPaymentMethod('debit');
      setCreditCardId(null);
      setInstallments(null);
      setCategoryId(undefined);
    }
  };

  const onSubmit = async () => {
    const t = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
    try {
      // Construir payload baseado no tipo de transação
      let payload: any = {
        type,
        value,
        description,
        date,
        family_member_id: familyMemberId,
        is_fixed: isFixed,
      };

      if (type === 'income') {
        // Ganho: conta + categoria obrigatórios, com parcelas opcionais
        // Se for parcelado, usar o valor da parcela; senão, usar o valor total
        const transactionValue = (installments && installments > 1) ? installmentValue : value;
        
        payload = {
          ...payload,
          value: transactionValue,
          account_id: accountId,
          category_id: categoryId,
          payment_method: 'debit',
          credit_card_id: null,
          installments: installments || 1, // Default 1 se não especificado
        };
      } else if (type === 'expense') {
        // Gasto: depende do método de pagamento
        if (paymentMethod === 'debit') {
          // Débito: conta obrigatória, sem cartão, sem parcelas
          payload = {
            ...payload,
            account_id: accountId,
            category_id: categoryId,
            payment_method: 'debit',
            credit_card_id: null,
            installments: null,
          };
        } else {
          // Crédito: cartão obrigatório, sem conta, com parcelas
          // Se for parcelado, usar o valor da parcela; senão, usar o valor total
          const transactionValue = (installments && installments > 1) ? installmentValue : value;
          
          payload = {
            ...payload,
            value: transactionValue,
            account_id: null,
            category_id: categoryId,
            payment_method: 'credit',
            credit_card_id: creditCardId,
            installments: installments,
          };
        }
      } else if (type === 'transfer') {
        // Transferência: contas origem/destino, sem categoria
        payload = {
          ...payload,
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          payment_method: 'debit',
          credit_card_id: null,
          installments: null,
        };
      }

      if (editingId) {
        await updateTransaction(editingId, payload);
        t.update({ title: "Sucesso", description: "Transação atualizada", duration: 2000 });
      } else {
        await createTransaction(payload);
        t.update({ title: "Sucesso", description: "Transação criada", duration: 2000 });
      }
    } catch (e: any) {
      t.update({ title: "Erro", description: e.message || "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
    }
    setOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  const onEdit = (transaction: any) => {
    setEditingId(transaction.id);
    setType(transaction.type);
    setAccountId(transaction.account_id);
    setCategoryId(transaction.category_id);
    setValue(transaction.value);
    setDescription(transaction.description);
    setDate(transaction.date);
    setIsFixed(transaction.is_fixed);
    setPaymentMethod(transaction.payment_method || 'debit');
    setCreditCardId(transaction.credit_card_id);
    setFamilyMemberId(transaction.family_member_id);
    setInstallments(transaction.installments);
    setOpen(true);
  };

  const onDelete = async (id: string) => {
    const t = toast({ title: "Excluindo...", description: "Aguarde", duration: 2000 });
    try {
      await deleteTransaction(id);
      t.update({ title: "Sucesso", description: "Transação excluída", duration: 2000 });
    } catch (e: any) {
      t.update({ title: "Erro", description: e.message || "Não foi possível excluir", duration: 3000, variant: "destructive" as any });
    }
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  const formatCurrency = formatCurrencyBRL;

  return (
    <div className="space-y-4 mt-2">
      <Card className="shadow-md">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Transações</CardTitle>
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Tipo de Transação */}
                <div className="space-y-2">
                  <Label>Tipo de Transação</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleTypeChange('income')}
                      className={`flex items-center gap-2 flex-1 ${type === 'income' 
                        ? 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100' 
                        : 'hover:border-green-300 hover:bg-green-50 hover:text-green-700'}`}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      Ganho
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleTypeChange('expense')}
                      className={`flex items-center gap-2 flex-1 ${type === 'expense' 
                        ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100' 
                        : 'hover:border-red-300 hover:bg-red-50 hover:text-red-700'}`}
                    >
                      <ArrowUpDown className="h-4 w-4 rotate-180" />
                      Gasto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleTypeChange('transfer')}
                      className={`flex items-center gap-2 flex-1 ${type === 'transfer' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100' 
                        : 'hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'}`}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      Transferência
                    </Button>
                  </div>
                </div>

                {/* Campos principais com lógica de visibilidade dinâmica */}
                {type === 'transfer' ? (
                  /* Transferência: Conta Origem + Conta Destino */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Conta de Origem</Label>
                      <Select value={fromAccountId} onValueChange={setFromAccountId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Origem" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountsWithBalance.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Conta de Destino</Label>
                      <Select value={toAccountId} onValueChange={setToAccountId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountsWithBalance.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : type === 'income' ? (
                  /* Ganho: Conta + Categoria + Valor Total + Parcelas */
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Conta</Label>
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountsWithBalance.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Categoria</Label>
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Valor</Label>
                      <Input 
                        type="number" 
                        value={value} 
                        onChange={(e) => setValue(parseFloat(e.target.value || '0'))} 
                        placeholder="0,00"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Parcelas</Label>
                      <Input 
                        type="number" 
                        value={installments || ''} 
                        onChange={(e) => setInstallments(e.target.value ? parseInt(e.target.value) : null)} 
                        placeholder="1"
                        min="1"
                        className="h-9"
                      />
                    </div>
                  </div>
                ) : (
                  /* Gasto: Conta + Categoria + Valor (método de pagamento será tratado abaixo) */
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Conta</Label>
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountsWithBalance.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Categoria</Label>
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Valor</Label>
                      <Input 
                        type="number" 
                        value={value} 
                        onChange={(e) => setValue(parseFloat(e.target.value || '0'))} 
                        placeholder="0,00"
                        className="h-9"
                      />
                    </div>
                  </div>
                )}

                {/* Descrição e Data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Descrição</Label>
                    <Input 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                      placeholder="Ex: Salário, Aluguel, etc."
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Data</Label>
                    <Input 
                      type="date" 
                      value={date} 
                      onChange={(e) => setDate(e.target.value)} 
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Informação do valor da parcela para ganhos parcelados */}
                {type === 'income' && installments && installments > 1 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-700 font-medium">Valor por Parcela:</span>
                      <span className="text-blue-900 font-semibold">
                        {formatCurrency(installmentValue)}
                      </span>
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {installments} parcelas de {formatCurrency(installmentValue)} = {formatCurrency(value)}
                    </div>
                  </div>
                )}

                {/* Método de Pagamento (apenas para gastos) */}
                {type === 'expense' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Método de Pagamento</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={paymentMethod === 'debit' ? 'default' : 'outline'}
                          onClick={() => {
                            setPaymentMethod('debit');
                            setCreditCardId(null);
                            setInstallments(null);
                          }}
                          className="flex-1 h-9 text-xs"
                        >
                          Débito/Dinheiro
                        </Button>
                        <Button
                          type="button"
                          variant={paymentMethod === 'credit' ? 'default' : 'outline'}
                          onClick={() => {
                            setPaymentMethod('credit');
                            setAccountId(undefined);
                          }}
                          className="flex-1 h-9 text-xs flex items-center gap-1"
                        >
                          <CreditCard className="h-3 w-3" />
                          Cartão de Crédito
                        </Button>
                      </div>
                    </div>
                    
                    {paymentMethod === 'credit' ? (
                      <div className="space-y-1">
                        <Label className="text-sm">Cartão de Crédito</Label>
                        <Select value={creditCardId || "none"} onValueChange={(value) => setCreditCardId(value === "none" ? null : value)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {creditCards.map((card) => (
                              <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Parcelas para Cartão de Crédito */}
                {type === 'expense' && paymentMethod === 'credit' && (
                  <div className="space-y-1">
                    <Label className="text-sm">Parcelas</Label>
                    <Input 
                      type="number" 
                      value={installments || ''} 
                      onChange={(e) => setInstallments(e.target.value ? parseInt(e.target.value) : null)} 
                      placeholder="Ex: 12"
                      min="2"
                      className="h-9"
                    />
                  </div>
                )}

                {/* Informação do valor da parcela para gastos parcelados */}
                {type === 'expense' && paymentMethod === 'credit' && installments && installments > 1 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-700 font-medium">Valor por Parcela:</span>
                      <span className="text-red-900 font-semibold">
                        {formatCurrency(installmentValue)}
                      </span>
                    </div>
                    <div className="text-xs text-red-600 mt-1">
                      {installments} parcelas de {formatCurrency(installmentValue)} = {formatCurrency(value)}
                    </div>
                  </div>
                )}

                {/* Campos Opcionais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Membro da Família</Label>
                    <Select value={familyMemberId || "none"} onValueChange={(value) => setFamilyMemberId(value === "none" ? null : value)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {familyMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-sm">Configurações</Label>
                    <div className="flex items-center space-x-2 h-9">
                      <Switch checked={isFixed} onCheckedChange={setIsFixed} />
                      <Label className="text-sm">Transação Recorrente</Label>
                    </div>
                  </div>
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
              {transactions.length === 0 ? (
                <div className="col-span-full rounded-lg border bg-card p-6 text-center text-muted-foreground">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <LayoutGrid className="h-5 w-5" />
                  </div>
                  Nenhuma transação
                </div>
              ) : transactions.map((t) => (
                <div key={t.id} className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition" style={{ borderTop: `4px solid ${t.type === 'income' ? THEME.income.color : THEME.expense.color}` }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex flex-col flex-1">
                      <span className="font-medium">{t.description}</span>
                      <span className="text-sm text-muted-foreground">{new Date(t.date).toLocaleDateString('pt-BR')}</span>
                      {t.installment_number && (
                        <span className="text-xs text-muted-foreground">
                          Parcela {t.installment_number}/{t.installments}
                        </span>
                      )}
                      {t.is_fixed && (
                        <span className="text-xs text-blue-600 font-medium">Recorrente</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => onEdit(t)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita e afetará o saldo da conta.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(t.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conta:</span>
                      <span>{t.accounts?.name}</span>
                    </div>
                    {t.categories?.name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Categoria:</span>
                        <span>{t.categories.name}</span>
                      </div>
                    )}
                    {t.credit_cards?.name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cartão:</span>
                        <span>{t.credit_cards.name}</span>
                      </div>
                    )}
                    {t.family_members?.name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Membro:</span>
                        <span>{t.family_members.name}</span>
                      </div>
                    )}
                  </div>
                  <div className={(t.type === 'income' ? THEME.income.className : THEME.expense.className) + ' mt-4 text-right font-semibold'}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(t.value))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md bg-card/40">
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <List className="h-5 w-5" />
                  </div>
                  Nenhuma transação
                </div>
              ) : transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.type === 'income' ? THEME.income.color : THEME.expense.color }} />
                    <div className="flex flex-col flex-1">
                      <span className="font-medium">{t.description}</span>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{new Date(t.date).toLocaleDateString('pt-BR')}</span>
                        <span>{t.accounts?.name}</span>
                        {t.categories?.name && <span>{t.categories.name}</span>}
                        {t.installment_number && (
                          <span className="text-blue-600">
                            {t.installment_number}/{t.installments}
                          </span>
                        )}
                        {t.is_fixed && (
                          <span className="text-blue-600 font-medium">Recorrente</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={(t.type === 'income' ? THEME.income.className : THEME.expense.className) + ' font-semibold'}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(t.value))}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(t)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita e afetará o saldo da conta.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(t.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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


