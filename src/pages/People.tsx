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
import { LayoutGrid, List, Plus, Users, Receipt, Edit, Trash2, Search } from "lucide-react";
import { FeaturePageGuard, FeatureGuard, LimitGuard, LimitWarningBanner } from "@/components/guards/FeatureGuard";
import { useFeatures, useLimit } from "@/hooks/use-feature";
import { useTheme } from "@/hooks/use-theme";
import PixIconDark from "@/assets/pix-dark.svg";
import PixIconWhite from "@/assets/pix-white.svg";
import { EmptyState, PageBody, PageHeader, PageToolbar, ToolbarSpacer } from "@/components/ui/page";

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

  // Filtra pessoas por busca
  const filteredPeople = people?.filter((person) =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const personDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Nova pessoa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pix">Chave PIX (opcional)</Label>
            <Input
              id="pix"
              value={pix}
              onChange={(e) => setPix(e.target.value)}
              placeholder="E-mail, telefone, CPF ou chave aleatória"
            />
            <p className="text-xs text-muted-foreground">Fica a um clique quando você for acertar as contas.</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>Salvar pessoa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  /* Iniciais em caixa de 1px: identifica a pessoa sem inventar um disco de
     cor que não significa nada. */
  const initials = (fullName: string) =>
    fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

  const avatar = (member: any) => (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken font-display text-xs font-semibold tracking-tight text-muted-foreground"
    >
      {initials(member.name) || "?"}
    </span>
  );

  const personActions = (member: any) => (
    <div className="flex items-center gap-0.5">
      {member.pix && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onCopyPix(member.pix, member.name)}
          aria-label={`Copiar PIX de ${member.name}`}
          title="Copiar chave PIX"
        >
          <img src={PixIcon} alt="Ícone Pix" aria-hidden width={16} height={16} className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onViewDetails(member.id)}
        aria-label={`Ver acertos de ${member.name}`}
        title="Ver acertos"
      >
        <Receipt className="h-4 w-4" />
      </Button>
      <FeatureGuard feature="pessoas_editar">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit(member.id, member.name, member.pix)}
          aria-label={`Editar ${member.name}`}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </FeatureGuard>
      <FeatureGuard feature="pessoas_excluir">
        <ConfirmationDialog
          title="Excluir pessoa"
          description="Os rateios ligados a esta pessoa perdem o vínculo. Não dá para desfazer."
          confirmText="Excluir pessoa"
          onConfirm={() => onDelete(member.id)}
          variant="destructive"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir ${member.name}`}
            className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </ConfirmationDialog>
      </FeatureGuard>
    </div>
  );

  return (
    <PageBody>
      <LimitWarningBanner
        limit="max_pessoas"
        currentValue={people?.length || 0}
        resourceName="pessoas"
      />

      <PageHeader
        eyebrow="Organização"
        icon={Users}
        title="Pessoas"
        description="Com quem você divide contas. Cada pessoa acumula o que foi rateado e o que ainda falta acertar."
        actions={
          <FeatureGuard feature="pessoas_criar">
            <LimitGuard limit="max_pessoas" currentValue={people?.length || 0}>
              {personDialog}
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
            placeholder="Buscar pessoa"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            aria-label="Buscar pessoas"
          />
        </div>
        <ToolbarSpacer />
        <div className="flex items-center gap-3">
          {!isLoading && (
            <span className="hidden text-xs tabular text-muted-foreground sm:inline">
              {filteredPeople.length}
              {filteredPeople.length === 1 ? " pessoa" : " pessoas"}
            </span>
          )}
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
        </div>
      </PageToolbar>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredPeople.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchTerm ? "Nenhuma pessoa encontrada" : "Nenhuma pessoa cadastrada"}
          description={
            searchTerm
              ? `Nada corresponde a “${searchTerm}”.`
              : "Cadastre quem divide contas com você para começar a registrar rateios."
          }
        />
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((member, i) => (
            <Card
              key={member.id}
              interactive
              className="animate-rise"
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              <CardContent className="flex flex-col gap-4 px-4 py-4 md:px-5">
                <div className="flex items-start gap-3">
                  {avatar(member)}
                  <div className="min-w-0 flex-1">
                    <h2
                      className="truncate font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground"
                      title={member.name}
                    >
                      {member.name}
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground" title={member.pix || undefined}>
                      {member.pix || "Sem chave PIX"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
                  <Button variant="subtle" size="sm" onClick={() => onViewDetails(member.id)} className="px-0">
                    Ver acertos
                  </Button>
                  {personActions(member)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border-subtle">
            {filteredPeople.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-200 ease-swift hover:bg-accent/40 md:px-4 md:py-3"
              >
                {avatar(member)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground" title={member.name}>
                    {member.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground" title={member.pix || undefined}>
                    {member.pix || "Sem chave PIX"}
                  </p>
                </div>
                {personActions(member)}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageBody>
  );
}
