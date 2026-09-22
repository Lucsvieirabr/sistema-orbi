import { getCachedAuthUser } from "@/hooks/use-current-user";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { noteSchema, parseOrThrow } from "@/lib/validation/schemas";
import { assertUuid } from "@/lib/utils";

export interface Note {
  id: string;
  user_id: string;
  content: string;
  is_completed: boolean;
  due_date: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteData {
  content: string;
  due_date?: string | null;
  priority?: number;
}

export interface UpdateNoteData {
  content?: string;
  is_completed?: boolean;
  due_date?: string | null;
  priority?: number;
}

export const useNotes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all notes for the current user
  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("is_completed", { ascending: true })
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Note[];
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Create a new note
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: CreateNoteData) => {
      const { data: { user } } = await getCachedAuthUser();
      if (!user) throw new Error("User not authenticated");

      const safeNote = parseOrThrow(noteSchema, noteData);

      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          // SEGURANCA: conteudo higienizado (sem caracteres de controle) e
          // prioridade dentro de 1..3; o banco repete via CHECK orbi_note_safe.
          content: safeNote.content,
          due_date: safeNote.due_date ?? null,
          priority: safeNote.priority ?? 2,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      await queryClient.refetchQueries({ queryKey: ["notes"] });
      toast({
        title: "Nota criada",
        description: "Sua nota foi adicionada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar nota",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update a note
  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateNoteData }) => {
      const { data: { user } } = await getCachedAuthUser();
      if (!user) throw new Error("User not authenticated");

      // SEGURANCA: `data` vinha do chamador e ia inteiro para o UPDATE — nada
      // impedia enviar `user_id` de outro tenant no payload. Aqui so as
      // colunas permitidas passam, higienizadas, e o filtro repete o dono.
      const safe = parseOrThrow(noteSchema.partial(), data);
      const patch: Record<string, unknown> = {};
      if (safe.content !== undefined) patch.content = safe.content;
      if (safe.priority !== undefined) patch.priority = safe.priority;
      if (safe.due_date !== undefined) patch.due_date = safe.due_date ?? null;
      if (typeof data?.is_completed === "boolean") patch.is_completed = data.is_completed;

      const { data: updatedNote, error } = await supabase
        .from("notes")
        .update(patch)
        .eq("id", assertUuid(id, "note_id"))
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return updatedNote;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      await queryClient.refetchQueries({ queryKey: ["notes"] });
      toast({
        title: "Nota atualizada",
        description: "Suas alterações foram salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar nota",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle note completion status
  const toggleNoteMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { data, error } = await supabase
        .from("notes")
        .update({ is_completed })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      await queryClient.refetchQueries({ queryKey: ["notes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar nota",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete a note
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      await queryClient.refetchQueries({ queryKey: ["notes"] });
      toast({
        title: "Nota excluída",
        description: "Sua nota foi removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir nota",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    notes,
    isLoading,
    error,
    createNote: createNoteMutation.mutate,
    updateNote: updateNoteMutation.mutate,
    toggleNote: toggleNoteMutation.mutate,
    deleteNote: deleteNoteMutation.mutate,
    isCreating: createNoteMutation.isPending,
    isUpdating: updateNoteMutation.isPending,
    isDeleting: deleteNoteMutation.isPending,
  };
};

