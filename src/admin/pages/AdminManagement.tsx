import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Crown, Shield, LayoutGrid, List } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { AddAdminDialog } from "@/admin/components/AddAdminDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface AdminUserData {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: 'admin' | 'super_admin';
  permissions: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
}

export default function AdminManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<"list" | "cards">("list");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const v = (localStorage.getItem("admin-admins:view") as "list" | "cards") || "list";
    setView(v);
  }, []);

  const onChangeView = (val: string) => {
    const v = (val as "list" | "cards") || "list";
    setView(v);
    localStorage.setItem("admin-admins:view", v);
  };

  // Buscar lista de administradores
  const { data: admins, isLoading } = useQuery<AdminUserData[]>({
    queryKey: ['admin-list'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_admins');
      
      if (error) {
        console.error('Error fetching admins:', error);
        throw error;
      }

      return data as AdminUserData[];
    },
    refetchInterval: 30000,
  });

  // Mutation para deletar admin
  const deleteAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .rpc('admin_delete_admin', { p_user_id: userId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-list'] });
      toast({
        title: "Administrador removido",
        description: "O administrador foi removido com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover admin",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para ativar/desativar admin
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase
        .rpc('admin_toggle_admin', { 
          p_user_id: userId,
          p_is_active: !isActive
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-list'] });
      toast({
        title: "Status atualizado",
        description: "O status do administrador foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredAdmins = admins?.filter((admin) =>
    admin.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Administradores</CardTitle>
                <p className="text-muted-foreground mt-1">
                  Total de {admins?.length || 0} administradores
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por email ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 pl-10"
                />
              </div>
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
              <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Admin
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Admins Grid/List */}
      {isLoading ? (
        <div className={view === "cards" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6" : "space-y-4"}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={view === "cards" ? "h-48 w-full" : "h-24 w-full"} />
          ))}
        </div>
      ) : (
        <>
          {view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAdmins && filteredAdmins.length === 0 ? (
                <div className="col-span-full">
                  <Card className="border-dashed border-2 border-muted-foreground/25">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-muted/50 rounded-full mb-4">
                        <Shield className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {searchTerm ? "Nenhum admin encontrado" : "Nenhum administrador"}
                      </h3>
                      <p className="text-muted-foreground">
                        {searchTerm
                          ? `Nenhum admin encontrado para "${searchTerm}"`
                          : "Ainda não há administradores no sistema"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                filteredAdmins?.map((admin) => (
                  <Card key={admin.user_id} className="group hover:shadow-lg transition-all duration-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {admin.role === 'super_admin' && (
                              <Crown className="h-4 w-4 text-yellow-500" />
                            )}
                            <h3 className="font-semibold text-lg truncate" title={admin.email || ''}>
                              {admin.full_name || admin.email || 'Admin sem nome'}
                            </h3>
                          </div>
                          <p className="text-sm text-muted-foreground truncate" title={admin.email || ''}>
                            {admin.email}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Função */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Função:</span>
                          <Badge variant={admin.role === 'super_admin' ? 'default' : 'secondary'}>
                            {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                          </Badge>
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Status:</span>
                          {admin.is_active ? (
                            <Badge variant="default" className="bg-green-500">Ativo</Badge>
                          ) : (
                            <Badge variant="destructive">Inativo</Badge>
                          )}
                        </div>

                        {/* Data de criação */}
                        <div className="pt-2 border-t text-xs text-muted-foreground">
                          Criado em: {format(new Date(admin.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>

                        {/* Ações */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8"
                            onClick={() => toggleAdminMutation.mutate({ userId: admin.user_id, isActive: admin.is_active })}
                          >
                            {admin.is_active ? 'Desativar' : 'Ativar'}
                          </Button>
                          <ConfirmationDialog
                            title="Remover Admin"
                            description={`Tem certeza que deseja remover o admin "${admin.full_name || admin.email}"?`}
                            confirmText="Remover"
                            onConfirm={() => deleteAdminMutation.mutate(admin.user_id)}
                            variant="destructive"
                          >
                            <Button variant="destructive" size="sm" className="flex-1 h-8">
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remover
                            </Button>
                          </ConfirmationDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                {filteredAdmins && filteredAdmins.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Shield className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {searchTerm ? "Nenhum admin encontrado" : "Nenhum administrador"}
                    </h3>
                    <p>
                      {searchTerm
                        ? `Nenhum admin encontrado para "${searchTerm}"`
                        : "Ainda não há administradores no sistema"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredAdmins?.map((admin) => (
                      <div
                        key={admin.user_id}
                        className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {admin.role === 'super_admin' ? (
                              <Crown className="h-5 w-5 text-yellow-500" />
                            ) : (
                              <Shield className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate" title={admin.full_name || admin.email || ''}>
                              {admin.full_name || admin.email || 'Admin sem nome'}
                            </div>
                            <div className="text-sm text-muted-foreground truncate" title={admin.email || ''}>
                              {admin.email}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={admin.role === 'super_admin' ? 'default' : 'secondary'} className="text-xs">
                                {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                              </Badge>
                              {admin.is_active ? (
                                <Badge variant="default" className="bg-green-500 text-xs">
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">
                                  Inativo
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right mr-4">
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(admin.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAdminMutation.mutate({ userId: admin.user_id, isActive: admin.is_active })}
                            className="h-8"
                          >
                            {admin.is_active ? 'Desativar' : 'Ativar'}
                          </Button>
                          <ConfirmationDialog
                            title="Remover Admin"
                            description={`Tem certeza que deseja remover o admin "${admin.full_name || admin.email}"?`}
                            confirmText="Remover"
                            onConfirm={() => deleteAdminMutation.mutate(admin.user_id)}
                            variant="destructive"
                          >
                            <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </ConfirmationDialog>
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

      {/* Dialog para adicionar admin */}
      <AddAdminDialog 
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  );
}
