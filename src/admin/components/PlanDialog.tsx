import { useEffect, useState, useMemo } from "react";
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
import { featureRegistry } from "@/lib/features/orbi-features";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: Plan | null;
}

export function PlanDialog({ open, onOpenChange, plan }: PlanDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Buscar features e limites do registry
  const AVAILABLE_FEATURES = useMemo(() => {
    return featureRegistry.getAllFeatures().map(f => ({
      key: f.key,
      label: f.label,
      description: f.description,
      category: f.category,
      isCore: f.isCore || false,
      metadata: f.metadata || {},
    }));
  }, []);

  const AVAILABLE_LIMITS = useMemo(() => {
    return featureRegistry.getAllLimits().map(l => ({
      key: l.key,
      label: l.label,
      description: l.description,
      category: l.category,
      defaultValue: l.defaultValue,
      unit: l.unit,
    }));
  }, []);

  // Agrupar features por recurso/entidade (CRUD)
  const featuresByResource = useMemo(() => {
    const resources: Record<string, {
      icon: string;
      label: string;
      mainFeature?: typeof AVAILABLE_FEATURES[0];
      crudFeatures: typeof AVAILABLE_FEATURES;
    }> = {};
    
    // Mapeamento de recursos
    const resourceMap: Record<string, { icon: string; label: string; order: number }> = {
      dashboard: { icon: '📊', label: 'Dashboard', order: 1 },
      extrato: { icon: '📝', label: 'Extrato / Transações', order: 2 },
      contas: { icon: '🏦', label: 'Contas Bancárias', order: 3 },
      categorias: { icon: '📂', label: 'Categorias', order: 4 },
      cartoes: { icon: '💳', label: 'Cartões de Crédito', order: 5 },
      pessoas: { icon: '👥', label: 'Pessoas', order: 6 },
      ia: { icon: '🤖', label: 'IA Classificador', order: 7 },
    };
    
    AVAILABLE_FEATURES.forEach(feature => {
      // Extrair módulo da feature key ou metadata
      let resourceKey = (feature as any).metadata?.module;
      
      // Se não tiver metadata, tentar extrair do nome da key
      if (!resourceKey) {
        // Extrair a primeira parte da key (ex: "transacoes_criar" -> "transacoes")
        const keyParts = feature.key.split('_');
        resourceKey = keyParts[0];
        
        // Mapeamento especial de keys para módulos corretos
        const keyToModule: Record<string, string> = {
          'transacoes': 'extrato',
          'ia': 'ia',
          'dashboard': 'dashboard'
        };
        
        resourceKey = keyToModule[resourceKey] || resourceKey;
      }
      
      // Normalizar ia_classificador para ia
      if (resourceKey === 'ia_classificador') {
        resourceKey = 'ia';
      }
      
      if (!resources[resourceKey]) {
        const config = resourceMap[resourceKey] || { icon: '📦', label: resourceKey, order: 99 };
        resources[resourceKey] = {
          icon: config.icon,
          label: config.label,
          mainFeature: undefined,
          crudFeatures: []
        };
      }
      
      // Separar feature principal (acesso) das operações CRUD
      if (feature.key.includes('_criar') || feature.key.includes('_editar') || 
          feature.key.includes('_excluir') || feature.key.includes('_importar') || 
          feature.key.includes('_faturas') || feature.key.includes('_classificacao') ||
          feature.key.includes('_deteccao')) {
        resources[resourceKey].crudFeatures.push(feature);
      } else {
        resources[resourceKey].mainFeature = feature;
      }
    });
    
    // Ordenar resources
    const sortedResources = Object.entries(resources).sort((a, b) => {
      const orderA = resourceMap[a[0]]?.order || 99;
      const orderB = resourceMap[b[0]]?.order || 99;
      return orderA - orderB;
    });
    
    return Object.fromEntries(sortedResources);
  }, [AVAILABLE_FEATURES]);

  // Agrupar limites por categoria
  const limitsByCategory = useMemo(() => {
    const grouped: Record<string, typeof AVAILABLE_LIMITS> = {};
    AVAILABLE_LIMITS.forEach(limit => {
      if (!grouped[limit.category]) {
        grouped[limit.category] = [];
      }
      grouped[limit.category].push(limit);
    });
    return grouped;
  }, [AVAILABLE_LIMITS]);

  // Labels para as categorias de limites
  const categoryLabels: Record<string, string> = {
    accounts: "Contas Financeiras",
    transactions: "Transações",
    cards: "Cartões de Crédito",
    people: "Pessoas e Contatos",
    storage: "Armazenamento",
    ai: "Inteligência Artificial",
    automation: "Automação",
    reports: "Relatórios",
    integration: "Integrações",
    support: "Suporte"
  };

  // Função para ativar/desativar todas as features de um recurso
  const toggleResourceFeatures = (mainFeature: typeof AVAILABLE_FEATURES[0] | undefined, crudFeatures: typeof AVAILABLE_FEATURES, enable: boolean) => {
    const newFeatures = { ...features };
    
    // Ativar/desativar feature principal (se não for Core)
    if (mainFeature && !(mainFeature as any).isCore) {
      newFeatures[mainFeature.key] = enable;
    }
    
    // Ativar/desativar operações CRUD
    crudFeatures.forEach(feature => {
      if (!(feature as any).isCore) {
        newFeatures[feature.key] = enable;
      }
    });
    
    setFeatures(newFeatures);
  };

  // Verificar se todas as features de um recurso estão ativadas
  const areAllResourceFeaturesEnabled = (mainFeature: typeof AVAILABLE_FEATURES[0] | undefined, crudFeatures: typeof AVAILABLE_FEATURES) => {
    const mainEnabled = !mainFeature || (mainFeature as any).isCore || features[mainFeature.key] === true;
    const crudEnabled = crudFeatures.every(feature => 
      (feature as any).isCore || features[feature.key] === true
    );
    return mainEnabled && crudEnabled;
  };
  
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
    monthly_payment_url: '',
    annual_payment_url: '',
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
        monthly_payment_url: plan.monthly_payment_url || '',
        annual_payment_url: plan.annual_payment_url || '',
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
        monthly_payment_url: '',
        annual_payment_url: '',
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
                    <Label htmlFor="monthly_payment_url">URL Pagamento Mensal (opcional)</Label>
                    <Input
                      id="monthly_payment_url"
                      type="url"
                      value={formData.monthly_payment_url}
                      onChange={(e) => setFormData({ ...formData, monthly_payment_url: e.target.value })}
                      placeholder="https://www.asaas.com/c/..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Link para onde o usuário será redirecionado ao assinar o plano mensal
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="annual_payment_url">URL Pagamento Anual (opcional)</Label>
                    <Input
                      id="annual_payment_url"
                      type="url"
                      value={formData.annual_payment_url}
                      onChange={(e) => setFormData({ ...formData, annual_payment_url: e.target.value })}
                      placeholder="https://www.asaas.com/c/..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Link para onde o usuário será redirecionado ao assinar o plano anual
                    </p>
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
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <Info className="h-4 w-4" />
                    <span>Selecione as permissões de cada recurso. Use os botões para ativar/desativar todas de uma vez.</span>
                  </div>
                  
                  {Object.entries(featuresByResource).map(([resourceKey, resourceData]) => {
                    const allEnabled = areAllResourceFeaturesEnabled(resourceData.mainFeature, resourceData.crudFeatures);
                    const hasNonCore = (resourceData.mainFeature && !(resourceData.mainFeature as any).isCore) || 
                                       resourceData.crudFeatures.some(f => !(f as any).isCore);
                    
                    return (
                      <div key={resourceKey} className="rounded-lg border-2 border-border hover:border-primary/50 transition-colors p-4">
                        {/* Cabeçalho do Recurso */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{resourceData.icon}</span>
                            <h3 className="text-base font-bold">{resourceData.label}</h3>
                          </div>
                          
                          {hasNonCore && (
                            <Button
                              type="button"
                              size="sm"
                              variant={allEnabled ? "outline" : "default"}
                              onClick={() => toggleResourceFeatures(resourceData.mainFeature, resourceData.crudFeatures, !allEnabled)}
                            >
                              {allEnabled ? 'Desativar' : 'Ativar'}
                            </Button>
                          )}
                        </div>
                        
                        {/* Features em formato simples */}
                        <div className="space-y-1.5 pl-10">
                          {/* Feature Principal (Acesso) */}
                          {resourceData.mainFeature && (
                            <div className="flex items-center justify-between py-1.5">
                              <Label 
                                htmlFor={`feature-${resourceData.mainFeature.key}`} 
                                className="cursor-pointer text-sm flex items-center gap-2"
                              >
                                {features[resourceData.mainFeature.key] ? '✅' : '⬜'} {resourceData.mainFeature.label}
                                {(resourceData.mainFeature as any).isCore && (
                                  <Badge variant="secondary" className="text-xs">Core</Badge>
                                )}
                              </Label>
                              <Switch
                                id={`feature-${resourceData.mainFeature.key}`}
                                checked={features[resourceData.mainFeature.key] || false}
                                disabled={(resourceData.mainFeature as any).isCore}
                                onCheckedChange={(checked) => 
                                  setFeatures({ ...features, [resourceData.mainFeature!.key]: checked })
                                }
                                className="scale-75"
                              />
                            </div>
                          )}
                          
                          {/* Operações CRUD */}
                          {resourceData.crudFeatures.map((feature) => (
                            <div key={feature.key} className="flex items-center justify-between py-1.5">
                              <Label 
                                htmlFor={`feature-${feature.key}`} 
                                className="cursor-pointer text-sm flex items-center gap-2"
                              >
                                {features[feature.key] ? '✅' : '⬜'} {feature.label}
                                {(feature as any).isCore && (
                                  <Badge variant="secondary" className="text-xs">Core</Badge>
                                )}
                              </Label>
                              <Switch
                                id={`feature-${feature.key}`}
                                checked={features[feature.key] || false}
                                disabled={(feature as any).isCore}
                                onCheckedChange={(checked) => 
                                  setFeatures({ ...features, [feature.key]: checked })
                                }
                                className="scale-75"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ABA: Limites */}
            <TabsContent value="limits" className="space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <Info className="h-4 w-4" />
                    <span>Use <strong>-1</strong> para definir como ilimitado</span>
                  </div>
                  
                  {Object.entries(limitsByCategory).map(([category, categoryLimits]) => (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">
                          {categoryLabels[category] || category}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {categoryLimits.length}
                        </Badge>
                      </div>
                      
                      <div className="space-y-3 pl-4 border-l-2 border-muted">
                        {categoryLimits.map((limit) => (
                          <div key={limit.key} className="space-y-2 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`limit-${limit.key}`} className="font-medium">
                                {limit.label}
                                {limit.unit && (
                                  <span className="text-xs text-muted-foreground ml-2">({limit.unit})</span>
                                )}
                              </Label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {limit.description}
                            </p>
                            <Input
                              id={`limit-${limit.key}`}
                              type="number"
                              value={limits[limit.key] ?? limit.defaultValue}
                              onChange={(e) => 
                                setLimits({ ...limits, [limit.key]: parseInt(e.target.value) || 0 })
                              }
                              placeholder={`Padrão: ${limit.defaultValue}`}
                            />
                          </div>
                        ))}
                      </div>
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


