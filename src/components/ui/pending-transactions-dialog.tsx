import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyBRL, formatDateForDisplay, getCurrentDateString } from "@/lib/utils";
import { CheckCircle, BanknoteXIcon, Edit, Trash2, TrendingUp, TrendingDown, Calendar, CreditCard, User, AlertTriangle } from "lucide-react";

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
  installmentNumber?: number;
  totalInstallments?: number;
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
      return <TrendingUp className="h-4 w-4 text-primary" />;
    }
    return transaction.type === 'income' ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />;
  };

  const getAccountName = (transaction: Transaction) => {
    if (transaction.account_id && transaction.accounts?.name) {
      return transaction.accounts.name;
    }
    if (transaction.credit_card_id && transaction.credit_cards?.name) {
      return transaction.credit_cards.name;
    }
    // Conta/cartão do parceiro não é legível (RLS) e conta excluída zera o vínculo.
    if (transaction.credit_card_id) return 'Cartão privado';
    if (transaction.account_id) return 'Conta privada';
    return 'Sem conta';
  };

  const getTotalValue = () => {
    return transactions.reduce((sum, t) => sum + t.value, 0);
  };

  // Comparação de chave YYYY-MM-DD no dia local (new Date("YYYY-MM-DD") é UTC
  // e marcava como vencido o que vence hoje).
  const isOverdue = (transaction: Transaction) => transaction.date.slice(0, 10) < getCurrentDateString();

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
              <TrendingUp className="h-5 w-5 text-success" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">Lista de transações pendentes para confirmar.</DialogDescription>
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
                <Card key={transaction.id} className={`p-4 ${isOverdue(transaction) ? 'border-destructive/30 bg-destructive-soft/50' : ''}`}>
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
                          {transaction.installmentNumber && transaction.totalInstallments && transaction.totalInstallments > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              {transaction.installmentNumber}/{transaction.totalInstallments}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDateForDisplay(transaction.date)}</span>
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
                          transaction.type === 'income' ? 'text-success' : 'text-destructive'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrencyBRL(transaction.value)}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(transaction.id)}
                        aria-label={`Editar ${transaction.description}`}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDelete(transaction.id)}
                        aria-label={`Excluir ${transaction.description}`}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive-soft"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>

                      {transaction.status === 'PENDING' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarkAsPaid(transaction.id)}
                          className="h-8 px-3 text-success hover:text-success hover:bg-success-soft"
                        >
                          <CheckCircle className="mr-1 h-3 w-3" aria-hidden />
                          {type === 'income' ? 'Marcar recebida' : 'Marcar paga'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarkAsPending(transaction.id)}
                          className="h-8 px-3 text-warning hover:text-warning hover:bg-warning-soft"
                        >
                          <BanknoteXIcon className="h-3 w-3 mr-1" />
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
