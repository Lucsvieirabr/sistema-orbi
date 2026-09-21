import { supabase } from '@/integrations/supabase/client';
import { classifyChunks } from './classification';
import type { ClassificationInput, ClassificationResult } from './classification';

export type Transaction = ClassificationInput;
export type { ClassificationResult } from './classification';

export interface BatchClassificationResponse {
  results: ClassificationResult[];
  failures: { start: number; count: number; message: string }[];
  stats: {
    total: number;
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
    processing_time_ms: number;
  };
}

export class BatchTransactionClassifier {
  private userLocation?: string;
  private batchSize = 100;

  constructor(userLocation?: string, batchSize = 100) {
    this.setUserLocation(userLocation);
    this.setBatchSize(batchSize);
  }

  async classifyBatch(transactions: Transaction[]): Promise<BatchClassificationResponse> {
    const started = performance.now();
    const response = await classifyChunks(transactions, this.batchSize, async chunk => {
      const { data, error } = await supabase.functions.invoke('classify-transactions', {
        body: {
          transactions: chunk,
          ...(this.userLocation ? { user_location: this.userLocation } : {}),
        },
      });
      if (error) throw error;
      return data;
    });
    return {
      ...response,
      stats: {
        total: response.results.length,
        high_confidence: response.results.filter(r => r.confidence >= 80).length,
        medium_confidence: response.results.filter(r => r.confidence >= 60 && r.confidence < 80).length,
        low_confidence: response.results.filter(r => r.confidence < 60).length,
        processing_time_ms: performance.now() - started,
      },
    };
  }

  async classifyTransaction(description: string, type: 'income' | 'expense'): Promise<ClassificationResult> {
    return (await this.classifyBatch([{ description, type }])).results[0];
  }

  setUserLocation(location?: string): void {
    this.userLocation = location?.trim() || undefined;
  }

  setBatchSize(size: number): void {
    this.batchSize = Number.isFinite(size) ? Math.max(1, Math.min(Math.floor(size), 500)) : 100;
  }

  getConfig(): { userLocation?: string; batchSize: number } {
    return { userLocation: this.userLocation, batchSize: this.batchSize };
  }
}

export function useBatchClassifier(userLocation?: string) {
  return new BatchTransactionClassifier(userLocation);
}
