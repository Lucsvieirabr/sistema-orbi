import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompositionItem } from "@/components/ui/composition-dialog";
import { Receipt } from "lucide-react";

interface CompositionViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CompositionItem[];
}

export function CompositionViewDialog({
  open,
  onOpenChange,
  items,
}: CompositionViewDialogProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-600" />
            <DialogTitle>Detalhes da Composição</DialogTitle>
          </div>
          <DialogDescription>
            Itens que compõem este rateio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {items.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhum item de composição registrado
            </div>
          ) : (
            <>
              {/* Lista de itens */}
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        {item.totalValue ? (
                          // Transação parte: mostra valor individual / valor total
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-green-600">
                              R$ {item.value.toFixed(2)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              de R$ {item.totalValue.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          // Transação total: mostra apenas o valor
                          <span className="text-sm font-medium text-green-600">
                            R$ {item.value.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm truncate">{item.description}</div>
                      <div className="text-sm text-muted-foreground text-right">
                        {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Total dos Itens:
                  </span>
                  <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                    R$ {total.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

