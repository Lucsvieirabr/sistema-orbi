import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus, Users } from "lucide-react";

export default function FamilyMembers() {
  const queryClient = useQueryClient();
  const { familyMembers, createFamilyMember, updateFamilyMember, deleteFamilyMember, isLoading } = useFamilyMembers();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "cards">("list");

  useEffect(() => {
    const v = (localStorage.getItem("family_members:view") as "list" | "cards") || "list";
    setView(v);
  }, []);

  const onChangeView = (val: string) => {
    const v = (val as "list" | "cards") || "list";
    setView(v);
    localStorage.setItem("family_members:view", v);
  };

  const title = useMemo(() => (editingId ? "Editar Membro" : "Novo Membro"), [editingId]);

  const onSubmit = async () => {
    if (!name.trim()) return;
    const t = toast({ title: "Salvando...", description: "Aguarde", duration: 2000 });
    try {
      if (editingId) {
        await updateFamilyMember(editingId, { name });
      } else {
        await createFamilyMember({ name });
      }
      t.update({ title: "Sucesso", description: "Membro salvo", duration: 2000 });
    } catch (e: any) {
      t.update({ title: "Erro", description: e.message || "Não foi possível salvar", duration: 3000, variant: "destructive" as any });
    }
    setOpen(false);
    setName("");
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ["family_members"] });
  };

  const onEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setName(currentName);
    setOpen(true);
  };

  const onDelete = async (id: string) => {
    const t = toast({ title: "Excluindo...", description: "Aguarde", duration: 2000 });
    try {
      await deleteFamilyMember(id);
      t.update({ title: "Sucesso", description: "Membro excluído", duration: 2000 });
    } catch (e: any) {
      t.update({ title: "Erro", description: e.message || "Não foi possível excluir", duration: 3000, variant: "destructive" as any });
    }
    queryClient.invalidateQueries({ queryKey: ["family_members"] });
  };

  return (
    <div className="space-y-4 mt-2">
      <Card className="shadow-md">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Membros da Família</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <div className="flex items-center gap-2">
              <ToggleGroup type="single" value={view} onValueChange={onChangeView}>
                <ToggleGroupItem value="list" aria-label="Lista" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="cards" aria-label="Cards" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            </div>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Membro</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Filho João, Esposa Maria" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={onSubmit}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              {familyMembers.length === 0 ? (
                <div className="col-span-full rounded-lg border bg-card p-6 text-center text-muted-foreground">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  Nenhum membro cadastrado
                </div>
              ) : familyMembers.map((member) => (
                <div key={member.id} className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{member.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(member.id, member.name)}>Editar</Button>
                      <Button variant="destructive" size="sm" onClick={() => onDelete(member.id)}>Excluir</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md bg-card/40">
              {familyMembers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  Nenhum membro cadastrado
                </div>
              ) : familyMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">{member.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onEdit(member.id, member.name)}>Editar</Button>
                    <Button variant="destructive" onClick={() => onDelete(member.id)}>Excluir</Button>
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
