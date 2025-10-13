/**
 * Cliente otimizado para classificação em batch usando Edge Function
 * 
 * Reduz significativamente o número de requests ao backend ao processar
 * múltiplas transações em uma única chamada à Edge Function.
 * 
 * Benefícios:
 * - 1 request ao invés de N requests (onde N = número de transações)
 * - Processamento paralelo no servidor
 * - Cache de padrões aprendidos compartilhado
 * - Menor latência total
 * - Redução de custos de rede
 */

import { supabase } from '@/integrations/supabase/client';

export interface Transaction {
  description: string;
  type: 'income' | 'expense';
  amount?: number;
  date?: string;
}

export interface ClassificationResult {
  description: string;
  category: string;
  subcategory?: string;
  confidence: number;
  method: string;
  features_used: string[];
  learned_from_user?: boolean;
}

export interface BatchClassificationResponse {
  results: ClassificationResult[];
  stats: {
    total: number;
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
    processing_time_ms: number;
  };
}

export class BatchTransactionClassifier {
  private userLocation: string;
  private batchSize: number;

  constructor(userLocation: string = 'SP', batchSize: number = 100) {
    this.userLocation = userLocation;
    this.batchSize = batchSize;
  }

  /**
   * Classifica múltiplas transações em uma única request
   * 
   * @param transactions - Array de transações para classificar
   * @returns Resultados da classificação com estatísticas
   */
  async classifyBatch(transactions: Transaction[]): Promise<BatchClassificationResponse> {
    if (transactions.length === 0) {
      return {
        results: [],
        stats: {
          total: 0,
          high_confidence: 0,
          medium_confidence: 0,
          low_confidence: 0,
          processing_time_ms: 0,
        },
      };
    }

    // Se houver muitas transações, processa em lotes
    if (transactions.length > this.batchSize) {
      return this.classifyInChunks(transactions);
    }

    try {
      const { data, error } = await supabase.functions.invoke('classify-transactions', {
        body: {
          transactions,
          user_location: this.userLocation,
        },
      });

      if (error) {
        console.error('Error invoking classify-transactions:', error);
        throw new Error(`Classification failed: ${error.message}`);
      }

      return data as BatchClassificationResponse;
    } catch (error) {
      console.error('Error in batch classification:', error);
      throw error;
    }
  }

  /**
   * Processa transações em chunks para não sobrecarregar o servidor
   */
  private async classifyInChunks(transactions: Transaction[]): Promise<BatchClassificationResponse> {
    const chunks: Transaction[][] = [];
    
    // Divide em chunks
    for (let i = 0; i < transactions.length; i += this.batchSize) {
      chunks.push(transactions.slice(i, i + this.batchSize));
    }

    // Processa chunks em paralelo (máximo 3 por vez para não sobrecarregar)
    const maxParallel = 3;
    const allResults: ClassificationResult[] = [];
    let totalProcessingTime = 0;

    for (let i = 0; i < chunks.length; i += maxParallel) {
      const chunkBatch = chunks.slice(i, i + maxParallel);
      const responses = await Promise.all(
        chunkBatch.map(chunk => this.classifyBatch(chunk))
      );

      responses.forEach(response => {
        allResults.push(...response.results);
        totalProcessingTime += response.stats.processing_time_ms;
      });
    }

    // Calcula estatísticas consolidadas
    const stats = {
      total: allResults.length,
      high_confidence: allResults.filter(r => r.confidence >= 80).length,
      medium_confidence: allResults.filter(r => r.confidence >= 60 && r.confidence < 80).length,
      low_confidence: allResults.filter(r => r.confidence < 60).length,
      processing_time_ms: totalProcessingTime,
    };

    return {
      results: allResults,
      stats,
    };
  }

  /**
   * Classifica uma única transação (wrapper para compatibilidade)
   */
  async classifyTransaction(
    description: string,
    type: 'income' | 'expense'
  ): Promise<ClassificationResult> {
    const response = await this.classifyBatch([{ description, type }]);
    return response.results[0];
  }

  /**
   * Define nova localização do usuário
   */
  setUserLocation(location: string): void {
    this.userLocation = location;
  }

  /**
   * Define novo tamanho de batch
   */
  setBatchSize(size: number): void {
    this.batchSize = Math.max(1, Math.min(size, 500)); // Entre 1 e 500
  }

  /**
   * Retorna configurações atuais
   */
  getConfig(): { userLocation: string; batchSize: number } {
    return {
      userLocation: this.userLocation,
      batchSize: this.batchSize,
    };
  }
}

/**
 * Hook auxiliar para uso com React
 */
export function useBatchClassifier(userLocation: string = 'SP') {
  const classifier = new BatchTransactionClassifier(userLocation);
  return classifier;
}

