/**
 * Hook para gerenciar padrões aprendidos da IA personalizada do usuário
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LearnedPattern {
  id: string;
  user_id: string;
  description: string;
  normalized_description: string;
  category: string;
  subcategory?: string;
  confidence: number;
  usage_count: number;
  last_used_at: string;
  first_learned_at: string;
  is_active: boolean;
  source_type: string;
  metadata: { transaction_type?: string; category_id?: string; [key: string]: unknown } | null;
}

/**
 * Hook para buscar padrões aprendidos do usuário
 */
export function useLearnedPatterns() {
  return useQuery({
    queryKey: ['learned-patterns'],
    queryFn: async () => {
      const rows: LearnedPattern[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('user_learned_patterns')
          .select('*').eq('is_active', true)
          .order('last_used_at', { ascending: false }).order('id')
          .range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data as LearnedPattern[]);
        if (data.length < 500) return rows;
      }
    },
  });
}

/**
 * Hook para atualizar um padrão aprendido
 */
export function useUpdateLearnedPattern() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      categoryId: string;
    }) => {
      const [{ data: pattern, error: patternError }, { data: category, error: categoryError }] = await Promise.all([
        supabase.from('user_learned_patterns').select('metadata').eq('id', params.id).single(),
        supabase.from('categories').select('id, name, category_type').eq('id', params.categoryId).single(),
      ]);
      if (patternError) throw patternError;
      if (categoryError) throw categoryError;
      const metadata = pattern.metadata && typeof pattern.metadata === 'object' && !Array.isArray(pattern.metadata)
        ? pattern.metadata : {};
      if (metadata.transaction_type && metadata.transaction_type !== category.category_type) {
        throw new Error('A categoria deve ter o mesmo tipo (receita ou despesa) da regra.');
      }
      const { error } = await supabase
        .from('user_learned_patterns')
        .update({
          category: category.name,
          subcategory: null,
          confidence: 90,
          metadata: { ...metadata, category_id: category.id, transaction_type: category.category_type },
          last_used_at: new Date().toISOString(),
        })
        .eq('id', params.id).select('id').single();

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learned-patterns'] });
      toast({
        title: 'Classificação atualizada',
        description: 'A IA agora vai usar essa categoria para transações semelhantes!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para deletar um padrão aprendido (DELETE real)
 */
export function useDeleteLearnedPattern() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_learned_patterns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learned-patterns'] });
      toast({
        title: 'Classificação removida',
        description: 'A IA não vai mais usar essa regra para classificar transações.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para obter estatísticas dos padrões aprendidos
 */
export function useLearnedPatternsStats() {
  const query = useLearnedPatterns();
  const data = query.data ?? [];
      const stats = {
        total: data.length,
        byCategory: {} as Record<string, number>,
        avgConfidence: 0,
        totalUsage: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
      };

      data.forEach((pattern) => {
        stats.byCategory[pattern.category] = 
          (stats.byCategory[pattern.category] || 0) + 1;
        stats.avgConfidence += pattern.confidence;
        stats.totalUsage += pattern.usage_count;
        
        if (pattern.confidence >= 85) stats.highConfidence++;
        else if (pattern.confidence >= 70) stats.mediumConfidence++;
        else stats.lowConfidence++;
      });

      if (data.length > 0) {
        stats.avgConfidence = stats.avgConfidence / data.length;
      }

  return { ...query, data: query.data ? stats : undefined };
}
