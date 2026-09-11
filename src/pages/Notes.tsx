import { useState } from "react";
import { useNotes, Note } from "@/hooks/use-notes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  CalendarIcon,
  Flag,
  StickyNote,
  CheckCircle2,
  Circle,
  Calendar as CalendarDays,
  Info,
  AlertCircle,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageBody, PageHeader } from "@/components/ui/page";

const priorityColors = {
  1: "text-destructive border-destructive/30",
  2: "text-warning border-warning/30",
  3: "text-muted-foreground border-border",
};

/* Régua vertical de 2px na borda do item: a prioridade vira estrutura, não
   só mais um chip disputando atenção com o texto da nota. */
const priorityRail = {
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-border",
};

const priorityLabels = {
  1: "Alta",
  2: "Média",
  3: "Baixa",
};

export default function Notes() {
  const { notes, isLoading, createNote, updateNote, toggleNote, deleteNote } = useNotes();
  const isMobile = useIsMobile();
  
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteDueDate, setNewNoteDueDate] = useState<Date>();
  const [newNotePriority, setNewNotePriority] = useState<number>(2);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "completed">("all");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const handleCreateNote = () => {
    if (!newNoteContent.trim()) return;

    createNote({
      content: newNoteContent,
      due_date: newNoteDueDate ? format(newNoteDueDate, "yyyy-MM-dd") : null,
      priority: newNotePriority,
    });

    setNewNoteContent("");
    setNewNoteDueDate(undefined);
    setNewNotePriority(2);
  };

  const handleToggleComplete = (note: Note) => {
    toggleNote({ id: note.id, is_completed: !note.is_completed });
  };

  const handleStartEdit = (note: Note) => {
    setEditingNote(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = (noteId: string) => {
    if (!editContent.trim()) return;
    
    updateNote({
      id: noteId,
      data: { content: editContent },
    });
    
    setEditingNote(null);
    setEditContent("");
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setEditContent("");
  };

  const handleDeleteClick = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (noteToDelete) {
      deleteNote(noteToDelete);
    }
    setDeleteDialogOpen(false);
    setNoteToDelete(null);
  };

  const toggleExpandNote = (noteId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const isNoteOverdue = (note: Note) => {
    if (!note.due_date || note.is_completed) return false;
    const dueDate = new Date(note.due_date + 'T00:00:00');
    return isPast(dueDate) && !isToday(dueDate);
  };

  const truncateText = (text: string, maxLength?: number) => {
    const limit = maxLength ?? (isMobile ? 25 : 80);
    if (text.length <= limit) return text;
    return text.substring(0, limit) + "...";
  };

  const filteredNotes = notes.filter((note) => {
    if (activeTab === "pending") return !note.is_completed;
    if (activeTab === "completed") return note.is_completed;
    return true;
  });

  const pendingCount = notes.filter(n => !n.is_completed).length;
  const completedCount = notes.filter(n => n.is_completed).length;

  if (isLoading) {
    return (
      <PageBody>
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageBody>
    );
  }

  const emptyCopy =
    activeTab === "completed"
      ? { title: "Nada concluído ainda", description: "As notas que você marcar como feitas aparecem aqui." }
      : activeTab === "pending"
      ? { title: "Nenhuma nota pendente", description: "Tudo em dia. Novas notas entram nesta aba." }
      : { title: "Nenhuma nota ainda", description: "Escreva a primeira acima — um lembrete de boleto, uma meta, um recado." };

  const filters: { value: typeof activeTab; label: string; count: number }[] = [
    { value: "all", label: "Todas", count: notes.length },
    { value: "pending", label: "Pendentes", count: pendingCount },
    { value: "completed", label: "Concluídas", count: completedCount },
  ];

  return (
    <PageBody>
      <PageHeader
        eyebrow="Organização"
        icon={StickyNote}
        title="Notas"
        description="Lembretes financeiros com prazo e prioridade — o que precisa acontecer antes do mês fechar."
      >
        {pendingCount > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="tabular font-medium text-foreground">{pendingCount}</span>
            {pendingCount === 1 ? " nota pendente" : " notas pendentes"}
          </p>
        )}
      </PageHeader>

      {/* Composer: a caixa de escrever é a primeira coisa da página.
          O campo é um poço afundado com respiro próprio (px-4/py-3) e o
          wrapper tem padding nos quatro lados — o texto nunca encosta na
          borda do fundo nem no rodapé. No foco o poço vira superfície de card
          com a borda do anel: o foco é visível sem depender de ring-0. */}
      <Card>
        <div className="p-3 md:p-4">
          <Textarea
            placeholder="Pagar boleto da luz, revisar assinatura da academia…"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCreateNote();
            }}
            aria-label="Nova nota"
            className={cn(
              "min-h-[104px] resize-none border-transparent bg-surface-sunken px-4 py-3 shadow-none md:min-h-[96px]",
              "scroll-py-3 transition-[background-color,border-color,box-shadow]",
              "hover:border-border focus-visible:border-ring focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-ring/15",
            )}
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border-subtle px-3 py-3 sm:flex-row sm:items-center sm:gap-3 md:px-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("justify-start font-normal", !newNoteDueDate && "text-muted-foreground")}
              >
                <CalendarIcon className="h-4 w-4" />
                {newNoteDueDate ? format(newNoteDueDate, "dd/MM/yyyy", { locale: ptBR }) : "Prazo"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={newNoteDueDate} onSelect={setNewNoteDueDate} initialFocus />
            </PopoverContent>
          </Popover>

          <Select value={newNotePriority.toString()} onValueChange={(value) => setNewNotePriority(parseInt(value))}>
            <SelectTrigger className="h-10 w-full sm:w-[150px] md:h-9" aria-label="Prioridade">
              <Flag className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Alta</SelectItem>
              <SelectItem value="2">Média</SelectItem>
              <SelectItem value="3">Baixa</SelectItem>
            </SelectContent>
          </Select>

          <span className="hidden flex-1 lg:block" />

          <p className="hidden text-xs text-muted-foreground lg:block">
            <kbd className="rounded border border-border-subtle bg-surface-sunken px-1.5 py-0.5 text-3xs font-medium">
              Ctrl
            </kbd>
            {" + "}
            <kbd className="rounded border border-border-subtle bg-surface-sunken px-1.5 py-0.5 text-3xs font-medium">
              Enter
            </kbd>{" "}
            adiciona
          </p>

          <Button onClick={handleCreateNote} disabled={!newNoteContent.trim()} size="sm" className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </Card>

      {/* Filtros: trilho segmentado solto sobre a página, com a contagem real. */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface-sunken p-1 no-scrollbar sm:w-fit">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setActiveTab(f.value)}
            aria-pressed={activeTab === f.value}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium",
              "transition-[background-color,color,box-shadow,transform] duration-200 ease-swift",
              "motion-safe:active:scale-[0.97]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              activeTab === f.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            <span className="text-xs tabular text-muted-foreground">{f.count}</span>
          </button>
        ))}
      </div>

      {filteredNotes.length === 0 ? (
        <EmptyState icon={StickyNote} title={emptyCopy.title} description={emptyCopy.description} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border-subtle">
            {filteredNotes.map((note) => {
              const isOverdue = isNoteOverdue(note);
              const isExpanded = expandedNotes.has(note.id);
              const truncateLimit = isMobile ? 72 : 140;
              const shouldTruncate = note.content.length > truncateLimit;
              const rail = priorityRail[note.priority as keyof typeof priorityRail];

              return (
                <li
                  key={note.id}
                  className={cn(
                    "relative flex gap-3 py-3 pl-5 pr-3 transition-colors duration-200 ease-swift md:pr-4",
                    note.is_completed ? "bg-surface-sunken/50" : "hover:bg-accent/40",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-2.5 left-2.5 w-0.5 rounded-full",
                      note.is_completed ? "bg-border" : rail,
                    )}
                  />

                  <button
                    type="button"
                    onClick={() => handleToggleComplete(note)}
                    aria-label={note.is_completed ? "Reabrir nota" : "Concluir nota"}
                    className="-m-1.5 h-11 w-11 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors duration-200 ease-swift hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-8 md:w-8 md:p-1"
                  >
                    {note.is_completed ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    {editingNote === note.id ? (
                      <div className="space-y-2 py-0.5">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[110px] w-full"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveEdit(note.id)}>
                            <Check className="h-4 w-4" />
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <p
                            className={cn(
                              "flex-1 text-sm leading-relaxed text-pretty",
                              note.is_completed ? "text-muted-foreground line-through" : "text-foreground",
                            )}
                          >
                            {shouldTruncate && !isExpanded ? truncateText(note.content, truncateLimit) : note.content}
                          </p>
                          {shouldTruncate && (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => toggleExpandNote(note.id)}
                              title={isExpanded ? "Ver menos" : "Ver mais"}
                              aria-label={isExpanded ? "Ver menos" : "Ver mais"}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          {isOverdue && (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3" />
                              Atrasada
                            </Badge>
                          )}
                          <span
                            className={cn(
                              "text-2xs font-medium uppercase tracking-[0.06em]",
                              priorityColors[note.priority as keyof typeof priorityColors]?.split(" ")[0],
                            )}
                          >
                            {priorityLabels[note.priority as keyof typeof priorityLabels]}
                          </span>
                          {note.due_date && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs tabular",
                                isOverdue ? "text-destructive" : "text-muted-foreground",
                              )}
                            >
                              <CalendarDays className="h-3 w-3" aria-hidden />
                              {format(new Date(note.due_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                          <span className="text-xs tabular text-muted-foreground">
                            criada {format(new Date(note.created_at), "dd/MM", { locale: ptBR })}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {editingNote !== note.id && (
                    <div className="flex shrink-0 items-start gap-0.5">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Editar nota"
                        onClick={() => handleStartEdit(note)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(note.id)}
                        aria-label="Excluir nota"
                        className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
            <AlertDialogDescription>
              A nota some para sempre. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNoteToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir nota
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  );
}
