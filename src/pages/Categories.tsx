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
import { LayoutGrid, List, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Categories() {
  const queryClient = useQueryClient();
  const { categories, createCategory, updateCategory, deleteCategory, populateInitialCategories, isLoading } = useCategories();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryType, setCategoryType] = useState<"income" | "expense">("expense");
  const [icon, setIcon] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "cards">("list");

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
    const t = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
    try {
      if (editingId) {
        await updateCategory(editingId, { name, category_type: categoryType, icon });
      } else {
        await createCategory({ name, category_type: categoryType, icon });
      }
      t.update({ title: "Sucesso", description: "Categoria salva", duration: 2000 });
    } catch (e) {
      t.update({ title: "Erro", description: "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
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
    // Replace with a custom confirmation dialog in real app
    await deleteCategory(id);
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const handlePopulateInitialCategories = async () => {
    const t = toast({ title: "Populando...", description: "Criando categorias iniciais", duration: 2000 });
    try {
      await populateInitialCategories();
      t.update({ title: "Sucesso", description: "Categorias iniciais criadas", duration: 2000 });
    } catch (e: any) {
      t.update({ title: "Erro", description: e.message || "Não foi possível criar categorias", duration: 3000, variant: "destructive" as any });
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card className="shadow-md">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Categorias</CardTitle>
          <div className="flex items-center gap-2">
            {categories.length === 0 && (
              <Button variant="outline" onClick={handlePopulateInitialCategories}>
                Criar Categorias Iniciais
              </Button>
            )}
            <ToggleGroup type="single" value={view} onValueChange={onChangeView}>
              <ToggleGroupItem value="list" aria-label="Lista" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="cards" aria-label="Cards" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
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
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className={view === "cards" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" : "space-y-3"}>
              <Skeleton className={view === "cards" ? "h-20 w-full" : "h-12 w-full"} />
              <Skeleton className={view === "cards" ? "h-20 w-full" : "h-12 w-full"} />
              <Skeleton className={view === "cards" ? "h-20 w-full" : "h-12 w-full"} />
            </div>
          ) : view === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {categories.length === 0 ? (
                <div className="col-span-full rounded-lg border bg-card p-6 text-center text-muted-foreground">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <List className="h-5 w-5" />
                  </div>
                  Nenhuma categoria cadastrada
                </div>
              ) : categories.map((c) => (
                <div key={c.id} className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconRenderer iconName={c.icon} className="h-5 w-5 text-primary" />
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(c.id, c.name, c.category_type, c.icon)}>Editar</Button>
                      <ConfirmationDialog
                        title="Confirmar Exclusão"
                        description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
                        confirmText="Excluir"
                        onConfirm={() => onDelete(c.id)}
                        variant="destructive"
                      >
                        <Button variant="destructive" size="sm">Excluir</Button>
                      </ConfirmationDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md bg-card/40">
              {categories.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <List className="h-5 w-5" />
                  </div>
                  Nenhuma categoria cadastrada
                </div>
              ) : categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <IconRenderer iconName={c.icon} className="h-4 w-4 text-primary" />
                    <span className="font-medium">{c.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onEdit(c.id, c.name, c.category_type, c.icon)}>Editar</Button>
                    <ConfirmationDialog
                      title="Confirmar Exclusão"
                      description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
                      confirmText="Excluir"
                      onConfirm={() => onDelete(c.id)}
                      variant="destructive"
                    >
                      <Button variant="destructive">Excluir</Button>
                    </ConfirmationDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


