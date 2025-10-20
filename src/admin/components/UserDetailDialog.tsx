import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserDetailData {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  plan_name: string | null;
  plan_slug: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
}

interface UserDetailDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDetailDialog({ userId, open, onOpenChange }: UserDetailDialogProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar detalhes do usuário
  const { data: userDetails, isLoading: userLoading } = useQuery<UserDetailData | null>({
    queryKey: ['user-details', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .rpc('admin_get_user_details', { p_user_id: userId });

      if (error) {
        console.error('Error fetching user details:', error);
        throw error;
      }

      return data?.[0] as UserDetailData;
    },
    enabled: !!userId && open,
  });

  // Buscar planos disponíveis
  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['admin-plans-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, slug, price_monthly')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data as Plan[];
    },
    enabled: open,
  });

  // Mutation para ativar plano
  const activatePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      if (!userId) throw new Error('User ID é requerido');
      
      const { error } = await supabase
        .rpc('admin_activate_plan_for_user', {
          p_user_id: userId,
          p_plan_id: planId
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      queryClient.invalidateQueries({ queryKey: ['user-details', userId] });
      toast({
        title: "Plano ativado",
        description: "O plano foi ativado com sucesso para o usuário.",
      });
      setSelectedPlanId("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao ativar plano",
        description: error.message,
        variant: "destructive",
      });
    },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do Usuário</DialogTitle>
          <DialogDescription>
            Visualize e edite informações do usuário
          </DialogDescription>
        </DialogHeader>

        {userLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : userDetails ? (
          <div className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">INFORMAÇÕES BÁSICAS</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Nome</label>
                  <p className="text-sm font-medium">{userDetails.full_name || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data de Cadastro</label>
                  <p className="text-sm font-medium">
                    {format(new Date(userDetails.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Email</label>
                  <p className="text-sm font-medium break-all">{userDetails.email}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Onboarding</label>
                  <div className="mt-1">
                    {userDetails.onboarding_completed ? (
                      <Badge variant="default" className="bg-green-500">Completo</Badge>
                    ) : (
                      <Badge variant="secondary">Pendente</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Assinatura Atual */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">ASSINATURA ATUAL</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Plano</label>
                  <p className="text-sm font-medium">{userDetails.plan_name || 'Sem plano'}</p>
                </div>
                {userDetails.current_period_end && userDetails.current_period_end.trim() !== '' && (
                  <div>
                    <label className="text-xs text-muted-foreground">Período até</label>
                    <p className="text-sm font-medium">
                      {(() => {
                        try {
                          const date = new Date(userDetails.current_period_end + 'T00:00:00');
                          return format(date, 'dd/MM/yyyy', { locale: ptBR });
                        } catch (error) {
                          return '-';
                        }
                      })()}
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(userDetails.subscription_status)}
                  </div>
                </div>
              </div>
            </div>

            {/* Ativar Novo Plano */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-semibold text-sm text-muted-foreground">ATIVAR NOVO PLANO</h3>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={plansLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={plansLoading ? "Carregando planos..." : "Selecione um plano"} />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - R$ {plan.price_monthly.toFixed(2)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => selectedPlanId && activatePlanMutation.mutate(selectedPlanId)}
                disabled={!selectedPlanId || activatePlanMutation.isPending}
                className="w-full"
              >
                {activatePlanMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ativando...
                  </>
                ) : (
                  'Ativar Plano'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum usuário encontrado
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
