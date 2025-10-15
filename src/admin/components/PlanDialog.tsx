import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plan } from "@/admin/pages/PlanManagement";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: Plan | null;
}

// Features disponíveis
const AVAILABLE_FEATURES = [
  { key: 'basic_dashboard', label: 'Dashboard Básico' },
  { key: 'manual_categorization', label: 'Categorização Manual' },
  { key: 'csv_export', label: 'Exportação CSV' },
  { key: 'ml_classification', label: 'Classificação ML' },
  { key: 'advanced_reports', label: 'Relatórios Avançados' },
  { key: 'api_access', label: 'Acesso API' },
  { key: 'priority_support', label: 'Suporte Prioritário' },
  { key: 'logo_customization', label: 'Personalização de Logos' },
  { key: 'custom_categories', label: 'Categorias Customizadas' },
  { key: 'multi_currency', label: 'Múltiplas Moedas' },
  { key: 'white_label', label: 'Marca Branca' },
  { key: 'bulk_import', label: 'Importação em Massa' },
  { key: 'scheduled_reports', label: 'Relatórios Agendados' },
  { key: 'team_sharing', label: 'Compartilhamento em Equipe' },
];

// Limites disponíveis
const AVAILABLE_LIMITS = [
  { key: 'max_accounts', label: 'Máx. Contas', defaultValue: 2 },
  { key: 'max_transactions_per_month', label: 'Máx. Transações/Mês', defaultValue: 100 },
  { key: 'max_credit_cards', label: 'Máx. Cartões', defaultValue: 1 },
  { key: 'max_people', label: 'Máx. Pessoas', defaultValue: 3 },
  { key: 'retention_months', label: 'Retenção (Meses)', defaultValue: 6 },
  { key: 'max_categories', label: 'Máx. Categorias', defaultValue: 20 },
  { key: 'max_series', label: 'Máx. Séries', defaultValue: 5 },
  { key: 'storage_mb', label: 'Armazenamento (MB)', defaultValue: 100 },
];

export function PlanDialog({ open, onOpenChange, plan }: PlanDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    is_active: true,
    is_featured: false,
    display_order: 0,
  });

  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});

  // Inicializar formulário quando plan muda
  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name,
        slug: plan.slug,
        description: plan.description || '',
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        is_active: plan.is_active,
        is_featured: plan.is_featured,
        display_order: plan.display_order,
      });
      setFeatures(plan.features || {});
      setLimits(plan.limits || {});
    } else {
      // Resetar para valores padrão
      setFormData({
        name: '',
        slug: '',
        description: '',
        price_monthly: 0,
        price_yearly: 0,
        is_active: true,
        is_featured: false,
        display_order: 0,
      });
      
      // Inicializar features como false
      const defaultFeatures: Record<string, boolean> = {};
      AVAILABLE_FEATURES.forEach(f => {
        defaultFeatures[f.key] = false;
      });
      setFeatures(defaultFeatures);
      
      // Inicializar limites com valores padrão
      const defaultLimits: Record<string, number> = {};
      AVAILABLE_LIMITS.forEach(l => {
        defaultLimits[l.key] = l.defaultValue;
      });
      setLimits(defaultLimits);
    }
  }, [plan, open]);

  // Mutation para criar/atualizar plano
  const savePlanMutation = useMutation({
    mutationFn: async () => {
      const planData = {
        ...formData,
        features,
        limits,
      };

      if (plan) {
        // Atualizar
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', plan.id);

        if (error) throw error;
      } else {
        // Criar
        const { error } = await supabase
          .from('subscription_plans')
          .insert([planData]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast({
        title: plan ? "Plano atualizado" : "Plano criado",
        description: plan 
          ? "O plano foi atualizado com sucesso." 
          : "O plano foi criado com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar plano",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    savePlanMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          <DialogDescription>
            Configure os detalhes, features e limites do plano
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="limits">Limites</TabsTrigger>
            </TabsList>

            {/* ABA: Detalhes */}
            <TabsContent value="details" className="space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Plano *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Pro"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug *</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                        placeholder="Ex: pro"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descreva o plano..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price_monthly">Preço Mensal (R$)</Label>
                      <Input
                        id="price_monthly"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price_monthly}
                        onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="price_yearly">Preço Anual (R$)</Label>
                      <Input
                        id="price_yearly"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price_yearly}
                        onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="display_order">Ordem de Exibição</Label>
                    <Input
                      id="display_order"
                      type="number"
                      min="0"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="is_active">Plano Ativo</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="is_featured">Plano em Destaque</Label>
                    <Switch
                      id="is_featured"
                      checked={formData.is_featured}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                    />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ABA: Features */}
            <TabsContent value="features" className="space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {AVAILABLE_FEATURES.map((feature) => (
                    <div key={feature.key} className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                      <Label htmlFor={`feature-${feature.key}`} className="cursor-pointer">
                        {feature.label}
                      </Label>
                      <Switch
                        id={`feature-${feature.key}`}
                        checked={features[feature.key] || false}
                        onCheckedChange={(checked) => 
                          setFeatures({ ...features, [feature.key]: checked })
                        }
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ABA: Limites */}
            <TabsContent value="limits" className="space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Use -1 para definir como ilimitado
                  </p>
                  {AVAILABLE_LIMITS.map((limit) => (
                    <div key={limit.key} className="space-y-2">
                      <Label htmlFor={`limit-${limit.key}`}>{limit.label}</Label>
                      <Input
                        id={`limit-${limit.key}`}
                        type="number"
                        value={limits[limit.key] ?? limit.defaultValue}
                        onChange={(e) => 
                          setLimits({ ...limits, [limit.key]: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={savePlanMutation.isPending}>
              {savePlanMutation.isPending ? 'Salvando...' : (plan ? 'Atualizar' : 'Criar')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


