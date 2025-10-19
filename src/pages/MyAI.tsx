/**
 * Página: Minha IA Personalizada
 * 
 * Interface para visualizar e gerenciar padrões aprendidos pela IA
 * do usuário. Permite ver, editar e remover padrões de classificação.
 */

import { useState, useMemo } from 'react';
import { Brain, TrendingUp, Search, Trash2, Edit2, CheckCircle2, List, BarChart3 } from 'lucide-react';
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
import { useFeature } from '@/hooks/use-feature';

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

  const { data: patterns, isLoading } = useLearnedPatterns();
  const { data: stats } = useLearnedPatternsStats();
  const { categories } = useCategories();
  const updatePattern = useUpdateLearnedPattern();
  const deletePattern = useDeleteLearnedPattern();

  // Verificar permissões para detecção de logos
  const { hasFeature: hasLogoDetection } = useFeature('ia_deteccao_logos');

  // Filtra padrões por busca
  const filteredPatterns = patterns?.filter((pattern) =>
    pattern.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pattern.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pattern.subcategory?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (pattern: LearnedPattern) => {
    setEditingPattern(pattern);
    setEditCategory(pattern.category);
  };

  const handleSaveEdit = () => {
    if (!editingPattern) return;

    updatePattern.mutate({
      id: editingPattern.id,
      category: editCategory,
      subcategory: editingPattern.subcategory, // Mantém a subcategoria original
    });

    setEditingPattern(null);
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

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="container mx-auto p-0 lg:p-4 space-y-4 lg:space-y-6 max-w-full">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <Brain className="h-8 w-8 text-primary flex-shrink-0" />
            <h1 className="text-3xl font-bold truncate">IA de Classificação de Transações</h1>
          </div>
          <p className="text-muted-foreground">
            Sua IA pessoal aprende como você prefere categorizar cada transação. 
            Cada vez que você corrige uma classificação durante a importação, a IA memoriza e aplica automaticamente nas próximas vezes!
          </p>
        </div>
    
      {/* Padrões por Categoria */}
      {stats && stats.total > 0 && (
        <Card className="bg-gradient-card shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Classificações Aprendidas por Categoria
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={categoryViewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryViewMode('list')}
                  className="h-8 px-3"
                >
                  <List className="h-4 w-4 mr-1" />
                  Lista
                </Button>
                <Button
                  variant={categoryViewMode === 'chart' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryViewMode('chart')}
                  className="h-8 px-3"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Gráfico
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {categoryViewMode === 'list' ? (
              categoryData.length > 0 ? (
                <div className="space-y-3">
                  {categoryData.map((item, index) => {
                    const percentage = (item.amount / stats.total) * 100;
                    const colors = [
                      'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
                      'bg-red-500', 'bg-purple-500', 'bg-pink-500'
                    ];
                    const colorClass = colors[index % colors.length];

                    return (
                      <div key={item.category} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${colorClass}`} />
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-foreground">
                              {item.category}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {item.amount} padrão{item.amount !== 1 ? 'ões' : ''}
                            </span>
                          </div>
                          <div className="w-full bg-muted/30 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${colorClass}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 bg-muted/20 rounded-lg">
                  <div className="text-center">
                    <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Nenhum padrão aprendido ainda</p>
                  </div>
                </div>
              )
            ) : categoryData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="amount"
                      nameKey="category"
                      label={({ category, percent }) => `${category.substring(0, 20)} ${(percent * 100).toFixed(0)}%`}
                    >
                      {categoryData.map((entry, index) => {
                        const colors = [
                          '#3b82f6', '#10b981', '#f59e0b',
                          '#ef4444', '#8b5cf6', '#ec4899'
                        ];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value} padrão${value !== 1 ? 'ões' : ''}`, 'Quantidade']}
                      labelFormatter={(label) => `Categoria: ${label}`}
                    />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] bg-muted/20 rounded-lg">
                <div className="text-center">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Nenhum padrão aprendido ainda</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      

      {/* Busca e Tabela */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Regras de Classificação Automática</CardTitle>
            </div>
            
            {/* Campo de busca */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar transação ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-80"
              />
              
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPatterns && filteredPatterns.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição da Transação</TableHead>
                    <TableHead>Categoria Aprendida</TableHead>
                    <TableHead className="text-center">Vezes Usada</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatterns.map((pattern) => (
                    <TableRow key={pattern.id}>
                      <TableCell className="font-medium max-w-xs">
                        <div className="truncate" title={pattern.description}>
                          {pattern.description}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px]">
                        <div className="truncate" title={pattern.category}>
                          {pattern.category}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{pattern.usage_count}x</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <FeatureGuard feature="ia_classificacao_automatica">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(pattern)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </FeatureGuard>
                          <FeatureGuard feature="ia_classificacao_automatica">
                            <ConfirmationDialog
                              title="Remover Regra de Classificação"
                              description={`Tem certeza que deseja remover esta regra? A IA não irá mais classificar "${pattern.description}" automaticamente como "${pattern.category}".`}
                              confirmText="Remover Regra"
                              onConfirm={() => handleDelete(pattern.id)}
                              variant="destructive"
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </ConfirmationDialog>
                          </FeatureGuard>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? (
                <p>Nenhuma regra de classificação encontrada para "{searchTerm}"</p>
              ) : (
                <div className="space-y-2">
                  <Brain className="h-12 w-12 mx-auto opacity-20" />
                  <p className="font-medium">Sua IA ainda não aprendeu nenhuma classificação.</p>
                  <p className="text-sm">
                    Importe um extrato bancário e corrija as categorias sugeridas. 
                    A IA vai memorizar suas preferências e aplicar automaticamente nas próximas importações!
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={!!editingPattern} onOpenChange={() => setEditingPattern(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Classificação Automática</DialogTitle>
            <DialogDescription>
              Altere como a IA deve classificar transações com a descrição:<br/>
              <strong>"{editingPattern?.description}"</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category">Nova Categoria</Label>
              <SelectWithAddButton
                entityType="categories"
                value={editCategory}
                onValueChange={setEditCategory}
                placeholder="Selecione a categoria"
              >
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectWithAddButton>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPattern(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editCategory}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

