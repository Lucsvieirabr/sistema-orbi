import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getMinAllowedDate, getMaxAllowedDate } from "@/lib/utils";

export interface CompositionItem {
  value: number;
  description: string;
  date: string;
  totalValue?: number; // Valor total do item (usado em transações parte para mostrar valor individual/total)
}

interface CompositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (items: CompositionItem[], total: number) => void;
  initialItems?: CompositionItem[];
}

export function CompositionDialog({
  open,
  onOpenChange,
  onSave,
  initialItems = [],
}: CompositionDialogProps) {
  const [items, setItems] = useState<CompositionItem[]>(initialItems);
  const [currentItem, setCurrentItem] = useState<Partial<CompositionItem>>({
    value: 0,
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (open) {
      // Quando abre o dialog, sincroniza com os itens iniciais
      setItems(initialItems);
      setCurrentItem({
        value: 0,
        description: "",
        date: new Date().toISOString().split("T")[0],
      });
    }
  }, [open, initialItems]);

  const itemsTotal = items.reduce((sum, item) => sum + item.value, 0);

  const handleAddItem = () => {
    if (!currentItem.description?.trim()) {
      toast({
        title: "Erro",
        description: "A descrição é obrigatória",
        variant: "destructive" as any,
      });
      return;
    }

    if (!currentItem.value || currentItem.value <= 0) {
      toast({
        title: "Erro",
        description: "O valor deve ser maior que zero",
        variant: "destructive" as any,
      });
      return;
    }

    setItems([...items, currentItem as CompositionItem]);
    setCurrentItem({
      value: 0,
      description: "",
      date: new Date().toISOString().split("T")[0],
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (items.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um item à composição",
        variant: "destructive" as any,
      });
      return;
    }

    onSave(items, itemsTotal);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setItems(initialItems);
    setCurrentItem({
      value: 0,
      description: "",
      date: new Date().toISOString().split("T")[0],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="pb-2">
          <DialogTitle>Personalizar Rateio</DialogTitle>
          <DialogDescription>
            Adicione os itens que compõem este rateio. O valor total será calculado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Adicionar novo item */}
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <h4 className="text-sm font-medium">Adicionar Item</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="item-value" className="text-xs">Valor (R$)</Label>
                <NumericInput
                  id="item-value"
                  value={currentItem.value || 0}
                  onChange={(value) =>
                    setCurrentItem({ ...currentItem, value })
                  }
                  placeholder="0,00"
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-description" className="text-xs">Descrição</Label>
                <Input
                  id="item-description"
                  value={currentItem.description || ""}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, description: e.target.value })
                  }
                  placeholder="Ex: Coca-Cola"
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-date" className="text-xs">Data</Label>
                <Input
                  id="item-date"
                  type="date"
                  value={currentItem.date || ""}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, date: e.target.value })
                  }
                  min={getMinAllowedDate()}
                  max={getMaxAllowedDate()}
                  className="h-8"
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={handleAddItem}
              size="sm"
              className="w-full h-8"
            >
              <Plus className="h-3 w-3 mr-1" />
              Adicionar Item
            </Button>
          </div>

          {/* Lista de itens adicionados */}
          {items.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Itens Adicionados</h4>
              <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border rounded-lg bg-background"
                  >
                    <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-green-600">
                          R$ {item.value.toFixed(2)}
                        </span>
                      </div>
                      <div className="truncate">{item.description}</div>
                      <div className="text-muted-foreground text-xs">
                        {new Date(item.date).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                      className="ml-2 h-7 w-7 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumo */}
          <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Valor Total do Rateio:
              </span>
              <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                R$ {itemsTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3">
          <Button type="button" variant="outline" onClick={handleCancel} size="sm">
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} size="sm">
            Salvar Composição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

