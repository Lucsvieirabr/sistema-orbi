import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface RecurringTransactionFormProps {
  isFixed: boolean;
  onIsFixedChange: (checked: boolean) => void;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  onFrequencyChange: (frequency: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
}

export function RecurringTransactionForm({
  isFixed,
  onIsFixedChange,
  frequency,
  onFrequencyChange,
  endDate,
  onEndDateChange,
}: RecurringTransactionFormProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm">Configurações</Label>
      <div className="flex items-center justify-start space-x-6 py-2 pl-0">
        <div className="flex items-center space-x-2">
          <Switch checked={isFixed} onCheckedChange={onIsFixedChange} />
          <Label className="text-sm">Recorrente</Label>
        </div>
      </div>

      {/* Campos adicionais para transações recorrentes */}
      {isFixed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
          <div className="space-y-1">
            <Label className="text-sm">Frequência</Label>
            <Select value={frequency} onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'yearly') => onFrequencyChange(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diária</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Data Final (opcional)</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              placeholder="Sem limite"
            />
          </div>
        </div>
      )}
    </div>
  );
}
