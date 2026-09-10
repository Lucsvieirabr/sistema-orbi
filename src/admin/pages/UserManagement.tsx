import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, PageToolbar, ToolbarSpacer } from "@/components/ui/page";
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
      <div className="min-w-0 space-y-5 md:space-y-7">
      <PageHeader
        eyebrow="Administração"
        icon={Users}
        title="Usuários"
        description={`${users?.length || 0} contas cadastradas no Orbi.`}
      />

      <PageToolbar>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder="Buscar por nome ou e-mail"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            aria-label="Buscar usuários"
          />
        </div>
        <ToolbarSpacer />
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
      </PageToolbar>

        {/* Users Grid/List */}
        {isLoading ? (
          <div className={view === "cards" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6" : "space-y-3"}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={view === "cards" ? "h-48 w-full" : "h-24 w-full"} />
            ))}
          </div>
        ) : (
          <>
            {view === "cards" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {filteredUsers && filteredUsers.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState
                      icon={Users}
                      title={searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
                      description={searchTerm ? `Nada corresponde a “${searchTerm}”.` : "Ainda não há usuários no sistema"}
                    />
                  </div>
                ) : (
                  filteredUsers?.map((user) => (
                    <Card key={user.user_id} className="group transition-all duration-200">
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
                              <Badge variant="default" className="bg-success">Completo</Badge>
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
                    <EmptyState
                      icon={Users}
                      title={searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
                      description={searchTerm ? `Nada corresponde a “${searchTerm}”.` : "Ainda não há usuários no sistema"}
                      className="border-0"
                    />
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredUsers?.map((user) => (
                        <div
                          key={user.user_id}
                          className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center lg:p-6"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken">
                              <Users className="h-4 w-4 text-muted-foreground" />
                            </span>
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
                                  <Badge variant="default" className="bg-success text-xs">
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
