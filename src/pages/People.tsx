import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { usePeople } from "@/hooks/use-people";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Plus, Users, Eye, Receipt, Edit, Trash2 } from "lucide-react";
import { FeaturePageGuard, FeatureGuard, LimitGuard } from "@/components/guards/FeatureGuard";
import { useFeatures, useLimit } from "@/hooks/use-feature";

export default function People() {
  return (
    <FeaturePageGuard feature="pessoas">
      <PeopleContent />
    </FeaturePageGuard>
  );
}

function PeopleContent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { people, createPerson, updatePerson, deletePerson, isLoading } = usePeople();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "cards">("list");
  const [searchTerm, setSearchTerm] = useState("");

  // Verificar permissões
  const features = useFeatures(['pessoas_criar', 'pessoas_editar', 'pessoas_excluir']);
  const { canUse: canCreateMore, limit, remaining } = useLimit('max_pessoas', people?.length || 0);

  useEffect(() => {
    const v = (localStorage.getItem("people:view") as "list" | "cards") || "list";
    setView(v);
  }, []);

  const onChangeView = (val: string) => {
    const v = (val as "list" | "cards") || "list";
    setView(v);
    localStorage.setItem("people:view", v);
  };

  const title = useMemo(() => (editingId ? "Editar Pessoa" : "Nova Pessoa"), [editingId]);

  const onSubmit = async () => {
    if (!name.trim()) return;
    toast({ title: "Salvando...", description: "Aguarde" });
    try {
      if (editingId) {
        await updatePerson(editingId, { name });
      } else {
        await createPerson({ name });
      }
      toast({ title: "Sucesso", description: "Pessoa salva" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Não foi possível salvar", variant: "destructive" });
    }
    setOpen(false);
    setName("");
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ["people"] });
  };

  const onEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setName(currentName);
    setOpen(true);
  };

  const onDelete = async (id: string) => {
    toast({ title: "Excluindo...", description: "Aguarde" });
    try {
      await deletePerson(id);
      toast({ title: "Sucesso", description: "Pessoa excluída" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Não foi possível excluir", variant: "destructive" });
    }
    queryClient.invalidateQueries({ queryKey: ["people"] });
  };

  const onViewDetails = (personId: string) => {
    navigate(`/sistema/people/${personId}`);
  };

  // Filtra pessoas por busca
  const filteredPeople = people?.filter((person) =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Pessoas</CardTitle>
                <p className="text-muted-foreground mt-1">
                  Gerencie pessoas e acompanhe transações individuais
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Buscar por nome..."
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
              <FeatureGuard feature="pessoas_criar">
                <LimitGuard limit="max_pessoas" currentValue={people?.length || 0}>
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nova Pessoa
                        {canCreateMore && remaining < 3 && (
                          <span className="ml-1 text-xs">({remaining} restantes)</span>
                        )}
                      </Button>
                    </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
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
                  </Dialog>
                </LimitGuard>
              </FeatureGuard>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* People Grid/List */}
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
              {filteredPeople.length === 0 ? (
                <div className="col-span-full">
                  <Card className="border-dashed border-2 border-muted-foreground/25">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-muted/50 rounded-full mb-4">
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {searchTerm ? "Nenhuma pessoa encontrada" : "Nenhuma pessoa cadastrada"}
                      </h3>
                      <p className="text-muted-foreground">
                        {searchTerm
                          ? `Nenhuma pessoa encontrada para "${searchTerm}"`
                          : "Adicione pessoas para acompanhar transações individuais"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                filteredPeople.map((member) => (
              <Card key={member.id} className="group hover:shadow-lg transition-all duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg">{member.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <FeatureGuard feature="pessoas_editar">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(member.id, member.name)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </FeatureGuard>
                      <FeatureGuard feature="pessoas_excluir">
                        <ConfirmationDialog
                          title="Confirmar Exclusão"
                          description="Tem certeza que deseja excluir esta pessoa? Esta ação não pode ser desfeita."
                          confirmText="Excluir"
                          onConfirm={() => onDelete(member.id)}
                          variant="destructive"
                        >
                          <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ConfirmationDialog>
                      </FeatureGuard>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => onViewDetails(member.id)}
                  >
                    <Receipt className="h-4 w-4" />
                    Ver Extrato
                  </Button>
                </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                {filteredPeople.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Users className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {searchTerm ? "Nenhuma pessoa encontrada" : "Nenhuma pessoa cadastrada"}
                    </h3>
                    <p>
                      {searchTerm
                        ? `Nenhuma pessoa encontrada para "${searchTerm}"`
                        : "Adicione sua primeira pessoa para começar"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredPeople.map((member) => (
                  <div key={member.id} className="p-6 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-semibold">{member.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewDetails(member.id)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Ver Detalhes
                        </Button>
                        <FeatureGuard feature="pessoas_editar">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(member.id, member.name)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </FeatureGuard>
                        <FeatureGuard feature="pessoas_excluir">
                          <ConfirmationDialog
                            title="Confirmar Exclusão"
                            description="Tem certeza que deseja excluir esta pessoa? Esta ação não pode ser desfeita."
                            confirmText="Excluir"
                            onConfirm={() => onDelete(member.id)}
                            variant="destructive"
                          >
                            <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </ConfirmationDialog>
                        </FeatureGuard>
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
  );
}
