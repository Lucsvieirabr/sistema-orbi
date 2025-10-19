import { useState } from "react";
import { useNotes, Note } from "@/hooks/use-notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const priorityColors = {
  1: "text-red-500 border-red-500",
  2: "text-yellow-500 border-yellow-500",
  3: "text-green-500 border-green-500",
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
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="px-0 lg:px-6 lg:py-6 max-w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <StickyNote className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            <h1 className="text-xl lg:text-2xl font-bold truncate">Minhas Notas</h1>
          </div>
          <p className="text-xs lg:text-sm text-muted-foreground truncate">
            Organize suas tarefas e lembretes financeiros em um só lugar
          </p>
        </div>
      {/* Create Note Card */}
      <Card className="p-4 mb-6 border-2 border-dashed">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Textarea
              placeholder="Digite sua nota ou tarefa aqui..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  handleCreateNote();
                }
              }}
              className="flex-1 min-h-[70px] resize-none"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal w-full sm:w-auto",
                    !newNoteDueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newNoteDueDate ? format(newNoteDueDate, "dd/MM/yyyy", { locale: ptBR }) : "Data limite"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newNoteDueDate}
                  onSelect={setNewNoteDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Select
              value={newNotePriority.toString()}
              onValueChange={(value) => setNewNotePriority(parseInt(value))}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <Flag className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">
                  <span className="text-red-500">Alta</span>
                </SelectItem>
                <SelectItem value="2">
                  <span className="text-yellow-500">Média</span>
                </SelectItem>
                <SelectItem value="3">
                  <span className="text-green-500">Baixa</span>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleCreateNote} disabled={!newNoteContent.trim()} size="sm" className="w-full sm:w-auto sm:ml-auto">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Nota
            </Button>
          </div>

          <p className="text-xs text-muted-foreground hidden lg:block">
            Dica: Pressione <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded">Ctrl + Enter</kbd> para adicionar rapidamente
          </p>
        </div>
      </Card>

      {/* Notes List with Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" className="gap-1">
            Todas
            <Badge variant="secondary">{notes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1">
            Pendentes
            <Badge variant="secondary">{pendingCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            Concluídas
            <Badge variant="secondary">{completedCount}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filteredNotes.length === 0 ? (
            <Card className="p-8 text-center">
              <StickyNote className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {activeTab === "completed" 
                  ? "Nenhuma nota concluída ainda" 
                  : activeTab === "pending"
                  ? "Nenhuma nota pendente"
                  : "Nenhuma nota criada ainda"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Adicione sua primeira nota acima!
              </p>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-32rem)] overflow-y-auto pr-2">
              {filteredNotes.map((note) => {
                const isOverdue = isNoteOverdue(note);
                const isExpanded = expandedNotes.has(note.id);
                const truncateLimit = isMobile ? 23 : 80;
                const shouldTruncate = note.content.length > truncateLimit;
                
                return (
                  <Card
                    key={note.id}
                    className={cn(
                      "p-3 transition-all hover:shadow-md",
                      note.is_completed && "opacity-60 bg-muted/50",
                      isOverdue && "border-red-500/50 bg-red-500/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleComplete(note)}
                        className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform"
                      >
                        {note.is_completed ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>

                      <div className="flex-1 space-y-2">
                        {editingNote === note.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full min-h-[120px]"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSaveEdit(note.id)}>
                                <Check className="h-4 w-4 mr-1" />
                                Salvar
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                <X className="h-4 w-4 mr-1" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <p
                                className={cn(
                                  "text-sm leading-relaxed flex-1",
                                  note.is_completed && "line-through text-muted-foreground"
                                )}
                              >
                                {shouldTruncate && !isExpanded 
                                  ? truncateText(note.content, truncateLimit)
                                  : note.content
                                }
                              </p>
                              {shouldTruncate && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => toggleExpandNote(note.id)}
                                  className="h-7 w-7 flex-shrink-0"
                                  title={isExpanded ? "Ver menos" : "Ver mais"}
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {isOverdue && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Atrasada
                                </Badge>
                              )}
                              
                              <Badge
                                variant="outline"
                                className={cn("text-xs", priorityColors[note.priority as keyof typeof priorityColors])}
                              >
                                <Flag className="h-3 w-3 mr-1" />
                                {priorityLabels[note.priority as keyof typeof priorityLabels]}
                              </Badge>

                              {note.due_date && (
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    isOverdue && "border-red-500/50 text-red-500"
                                  )}
                                >
                                  <CalendarDays className="h-3 w-3 mr-1" />
                                  {format(new Date(note.due_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                                </Badge>
                              )}

                              <span className="text-xs text-muted-foreground">
                                {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {editingNote !== note.id && (
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleStartEdit(note)}
                            className="h-7 w-7"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteClick(note.id)}
                            className="h-7 w-7 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A nota será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNoteToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}

