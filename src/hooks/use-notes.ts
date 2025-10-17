import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          content: noteData.content,
          due_date: noteData.due_date || null,
          priority: noteData.priority || 2,
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
      const { data: updatedNote, error } = await supabase
        .from("notes")
        .update(data)
        .eq("id", id)
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

