import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, PageToolbar, ToolbarSpacer } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Edit, Trash2, LayoutGrid, List, CreditCard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionData {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  plan_name: string | null;
  plan_slug: string | null;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

export default function SubscriptionManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<"list" | "cards">("list");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const v = (localStorage.getItem("admin-subscriptions:view") as "list" | "cards") || "list";
    setView(v);
  }, []);

  const onChangeView = (val: string) => {
    const v = (val as "list" | "cards") || "list";
    setView(v);
    localStorage.setItem("admin-subscriptions:view", v);
  };

  // Buscar lista de assinaturas
  const { data: subscriptions, isLoading } = useQuery<SubscriptionData[]>({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_subscriptions');
      
      if (error) {
        console.error('Error fetching subscriptions:', error);
        throw error;
      }

      return data as SubscriptionData[];
    },
    refetchInterval: 30000,
  });

  // Mutation para cancelar assinatura
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .rpc('admin_cancel_subscription', { p_subscription_id: subscriptionId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      toast({
        title: "Assinatura cancelada",
        description: "A assinatura foi cancelada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cancelar assinatura",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; color: string }> = {
      trial: { variant: 'secondary', label: 'Trial', color: 'text-primary' },
      active: { variant: 'default', label: 'Ativo', color: 'text-success' },
      past_due: { variant: 'destructive', label: 'Atrasado', color: 'text-destructive' },
      canceled: { variant: 'outline', label: 'Cancelado', color: 'text-muted-foreground' },
      expired: { variant: 'destructive', label: 'Expirado', color: 'text-destructive' },
    };

    const config = variants[status] || { variant: 'outline', label: status, color: 'text-muted-foreground' };
    return { ...config };
  };

  const filteredSubscriptions = subscriptions?.filter((sub) =>
    sub.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.plan_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-w-0 space-y-5 md:space-y-7">
      <PageHeader
        eyebrow="Administração"
        icon={CreditCard}
        title="Assinaturas"
        description={`${subscriptions?.length || 0} assinaturas registradas, ativas e encerradas.`}
      />

      <PageToolbar>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder="Buscar assinatura"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            aria-label="Buscar assinaturas"
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

      {/* Subscriptions Grid/List */}
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
              {filteredSubscriptions && filteredSubscriptions.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                      icon={CreditCard}
                      title={searchTerm ? "Nenhuma assinatura encontrada" : "Nenhuma assinatura"}
                      description={searchTerm ? `Nada corresponde a “${searchTerm}”.` : "Ainda não há assinaturas no sistema"}
                    />
                </div>
              ) : (
                filteredSubscriptions?.map((sub) => {
                  const statusConfig = getStatusBadge(sub.status);
                  return (
                    <Card key={sub.id} className="group">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate" title={sub.email || ''}>
                              {sub.full_name || sub.email || 'Usuário sem nome'}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate" title={sub.email || ''}>
                              {sub.email}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {/* Plano */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Plano:</span>
                            {sub.plan_name ? (
                              <Badge variant="outline">{sub.plan_name}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </div>

                          {/* Status */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Status:</span>
                            <Badge variant={statusConfig.variant as any}>
                              {statusConfig.label}
                            </Badge>
                          </div>

                          {/* Ciclo de Faturamento */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Ciclo:</span>
                            <Badge variant="secondary" className="text-xs">
                              {sub.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                            </Badge>
                          </div>

                          {/* Período */}
                          <div className="pt-2 border-t text-xs text-muted-foreground">
                            <div>Início: {(() => {
                              try {
                                return format(new Date(sub.current_period_start + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
                              } catch {
                                return '-';
                              }
                            })()}</div>
                            <div>Fim: {(() => {
                              try {
                                return format(new Date(sub.current_period_end + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
                              } catch {
                                return '-';
                              }
                            })()}</div>
                          </div>

                          {/* Ações */}
                          {sub.status !== 'canceled' && (
                            <div className="flex gap-2 pt-2">
                              <ConfirmationDialog
                                title="Cancelar Assinatura"
                                description={`Tem certeza que deseja cancelar a assinatura de "${sub.full_name || sub.email}"?`}
                                confirmText="Cancelar"
                                onConfirm={() => cancelSubscriptionMutation.mutate(sub.id)}
                                variant="destructive"
                              >
                                <Button variant="destructive" size="sm" className="flex-1 h-8">
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Cancelar
                                </Button>
                              </ConfirmationDialog>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                {filteredSubscriptions && filteredSubscriptions.length === 0 ? (
                  <EmptyState
                      icon={CreditCard}
                      title={searchTerm ? "Nenhuma assinatura encontrada" : "Nenhuma assinatura"}
                      description={searchTerm ? `Nada corresponde a “${searchTerm}”.` : "Ainda não há assinaturas no sistema"}
                      className="border-0"
                    />
                ) : (
                  <div className="divide-y divide-border">
                    {filteredSubscriptions?.map((sub) => {
                      const statusConfig = getStatusBadge(sub.status);
                      return (
                        <div
                          key={sub.id}
                          className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center lg:p-6"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate" title={sub.full_name || sub.email || ''}>
                                {sub.full_name || sub.email || 'Usuário sem nome'}
                              </div>
                              <div className="text-sm text-muted-foreground truncate" title={sub.email || ''}>
                                {sub.email}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {sub.plan_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {sub.plan_name}
                                  </Badge>
                                )}
                                <Badge variant={statusConfig.variant as any} className="text-xs">
                                  {statusConfig.label}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {sub.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right mr-4">
                              <div className="text-sm text-muted-foreground">
                                Até: {(() => {
                                  try {
                                    return format(new Date(sub.current_period_end + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
                                  } catch {
                                    return '-';
                                  }
                                })()}
                              </div>
                            </div>
                            {sub.status !== 'canceled' && (
                              <ConfirmationDialog
                                title="Cancelar Assinatura"
                                description={`Tem certeza que deseja cancelar a assinatura de "${sub.full_name || sub.email}"?`}
                                confirmText="Cancelar"
                                onConfirm={() => cancelSubscriptionMutation.mutate(sub.id)}
                                variant="destructive"
                              >
                                <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </ConfirmationDialog>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
