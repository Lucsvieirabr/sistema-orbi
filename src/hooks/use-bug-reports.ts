import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export interface BugReport {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string;
  imagem_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useBugReports(isAdmin: boolean = false) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const fetchBugReports = async (): Promise<BugReport[]> => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    let query = supabase.from("bug_reports").select("*");

    // Se não for admin, buscar apenas seus relatórios
    if (!isAdmin) {
      query = query.eq("user_id", user?.id ?? "");
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["bug-reports", isAdmin],
    queryFn: fetchBugReports,
  });

  useEffect(() => {
    const channel = supabase
      .channel("bug-reports-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bug_reports" },
        () => queryClient.invalidateQueries({ queryKey: ["bug-reports"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createBugReport = async (titulo: string, descricao: string, imagem_url?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("bug_reports")
        .insert({
          user_id: user!.id,
          titulo,
          descricao,
          imagem_url: imagem_url || null,
          status: "novo",
        })
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: "Sucesso!",
        description: "Defeito/Sugestão reportado com sucesso.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
      return data;
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao reportar defeito/sugestão.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateBugReportStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("bug_reports")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Status atualizado.",
      });

      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteBugReport = async (id: string) => {
    try {
      const { error } = await supabase
        .from("bug_reports")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Defeito/Sugestão removido.",
      });

      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao remover defeito/sugestão.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    bugReports: data ?? [],
    isLoading,
    error,
    createBugReport,
    updateBugReportStatus,
    deleteBugReport,
  };
}
