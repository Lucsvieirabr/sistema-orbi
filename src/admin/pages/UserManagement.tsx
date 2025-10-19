import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Users, LayoutGrid, List } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UserDetailDialog } from "@/admin/components/UserDetailDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserData {
  user_id: string;
  email: string | null;
  created_at: string;
  full_name: string | null;
  onboarding_completed: boolean | null;
  plan_name: string | null;
  plan_slug: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
}

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<"list" | "cards">("list");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    const v = (localStorage.getItem("admin-users:view") as "list" | "cards") || "list";
    setView(v);
  }, []);

  const onChangeView = (val: string) => {
    const v = (val as "list" | "cards") || "list";
    setView(v);
    localStorage.setItem("admin-users:view", v);
  };

  const handleViewDetails = (userId: string) => {
    setSelectedUserId(userId);
    setDetailsOpen(true);
  };

  // Buscar usuários via função RPC (evita necessidade de service_role_key)
  const { data: users, isLoading } = useQuery<UserData[]>({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      // Usar função RPC que tem SECURITY DEFINER
      const { data, error } = await supabase.rpc('admin_list_users');

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      return data as UserData[];
    },
    refetchInterval: 30000,
  });

  const getStatusBadge = (status: string | null) => {
    if (!status) {
      return <Badge variant="outline">Sem plano</Badge>;
    }

    const variants: Record<string, { variant: any; label: string }> = {
      trial: { variant: 'secondary', label: 'Trial' },
      active: { variant: 'default', label: 'Ativo' },
      past_due: { variant: 'destructive', label: 'Atrasado' },
      canceled: { variant: 'outline', label: 'Cancelado' },
      expired: { variant: 'destructive', label: 'Expirado' },
    };

    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredUsers = users?.filter((user) => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="container mx-auto p-4 space-y-6">
        {/* Header Section */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl lg:text-2xl">Usuários</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Total de {users?.length || 0} usuários cadastrados
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-48 lg:w-64 pl-10"
                  />
                </div>
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
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Users Grid/List */}
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
                {filteredUsers && filteredUsers.length === 0 ? (
                  <div className="col-span-full">
                    <Card className="border-dashed border-2 border-muted-foreground/25">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 bg-muted/50 rounded-full mb-4">
                          <Users className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                          {searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
                        </h3>
                        <p className="text-muted-foreground">
                          {searchTerm
                            ? `Nenhum usuário encontrado para "${searchTerm}"`
                            : "Ainda não há usuários no sistema"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  filteredUsers?.map((user) => (
                    <Card key={user.user_id} className="group hover:shadow-lg transition-all duration-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate" title={user.email || ''}>
                              {user.full_name || user.email || 'Usuário sem nome'}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate" title={user.email || ''}>
                              {user.email}
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => handleViewDetails(user.user_id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {/* Plano e Status */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Plano:</span>
                            {user.plan_name ? (
                              <Badge variant="outline">{user.plan_name}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Status:</span>
                            {getStatusBadge(user.subscription_status)}
                          </div>

                          {/* Onboarding */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Onboarding:</span>
                            {user.onboarding_completed ? (
                              <Badge variant="default" className="bg-green-500">Completo</Badge>
                            ) : (
                              <Badge variant="secondary">Pendente</Badge>
                            )}
                          </div>

                          {/* Data de cadastro */}
                          <div className="pt-2 border-t text-xs text-muted-foreground">
                            Cadastro: {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
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
                  {filteredUsers && filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-6 w-6" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
                      </h3>
                      <p>
                        {searchTerm
                          ? `Nenhum usuário encontrado para "${searchTerm}"`
                          : "Ainda não há usuários no sistema"}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredUsers?.map((user) => (
                        <div
                          key={user.user_id}
                          className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate" title={user.full_name || user.email || ''}>
                                {user.full_name || user.email || 'Usuário sem nome'}
                              </div>
                              <div className="text-sm text-muted-foreground truncate" title={user.email || ''}>
                                {user.email}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {user.plan_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {user.plan_name}
                                  </Badge>
                                )}
                                {getStatusBadge(user.subscription_status)}
                                {user.onboarding_completed ? (
                                  <Badge variant="default" className="bg-green-500 text-xs">
                                    Onboarding OK
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    Onboarding Pendente
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right mr-4">
                              <div className="text-sm text-muted-foreground">
                                Cadastro: {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => handleViewDetails(user.user_id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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

      {/* Dialog para detalhes do usuário */}
      <UserDetailDialog 
        userId={selectedUserId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </>
  );
}
