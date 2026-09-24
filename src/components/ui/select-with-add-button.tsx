import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Plus, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
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
import { useLimit } from "@/hooks/use-feature";
import { useNavigate } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";

export interface SelectWithAddButtonProps {
  entityType: 'accounts' | 'categories' | 'creditCards' | 'people';
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  /** id do trigger, para associar um <Label htmlFor>. */
  id?: string;
  /** Erro de validação: borda vermelha e descrição do erro no trigger. */
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

const ADD_LABELS: Record<SelectWithAddButtonProps["entityType"], string> = {
  accounts: "Adicionar conta",
  categories: "Adicionar categoria",
  creditCards: "Adicionar cartão",
  people: "Adicionar pessoa",
};

const EntityForms = {
  accounts: ({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: (id: string) => void }) => {
    const [name, setName] = React.useState("");
    const [type, setType] = React.useState("Corrente");
    const [initialBalance, setInitialBalance] = React.useState(0);
    const [color, setColor] = React.useState("#4f46e5");
    const [nameError, setNameError] = React.useState<string | undefined>();
    const { createAccount } = useAccounts();
    const queryClient = useQueryClient();

    const onSubmit = async () => {
      if (!name.trim()) {
        setNameError("Dê um nome à conta.");
        document.getElementById("quick-account-name")?.focus();
        return;
      }
      const t = toast({ title: "Salvando…", duration: 2000 });
      try {
        const newAccount = await createAccount({ name, type, initial_balance: initialBalance, color });
        t.update({ title: "Conta salva", duration: 2000 });
        onOpenChange(false);
        setName("");
        setType("Corrente");
        setInitialBalance(0);
        setColor("#4f46e5");
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["balances"] });
        onSuccess(newAccount.id);
      } catch (e) {
        t.update({ title: "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
      }
    };

    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conta</DialogTitle>
          <DialogDescription className="sr-only">Informe nome e tipo da nova conta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick-account-name">Nome</Label>
            <Input
              id="quick-account-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
              placeholder="Conta corrente"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "quick-account-name-error" : undefined}
            />
            {nameError && (
              <p id="quick-account-name-error" className="text-xs text-destructive" role="alert">
                {nameError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-account-type">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="quick-account-type">
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
            <Label htmlFor="quick-account-balance">Saldo inicial</Label>
            <NumericInput
              id="quick-account-balance"
              currency
              value={initialBalance}
              onChange={setInitialBalance}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    );
  },

  categories: ({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: (id: string) => void }) => {
    const [name, setName] = React.useState("");
    const [categoryType, setCategoryType] = React.useState<"income" | "expense">("expense");
    const [icon, setIcon] = React.useState("");
    const [nameError, setNameError] = React.useState<string | undefined>();
    const { createCategory } = useCategories();
    const queryClient = useQueryClient();

    const onSubmit = async () => {
      if (!name.trim()) {
        setNameError("Dê um nome à categoria.");
        document.getElementById("quick-category-name")?.focus();
        return;
      }
      const t = toast({ title: "Salvando…", duration: 2000 });
      try {
        const newCategory = await createCategory({ name, category_type: categoryType, icon });
        t.update({ title: "Categoria salva", duration: 2000 });
        onOpenChange(false);
        setName("");
        setCategoryType("expense");
        setIcon("");
        queryClient.invalidateQueries({ queryKey: ["categories"] });
        onSuccess(newCategory.id);
      } catch (e) {
        t.update({ title: "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
      }
    };

    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
          <DialogDescription className="sr-only">Informe nome e tipo da nova categoria.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick-category-name">Nome</Label>
            <Input
              id="quick-category-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
              placeholder="Mercado"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "quick-category-name-error" : undefined}
            />
            {nameError && (
              <p id="quick-category-name-error" className="text-xs text-destructive" role="alert">
                {nameError}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick-category-type">Tipo</Label>
              <Select value={categoryType} onValueChange={(value: "income" | "expense") => setCategoryType(value)}>
                <SelectTrigger id="quick-category-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Gasto</SelectItem>
                  <SelectItem value="income">Ganho</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ícone (opcional)</Label>
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

  creditCards: ({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: (id: string) => void }) => {
    const { accountsWithBalance } = useAccounts();

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

    const accountSelector = (
      <Select>
        <SelectTrigger id="connected_account">
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
          <DialogTitle>Novo cartão</DialogTitle>
          <DialogDescription className="sr-only">Informe os dados do novo cartão de crédito.</DialogDescription>
        </DialogHeader>
        <CreditCardForm
          onSuccess={(id) => {
            onOpenChange(false);
            onSuccess(id);
          }}
          showFooter={true}
          accountSelector={accountSelector}
        />
      </DialogContent>
    );
  },

  people: ({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: (id: string) => void }) => {
    const [name, setName] = React.useState("");
    const [nameError, setNameError] = React.useState<string | undefined>();
    const { createPerson } = usePeople();
    const queryClient = useQueryClient();

    const onSubmit = async () => {
      if (!name.trim()) {
        setNameError("Dê um nome à pessoa.");
        document.getElementById("quick-person-name")?.focus();
        return;
      }
      const t = toast({ title: "Salvando…", duration: 2000 });
      try {
        const newPerson = await createPerson({ name });
        t.update({ title: "Pessoa salva", duration: 2000 });
        onOpenChange(false);
        setName("");
        queryClient.invalidateQueries({ queryKey: ["people"] });
        onSuccess(newPerson.id);
      } catch (e: any) {
        t.update({ title: "Não foi possível salvar", description: e?.message, duration: 3000, variant: "destructive" as any });
      }
    };

    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pessoa</DialogTitle>
          <DialogDescription className="sr-only">Informe o nome da nova pessoa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick-person-name">Nome da pessoa</Label>
            <Input
              id="quick-person-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
              placeholder="Ex: Filho João, Esposa Maria"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "quick-person-name-error" : undefined}
            />
            {nameError && (
              <p id="quick-person-name-error" className="text-xs text-destructive" role="alert">
                {nameError}
              </p>
            )}
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
  disabled,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const listboxId = React.useId();
  const navigate = useNavigate();

  // Buscar dados para verificar limites
  const { accountsWithBalance } = useAccounts();
  const { categories } = useCategories();
  const { people } = usePeople();

  // Verificar limites baseado no tipo de entidade
  const getLimitInfo = () => {
    switch (entityType) {
      case 'accounts':
        return { limit: 'max_contas', currentValue: accountsWithBalance?.length || 0, resourceName: 'contas' };
      case 'categories':
        const userCategories = categories?.filter(c => !c.is_system).length || 0;
        return { limit: 'max_categorias', currentValue: userCategories, resourceName: 'categorias' };
      case 'people':
        return { limit: 'max_pessoas', currentValue: people?.length || 0, resourceName: 'pessoas' };
      default:
        return null;
    }
  };

  const limitInfo = getLimitInfo();
  const { canUse } = useLimit(limitInfo?.limit || '', limitInfo?.currentValue || 0);

  const onSuccess = (id: string) => {
    setRefreshTrigger(prev => prev + 1);
    // Selecionar automaticamente a entidade recém-criada
    if (onValueChange) {
      onValueChange(id);
    }
  };

  // Adiciona event listeners para scroll
  React.useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      scrollArea.scrollTop += e.deltaY;
    };

    let startY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const currentY = e.touches[0].clientY;
      const deltaY = startY - currentY;
      scrollArea.scrollTop += deltaY;
      startY = currentY;
    };

    scrollArea.addEventListener('wheel', handleWheel, { passive: false });
    scrollArea.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollArea.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      scrollArea.removeEventListener('wheel', handleWheel);
      scrollArea.removeEventListener('touchstart', handleTouchStart);
      scrollArea.removeEventListener('touchmove', handleTouchMove);
    };
  }, [open]); // Re-executa quando o popover abre

  const EntityFormComponent = EntityForms[entityType];

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Verificar limite antes de abrir dialog (apenas para entidades com limite)
    if (limitInfo && !canUse) {
      toast({
        variant: "destructive",
        duration: 6000,
        title: (
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span>Limite atingido</span>
          </div>
        ) as any,
        description: (
          <div className="space-y-3">
            <p>Você atingiu o limite de <strong>{limitInfo.resourceName}</strong> do seu plano.</p>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => navigate('/pricing')}
              className="w-full"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Ver planos e fazer upgrade
            </Button>
          </div>
        ) as any,
      });
      return;
    }
    
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

  // Filtra os itens baseado no termo de busca
  const filteredItems = React.useMemo(() => {
    if (!searchTerm.trim()) return commandItems;
    return commandItems.filter(item => 
      item.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [commandItems, searchTerm]);

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          setSearchTerm("");
        }
      }}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-invalid={ariaInvalid || undefined}
            aria-describedby={ariaDescribedBy}
            className="w-full justify-between border border-input pr-12 aria-[invalid=true]:border-destructive"
            disabled={disabled}
          >
            <span className="truncate">
              {value && valueTextMap[value] ? valueTextMap[value] : placeholder}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start" role="presentation">
          <div className="border-b p-2">
            <Input
              placeholder="Buscar…"
              aria-label="Buscar na lista"
              className="h-11 md:h-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div 
            ref={scrollAreaRef}
            className="max-h-[300px] overflow-y-auto overflow-x-hidden"
            style={{ scrollbarWidth: 'thin' }}
          >
            {filteredItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum item encontrado.
              </div>
            ) : (
              <div id={listboxId} className="p-1" role="listbox">
                {filteredItems.map((item) => (
                  <div
                    key={item.value}
                    role="option"
                    aria-selected={value === item.value}
                    className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      onValueChange?.(item.value === value ? "" : item.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Botão de adicionar */}
      <button
        type="button"
        // Alvo de toque de 44px no mobile (mesma altura do trigger h-11); md: volta à densidade de mouse.
        className="absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 ease-swift hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 md:right-1 md:h-8 md:w-8 md:rounded-md"
        onClick={handleAddClick}
        disabled={disabled}
        aria-label={ADD_LABELS[entityType]}
      >
        <Plus className="h-4 w-4 md:h-3.5 md:w-3.5" aria-hidden />
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
