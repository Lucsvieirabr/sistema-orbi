import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { IconRenderer } from "@/components/ui/icon-renderer";
import { IconSelector } from "@/components/ui/icon-selector";
import { useCategories } from "@/hooks/use-categories";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus, Tag, Edit, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FeaturePageGuard, FeatureGuard, LimitGuard, LimitWarningBanner } from "@/components/guards/FeatureGuard";
import { useFeatures, useLimit } from "@/hooks/use-feature";

export default function Categories() {
  return (
    <FeaturePageGuard feature="categorias">
      <CategoriesContent />
    </FeaturePageGuard>
  );
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

  // Verificar permissões
  const features = useFeatures(['categorias_criar', 'categorias_editar', 'categorias_excluir']);
  const userCategoriesCount = categories?.filter(c => !c.is_system).length || 0;
  const { canUse: canCreateMore, limit, remaining } = useLimit('max_categorias', userCategoriesCount);

  useEffect(() => {
    const v = (localStorage.getItem("categories:view") as "list" | "cards") || "list";
    setView(v);
  }, []);

  const onChangeView = (val: string) => {
    const v = (val as "list" | "cards") || "list";
    setView(v);
    localStorage.setItem("categories:view", v);
  };

  const title = useMemo(() => (editingId ? "Editar Categoria" : "Nova Categoria"), [editingId]);

  const resetForm = () => {
    setName("");
    setCategoryType("expense");
    setIcon("");
    setEditingId(null);
  };

  const onSubmit = async () => {
    if (!name.trim()) return;
    toast({ title: "Salvando...", description: "Aguarde" });
    try {
      if (editingId) {
        await updateCategory(editingId, { name, category_type: categoryType, icon });
      } else {
        await createCategory({ name, category_type: categoryType, icon });
      }
      toast({ title: "Sucesso", description: "Categoria salva" });
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível salvar", variant: "destructive" });
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

  const onDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      toast({ title: "Sucesso", description: "Categoria excluída" });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
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

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Aviso de Limite */}
      <LimitWarningBanner 
        limit="max_categorias" 
        currentValue={userCategoriesCount}
        resourceName="categorias"
      />
      
      {/* Header Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Tag className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Categorias</CardTitle>
                <p className="text-muted-foreground mt-1">
                  Organize suas transações em categorias personalizadas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Buscar por nome ou tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <ToggleGroup type="single" value={view} onValueChange={onChangeView}>
                <ToggleGroupItem
                  value="list"
                  aria-label="Lista"
                  className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="cards"
                  aria-label="Cards"
                  className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              <FeatureGuard feature="categorias_criar">
                <LimitGuard limit="max_categorias" currentValue={userCategoriesCount}>
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nova Categoria
                      </Button>
                    </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{title}</DialogTitle>
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
                  </Dialog>
                </LimitGuard>
              </FeatureGuard>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Categories Grid/List */}
      {isLoading ? (
        <div className={view === "cards" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6" : "space-y-4"}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className={view === "cards" ? "h-32 w-full" : "h-16 w-full"} />
          ))}
        </div>
      ) : (
        <>
          {view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCategories.length === 0 ? (
                <div className="col-span-full">
                  <Card className="border-dashed border-2 border-muted-foreground/25">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-muted/50 rounded-full mb-4">
                        <Tag className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {searchTerm ? "Nenhuma categoria encontrada" : "Nenhuma categoria cadastrada"}
                      </h3>
                      <p className="text-muted-foreground">
                        {searchTerm
                          ? `Nenhuma categoria encontrada para "${searchTerm}"`
                          : "Crie sua primeira categoria para organizar suas transações"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                filteredCategories.map((c) => (
              <Card key={c.id} className="group hover:shadow-lg transition-all duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {c.icon && (
                        <div className="h-8 w-8 rounded-full bg-transparent flex items-center justify-center flex-shrink-0">
                          <IconRenderer iconName={c.icon} className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <h3 className="font-semibold text-sm truncate" title={c.name}>
                        {c.name}
                      </h3>
                      {c.is_system && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          Sistema
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!c.is_system && (
                        <>
                          <FeatureGuard feature="categorias_editar">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(c.id, c.name, c.category_type, c.icon)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </FeatureGuard>
                          <FeatureGuard feature="categorias_excluir">
                            <ConfirmationDialog
                              title="Confirmar Exclusão"
                              description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
                              confirmText="Excluir"
                              onConfirm={() => onDelete(c.id)}
                              variant="destructive"
                            >
                              <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </ConfirmationDialog>
                          </FeatureGuard>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                {filteredCategories.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Tag className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {searchTerm ? "Nenhuma categoria encontrada" : "Nenhuma categoria cadastrada"}
                    </h3>
                    <p>
                      {searchTerm
                        ? `Nenhuma categoria encontrada para "${searchTerm}"`
                        : "Crie sua primeira categoria para começar"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredCategories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      {c.icon && (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <IconRenderer iconName={c.icon} className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{c.name}</span>
                        {c.is_system && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            Sistema
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!c.is_system && (
                        <>
                          <FeatureGuard feature="categorias_editar">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(c.id, c.name, c.category_type, c.icon)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </FeatureGuard>
                          <FeatureGuard feature="categorias_excluir">
                            <ConfirmationDialog
                              title="Confirmar Exclusão"
                              description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
                              confirmText="Excluir"
                              onConfirm={() => onDelete(c.id)}
                              variant="destructive"
                            >
                              <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </ConfirmationDialog>
                          </FeatureGuard>
                        </>
                      )}
                    </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

