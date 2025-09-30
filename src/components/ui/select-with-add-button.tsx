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
import { IconRenderer } from "@/components/ui/icon-renderer";
import { toast } from "@/hooks/use-toast";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useCreditCards } from "@/hooks/use-credit-cards";
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
    const [name, setName] = React.useState("");
    const [brand, setBrand] = React.useState("");
    const [limit, setLimit] = React.useState(0);
    const [statementDate, setStatementDate] = React.useState(1);
    const [dueDate, setDueDate] = React.useState(1);
    const [connectedAccountId, setConnectedAccountId] = React.useState<string>("none");
    const { createCreditCard } = useCreditCards();
    const { accountsWithBalance } = useAccounts();
    const queryClient = useQueryClient();

    const onSubmit = async () => {
      if (!name.trim()) return;
      if (limit <= 0) {
        toast({ title: "Erro", description: "O limite deve ser maior que zero", variant: "destructive" });
        return;
      }
      if (statementDate < 1 || statementDate > 31) {
        toast({ title: "Erro", description: "A data de fechamento deve estar entre 1 e 31", variant: "destructive" });
        return;
      }
      if (dueDate < 1 || dueDate > 31) {
        toast({ title: "Erro", description: "A data de vencimento deve estar entre 1 e 31", variant: "destructive" });
        return;
      }

      const payload = {
        name,
        brand: brand || null,
        limit,
        statement_date: statementDate,
        due_date: dueDate,
        connected_account_id: connectedAccountId === "none" ? null : connectedAccountId
      };
      const t = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
      try {
        await createCreditCard(payload);
        t.update({ title: "Sucesso", description: "Cartão salvo", duration: 2000 });
        onOpenChange(false);
        setName("");
        setBrand("");
        setLimit(0);
        setStatementDate(1);
        setDueDate(1);
        setConnectedAccountId("none");
        onSuccess();
        queryClient.invalidateQueries({ queryKey: ["credit_cards"] });
      } catch (e: any) {
        t.update({ title: "Erro", description: e.message || "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
      }
    };

    return (
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Cartão</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Cartão</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Visa Nubank" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand">Bandeira</Label>
            <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: Visa, Mastercard, Elo" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="limit">Limite</Label>
            <NumericInput
              id="limit"
              currency
              value={limit}
              onChange={setLimit}
              placeholder="0,00"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="statement_date">Dia de Fechamento</Label>
              <NumericInput
                id="statement_date"
                value={statementDate}
                onChange={(value) => setStatementDate(value || 1)}
                min={1}
                max={31}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Dia de Vencimento</Label>
              <NumericInput
                id="due_date"
                value={dueDate}
                onChange={(value) => setDueDate(value || 1)}
                min={1}
                max={31}
                placeholder="1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="connected_account">Conta Conectada (Opcional)</Label>
            <Select value={connectedAccountId} onValueChange={setConnectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma conta</SelectItem>
                {accountsWithBalance.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>Salvar</Button>
        </DialogFooter>
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
  >(({ className, children, ...props }, ref) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 relative",
        className,
      )}
      {...props}
    >
      <div className="flex-1 min-w-0 pr-16">
        {children}
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 flex-shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-muted"
          disabled={disabled}
          onClick={handleAddClick}
        >
          <Plus className="h-3 w-3" />
        </Button>
        <ChevronDown className="h-4 w-4 opacity-50 pointer-events-none" />
      </div>
    </SelectPrimitive.Trigger>
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
