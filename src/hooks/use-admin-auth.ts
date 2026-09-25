import { getCachedAuthUser } from "@/hooks/use-current-user";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Um só papel: quem está em `admin_users` e ativo tem acesso total ao painel. */
export interface AdminUser {
  id: string;
  user_id: string;
  role: "admin";
  is_active: boolean;
}

export function useAdminAuth() {
  const { data: adminUser, isLoading, error } = useQuery<AdminUser | null>({
    queryKey: ["admin-auth"],
    queryFn: async () => {
      const { data: { user } } = await getCachedAuthUser();
      if (!user) return null;

      // RPC SECURITY DEFINER: evita recursão de RLS em admin_users.
      const { data, error } = await supabase.rpc("get_admin_user");
      if (error) return null;

      const row = Array.isArray(data) ? data[0] : data;
      return row ? (row as AdminUser) : null;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return { adminUser, isAdmin: !!adminUser, isLoading, error };
}
