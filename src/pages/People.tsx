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
import { FeaturePageGuard, FeatureGuard, LimitGuard, LimitWarningBanner } from "@/components/guards/FeatureGuard";
import { useFeatures, useLimit } from "@/hooks/use-feature";
import { useTheme } from "@/hooks/use-theme";
import PixIconDark from "@/assets/pix-dark.svg";
import PixIconWhite from "@/assets/pix-white.svg";

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
  const [pix, setPix] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "cards">("list");
  const [searchTerm, setSearchTerm] = useState("");

  // Verificar permissões
  const features = useFeatures(['pessoas_criar', 'pessoas_editar', 'pessoas_excluir']);
  const { canUse: canCreateMore, limit, remaining } = useLimit('max_pessoas', people?.length || 0);
  const { theme } = useTheme();
  const PixIcon = theme === "dark" ? PixIconWhite : PixIconDark;

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
        await updatePerson(editingId, { name, pix: pix.trim() || null });
      } else {
        await createPerson({ name, pix: pix.trim() || null });
      }
      toast({ title: "Sucesso", description: "Pessoa salva" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Não foi possível salvar", variant: "destructive" });
    }
    setOpen(false);
    setName("");
    setPix("");
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ["people"] });
  };

  const onEdit = (id: string, currentName: string, currentPix?: string | null) => {
    setEditingId(id);
    setName(currentName);
    setPix(currentPix || "");
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

  const onCopyPix = async (pixKey: string, personName: string) => {
    try {
      await navigator.clipboard.writeText(pixKey);
      toast({ title: "PIX copiado!", description: `Chave PIX de ${personName} copiada para a área de transferência` });
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível copiar o PIX", variant: "destructive" });
    }
  };

  const truncateText = (text: string, maxLength: number = 15) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Filtra pessoas por busca
  const filteredPeople = people?.filter((person) =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="container mx-auto p-0 lg:p-4 space-y-4 lg:space-y-6 max-w-full">
      {/* Aviso de Limite */}
      <LimitWarningBanner 
        limit="max_pessoas" 
        currentValue={people?.length || 0}
        resourceName="pessoas"
      />
      
      {/* Header Section */}
      <Card className="shadow-lg max-w-full">
        <CardHeader className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between w-full max-w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl lg:text-2xl truncate">Pessoas</CardTitle>
                <p className="text-muted-foreground mt-1 text-sm hidden lg:block truncate">
                  Gerencie pessoas e acompanhe transações individuais
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-48 lg:w-64"
              />
              <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-start">
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
                <FeatureGuard feature="pessoas_criar">
                  <LimitGuard limit="max_pessoas" currentValue={people?.length || 0}>
                    <Dialog open={open} onOpenChange={setOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2 w-full sm:w-auto">
                          <Plus className="h-4 w-4" />
                          <span className="sm:inline">Nova Pessoa</span>
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
                          <div className="space-y-2">
                            <Label htmlFor="pix">Chave PIX (Opcional)</Label>
                            <Input id="pix" value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" />
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
                  <Card key={member.id} className="group hover:shadow-lg transition-all duration-200 w-full overflow-hidden">
                    <CardHeader className="pb-3 p-4 w-full overflow-hidden">
                      <div className="flex flex-col gap-3 w-full overflow-hidden">
                        <div className="flex items-center justify-between gap-2 w-full overflow-hidden">
                          <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <h3 className="font-semibold text-base" title={member.name}>{truncateText(member.name, 20)}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => member.pix && onCopyPix(member.pix, member.name)}
                            disabled={!member.pix}
                            className="h-7 w-7 lg:h-8 lg:w-8 p-0"
                            title={member.pix ? "Copiar PIX" : "Sem PIX cadastrado"}
                          >
                            <img src={PixIcon} alt="PIX" className="h-3 w-3 lg:h-4 lg:w-4" />
                          </Button>
                          <FeatureGuard feature="pessoas_editar">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(member.id, member.name, member.pix)}
                              className="h-7 w-7 lg:h-8 lg:w-8 p-0"
                            >
                              <Edit className="h-3 w-3 lg:h-4 lg:w-4" />
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
                              <Button variant="destructive" size="sm" className="h-7 w-7 lg:h-8 lg:w-8 p-0">
                                <Trash2 className="h-3 w-3 lg:h-4 lg:w-4" />
                              </Button>
                            </ConfirmationDialog>
                          </FeatureGuard>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        className="w-full gap-2 text-sm"
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
            <Card className="max-w-full overflow-hidden">
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
                  <div className="divide-y divide-border w-full">
                    {filteredPeople.map((member) => (
                      <div key={member.id} className="p-4 hover:bg-muted/30 transition-colors w-full overflow-hidden">
                        <div className="flex items-center justify-between gap-3 w-full overflow-hidden">
                          <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <span className="font-semibold" title={member.name}>{truncateText(member.name, 25)}</span>
                          </div>
                          <div className="flex items-center gap-1 lg:gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onViewDetails(member.id)}
                              className="gap-2 flex-1 lg:flex-initial"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline">Ver Detalhes</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => member.pix && onCopyPix(member.pix, member.name)}
                              disabled={!member.pix}
                              className="h-8 w-8 p-0 flex-shrink-0"
                              title={member.pix ? "Copiar PIX" : "Sem PIX cadastrado"}
                            >
                              <img src={PixIcon} alt="PIX" className="h-4 w-4" />
                            </Button>
                            <FeatureGuard feature="pessoas_editar">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEdit(member.id, member.name, member.pix)}
                                className="h-8 w-8 p-0 flex-shrink-0"
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
                                <Button variant="destructive" size="sm" className="h-8 w-8 p-0 flex-shrink-0 hidden lg:flex">
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
    </div>
  );
}
