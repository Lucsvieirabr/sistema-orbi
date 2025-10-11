/**
 * Sistema de Machine Learning para Classificação de Transações
 *
 * Implementa algoritmos de ML para melhorar a categorização automática
 * usando técnicas de processamento de linguagem natural e aprendizado supervisionado.
 */

export interface MLTransaction {
  description: string;
  category: string;
  subcategory?: string;
  type: 'income' | 'expense';
  amount?: number;
  date?: string;
}

export interface MLFeatures {
  // Características baseadas em texto
  tokens: string[];
  bigrams: string[];
  trigrams: string[];

  // Características numéricas
  description_length: number;
  word_count: number;
  uppercase_ratio: number;
  digit_ratio: number;

  // Características contextuais
  contains_numbers: boolean;
  contains_currency_symbols: boolean;
  contains_special_chars: boolean;

  // Características de padrão
  is_all_caps: boolean;
  has_repeated_chars: boolean;
  likely_establishment: boolean;
}

export interface MLPrediction {
  category: string;
  subcategory?: string;
  confidence: number;
  method: 'ml' | 'rule_based' | 'hybrid';
  features_used: string[];
}

export class TransactionMLClassifier {
  private trainingData: MLTransaction[] = [];
  private vocabulary: Map<string, number> = new Map();
  private categoryStats: Map<string, { count: number; avg_confidence: number }> = new Map();

  constructor() {
    this.initializeTrainingData();
  }

  /**
   * Inicializa dados de treinamento com transações conhecidas
   */
  private initializeTrainingData(): void {
    // Dados iniciais baseados no dicionário existente
    const initialTransactions: MLTransaction[] = [
      // Alimentação
      { description: "Komprao Koch Atacadista", category: "Alimentação", subcategory: "Atacado", type: "expense" },
      { description: "Fort Atacadista", category: "Alimentação", subcategory: "Atacado", type: "expense" },
      { description: "McDonald's", category: "Alimentação", subcategory: "Fast Food", type: "expense" },
      { description: "Burger King", category: "Alimentação", subcategory: "Fast Food", type: "expense" },
      { description: "iFood", category: "Alimentação", subcategory: "Delivery", type: "expense" },

      // Transporte
      { description: "Posto Tucha", category: "Transporte", subcategory: "Combustível", type: "expense" },
      { description: "Uber", category: "Transporte", subcategory: "Aplicativo", type: "expense" },
      { description: "99", category: "Transporte", subcategory: "Aplicativo", type: "expense" },

      // Saúde
      { description: "Drogasil", category: "Proteção Pessoal / Saúde / Farmácia", subcategory: "Farmácia", type: "expense" },

      // Transferências
      { description: "PIX enviado", category: "Transferências", subcategory: "PIX Enviado", type: "expense" },
      { description: "PIX recebido", category: "Outras Receitas", subcategory: "PIX Recebido", type: "income" },

      // Taxas
      { description: "Tarifa bancária", category: "Tarifas Bancárias / Juros / Impostos / Taxas", subcategory: "Taxa Bancária", type: "expense" },
    ];

    this.trainingData = initialTransactions;
    this.buildVocabulary();
    this.calculateCategoryStats();
  }

  /**
   * Extrai características de uma transação para ML
   */
  extractFeatures(description: string): MLFeatures {
    const tokens = this.tokenize(description);
    const lowerDesc = description.toLowerCase();

    return {
      tokens,
      bigrams: this.generateNGrams(tokens, 2),
      trigrams: this.generateNGrams(tokens, 3),

      description_length: description.length,
      word_count: tokens.length,
      uppercase_ratio: this.calculateUppercaseRatio(description),
      digit_ratio: this.calculateDigitRatio(description),

      contains_numbers: /\d/.test(description),
      contains_currency_symbols: /[R$€£¥]/.test(description),
      contains_special_chars: /[^a-zA-Z0-9\s]/.test(description),

      is_all_caps: description === description.toUpperCase(),
      has_repeated_chars: this.hasRepeatedCharacters(description),
      likely_establishment: this.isLikelyEstablishmentName(description)
    };
  }

  /**
   * Tokeniza descrição removendo pontuação e normalizando
   */
  private tokenize(description: string): string[] {
    return description
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
  }

  /**
   * Gera n-gramas de tokens
   */
  private generateNGrams(tokens: string[], n: number): string[] {
    const ngrams: string[] = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  /**
   * Calcula ratio de letras maiúsculas
   */
  private calculateUppercaseRatio(description: string): number {
    const letters = description.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return 0;

    const uppercase = description.replace(/[^A-Z]/g, '');
    return uppercase.length / letters.length;
  }

  /**
   * Calcula ratio de dígitos
   */
  private calculateDigitRatio(description: string): number {
    const digits = description.replace(/[^\d]/g, '');
    return digits.length / description.length;
  }

  /**
   * Verifica se tem caracteres repetidos (indicativo de códigos)
   */
  private hasRepeatedCharacters(description: string): boolean {
    return /(.)\1{2,}/.test(description);
  }

  /**
   * Verifica se parece nome de estabelecimento
   */
  private isLikelyEstablishmentName(description: string): boolean {
    const tokens = this.tokenize(description);
    return tokens.length >= 2 &&
           tokens.length <= 5 &&
           !/pix|pagamento|transferencia|juros|multa|taxa/.test(description.toLowerCase());
  }

  /**
   * Constrói vocabulário baseado nos dados de treinamento
   */
  private buildVocabulary(): void {
    this.vocabulary.clear();

    this.trainingData.forEach(transaction => {
      const tokens = this.tokenize(transaction.description);
      tokens.forEach(token => {
        this.vocabulary.set(token, (this.vocabulary.get(token) || 0) + 1);
      });
    });
  }

  /**
   * Calcula estatísticas por categoria
   */
  private calculateCategoryStats(): void {
    this.categoryStats.clear();

    this.trainingData.forEach(transaction => {
      if (!this.categoryStats.has(transaction.category)) {
        this.categoryStats.set(transaction.category, { count: 0, avg_confidence: 0 });
      }

      const stats = this.categoryStats.get(transaction.category)!;
      stats.count++;
    });
  }

  /**
   * Calcula similaridade de texto usando TF-IDF
   */
  calculateTextSimilarity(description1: string, description2: string): number {
    const tokens1 = this.tokenize(description1);
    const tokens2 = this.tokenize(description2);

    const tfidf1 = this.calculateTFIDF(tokens1);
    const tfidf2 = this.calculateTFIDF(tokens2);

    return this.cosineSimilarity(tfidf1, tfidf2);
  }

  /**
   * Calcula TF-IDF para tokens
   */
  private calculateTFIDF(tokens: string[]): Map<string, number> {
    const tfidf = new Map<string, number>();
    const totalTokens = tokens.length;

    // Term Frequency (TF)
    const termFreq = new Map<string, number>();
    tokens.forEach(token => {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    });

    // Inverse Document Frequency (IDF) e TF-IDF
    termFreq.forEach((freq, term) => {
      const tf = freq / totalTokens;
      const idf = Math.log(this.trainingData.length / (this.vocabulary.get(term) || 1));
      tfidf.set(term, tf * idf);
    });

    return tfidf;
  }

  /**
   * Calcula similaridade de cosseno entre dois vetores TF-IDF
   */
  private cosineSimilarity(vector1: Map<string, number>, vector2: Map<string, number>): number {
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    // Combina chaves de ambos os vetores
    const allKeys = new Set([...vector1.keys(), ...vector2.keys()]);

    allKeys.forEach(key => {
      const val1 = vector1.get(key) || 0;
      const val2 = vector2.get(key) || 0;

      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    });

    const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Classifica transação usando ML
   */
  predictCategory(description: string, type: 'income' | 'expense'): MLPrediction {
    const features = this.extractFeatures(description);

    // 1. Tenta encontrar correspondência exata nos dados de treinamento
    const exactMatch = this.findExactMatch(description);
    if (exactMatch) {
      return {
        category: exactMatch.category,
        subcategory: exactMatch.subcategory,
        confidence: 0.95,
        method: 'ml',
        features_used: ['exact_match']
      };
    }

    // 2. Usa similaridade de texto com dados de treinamento
    const similarMatches = this.findSimilarTransactions(description);
    if (similarMatches.length > 0) {
      const bestMatch = this.selectBestMatch(similarMatches);
      return {
        category: bestMatch.category,
        subcategory: bestMatch.subcategory,
        confidence: bestMatch.confidence,
        method: 'ml',
        features_used: ['text_similarity']
      };
    }

    // 3. Usa características baseadas em regras
    const ruleBasedPrediction = this.ruleBasedPrediction(features, type);
    if (ruleBasedPrediction) {
      return ruleBasedPrediction;
    }

    // 4. Fallback: categoria padrão
    return {
      category: type === 'income' ? 'Outras Receitas' : 'Outros',
      confidence: 0.3,
      method: 'hybrid',
      features_used: ['fallback']
    };
  }

  /**
   * Busca correspondência exata nos dados de treinamento
   */
  private findExactMatch(description: string): MLTransaction | null {
    const normalizedDesc = description.toLowerCase().trim();

    return this.trainingData.find(transaction =>
      transaction.description.toLowerCase().trim() === normalizedDesc
    ) || null;
  }

  /**
   * Encontra transações similares usando similaridade de texto
   */
  private findSimilarTransactions(description: string): Array<{ transaction: MLTransaction; similarity: number }> {
    const similarities: Array<{ transaction: MLTransaction; similarity: number }> = [];

    this.trainingData.forEach(transaction => {
      const similarity = this.calculateTextSimilarity(description, transaction.description);
      if (similarity > 0.3) { // Threshold mínimo de similaridade
        similarities.push({ transaction, similarity });
      }
    });

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  /**
   * Seleciona melhor correspondência baseada em múltiplos fatores
   */
  private selectBestMatch(similarities: Array<{ transaction: MLTransaction; similarity: number }>): MLTransaction & { confidence: number } {
    if (similarities.length === 0) {
      throw new Error('No similar transactions found');
    }

    // Usa weighted scoring
    let bestScore = 0;
    let bestMatch = similarities[0];

    similarities.forEach(({ transaction, similarity }) => {
      // Peso da similaridade (70%)
      // Frequência da categoria (20%)
      // Confiança histórica (10%)
      const categoryFreq = this.categoryStats.get(transaction.category)?.count || 1;
      const categoryWeight = Math.log(categoryFreq + 1) / Math.log(this.trainingData.length + 1);

      const score = similarity * 0.7 + categoryWeight * 0.2 + 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { transaction, similarity };
      }
    });

    return {
      ...bestMatch.transaction,
      confidence: Math.min(bestScore * 100, 90)
    };
  }

  /**
   * Classificação baseada em regras usando características
   */
  private ruleBasedPrediction(features: MLFeatures, type: 'income' | 'expense'): MLPrediction | null {
    // Regras baseadas em características específicas

    // 1. Transações com números altos e símbolos monetários são provavelmente financeiras
    if (features.contains_currency_symbols && features.digit_ratio > 0.2) {
      if (type === 'income') {
        return {
          category: 'Outras Receitas',
          confidence: 0.7,
          method: 'rule_based',
          features_used: ['currency_symbols', 'digit_ratio']
        };
      }
    }

    // 2. Descrições muito curtas são provavelmente estabelecimentos
    if (features.word_count <= 2 && features.likely_establishment) {
      return {
        category: type === 'income' ? 'Outras Receitas' : 'Outros',
        confidence: 0.6,
        method: 'rule_based',
        features_used: ['short_description', 'likely_establishment']
      };
    }

    // 3. Descrições em maiúsculas são provavelmente códigos ou siglas
    if (features.is_all_caps && features.word_count <= 3) {
      return {
        category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
        subcategory: 'Código/Sigla',
        confidence: 0.65,
        method: 'rule_based',
        features_used: ['all_caps', 'short_description']
      };
    }

    return null;
  }

  /**
   * Adiciona nova transação aos dados de treinamento
   */
  addTrainingData(transaction: MLTransaction): void {
    this.trainingData.push(transaction);
    this.buildVocabulary();
    this.calculateCategoryStats();
  }

  /**
   * Remove transação dos dados de treinamento
   */
  removeTrainingData(index: number): void {
    if (index >= 0 && index < this.trainingData.length) {
      this.trainingData.splice(index, 1);
      this.buildVocabulary();
      this.calculateCategoryStats();
    }
  }

  /**
   * Obtém estatísticas do modelo
   */
  getModelStats(): {
    total_training_samples: number;
    vocabulary_size: number;
    categories_count: number;
    avg_confidence_per_category: { [category: string]: number };
  } {
    const avgConfidence: { [category: string]: number } = {};

    this.categoryStats.forEach((stats, category) => {
      avgConfidence[category] = stats.avg_confidence;
    });

    return {
      total_training_samples: this.trainingData.length,
      vocabulary_size: this.vocabulary.size,
      categories_count: this.categoryStats.size,
      avg_confidence_per_category: avgConfidence
    };
  }

  /**
   * Valida modelo com dados de teste
   */
  validateModel(testData: MLTransaction[]): {
    accuracy: number;
    precision_by_category: { [category: string]: number };
    recall_by_category: { [category: string]: number };
    f1_score: number;
  } {
    let correct = 0;
    const predictionsByCategory: { [category: string]: { correct: number; total: number } } = {};

    testData.forEach(testTransaction => {
      const prediction = this.predictCategory(testTransaction.description, testTransaction.type);

      if (!predictionsByCategory[testTransaction.category]) {
        predictionsByCategory[testTransaction.category] = { correct: 0, total: 0 };
      }
      predictionsByCategory[testTransaction.category].total++;

      if (prediction.category === testTransaction.category) {
        correct++;
        predictionsByCategory[testTransaction.category].correct++;
      }
    });

    const accuracy = testData.length > 0 ? correct / testData.length : 0;

    // Calcula precisão e recall por categoria
    const precisionByCategory: { [category: string]: number } = {};
    const recallByCategory: { [category: string]: number } = {};

    Object.entries(predictionsByCategory).forEach(([category, stats]) => {
      precisionByCategory[category] = stats.total > 0 ? stats.correct / stats.total : 0;
      recallByCategory[category] = testData.filter(t => t.category === category).length > 0
        ? stats.correct / testData.filter(t => t.category === category).length
        : 0;
    });

    // Calcula F1-score médio
    const f1Scores = Object.keys(precisionByCategory).map(category =>
      (precisionByCategory[category] + recallByCategory[category]) > 0
        ? 2 * (precisionByCategory[category] * recallByCategory[category]) /
          (precisionByCategory[category] + recallByCategory[category])
        : 0
    );

    const avgF1 = f1Scores.length > 0 ? f1Scores.reduce((a, b) => a + b) / f1Scores.length : 0;

    return {
      accuracy,
      precision_by_category: precisionByCategory,
      recall_by_category: recallByCategory,
      f1_score: avgF1
    };
  }

  /**
   * Exporta dados de treinamento para backup
   */
  exportTrainingData(): MLTransaction[] {
    return [...this.trainingData];
  }

  /**
   * Importa dados de treinamento
   */
  importTrainingData(data: MLTransaction[]): void {
    this.trainingData = [...data];
    this.buildVocabulary();
    this.calculateCategoryStats();
  }
}
