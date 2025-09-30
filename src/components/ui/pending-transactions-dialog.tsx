import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyBRL } from "@/lib/utils";
import { CheckCircle, Clock, Edit, Trash2, TrendingUp, TrendingDown, Calendar, CreditCard, User, AlertTriangle } from "lucide-react";

interface Transaction {
  id: string;
  description: string;
  value: number;
  date: string;
  type: string;
  status: string;
  account_id?: string;
  credit_card_id?: string;
  category_id?: string;
  person_id?: string;
  installment_number?: number;
  installments?: number;
  accounts?: { name: string };
  categories?: { name: string };
  credit_cards?: { name: string };
  people?: { name: string };
}

interface PendingTransactionsDialogProps {
  transactions: Transaction[];
  title: string;
  type: 'income' | 'expense';
  onMarkAsPaid: (id: string) => void;
  onMarkAsPending: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
}

export function PendingTransactionsDialog({
  transactions,
  title,
  type,
  onMarkAsPaid,
  onMarkAsPending,
  onEdit,
  onDelete,
  isOpen,
  onOpenChange,
  trigger
}: PendingTransactionsDialogProps) {
  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.type === 'transfer') {
      return <TrendingUp className="h-4 w-4 text-blue-500" />;
    }
    return transaction.type === 'income' ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getAccountName = (transaction: Transaction) => {
    if (transaction.account_id && transaction.accounts?.name) {
      return transaction.accounts.name;
    }
    if (transaction.credit_card_id && transaction.credit_cards?.name) {
      return transaction.credit_cards.name;
    }
    return 'N/A';
  };

  const getTotalValue = () => {
    return transactions.reduce((sum, t) => sum + t.value, 0);
  };

  const isOverdue = (transaction: Transaction) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(transaction.date) < today;
  };

  const overdueTransactionsCount = transactions.filter(isOverdue).length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'income' ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            {title}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{transactions.length} transações pendentes</span>
            {overdueTransactionsCount > 0 && (
              <Badge variant="destructive" className="font-semibold">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {overdueTransactionsCount} vencida{overdueTransactionsCount > 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="outline" className="font-semibold">
              Total: {formatCurrencyBRL(getTotalValue())}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma transação pendente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <Card key={transaction.id} className={`p-4 ${isOverdue(transaction) ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {getTransactionIcon(transaction)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{transaction.description}</span>
                          {isOverdue(transaction) && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Vencida
                            </Badge>
                          )}
                          {transaction.installment_number && transaction.installments && transaction.installments > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              {transaction.installment_number}/{transaction.installments}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(transaction.date).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {transaction.account_id ? (
                              <CreditCard className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                            <span>{getAccountName(transaction)}</span>
                          </div>
                          {transaction.categories?.name && (
                            <span>• {transaction.categories.name}</span>
                          )}
                          {transaction.people?.name && (
                            <span>• {transaction.people.name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right mr-3">
                        <div className={`font-semibold ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrencyBRL(transaction.value)}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(transaction.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDelete(transaction.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>

                      {transaction.status === 'PENDING' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarkAsPaid(transaction.id)}
                          className="h-8 px-3 text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Marcar Pago
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarkAsPending(transaction.id)}
                          className="h-8 px-3 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Marcar Pendente
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
