import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCategories } from "@/hooks/use-categories";

export default function Categories() {
  const queryClient = useQueryClient();
  const { categories, createCategory, updateCategory, deleteCategory, isLoading } = useCategories();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const title = useMemo(() => (editingId ? "Editar Categoria" : "Nova Categoria"), [editingId]);

  const onSubmit = async () => {
    if (!name.trim()) return;
    if (editingId) {
      await updateCategory(editingId, { name });
    } else {
      await createCategory({ name });
    }
    setOpen(false);
    setName("");
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const onEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setName(currentName);
    setOpen(true);
  };

  const onDelete = async (id: string) => {
    // Replace with a custom confirmation dialog in real app
    await deleteCategory(id);
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Categorias</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#28A745] hover:bg-[#23923d]">Nova Categoria</Button>
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
            </div>
            <DialogFooter>
              <Button onClick={onSubmit} className="bg-[#28A745] hover:bg-[#23923d]">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {isLoading && <div>Carregando...</div>}
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between border rounded p-2">
                <span>{c.name}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onEdit(c.id, c.name)}>Editar</Button>
                  <Button variant="destructive" onClick={() => onDelete(c.id)}>Excluir</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


