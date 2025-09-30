import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectWithAddButton } from "@/components/ui/select-with-add-button";
import { NumericInput } from "@/components/ui/numeric-input";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Plus, CheckCircle, CreditCard, Calendar, FileText, AlertCircle, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { usePeople } from "@/hooks/use-people";
import { usePersonTransactions, useUpdateTransactionStatus, useCreatePaymentTransaction } from "@/hooks/use-person-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useAccounts } from "@/hooks/use-accounts";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface PersonDetailProps {
  personId?: string;
}

export default function PersonDetail({ personId: propPersonId }: PersonDetailProps) {
  const { personId: paramPersonId } = useParams<{ personId: string }>();
  const personId = propPersonId || paramPersonId;
  const navigate = useNavigate();

  const { people, isLoading: peopleLoading, error: peopleError } = usePeople();
  const { transactions, indicators, isLoading: transactionsLoading, error } = usePersonTransactions(personId || "");
  const { updateTransactionStatus } = useUpdateTransactionStatus();
  const { createPaymentTransaction } = useCreatePaymentTransaction();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { accountsWithBalance, isLoading: accountsLoading } = useAccounts();
  const queryClient = useQueryClient();

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string>("");
  const [paymentValue, setPaymentValue] = useState<number>(0);

  // Estados para o dialog de nova transação
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [type, setType] = useState<'expense'>('expense');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [peopleSearchTerm, setPeopleSearchTerm] = useState("");
  const [isLoan, setIsLoan] = useState(false);
  const [isRateio, setIsRateio] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isFixed, setIsFixed] = useState(false);

  const person = useMemo(() => {
    return people.find(p => p.id === personId);
  }, [people, personId]);

  // Pessoas filtradas para busca (excluindo a pessoa da rota)
  const filteredPeople = useMemo(() => {
    if (!peopleSearchTerm.trim()) return people.filter(p => p.id !== personId);
    return people.filter(p => 
      p.id !== personId && 
      p.name.toLowerCase().includes(peopleSearchTerm.toLowerCase())
    );
  }, [people, peopleSearchTerm, personId]);

  // Limpar pessoas selecionadas quando o dialog abrir (usuário + pessoa da rota são automáticos)
  useEffect(() => {
    if (transactionDialogOpen) {
      setSelectedPeople([]);
      setIsLoan(false);
      setIsRateio(false);
      setSelectedPersonId(null);
      setIsFixed(false);
    }
  }, [transactionDialogOpen]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    return status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  };

  const getTypeIcon = (type: string, status: string) => {
    if (type === 'income' && status === 'PENDING') {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    }
    if (type === 'expense' && status === 'PENDING') {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return <CheckCircle className="h-4 w-4 text-gray-600" />;
  };

  const handleMarkAsPaid = async (transactionId: string) => {
    try {
      await updateTransactionStatus(transactionId, 'PAID');
      toast({ title: "Sucesso", description: "Transação marcada como paga", duration: 2000 });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Não foi possível atualizar", duration: 3000, variant: "destructive" as any });
    }
  };

  const handleOpenPaymentDialog = (debtId: string, debtValue: number) => {
    setSelectedDebtId(debtId);
    setPaymentValue(debtValue);
    setPaymentDialogOpen(true);
  };

  const handlePayDebt = async () => {
    try {
      await createPaymentTransaction(selectedDebtId, paymentValue);
      toast({ title: "Sucesso", description: "Pagamento registrado", duration: 2000 });
      setPaymentDialogOpen(false);
      setSelectedDebtId("");
      setPaymentValue(0);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Não foi possível processar pagamento", duration: 3000, variant: "destructive" as any });
    }
  };

  const handleCreateTransaction = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const transactionValue = parseFloat((value || 0).toString());
      if (!transactionValue || transactionValue <= 0) {
        throw new Error("Valor deve ser maior que zero");
      }

      if (!description.trim()) {
        throw new Error("Descrição é obrigatória");
      }

      if (!accountId) {
        throw new Error("Conta é obrigatória");
      }

      if (!categoryId) {
        throw new Error("Categoria é obrigatória");
      }

      if (!date) {
        throw new Error("Data é obrigatória");
      }

      if (isLoan) {
        // Para empréstimo: criar gasto + conta a receber
        const seriesId = crypto.randomUUID();
        
        // 1. Criar gasto (expense) com o valor total
        const { data: expenseTransaction, error: expenseError } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            type: 'expense',
            value: transactionValue,
            description: `${description.trim()} (Empréstimo)`,
            date: date,
            account_id: accountId,
            category_id: categoryId,
            payment_method: 'debit',
            credit_card_id: null,
            person_id: null,
            is_fixed: false,
            is_shared: false,
            compensation_value: 0,
            series_id: seriesId,
            linked_txn_id: null,
            status: 'PAID',
          })
          .select()
          .single();

        if (expenseError) {
          console.error("Erro ao criar gasto do empréstimo:", expenseError);
          throw expenseError;
        }

        if (!expenseTransaction) {
          throw new Error("Erro interno: gasto do empréstimo não foi criado");
        }

        // 2. Criar conta a receber (income) para a pessoa
        const { data: incomeTransaction, error: incomeError } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            type: 'income',
            value: transactionValue,
            description: `${description.trim()} (A receber de ${person?.name})`,
            date: date,
            account_id: accountId,
            category_id: categoryId,
            payment_method: 'debit',
            credit_card_id: null,
            person_id: personId,
            is_fixed: false,
            is_shared: false,
            compensation_value: 0,
            series_id: seriesId,
            linked_txn_id: expenseTransaction.id,
            status: 'PENDING',
          })
          .select()
          .single();

        if (incomeError) {
          console.error("Erro ao criar conta a receber:", incomeError);
          throw incomeError;
        }

        if (!incomeTransaction) {
          throw new Error("Erro interno: conta a receber não foi criada");
        }

        toast({ title: "Sucesso", description: "Empréstimo criado: gasto + conta a receber", duration: 2000 });
      } else if (type === 'expense' && isRateio) {
        // Para rateio: criar gasto bruto + dívidas individuais
        // Padrão do sistema: usuário atual + pessoa da rota + pessoas selecionadas
        const totalPeopleInRateio = selectedPeople.length + 2; // +2 para usuário atual + pessoa da rota
        const amountPerPerson = transactionValue / totalPeopleInRateio;

        if (amountPerPerson <= 0) {
          throw new Error("Valor por pessoa deve ser maior que zero");
        }

        // 1. Inserir gasto bruto
        const { data: expenseTransaction, error: expenseError } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            type: 'expense',
            value: transactionValue,
            description: `${description.trim()} (Pagamento Total)`,
            date: date,
            account_id: accountId,
            category_id: categoryId,
            payment_method: 'debit',
            credit_card_id: null,
            person_id: null,
            is_fixed: false,
            is_shared: true,
            compensation_value: amountPerPerson * totalPeopleInRateio, // Valor total que será compensado
            series_id: null,
            linked_txn_id: null,
            status: 'PAID',
          })
          .select()
          .single();

        if (expenseError) {
          console.error("Erro ao criar gasto bruto:", expenseError);
          throw expenseError;
        }

        if (!expenseTransaction) {
          throw new Error("Erro interno: gasto bruto não foi criado");
        }

        // 2. Inserir dívidas individuais (apenas para pessoas selecionadas + pessoa da rota)
        const seriesId = crypto.randomUUID();
        
        // 2.1. Criar dívida para a pessoa da rota
        let debtDataRoute = null;
        if (personId) {
          const { data, error: debtErrorRoute } = await supabase
            .from("transactions")
            .insert({
              user_id: user.id,
              type: 'income',
              value: amountPerPerson,
              description: `${description.trim()} (Parte - ${person?.name})`,
              date: date,
              account_id: accountId,
              category_id: categoryId,
              payment_method: 'debit',
              credit_card_id: null,
              person_id: personId,
              is_fixed: false,
              is_shared: true,
              compensation_value: 0,
              series_id: seriesId,
              linked_txn_id: expenseTransaction.id,
              status: 'PENDING',
            })
            .select()
            .single();

          if (debtErrorRoute) {
            console.error("Erro ao criar dívida da pessoa da rota:", debtErrorRoute);
            throw debtErrorRoute;
          }

          if (!data) {
            throw new Error("Erro interno: dívida da pessoa da rota não foi criada");
          }

          debtDataRoute = data;
        }
        
        // 2.2. Criar dívidas para as pessoas selecionadas
        const debtTransactions = [];
        for (const personIdToShare of selectedPeople) {
          // Buscar nome da pessoa
          const { data: personData, error: personError } = await supabase
            .from("people")
            .select("name")
            .eq("id", personIdToShare)
            .single();

          if (personError) {
            console.error("Erro ao buscar pessoa:", personError);
            throw personError;
          }

          if (!personData) {
            throw new Error(`Pessoa não encontrada: ${personIdToShare}`);
          }

          const { data: debtData, error: debtError } = await supabase
            .from("transactions")
            .insert({
              user_id: user.id,
              type: 'income',
              value: amountPerPerson,
              description: `${description.trim()} (Parte - ${personData.name})`,
              date: date,
              account_id: accountId,
              category_id: categoryId,
              payment_method: 'debit',
              credit_card_id: null,
              person_id: personIdToShare,
              is_fixed: false,
              is_shared: true,
              compensation_value: 0,
              series_id: seriesId,
              linked_txn_id: expenseTransaction.id,
              status: 'PENDING',
            })
            .select()
            .single();

          if (debtError) {
            console.error("Erro ao criar dívida individual:", debtError);
            throw debtError;
          }

          if (!debtData) {
            throw new Error("Erro interno: dívida individual não foi criada");
          }

          debtTransactions.push(debtData);
        }

        // 3. Atualizar as transações para criar a ligação
        await supabase
          .from("transactions")
          .update({
            series_id: seriesId,
          })
          .eq("id", expenseTransaction.id);

        const allDebtTransactions = [debtDataRoute, ...debtTransactions].filter(Boolean);
        for (const debtTransaction of allDebtTransactions) {
          await supabase
            .from("transactions")
            .update({
              series_id: seriesId,
            })
            .eq("id", debtTransaction.id);
        }

        toast({ title: "Sucesso", description: `Rateio criado: gasto bruto + dívidas individuais`, duration: 2000 });
      } else if (type === 'expense' && !isLoan && !isRateio) {
        // Para gasto normal: criar apenas uma transação de gasto
        const { data, error } = await supabase.from("transactions").insert({
          user_id: user.id,
          type: 'expense',
          value: transactionValue,
          description: description.trim(),
          date: date,
          account_id: accountId,
          category_id: categoryId,
          payment_method: 'debit',
          credit_card_id: null,
          person_id: selectedPersonId,
          is_fixed: false,
          is_shared: false,
          compensation_value: 0,
          series_id: null,
          linked_txn_id: null,
          status: 'PAID',
        }).select().single();

        if (error) {
          console.error("Erro ao criar gasto:", error);
          throw error;
        }

        if (!data) {
          throw new Error("Erro interno: gasto não foi criado");
        }

        toast({ title: "Sucesso", description: "Gasto criado", duration: 2000 });
      } else {
        throw new Error("Tipo de transação inválido ou dados insuficientes");
      }

      // Limpar formulário e fechar dialog
      setTransactionDialogOpen(false);
      setDescription('');
      setValue(null);
      setDate(new Date().toISOString().split('T')[0]);
      setAccountId('');
      setCategoryId('');
      setSelectedPeople([]);
      setPeopleSearchTerm("");
      setIsLoan(false);
      setIsRateio(false);
      setSelectedPersonId(null);
      setIsFixed(false);

      // Atualizar dados
      queryClient.invalidateQueries({ queryKey: ["person-transactions", personId] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });

      toast({ title: "Sucesso", description: "Transação criada com sucesso", duration: 2000 });

    } catch (e: any) {
      console.error("Erro ao criar transação:", e);
      toast({ title: "Erro", description: e.message || "Não foi possível criar transação", duration: 3000, variant: "destructive" as any });
    }
  };

  if (peopleLoading || transactionsLoading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <Card className="shadow-md">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-96" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card className="shadow-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
            <p className="text-muted-foreground mb-4">{error.message}</p>
            <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="container mx-auto p-4">
        <Card className="shadow-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Pessoa não encontrada</h3>
            <Button onClick={() => navigate('/sistema/people')} className="mt-4">
              Voltar para Pessoas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/sistema/people')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <CardTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              {person.name}
            </CardTitle>
          </div>
        </CardHeader>
      </Card>

      {/* Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total a Receber
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(indicators.totalAReceber)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dívidas pendentes
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total a Pagar
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(indicators.totalAPagar)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dívidas pendentes
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Líquido
            </CardTitle>
            <DollarSign className={`h-4 w-4 ${indicators.saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${indicators.saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(indicators.saldoLiquido)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {indicators.saldoLiquido >= 0 ? 'Você receberá' : 'Você pagará'} este valor
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card className="shadow-md">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Extrato de Dívidas Vinculadas
          </CardTitle>
          <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-2 mt-4"
              >
                <Plus className="h-4 w-4" />
                Nova transação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Transação</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Tipo de Operação */}
                <div className="space-y-2">
                  <Label>Tipo de Operação</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsLoan(false);
                        setIsRateio(false);
                      }}
                      className={`flex items-center gap-2 flex-1 ${!isLoan && !isRateio
                        ? 'border-destructive/50 bg-destructive/10 dark:bg-destructive/20 text-destructive dark:text-destructive'
                        : 'hover:border-destructive/30 hover:bg-destructive/5 dark:hover:bg-destructive/10'}`}
                    >
                      <ArrowDownCircle className="h-4 w-4" />
                      Gasto Normal
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsLoan(true);
                        setIsRateio(false);
                      }}
                      className={`flex items-center gap-2 flex-1 ${isLoan && !isRateio
                        ? 'border-purple-500/50 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300'
                        : 'hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/10'}`}
                    >
                      <DollarSign className="h-4 w-4" />
                      Empréstimo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsLoan(false);
                        setIsRateio(true);
                      }}
                      className={`flex items-center gap-2 flex-1 ${!isLoan && isRateio
                        ? 'border-blue-500/50 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300'
                        : 'hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'}`}
                    >
                      <ArrowDownCircle className="h-4 w-4" />
                      Rateio
                    </Button>
                  </div>
                </div>

                {/* Campos principais */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: Jantar no restaurante"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value">Valor</Label>
                    <NumericInput
                      id="value"
                      value={value}
                      onChange={setValue}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <SelectWithAddButton
                      entityType="accounts"
                      value={accountId}
                      onValueChange={setAccountId}
                      placeholder="Selecionar conta"
                    >
                      {accountsWithBalance?.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectWithAddButton>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <SelectWithAddButton
                      entityType="categories"
                      value={categoryId}
                      onValueChange={setCategoryId}
                      placeholder="Selecionar categoria"
                    >
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectWithAddButton>
                  </div>
                </div>

                {/* Campos de Pessoa e Configurações - Ocultos para Rateio */}
                {!isRateio && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Pessoa</Label>
                      <SelectWithAddButton
                        entityType="people"
                        value={selectedPersonId || "none"}
                        onValueChange={(value) => setSelectedPersonId(value === "none" ? null : value)}
                        placeholder="Opcional"
                      >
                        <SelectItem value="none">Nenhum</SelectItem>
                        {people.map((person) => (
                          <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                        ))}
                      </SelectWithAddButton>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm">Configurações</Label>
                      <div className="flex items-center space-x-2 h-9">
                        <Switch checked={isFixed} onCheckedChange={setIsFixed} />
                        <Label className="text-sm">Transação Recorrente</Label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Campo de Configurações para Rateio - Sempre visível */}
                {isRateio && (
                  <div className="space-y-1">
                    <Label className="text-sm">Configurações</Label>
                    <div className="flex items-center space-x-2 h-9">
                      <Switch checked={isFixed} onCheckedChange={setIsFixed} />
                      <Label className="text-sm">Transação Recorrente</Label>
                    </div>
                  </div>
                )}

                {/* Seleção de Pessoas para Rateio */}
                {isRateio && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Pessoas para dividir</Label>
                      
                      {/* Mostrar pessoas sempre incluídas no rateio */}
                      <div className="space-y-2">
                       
                        
                        {person && (
                          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm">
                              <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                <DollarSign className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="text-blue-700 dark:text-blue-300 font-medium">
                                {person.name}
                              </span>
                              <span className="text-blue-600 dark:text-blue-400 text-xs">
                                - Já incluído no rateio
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      

                      <div className="space-y-2">
                        <Label>Adicionar outras pessoas</Label>
                        <Input
                          placeholder="Buscar pessoas..."
                          value={peopleSearchTerm}
                          onChange={(e) => setPeopleSearchTerm(e.target.value)}
                          className="w-full"
                        />
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                          {peopleLoading ? (
                            <div className="text-sm text-muted-foreground">Carregando pessoas...</div>
                          ) : (
                            filteredPeople.map((person) => (
                            <Button
                              key={person.id}
                              type="button"
                              variant={selectedPeople.includes(person.id) ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                setSelectedPeople(prev =>
                                  prev.includes(person.id)
                                    ? prev.filter(id => id !== person.id)
                                    : [...prev, person.id]
                                );
                              }}
                              className={`h-8 ${selectedPeople.includes(person.id)
                                ? 'bg-purple-100 text-purple-800 border-2 border-purple-300 hover:bg-purple-200'
                                : 'border-2 border-gray-300 hover:bg-transparent'}`}
                            >
                              {person.name}
                            </Button>
                            ))
                          )}
                        </div>
                      </div>
                      
                      {(selectedPeople.length > 0 || person) && (
                        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <span className="text-purple-700 dark:text-purple-300 font-medium">
                                  {selectedPeople.length + 1} pessoa{(selectedPeople.length + 1) !== 1 ? 's' : ''}
                                </span>
                                <span className="text-purple-600 dark:text-purple-400">no rateio</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-purple-700 dark:text-purple-300 font-medium">
                                Valor por pessoa
                              </div>
                              <div className="text-purple-900 dark:text-purple-100 font-semibold">
                                {value && parseFloat(value.toString()) > 0
                                  ? `R$ ${(parseFloat(value.toString()) / (selectedPeople.length + 2)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                  : 'R$ 0,00'
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTransactionDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateTransaction}>
                  Criar Transação
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Nenhuma transação encontrada para esta pessoa</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getTypeIcon(transaction.type, transaction.status)}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{transaction.description}</span>
                        <Badge className={cn("text-xs", getStatusColor(transaction.status))}>
                          {transaction.status === 'PAID' ? 'Paga' : 'Pendente'}
                        </Badge>
                        {transaction.linked_txn_id && (
                          <Badge variant="outline" className="text-xs">
                            Rateio
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(transaction.date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(transaction.value)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {transaction.type === 'income' && transaction.status === 'PENDING' && (
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsPaid(transaction.id)}
                        className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Receber
                      </Button>
                    )}

                    {transaction.type === 'expense' && transaction.status === 'PENDING' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenPaymentDialog(transaction.id, Number(transaction.value))}
                        className="flex items-center gap-1"
                      >
                        <CreditCard className="h-3 w-3" />
                        Pagar Dívida
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar Dívida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-value">Valor do Pagamento</Label>
              <Input
                id="payment-value"
                type="number"
                step="0.01"
                value={paymentValue}
                onChange={(e) => setPaymentValue(Number(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePayDebt}>
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
