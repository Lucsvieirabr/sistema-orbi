import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users, CheckCircle, Calendar, FileText, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { usePeople } from "@/hooks/use-people";
import { usePersonTransactions, useUpdateTransactionStatus } from "@/hooks/use-person-transactions";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatDateForDisplay } from "@/lib/utils";

interface PersonDetailProps {
  personId?: string;
}

export default function PersonDetail({ personId: propPersonId }: PersonDetailProps) {
  const { personId: paramPersonId } = useParams<{ personId: string }>();
  const personId = propPersonId || paramPersonId;
  const navigate = useNavigate();

  // Period filter state - default to current month
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const { people, isLoading: peopleLoading } = usePeople();
  const { transactions, indicators, isLoading: transactionsLoading, error } = usePersonTransactions(personId || "", selectedMonth, selectedYear);
  const { updateTransactionStatus } = useUpdateTransactionStatus();

  const person = useMemo(() => {
    return people.find(p => p.id === personId);
  }, [people, personId]);

  // Helper function to navigate months
  const handlePreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Format month/year for display
  const periodDisplay = useMemo(() => {
    const date = new Date(selectedYear, selectedMonth);
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  }, [selectedMonth, selectedYear]);


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

  const handlePayDebt = async (transactionId: string) => {
    try {
      await updateTransactionStatus(transactionId, 'PAID');
      toast({ title: "Sucesso", description: "Dívida marcada como paga", duration: 2000 });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Não foi possível marcar como paga", duration: 3000, variant: "destructive" as any });
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
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
          <div className="flex items-center justify-between gap-4 flex-wrap">
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
                  <Users className="h-5 w-5 text-primary" />
                </div>
                {person.name}
              </CardTitle>
            </div>
            
            {/* Period Filter */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePreviousMonth}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[160px] text-center capitalize">
                {periodDisplay}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextMonth}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total a Receber
            </CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-green-600">
              {formatCurrency(indicators.totalAReceber)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Pendente
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total a Pagar
            </CardTitle>
            <TrendingDown className="h-3.5 w-3.5 text-red-600" />
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-red-600">
              {formatCurrency(indicators.totalAPagar)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Pendente
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Recebido
            </CardTitle>
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-green-600">
              {formatCurrency(indicators.totalRecebido)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Pago
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Pago
            </CardTitle>
            <CheckCircle className="h-3.5 w-3.5 text-red-600" />
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-red-600">
              {formatCurrency(indicators.totalPago)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Pago
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Saldo Líquido
            </CardTitle>
            <DollarSign className={`h-3.5 w-3.5 ${indicators.saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent className="pb-3">
            <div className={`text-xl font-bold ${indicators.saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(indicators.saldoLiquido)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {indicators.saldoLiquido >= 0 ? 'A receber' : 'A pagar'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Extrato de Transações Vinculadas
          </CardTitle>
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
                          {formatDateForDisplay(transaction.date)}
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
                        onClick={() => handlePayDebt(transaction.id)}
                        className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Pagar
                      </Button>
                    )}
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
