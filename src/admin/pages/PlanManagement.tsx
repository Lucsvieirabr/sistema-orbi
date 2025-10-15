import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Check, X, Receipt, LayoutGrid, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PlanDialog } from "@/admin/components/PlanDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export default function PlanManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [view, setView] = useState<"list" | "cards">("cards");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const v = (localStorage.getItem("plans:view") as "list" | "cards") || "cards";
    setView(v);
  }, []);

  const onChangeView = (val: string) => {
    const v = (val as "list" | "cards") || "cards";
    setView(v);
    localStorage.setItem("plans:view", v);
  };

  // Buscar todos os planos
  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('display_order');

      if (error) throw error;
      return data as Plan[];
    },
  });

  // Mutation para deletar plano
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast({
        title: "Plano excluído",
        description: "O plano foi excluído com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir plano",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingPlan(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPlan(null);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  // Filtrar planos por busca
  const filteredPlans = plans?.filter((plan) =>
    plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Planos de Assinatura</CardTitle>
                <p className="text-muted-foreground mt-1">
                  Configure e gerencie os planos disponíveis no sistema
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Buscar planos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
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
              <Button className="gap-2" onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                Novo Plano
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Plans Grid/List */}
      {isLoading ? (
        <div className={view === "cards" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6" : "space-y-4"}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className={view === "cards" ? "h-80 w-full" : "h-32 w-full"} />
          ))}
        </div>
      ) : (
        <>
          {view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlans.length === 0 ? (
                <div className="col-span-full">
                  <Card className="border-dashed border-2 border-muted-foreground/25">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 bg-muted/50 rounded-full mb-4">
                        <Receipt className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {searchTerm ? "Nenhum plano encontrado" : "Nenhum plano cadastrado"}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {searchTerm
                          ? `Nenhum plano encontrado para "${searchTerm}"`
                          : "Crie seu primeiro plano de assinatura"}
                      </p>
                      {!searchTerm && (
                        <Button onClick={handleCreate}>
                          <Plus className="h-4 w-4 mr-2" />
                          Criar Plano
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                filteredPlans.map((plan) => (
                  <Card 
                    key={plan.id} 
                    className={`group hover:shadow-lg transition-all duration-200 ${
                      plan.is_featured ? 'border-primary shadow-md' : ''
                    }`}
                    style={{ borderTop: plan.is_featured ? '4px solid hsl(var(--primary))' : '' }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {plan.is_active ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                            <h3 className="font-semibold text-lg">{plan.name}</h3>
                            {plan.is_featured && (
                              <Badge variant="default" className="text-xs">
                                Destaque
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {plan.description || 'Sem descrição'}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Preços */}
                        <div>
                          <div className="text-3xl font-bold text-primary">
                            {formatPrice(plan.price_monthly)}
                            <span className="text-sm font-normal text-muted-foreground">/mês</span>
                          </div>
                          {plan.price_yearly > 0 && (
                            <div className="text-sm text-muted-foreground">
                              ou {formatPrice(plan.price_yearly)}/ano
                            </div>
                          )}
                        </div>

                        {/* Limites principais */}
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {plan.limits.max_accounts !== undefined && (
                            <div>• Contas: {plan.limits.max_accounts === -1 ? '∞' : plan.limits.max_accounts}</div>
                          )}
                          {plan.limits.max_transactions_per_month !== undefined && (
                            <div>• Transações/mês: {plan.limits.max_transactions_per_month === -1 ? '∞' : plan.limits.max_transactions_per_month}</div>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex gap-2 pt-4 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8"
                            onClick={() => handleEdit(plan)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                          <ConfirmationDialog
                            title="Confirmar Exclusão"
                            description={`Tem certeza que deseja excluir o plano "${plan.name}"? Esta ação não pode ser desfeita.`}
                            confirmText="Excluir"
                            onConfirm={() => deletePlanMutation.mutate(plan.id)}
                            variant="destructive"
                          >
                            <Button variant="destructive" size="sm" className="flex-1 h-8">
                              <Trash2 className="h-3 w-3 mr-1" />
                              Excluir
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
                {filteredPlans.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Receipt className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {searchTerm ? "Nenhum plano encontrado" : "Nenhum plano cadastrado"}
                    </h3>
                    <p className="mb-4">
                      {searchTerm
                        ? `Nenhum plano encontrado para "${searchTerm}"`
                        : "Crie seu primeiro plano para começar"}
                    </p>
                    {!searchTerm && (
                      <Button onClick={handleCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Plano
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredPlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          {plan.is_active ? (
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Check className="h-5 w-5 text-green-600" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                              <X className="h-5 w-5 text-red-600" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">{plan.name}</span>
                              {plan.is_featured && (
                                <Badge variant="default">Destaque</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {plan.description || 'Sem descrição'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-medium text-primary">
                                {formatPrice(plan.price_monthly)}/mês
                              </span>
                              {plan.price_yearly > 0 && (
                                <>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-sm text-muted-foreground">
                                    {formatPrice(plan.price_yearly)}/ano
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(plan)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <ConfirmationDialog
                            title="Confirmar Exclusão"
                            description={`Tem certeza que deseja excluir o plano "${plan.name}"? Esta ação não pode ser desfeita.`}
                            confirmText="Excluir"
                            onConfirm={() => deletePlanMutation.mutate(plan.id)}
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

      {/* Dialog para criar/editar plano */}
      <PlanDialog
        open={isDialogOpen}
        onOpenChange={handleCloseDialog}
        plan={editingPlan}
      />
    </div>
  );
}
