import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { IconRenderer } from "@/components/ui/icon-renderer";
import { IconSelector } from "@/components/ui/icon-selector";
import { useCategories } from "@/hooks/use-categories";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus, Tag, Edit, Trash2, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FeaturePageGuard, FeatureGuard, LimitGuard, LimitWarningBanner } from "@/components/guards/FeatureGuard";
import { useFeatures, useLimit } from "@/hooks/use-feature";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { EmptyState, PageBody, PageHeader, PageToolbar, SectionHeader, ToolbarSpacer } from "@/components/ui/page";

export default function Categories() {
  return (
    <FeaturePageGuard feature="categorias">
      <CategoriesContent />
    </FeaturePageGuard>
  );
}

type CategoryDeleteImpact = { transactions: number; budgets: number; contracts: number };

function deleteImpactText(impact: CategoryDeleteImpact | undefined): string {
  if (!impact) return "Verificando o que usa esta categoria…";
  const parts: string[] = [];
  if (impact.transactions > 0)
    parts.push(`${impact.transactions} ${impact.transactions === 1 ? "transação fica" : "transações ficam"} sem categoria`);
  if (impact.budgets > 0)
    parts.push(`${impact.budgets} ${impact.budgets === 1 ? "orçamento será apagado" : "orçamentos serão apagados"}`);
  if (impact.contracts > 0)
    parts.push(`${impact.contracts} ${impact.contracts === 1 ? "contrato de rateio será apagado" : "contratos de rateio serão apagados"}`);
  const summary = parts.length ? `${parts.join("; ")}.` : "Nada usa esta categoria.";
  return `${summary} Não dá para desfazer.`;
}

function CategoriesContent() {
  const queryClient = useQueryClient();
  const { categories, createCategory, updateCategory, deleteCategory, isLoading } = useCategories();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryType, setCategoryType] = useState<"income" | "expense">("expense");
  const [icon, setIcon] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "cards">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const isMobile = useIsMobile();

  // Verificar permissões
  const features = useFeatures(['categorias_criar', 'categorias_editar', 'categorias_excluir']);
  const userCategoriesCount = categories?.filter(c => !c.is_system).length || 0;
  const { canUse: canCreateMore, limit, remaining } = useLimit('max_categorias', userCategoriesCount);

  useEffect(() => {
    const v = (localStorage.getItem("categories:view") as "list" | "cards") || "list";
    setView(v);
  }, []);

  // Forçar view "list" no mobile
  useEffect(() => {
    if (isMobile && view === "cards") {
      setView("list");
    }
  }, [isMobile, view]);

  const onChangeView = (val: string) => {
    const v = (val as "list" | "cards") || "list";
    setView(v);
    localStorage.setItem("categories:view", v);
  };

  const title = useMemo(() => (editingId ? "Editar categoria" : "Nova categoria"), [editingId]);

  const [nameError, setNameError] = useState<string | undefined>();

  const resetForm = () => {
    setNameError(undefined);
    setName("");
    setCategoryType("expense");
    setIcon("");
    setEditingId(null);
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      setNameError("Dê um nome à categoria.");
      return;
    }
    toast({ title: "Salvando…" });
    try {
      if (editingId) {
        await updateCategory(editingId, { name, category_type: categoryType, icon });
      } else {
        await createCategory({ name, category_type: categoryType, icon });
      }
      toast({ title: "Categoria salva" });
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível salvar", variant: "destructive" });
      return;
    }
    setOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const onEdit = (id: string, currentName: string, currentType?: string, currentIcon?: string) => {
    setEditingId(id);
    setName(currentName);
    setCategoryType((currentType as "income" | "expense") || "expense");
    setIcon(currentIcon || "");
    setOpen(true);
  };

  // Impacto real da exclusão, contado quando o diálogo abre. Orçamento e
  // contrato de rateio da categoria são apagados em cascata (FK ON DELETE
  // CASCADE); transações e séries só perdem a categoria.
  const [impact, setImpact] = useState<Record<string, CategoryDeleteImpact | undefined>>({});
  const loadImpact = async (id: string) => {
    setImpact((prev) => ({ ...prev, [id]: undefined }));
    const count = async (table: "transactions" | "budgets" | "split_contracts") => {
      const { count: n, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("category_id", id);
      return error ? 0 : n ?? 0;
    };
    const [transactions, budgets, contracts] = await Promise.all([
      count("transactions"),
      count("budgets"),
      count("split_contracts"),
    ]);
    setImpact((prev) => ({ ...prev, [id]: { transactions, budgets, contracts } }));
  };

  const onDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      toast({ title: "Categoria excluída" });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["split-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-transactions"] });
    } catch (error: any) {
      toast({ 
        title: "Erro", 
        description: error?.message || "Não foi possível excluir a categoria", 
        variant: "destructive" 
      });
    }
  };

  // Filtra categorias por busca
  const filteredCategories = categories?.filter((category) =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.category_type?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const expenseCategories = filteredCategories.filter((c) => c.category_type !== "income");
  const incomeCategories = filteredCategories.filter((c) => c.category_type === "income");

  const categoryDialog = (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Nova categoria
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Preencha os campos abaixo e salve para confirmar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
              placeholder="Mercado"
              required
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "name-error" : undefined}
            />
            {nameError && (
              <p id="name-error" className="text-xs text-destructive">
                {nameError}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoryType">Tipo</Label>
              <Select value={categoryType} onValueChange={(value: "income" | "expense") => setCategoryType(value)}>
                <SelectTrigger id="categoryType">
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
              <IconSelector value={icon} onChange={setIcon} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>Salvar categoria</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const categoryActions = (c: any) =>
    c.is_system ? null : (
      <div className="flex items-center gap-0.5">
        <FeatureGuard feature="categorias_editar">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(c.id, c.name, c.category_type, c.icon)}
            aria-label={`Editar ${c.name}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </FeatureGuard>
        <FeatureGuard feature="categorias_excluir">
          <ConfirmationDialog
            title="Excluir categoria"
            description={deleteImpactText(impact[c.id])}
            confirmText="Excluir categoria"
            onConfirm={() => onDelete(c.id)}
            onOpenChange={(next) => next && loadImpact(c.id)}
            variant="destructive"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Excluir ${c.name}`}
              className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </ConfirmationDialog>
        </FeatureGuard>
      </div>
    );

  /* Glifo da categoria: caixa de 1px, não disco de cor. O tom vem do tipo
     (gasto/ganho), que é a única informação que a cor precisa carregar aqui. */
  const glyph = (c: any) => (
    <span
      aria-hidden
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
        c.category_type === "income"
          ? "border-success/25 bg-success-soft text-success"
          : "border-border-subtle bg-surface-sunken text-muted-foreground",
      )}
    >
      {c.icon ? <IconRenderer iconName={c.icon} className="h-4 w-4" /> : <Tag className="h-3.5 w-3.5" />}
    </span>
  );

  const systemTag = (c: any) =>
    c.is_system ? (
      <span className="shrink-0 rounded border border-border-subtle px-1.5 py-0.5 text-3xs uppercase tracking-[0.08em] text-muted-foreground">
        Sistema
      </span>
    ) : null;

  const renderGroup = (label: string, items: typeof filteredCategories, hint: string) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-3">
        <SectionHeader
          eyebrow={label}
          description={hint}
          actions={<span className="text-xs tabular text-muted-foreground">{items.length}</span>}
          className="border-b border-border-subtle pb-2"
        />
        {view === "cards" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((c, i) => (
              <Card
                key={c.id}
                interactive
                className="animate-rise"
                style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
              >
                <CardContent className="flex items-center gap-3 px-4 py-3.5">
                  {glyph(c)}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground" title={c.name}>
                      {c.name}
                    </span>
                    {systemTag(c)}
                  </div>
                  {categoryActions(c)}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border-subtle">
              {items.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-200 ease-swift hover:bg-accent/40 md:px-4"
                >
                  {glyph(c)}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground" title={c.name}>
                      {c.name}
                    </span>
                    {systemTag(c)}
                  </div>
                  {categoryActions(c)}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    );
  };

  return (
    <PageBody>
      <LimitWarningBanner
        limit="max_categorias"
        currentValue={userCategoriesCount}
        resourceName="categorias"
      />

      <PageHeader
        eyebrow="Organização"
        icon={Tag}
        title="Categorias"
        description="O vocabulário que o Orbi usa para classificar cada lançamento. As de sistema vêm prontas; as suas você define."
        actions={
          <FeatureGuard feature="categorias_criar">
            <LimitGuard limit="max_categorias" currentValue={userCategoriesCount}>
              {categoryDialog}
            </LimitGuard>
          </FeatureGuard>
        }
      />

      <PageToolbar>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder="Buscar categoria"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            aria-label="Buscar categorias"
          />
        </div>
        <ToolbarSpacer />
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={onChangeView}
          aria-label="Visualização"
          className="hidden rounded-lg border border-border bg-surface-sunken p-1 sm:flex"
        >
          <ToggleGroupItem value="list" aria-label="Lista" size="sm">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="cards" aria-label="Cartões" size="sm">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </PageToolbar>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={searchTerm ? "Nenhuma categoria encontrada" : "Nenhuma categoria cadastrada"}
          description={
            searchTerm
              ? `Nada corresponde a “${searchTerm}”.`
              : "Crie a primeira categoria para o Orbi começar a organizar seus lançamentos."
          }
        />
      ) : (
        <div className="space-y-7">
          {renderGroup("Gastos", expenseCategories, "Saídas: o que sai da conta.")}
          {renderGroup("Ganhos", incomeCategories, "Entradas: o que chega na conta.")}
        </div>
      )}
    </PageBody>
  );
}
