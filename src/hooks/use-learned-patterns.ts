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
  metadata: any;
}

/**
 * Hook para buscar padrões aprendidos do usuário
 */
export function useLearnedPatterns() {
  return useQuery({
    queryKey: ['learned-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_learned_patterns')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      return data as LearnedPattern[];
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
      category: string;
      subcategory?: string;
      confidence?: number;
    }) => {
      const { error } = await supabase
        .from('user_learned_patterns')
        .update({
          category: params.category,
          subcategory: params.subcategory,
          confidence: params.confidence || 90,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', params.id);

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
 * Hook para deletar um padrão aprendido
 */
export function useDeleteLearnedPattern() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_learned_patterns')
        .update({ is_active: false })
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
  return useQuery({
    queryKey: ['learned-patterns-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_learned_patterns')
        .select('category, confidence, usage_count')
        .eq('is_active', true);

      if (error) throw error;

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

      return stats;
    },
  });
}

