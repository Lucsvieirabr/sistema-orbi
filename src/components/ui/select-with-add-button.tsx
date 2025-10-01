import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { ColorPicker } from "@/components/ui/color-picker";
import { IconSelector } from "@/components/ui/icon-selector";
import { CreditCardForm } from "@/components/ui/credit-card-form";
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

  // SelectTrigger personalizado que não inclui o ícone automático
  const CustomSelectTrigger = React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
  >(({ className, children, onClick, ...props }, ref) => (
    <div className="relative">
      <SelectPrimitive.Trigger
        ref={ref}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        onClick={(e) => {
          // Se o clique foi no botão plus, não abrir o select
          if ((e.target as HTMLElement).closest('[data-plus-button]')) {
            return;
          }
          onClick?.(e);
        }}
        {...props}
      >
        <div className="flex-1 min-w-0 pr-16">
          {children}
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 pointer-events-none" />
      </SelectPrimitive.Trigger>
      <button
        type="button"
        data-plus-button
        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-sm hover:bg-muted cursor-pointer z-10"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleAddClick(e);
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  ));

  CustomSelectTrigger.displayName = "CustomSelectTrigger";


  return (
    <div className="relative w-full">
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <CustomSelectTrigger className="w-full pr-12">
          <SelectValue placeholder={placeholder}>
            {value && valueTextMap[value] ? valueTextMap[value] : placeholder}
          </SelectValue>
        </CustomSelectTrigger>
        <SelectContent className="w-full">
          {children}
        </SelectContent>
      </Select>

      {/* Dialog separado, fora do Select */}
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
