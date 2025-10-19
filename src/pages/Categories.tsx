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
import { useIsMobile } from "@/hooks/use-mobile";

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

  const truncateText = (text: string, maxLength: number = 15) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Filtra categorias por busca
  const filteredCategories = categories?.filter((category) =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.category_type?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="container mx-auto p-0 lg:p-4 space-y-4 lg:space-y-6 max-w-full">
        {/* Aviso de Limite */}
        <LimitWarningBanner 
          limit="max_categorias" 
          currentValue={userCategoriesCount}
          resourceName="categorias"
        />
        
        {/* Header Section */}
        <Card className="shadow-lg max-w-full">
          <CardHeader className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between w-full max-w-full">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <Tag className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-xl lg:text-2xl truncate">Categorias</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm hidden lg:block truncate">
                    Organize suas transações em categorias personalizadas
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 w-full lg:w-auto max-w-full">
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-48 lg:w-64 max-w-full"
                />
                <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-start flex-shrink-0">
                <ToggleGroup type="single" value={view} onValueChange={onChangeView} className="hidden sm:flex">
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
                        <Button className="gap-2 w-full sm:w-auto">
                          <Plus className="h-4 w-4" />
                          <span className="sm:inline">Nova Categoria</span>
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
          </div>
        </CardHeader>
      </Card>

        {/* Categories Grid/List */}
        {isLoading ? (
          <div className={view === "cards" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-full" : "space-y-4 max-w-full"}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className={view === "cards" ? "h-32 w-full" : "h-16 w-full"} />
            ))}
          </div>
        ) : (
          <>
            {view === "cards" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-full w-full">
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
                  <Card key={c.id} className="group hover:shadow-lg transition-all duration-200 w-full overflow-hidden">
                    <CardHeader className="pb-3 p-4 w-full overflow-hidden">
                      <div className="flex flex-col gap-3 w-full overflow-hidden">
                        <div className="flex items-center justify-between gap-2 w-full overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                            {c.icon && (
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <IconRenderer iconName={c.icon} className="h-5 w-5 text-primary" />
                              </div>
                            )}
                            <h3 className="font-semibold text-base" title={c.name}>{truncateText(c.name, 20)}</h3>
                            {c.is_system && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap">
                                Sistema
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 justify-end flex-shrink-0">
                          {!c.is_system && (
                            <>
                              <FeatureGuard feature="categorias_editar">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onEdit(c.id, c.name, c.category_type, c.icon)}
                                  className="h-7 w-7 lg:h-8 lg:w-8 p-0"
                                >
                                  <Edit className="h-3 w-3 lg:h-4 lg:w-4" />
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
                                  <Button variant="destructive" size="sm" className="h-7 w-7 lg:h-8 lg:w-8 p-0">
                                    <Trash2 className="h-3 w-3 lg:h-4 lg:w-4" />
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
            <Card className="max-w-full overflow-hidden">
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
                  <div className="divide-y divide-border w-full">
                    {filteredCategories.map((c) => (
                      <div key={c.id} className="p-4 hover:bg-muted/30 transition-colors w-full overflow-hidden">
                        <div className="flex items-center justify-between gap-3 w-full overflow-hidden">
                          <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                            {c.icon && (
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <IconRenderer iconName={c.icon} className="h-5 w-5 text-primary" />
                              </div>
                            )}
                            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                              <span className="font-semibold" title={c.name}>{truncateText(c.name, 25)}</span>
                              {c.is_system && (
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap">
                                  Sistema
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 lg:gap-2 justify-end flex-shrink-0">
                            {!c.is_system && (
                              <>
                                <FeatureGuard feature="categorias_editar">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onEdit(c.id, c.name, c.category_type, c.icon)}
                                    className="h-8 w-8 p-0 flex-shrink-0"
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
                                    <Button variant="destructive" size="sm" className="h-8 w-8 p-0 flex-shrink-0 hidden lg:flex">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </ConfirmationDialog>
                                </FeatureGuard>
                              </>
                            )}
                          </div>
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
    </div>
  );
}
