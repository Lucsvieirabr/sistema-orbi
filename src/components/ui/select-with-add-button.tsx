import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Plus, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { ColorPicker } from "@/components/ui/color-picker";
import { IconSelector } from "@/components/ui/icon-selector";
import { CreditCardForm } from "@/components/ui/credit-card-form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { usePeople } from "@/hooks/use-people";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export interface SelectWithAddButtonProps {
  entityType: 'accounts' | 'categories' | 'creditCards' | 'people';
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

const EntityForms = {
  accounts: ({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) => {
    const [name, setName] = React.useState("");
    const [type, setType] = React.useState("Corrente");
    const [initialBalance, setInitialBalance] = React.useState(0);
    const [color, setColor] = React.useState("#4f46e5");
    const { createAccount } = useAccounts();
    const queryClient = useQueryClient();

    const onSubmit = async () => {
      if (!name.trim()) return;
      const t = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
      try {
        await createAccount({ name, type, initial_balance: initialBalance, color });
        t.update({ title: "Sucesso", description: "Conta salva", duration: 2000 });
        onOpenChange(false);
        setName("");
        setType("Corrente");
        setInitialBalance(0);
        setColor("#4f46e5");
        onSuccess();
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["balances"] });
      } catch (e) {
        t.update({ title: "Erro", description: "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
      }
    };

    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Conta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Corrente">Corrente</SelectItem>
                <SelectItem value="Poupança">Poupança</SelectItem>
                <SelectItem value="Investimento">Investimento</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="initial_balance">Saldo Inicial</Label>
            <NumericInput
              id="initial_balance"
              currency
              value={initialBalance}
              onChange={setInitialBalance}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Cor</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    );
  },

  categories: ({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) => {
    const [name, setName] = React.useState("");
    const [categoryType, setCategoryType] = React.useState<"income" | "expense">("expense");
    const [icon, setIcon] = React.useState("");
    const { createCategory } = useCategories();
    const queryClient = useQueryClient();

    const onSubmit = async () => {
      if (!name.trim()) return;
      const t = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
      try {
        await createCategory({ name, category_type: categoryType, icon });
        t.update({ title: "Sucesso", description: "Categoria salva", duration: 2000 });
        onOpenChange(false);
        setName("");
        setCategoryType("expense");
        setIcon("");
        onSuccess();
        queryClient.invalidateQueries({ queryKey: ["categories"] });
      } catch (e) {
        t.update({ title: "Erro", description: "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
      }
    };

    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Categoria</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoryType">Tipo</Label>
              <Select value={categoryType} onValueChange={(value: "income" | "expense") => setCategoryType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Gasto</SelectItem>
                  <SelectItem value="income">Ganho</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Ícone (opcional)</Label>
              <IconSelector
                value={icon}
                onChange={setIcon}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    );
  },

  creditCards: ({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) => {
    const { accountsWithBalance } = useAccounts();

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

    const accountSelector = (
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Selecione uma conta" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhuma conta</SelectItem>
          {accountsWithBalance.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name} - {formatCurrency(account.current_balance ?? 0)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

    return (
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Cartão</DialogTitle>
        </DialogHeader>
        <CreditCardForm
          onSuccess={() => {
            onOpenChange(false);
            onSuccess();
          }}
          showFooter={true}
          accountSelector={accountSelector}
        />
      </DialogContent>
    );
  },

  people: ({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) => {
    const [name, setName] = React.useState("");
    const { createPerson } = usePeople();
    const queryClient = useQueryClient();

    const onSubmit = async () => {
      if (!name.trim()) return;
      const t = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
      try {
        await createPerson({ name });
        t.update({ title: "Sucesso", description: "Pessoa salva", duration: 2000 });
        onOpenChange(false);
        setName("");
        onSuccess();
        queryClient.invalidateQueries({ queryKey: ["people"] });
      } catch (e: any) {
        t.update({ title: "Erro", description: e.message || "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
      }
    };

    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Pessoa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Pessoa</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Filho João, Esposa Maria" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    );
  }
};

export const SelectWithAddButton: React.FC<SelectWithAddButtonProps> = ({
  entityType,
  value,
  onValueChange,
  placeholder,
  children,
  disabled
}) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  const onSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const EntityFormComponent = EntityForms[entityType];

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDialogOpen(true);
  };

  // Cria um mapeamento de valor -> texto para o SelectValue
  const valueTextMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === SelectItem) {
        map[child.props.value] = child.props.children as string;
      }
    });
    return map;
  }, [children]);

  // Converte children para formato Command
  const commandItems = React.useMemo(() => {
    return React.Children.toArray(children).map((child) => {
      if (React.isValidElement(child) && child.type === SelectItem) {
        return {
          value: child.props.value,
          label: child.props.children as string,
        };
      }
      return null;
    }).filter(Boolean);
  }, [children]);

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between pr-12 border border-input"
            disabled={disabled}
          >
            <span className="truncate">
              {value && valueTextMap[value] ? valueTextMap[value] : placeholder}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar..." />
            <ScrollArea className="max-h-[300px]">
              <CommandList>
                <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                <CommandGroup>
                  {commandItems.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={item.label}
                      onSelect={(currentValue) => {
                        const selectedItem = commandItems.find(item => item.label === currentValue);
                        if (selectedItem) {
                          onValueChange?.(selectedItem.value === value ? "" : selectedItem.value);
                          setOpen(false);
                        }
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === item.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </ScrollArea>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Botão de adicionar */}
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-sm hover:bg-muted cursor-pointer z-10"
        onClick={handleAddClick}
        disabled={disabled}
      >
        <Plus className="h-3 w-3" />
      </button>

      {/* Dialog separado */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <EntityFormComponent
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={onSuccess}
        />
      </Dialog>
    </div>
  );
};
