import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatCurrencyBRL, getCurrentDateString } from "@/lib/utils";
import { Plus, Trash2, Calendar, DollarSign, CheckCircle, BanknoteXIcon } from "lucide-react";

interface Installment {
  id: string;
  value: number;
  date: string;
  status: 'PAID' | 'PENDING';
  installment_number: number;
  isEdited?: boolean; // Nova propriedade para controlar se foi editada manualmente
}

interface InstallmentFormProps {
  totalValue: number;
  installments: number;
  startDate: string;
  description: string;
  onInstallmentsChange: (installments: Installment[]) => void;
  onTotalValueChange: (totalValue: number) => void;
  disabled?: boolean;
  initialInstallments?: Installment[]; // Nova prop para dados iniciais
}

export function InstallmentForm({
  totalValue,
  installments,
  startDate,
  description,
  onInstallmentsChange,
  onTotalValueChange,
  disabled = false,
  initialInstallments = []
}: InstallmentFormProps) {
  const [installmentsList, setInstallmentsList] = useState<Installment[]>(initialInstallments);
  const [isGenerated, setIsGenerated] = useState(initialInstallments.length > 0);

  // Calcular valor médio das parcelas
  const averageValue = useMemo(() => {
    if (installments <= 0) return 0;
    return totalValue / installments;
  }, [totalValue, installments]);

  // Calcular valor total atual baseado nas parcelas
  const currentTotalValue = useMemo(() => {
    return installmentsList.reduce((sum, installment) => sum + installment.value, 0);
  }, [installmentsList]);

  // Gerar parcelas iniciais
  const generateInstallments = () => {
    if (installments <= 0) return;

    const newInstallments: Installment[] = [];
    const startDateObj = new Date(startDate);

    for (let i = 0; i < installments; i++) {
      const installmentDate = new Date(startDateObj);
      installmentDate.setMonth(installmentDate.getMonth() + i);

      newInstallments.push({
        id: `installment-${i}`,
        value: averageValue,
        date: installmentDate.toISOString().slice(0, 10),
        status: i === 0 ? 'PAID' : 'PENDING',
        installment_number: i + 1
      });
    }

    setInstallmentsList(newInstallments);
    setIsGenerated(true);
    onInstallmentsChange(newInstallments);
  };

  // Atualizar valor de uma parcela específica (com redistribuição automática)
  const updateInstallmentValue = (id: string, newValue: number) => {
    // Marcar a parcela como editada
    const updatedInstallments = installmentsList.map(installment =>
      installment.id === id 
        ? { ...installment, value: newValue, isEdited: true } 
        : installment
    );

    // Calcular valor total das parcelas editadas
    const editedInstallments = updatedInstallments.filter(i => i.isEdited);
    const editedTotal = editedInstallments.reduce((sum, i) => sum + i.value, 0);

    // Calcular valor disponível para parcelas não editadas
    const nonEditedInstallments = updatedInstallments.filter(i => !i.isEdited);
    const availableValue = totalValue - editedTotal;

    // Redistribuir valor entre parcelas não editadas
    if (nonEditedInstallments.length > 0) {
      const newValue = availableValue / nonEditedInstallments.length;
      
      const finalInstallments = updatedInstallments.map(installment => {
        if (installment.isEdited) {
          return installment;
        }
        return {
          ...installment,
          value: newValue
        };
      });

      setInstallmentsList(finalInstallments);
      onInstallmentsChange(finalInstallments);
    } else {
      setInstallmentsList(updatedInstallments);
      onInstallmentsChange(updatedInstallments);
    }
  };

  // Atualizar data de uma parcela específica
  const updateInstallmentDate = (id: string, date: string) => {
    const updatedInstallments = installmentsList.map(installment =>
      installment.id === id ? { ...installment, date } : installment
    );
    
    setInstallmentsList(updatedInstallments);
    onInstallmentsChange(updatedInstallments);
  };

  // Atualizar status de uma parcela específica
  const updateInstallmentStatus = (id: string, status: 'PAID' | 'PENDING') => {
    const updatedInstallments = installmentsList.map(installment =>
      installment.id === id ? { ...installment, status } : installment
    );
    
    setInstallmentsList(updatedInstallments);
    onInstallmentsChange(updatedInstallments);
  };

  // Remover uma parcela preservando parcelas editadas
  const removeInstallment = (id: string) => {
    const updatedInstallments = installmentsList.filter(installment => installment.id !== id);
    
    // Reordenar números das parcelas
    const reorderedInstallments = updatedInstallments.map((installment, index) => ({
      ...installment,
      installment_number: index + 1
    }));
    
    // Redistribuir apenas se há parcelas restantes
    if (reorderedInstallments.length > 0) {
      // Calcular valor total das parcelas editadas
      const editedInstallments = reorderedInstallments.filter(i => i.isEdited);
      const editedTotal = editedInstallments.reduce((sum, i) => sum + i.value, 0);
      
      // Calcular valor disponível para as parcelas não editadas
      const nonEditedInstallments = reorderedInstallments.filter(i => !i.isEdited);
      
      if (nonEditedInstallments.length > 0) {
        const availableValue = totalValue - editedTotal;
        const newValue = availableValue / nonEditedInstallments.length;

        // Encontrar a última parcela editada para usar como referência de data
        let lastEditedDate = new Date(startDate);
        let lastEditedIndex = -1;
        
        // Percorrer da primeira até a última parcela editada
        for (let i = 0; i < reorderedInstallments.length; i++) {
          if (reorderedInstallments[i].isEdited) {
            lastEditedDate = new Date(reorderedInstallments[i].date);
            lastEditedIndex = i;
          }
        }

        const finalInstallments = reorderedInstallments.map((installment, index) => {
          // Manter parcelas editadas inalteradas (valor e data)
          if (installment.isEdited) {
            return installment;
          }
          
          // Para parcelas não editadas após a última editada, recalcular data sequencialmente
          if (index > lastEditedIndex) {
            const monthsFromLastEdited = index - lastEditedIndex;
            const newDate = new Date(lastEditedDate);
            newDate.setMonth(newDate.getMonth() + monthsFromLastEdited);
            
            return {
              ...installment,
              value: newValue,
              date: newDate.toISOString().slice(0, 10)
            };
          }
          
          // Para parcelas não editadas antes da última editada, manter data original
          return {
            ...installment,
            value: newValue
          };
        });
        
        setInstallmentsList(finalInstallments);
        onInstallmentsChange(finalInstallments);
      } else {
        // Se todas as parcelas restantes são editadas, manter como estão
        setInstallmentsList(reorderedInstallments);
        onInstallmentsChange(reorderedInstallments);
      }
    } else {
      setInstallmentsList(reorderedInstallments);
      onInstallmentsChange(reorderedInstallments);
    }
  };

  // Adicionar nova parcela preservando parcelas editadas
  const addInstallment = () => {
    const lastInstallment = installmentsList[installmentsList.length - 1];
    const lastDate = new Date(lastInstallment.date);
    const nextDate = new Date(lastDate);
    nextDate.setMonth(nextDate.getMonth() + 1);

    // Calcular valor total das parcelas editadas
    const editedInstallments = installmentsList.filter(i => i.isEdited);
    const editedTotal = editedInstallments.reduce((sum, i) => sum + i.value, 0);
    
    // Calcular valor disponível para as parcelas não editadas + nova parcela
    const nonEditedInstallments = installmentsList.filter(i => !i.isEdited);
    const availableValue = totalValue - editedTotal;
    const newValue = availableValue / (nonEditedInstallments.length + 1);

    const newInstallment: Installment = {
      id: `installment-${Date.now()}`,
      value: newValue,
      date: nextDate.toISOString().slice(0, 10),
      status: 'PENDING',
      installment_number: installmentsList.length + 1,
      isEdited: false
    };

    const updatedInstallments = installmentsList.map(installment => {
      // Manter parcelas editadas inalteradas
      if (installment.isEdited) {
        return installment;
      }
      // Redistribuir apenas parcelas não editadas
      return {
        ...installment,
        value: newValue
      };
    });

    // Adicionar nova parcela
    updatedInstallments.push(newInstallment);
    
    setInstallmentsList(updatedInstallments);
    onInstallmentsChange(updatedInstallments);
  };

  // Redistribuir valores igualmente baseado no valor total fixo
  const redistributeValues = () => {
    const newValue = totalValue / installmentsList.length;
    const updatedInstallments = installmentsList.map(installment => ({
      ...installment,
      value: newValue,
      isEdited: false // Limpar estado de editado
    }));
    
    setInstallmentsList(updatedInstallments);
    onInstallmentsChange(updatedInstallments);
  };

  // Atualizar valor total quando as parcelas mudam
  useEffect(() => {
    onTotalValueChange(currentTotalValue);
  }, [currentTotalValue, onTotalValueChange]);

  // Reset quando os parâmetros mudam (apenas se não há dados iniciais)
  useEffect(() => {
    if (!isGenerated && initialInstallments.length === 0) {
      generateInstallments();
    }
  }, [totalValue, installments, startDate]);

  return (
    <div className="space-y-3">
      {/* Cabeçalho com controles */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Parcelas da Transação</h3>
          <p className="text-xs text-muted-foreground">
            {description} - {installmentsList.length} parcela{installmentsList.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={redistributeValues}
            disabled={disabled || installmentsList.length === 0}
            className="h-7 px-2 text-xs"
          >
            <DollarSign className="h-3 w-3 mr-1" />
            Redistribuir
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addInstallment}
            disabled={disabled}
            className="h-7 px-2 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Resumo do valor total fixo */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Valor Total Fixo
              </span>
              <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                Manual
              </span>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-blue-600">
                {formatCurrencyBRL(totalValue)}
              </div>
              <div className="text-xs text-blue-600">
                {formatCurrencyBRL(totalValue / installmentsList.length)} por parcela
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de parcelas - Layout ultra compacto */}
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {installmentsList.map((installment, index) => (
          <Card key={installment.id} className={`border-l-4 ${installment.isEdited ? 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/10' : 'border-l-blue-500'}`}>
            <CardContent className="p-2">
              {/* Cabeçalho ultra compacto */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                    {installment.installment_number}
                  </Badge>
                  {installment.isEdited && (
                    <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">
                      Editada
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={installment.status === 'PAID'}
                      onCheckedChange={(checked) => 
                        updateInstallmentStatus(installment.id, checked ? 'PAID' : 'PENDING')
                      }
                      disabled={disabled}
                      className="scale-75"
                    />
                    {installment.status === 'PAID' ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <BanknoteXIcon className="h-3 w-3 text-yellow-500" />
                    )}
                    <span className="text-xs font-medium">
                      {installment.status === 'PAID' ? 'Paga' : 'Pendente'}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeInstallment(installment.id)}
                  disabled={disabled || installmentsList.length <= 1}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {/* Campos em linha ultra compacta */}
              <div className="grid grid-cols-2 gap-1">
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <NumericInput
                    currency
                    value={installment.value}
                    onChange={(value) => updateInstallmentValue(installment.id, value)}
                    placeholder="0,00"
                    className="h-7 text-xs"
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">Vencimento</Label>
                  <div className="relative">
                    <Calendar className="absolute left-1.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      type="date"
                      value={installment.date}
                      onChange={(e) => updateInstallmentDate(installment.id, e.target.value)}
                      className="h-7 pl-6 text-xs"
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resumo Final - Estilo consistente */}
      {installmentsList.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Resumo das Parcelas
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-blue-100 dark:border-blue-800">
                <div className="text-lg font-bold text-green-600">
                  {installmentsList.filter(i => i.status === 'PAID').length}
                </div>
                <div className="text-xs text-muted-foreground">Pagas</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-blue-100 dark:border-blue-800">
                <div className="text-lg font-bold text-yellow-600">
                  {installmentsList.filter(i => i.status === 'PENDING').length}
                </div>
                <div className="text-xs text-muted-foreground">Pendentes</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-blue-100 dark:border-blue-800">
                <div className="text-lg font-bold text-blue-600">
                  {formatCurrencyBRL(installmentsList.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.value, 0))}
                </div>
                <div className="text-xs text-muted-foreground">Valor Pago</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-blue-100 dark:border-blue-800">
                <div className="text-lg font-bold text-orange-600">
                  {formatCurrencyBRL(installmentsList.filter(i => i.status === 'PENDING').reduce((sum, i) => sum + i.value, 0))}
                </div>
                <div className="text-xs text-muted-foreground">Valor Pendente</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
