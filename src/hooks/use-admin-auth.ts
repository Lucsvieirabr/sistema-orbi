import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminUser {
  id: string;
  user_id: string;
  role: 'super_admin' | 'admin' | 'support' | 'viewer';
  permissions: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
}

/**
 * Hook para verificar se o usuário atual é admin
 */
export function useAdminAuth() {
  const { data: adminUser, isLoading, error } = useQuery<AdminUser | null>({
    queryKey: ['admin-auth'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Usar função RPC que bypassa RLS para evitar recursão infinita
      // Não usar .single() pois pode retornar 0 linhas
      const { data, error } = await supabase
        .rpc('get_admin_user');

      if (error) {
        console.error('Error checking admin status:', error);
        return null;
      }

      // Se não retornou dados ou retornou array vazio, usuário não é admin
      if (!data || (Array.isArray(data) && data.length === 0)) {
        return null;
      }

      // Se retornou array, pegar primeiro item
      const adminData = Array.isArray(data) ? data[0] : data;
      
      return adminData as AdminUser;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    retry: false, // Não retry em caso de erro
  });

  const isAdmin = !!adminUser;
  const isSuperAdmin = adminUser?.role === 'super_admin';
  const hasPermission = (permission: string): boolean => {
    if (!adminUser) return false;
    if (isSuperAdmin) return true; // Super admin tem todas as permissões
    return adminUser.permissions[permission] === true;
  };

  return {
    adminUser,
    isAdmin,
    isSuperAdmin,
    hasPermission,
    isLoading,
    error,
  };
}

