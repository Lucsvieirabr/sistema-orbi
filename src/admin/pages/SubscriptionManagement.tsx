import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      trial: { variant: 'secondary', label: 'Trial', color: 'text-blue-500' },
      active: { variant: 'default', label: 'Ativo', color: 'text-green-500' },
      past_due: { variant: 'destructive', label: 'Atrasado', color: 'text-red-500' },
      canceled: { variant: 'outline', label: 'Cancelado', color: 'text-gray-500' },
      expired: { variant: 'destructive', label: 'Expirado', color: 'text-red-500' },
    };

    const config = variants[status] || { variant: 'outline', label: status, color: 'text-gray-500' };
    return { ...config };
  };

  const filteredSubscriptions = subscriptions?.filter((sub) =>
    sub.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.plan_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CreditCard className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl lg:text-2xl">Assinaturas</CardTitle>
                <p className="text-muted-foreground mt-1 text-sm">
                  Total de {subscriptions?.length || 0} assinaturas
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

      {/* Subscriptions Grid/List */}
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
              {filteredSubscriptions && filteredSubscriptions.length === 0 ? (
                <div className="col-span-full">
                  <Card className="border-dashed border-2 border-muted-foreground/25">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-muted/50 rounded-full mb-4">
                        <CreditCard className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {searchTerm ? "Nenhuma assinatura encontrada" : "Nenhuma assinatura"}
                      </h3>
                      <p className="text-muted-foreground">
                        {searchTerm
                          ? `Nenhuma assinatura encontrada para "${searchTerm}"`
                          : "Ainda não há assinaturas no sistema"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                filteredSubscriptions?.map((sub) => {
                  const statusConfig = getStatusBadge(sub.status);
                  return (
                    <Card key={sub.id} className="group hover:shadow-lg transition-all duration-200">
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
                            <div>Início: {format(new Date(sub.current_period_start), 'dd/MM/yyyy', { locale: ptBR })}</div>
                            <div>Fim: {format(new Date(sub.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}</div>
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
                  <div className="p-8 text-center text-muted-foreground">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {searchTerm ? "Nenhuma assinatura encontrada" : "Nenhuma assinatura"}
                    </h3>
                    <p>
                      {searchTerm
                        ? `Nenhuma assinatura encontrada para "${searchTerm}"`
                        : "Ainda não há assinaturas no sistema"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredSubscriptions?.map((sub) => {
                      const statusConfig = getStatusBadge(sub.status);
                      return (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <CreditCard className="h-5 w-5 text-primary" />
                            </div>
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
                                Até: {format(new Date(sub.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}
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
