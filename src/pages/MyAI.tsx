/**
 * Página: Minha IA Personalizada
 * 
 * Interface para visualizar e gerenciar padrões aprendidos pela IA
 * do usuário. Permite ver, editar e remover padrões de classificação.
 */

import { useState, useMemo } from 'react';
import { Brain, Search, Trash2, Edit2, CheckCircle2, List, BarChart3, Sparkles, Layers, Repeat, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Pie, Tooltip, Legend } from 'recharts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SelectWithAddButton } from '@/components/ui/select-with-add-button';
import { SelectItem } from '@/components/ui/select';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  useLearnedPatterns,
  useLearnedPatternsStats,
  useUpdateLearnedPattern,
  useDeleteLearnedPattern,
  type LearnedPattern,
} from '@/hooks/use-learned-patterns';
import { useCategories } from '@/hooks/use-categories';
import { Skeleton } from '@/components/ui/skeleton';
import { FeaturePageGuard, FeatureGuard } from '@/components/guards/FeatureGuard';
import {
  RecordActions,
  RecordCard,
  RecordCardHead,
  RecordCardList,
  RecordField,
  RecordFields,
  TableView,
} from "@/components/ui/record-card";
import { chartColors } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, PageBody, PageHeader, SectionHeader } from "@/components/ui/page";
import { FabAction, FabHint, FabStack, useFabHint } from "@/components/ui/floating-actions";
import { ExtratoUploader } from "@/components/extrato-uploader";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function MyAI() {
  return (
    <FeaturePageGuard feature="ia_classificador">
      <MyAIContent />
    </FeaturePageGuard>
  );
}

function MyAIContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryViewMode, setCategoryViewMode] = useState<'list' | 'chart'>('list');
  const [editingPattern, setEditingPattern] = useState<LearnedPattern | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  /* Esta é a única tela em que a ação flutuante precisa ser *descoberta*: a
     IA só aprende quando um extrato entra, e nada aqui dizia isso. Aviso e
     brilho compartilham o mesmo estado — somem juntos, para sempre, no
     primeiro toque. */
  const importHint = useFabHint('orbi.hint.my-ai.import');

  const { data: patterns, isLoading } = useLearnedPatterns();
  const { data: stats } = useLearnedPatternsStats();
  const { categories } = useCategories();
  const updatePattern = useUpdateLearnedPattern();
  const deletePattern = useDeleteLearnedPattern();

  // Filtra padrões por busca
  const filteredPatterns = patterns?.filter((pattern) =>
    pattern.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pattern.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pattern.subcategory?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (pattern: LearnedPattern) => {
    setEditingPattern(pattern);
    setEditCategory(pattern.metadata?.category_id ?? categories?.find(cat =>
      cat.name === pattern.category && (!pattern.metadata?.transaction_type || cat.category_type === pattern.metadata.transaction_type)
    )?.id ?? '');
  };

  const handleSaveEdit = () => {
    if (!editingPattern) return;

    updatePattern.mutate({
      id: editingPattern.id,
      categoryId: editCategory,
    }, { onSuccess: () => setEditingPattern(null) });
  };

  const handleDelete = (id: string) => {
    deletePattern.mutate(id);
  };

  // Prepara dados para lista e gráfico
  const categoryData = useMemo(() => {
    if (!stats || !stats.byCategory) return [];
    
    return Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({
        category,
        amount: count,
      }));
  }, [stats]);

  const topPattern = filteredPatterns?.length
    ? [...filteredPatterns].sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0))[0]
    : null;

  const openImport = () => {
    importHint.dismiss();
    setImportOpen(true);
  };

  return (
    /* Respiro no rodapé: a última regra da lista não fica sob o botão. */
    <PageBody className="pb-20 lg:pb-16">
      <PageHeader
        eyebrow="Inteligência"
        icon={Brain}
        title="Classificação automática"
        description="Cada correção que você faz durante uma importação vira uma regra. Na próxima vez, o Orbi já classifica sozinho."
      />

      {/* Faixa de indicadores: o que a IA já aprendeu, em três números. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <StatCard
          dense
          label="Regras aprendidas"
          value={<span className="tabular">{stats?.total ?? 0}</span>}
          hint="descrições que a IA já reconhece"
          tone="accent"
          icon={Sparkles}
        />
        <StatCard
          dense
          label="Categorias cobertas"
          value={<span className="tabular">{categoryData.length}</span>}
          hint="destinos distintos de classificação"
          icon={Layers}
        />
        <StatCard
          dense
          className="col-span-2 lg:col-span-1"
          label="Regra mais usada"
          value={<span className="tabular">{topPattern?.usage_count ?? 0}×</span>}
          hint={topPattern ? topPattern.description : "nenhuma regra ainda"}
          icon={Repeat}
        />
      </div>

      {/* Distribuição por categoria */}
      {stats && stats.total > 0 && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Distribuição"
            title="Onde a IA classifica"
            className="border-b border-border-subtle pb-2"
            actions={
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-sunken p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCategoryViewMode('list')}
                  aria-pressed={categoryViewMode === 'list'}
                  className={cn("h-8", categoryViewMode === 'list' && "bg-card text-foreground shadow-sm")}
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">Lista</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCategoryViewMode('chart')}
                  aria-pressed={categoryViewMode === 'chart'}
                  className={cn("h-8", categoryViewMode === 'chart' && "bg-card text-foreground shadow-sm")}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Gráfico</span>
                </Button>
              </div>
            }
          />

          {categoryData.length === 0 ? (
            <EmptyState
              icon={Brain}
              title="Nenhum padrão aprendido ainda"
              description="Importe um extrato e corrija as categorias sugeridas — a IA começa a aprender a partir daí."
            />
          ) : categoryViewMode === 'list' ? (
            /* Ranking: barra proporcional de 1 linha por categoria, ordenada.
               A ordem é a informação; a cor só distingue as séries. */
            <ul className="space-y-3">
              {categoryData.map((item, index) => {
                const percentage = (item.amount / stats.total) * 100;
                const chart = `bg-chart-${(index % 6) + 1}`;
                return (
                  <li key={item.category} className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground" title={item.category}>
                        {item.category}
                      </span>
                      <span className="shrink-0 text-xs tabular text-muted-foreground">
                        {item.amount} {item.amount === 1 ? 'regra' : 'regras'} · {percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className={cn("h-1 rounded-full transition-[width] duration-500 ease-swift", chart)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Card>
              <CardContent className="pt-5">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={100}
                        paddingAngle={1}
                        dataKey="amount"
                        nameKey="category"
                      >
                        {categoryData.map((entry, index) => {
                          const colors = chartColors();
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="none" />;
                        })}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value} ${value === 1 ? 'regra' : 'regras'}`, 'Aprendidas']}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Regras */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Regras"
          title="O que a IA aprendeu"
          description="Uma linha por descrição reconhecida. Edite a categoria ou remova a regra."
          className="border-b border-border-subtle pb-2"
        />

        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder="Buscar descrição ou categoria"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            aria-label="Buscar regras"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredPatterns && filteredPatterns.length > 0 ? (
          <>
            {/* Telefone: uma regra por card — sem tabela espremida. */}
            <RecordCardList>
              {filteredPatterns.map((pattern) => (
                <RecordCard key={pattern.id}>
                  <RecordCardHead
                    title={pattern.description}
                    value={<Badge variant="secondary">{pattern.usage_count}×</Badge>}
                  />
                  <RecordFields className="grid-cols-1">
                    <RecordField label="Categoria aprendida">{pattern.category}</RecordField>
                  </RecordFields>
                  <RecordActions>
                    <FeatureGuard feature="ia_classificacao_automatica">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar regra de ${pattern.description}`}
                        onClick={() => handleEdit(pattern)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </FeatureGuard>
                    <FeatureGuard feature="ia_classificacao_automatica">
                      <ConfirmationDialog
                        title="Remover regra"
                        description={`A IA deixa de classificar “${pattern.description}” automaticamente como “${pattern.category}”.`}
                        confirmText="Remover regra"
                        onConfirm={() => handleDelete(pattern.id)}
                        variant="destructive"
                      >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remover regra de ${pattern.description}`}
                          className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </ConfirmationDialog>
                    </FeatureGuard>
                  </RecordActions>
                </RecordCard>
              ))}
            </RecordCardList>

            {/* md+: tabela real, com rolagem contida no contêiner. */}
            <TableView>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição reconhecida</TableHead>
                    <TableHead>Classifica como</TableHead>
                    <TableHead className="text-right">Usos</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatterns.map((pattern) => (
                    <TableRow key={pattern.id}>
                      <TableCell className="max-w-xs font-medium">
                        <div className="truncate" title={pattern.description}>
                          {pattern.description}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[180px] text-muted-foreground">
                        <div className="truncate" title={pattern.category}>
                          {pattern.category}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">{pattern.usage_count}×</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          <FeatureGuard feature="ia_classificacao_automatica">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleEdit(pattern)}
                              aria-label={`Editar regra de ${pattern.description}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </FeatureGuard>
                          <FeatureGuard feature="ia_classificacao_automatica">
                            <ConfirmationDialog
                              title="Remover regra"
                              description={`A IA deixa de classificar “${pattern.description}” automaticamente como “${pattern.category}”.`}
                              confirmText="Remover regra"
                              onConfirm={() => handleDelete(pattern.id)}
                              variant="destructive"
                            >
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remover regra de ${pattern.description}`}
                                className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </ConfirmationDialog>
                          </FeatureGuard>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableView>
          </>
        ) : (
          <EmptyState
            icon={Brain}
            title={searchTerm ? "Nenhuma regra encontrada" : "A IA ainda não aprendeu nada"}
            description={
              searchTerm
                ? `Nada corresponde a “${searchTerm}”.`
                : "Importe um extrato bancário e corrija as categorias sugeridas. O Orbi memoriza suas escolhas e aplica sozinho nas próximas importações."
            }
          />
        )}
      </section>

      <Dialog open={!!editingPattern} onOpenChange={() => { if (!updatePattern.isPending) setEditingPattern(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar regra</DialogTitle>
            <DialogDescription>
              Escolha como a IA deve classificar transações descritas como{" "}
              <strong className="text-foreground">{editingPattern?.description}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="category">Categoria</Label>
            <SelectWithAddButton
              entityType="categories"
              value={editCategory}
              onValueChange={setEditCategory}
              placeholder="Selecione a categoria"
            >
              {categories?.filter(cat => !editingPattern?.metadata?.transaction_type || cat.category_type === editingPattern.metadata.transaction_type).map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name} ({cat.category_type === 'income' ? 'Receita' : 'Despesa'})
                </SelectItem>
              ))}
            </SelectWithAddButton>
          </div>

          <DialogFooter>
            <Button variant="ghost" disabled={updatePattern.isPending} onClick={() => setEditingPattern(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editCategory || updatePattern.isPending}>
              <CheckCircle2 className="h-4 w-4" />
              Salvar regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExtratoUploader
        open={importOpen}
        onOpenChange={setImportOpen}
        onTransactionsImported={() => {
          queryClient.invalidateQueries({ queryKey: ['learned-patterns'] });
          queryClient.invalidateQueries({ queryKey: ['learned-patterns-stats'] });
          toast({
            title: 'Importação concluída',
            description: 'As correções que você fez viraram regras aqui.',
          });
        }}
      />

      {/* Ação flutuante desta tela: alimentar a IA. Vem com destaque e um
          balão de onboarding — o resto do sistema usa o FAB sem nenhum dos
          dois. */}
      <FeatureGuard feature="transacoes_importar_csv">
        <FabStack>
          <FabHint
            open={importHint.visible}
            onDismiss={importHint.dismiss}
            eyebrow="Comece por aqui"
            title="Importe um extrato para treinar a IA"
            description="Corrija as categorias sugeridas na importação: cada correção vira uma regra nesta lista."
          />
          <FabAction
            icon={Upload}
            label="Importar extrato"
            highlight={importHint.visible}
            onClick={openImport}
          />
        </FabStack>
      </FeatureGuard>
    </PageBody>
  );
}
