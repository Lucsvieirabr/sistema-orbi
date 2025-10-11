/**
 * Classificador Inteligente de Transações - Sistema Híbrido Avançado
 *
 * Sistema de classificação hierárquica que integra:
 * 1. Padrões aprendidos globalmente (Supabase)
 * 2. Estabelecimentos específicos (BankDictionary)
 * 3. Padrões bancários contextuais
 * 4. Palavras-chave genéricas
 * 5. Machine Learning como fallback
 * 6. Cache inteligente para performance
 */

import { BankDictionary } from './BankDictionary';
import { TransactionMLClassifier, MLPrediction, MLTransaction } from './TransactionMLClassifier';
import { GlobalCacheManager, TransactionPatternCache } from './IntelligentCache';
import { supabase } from '@/integrations/supabase/client';

export interface IntelligentClassification {
  category: string;
  subcategory?: string;
  confidence: number;
  method: 'dictionary' | 'ml' | 'hybrid';
  features_used: string[];
  learned_from_user?: boolean;
  ml_prediction?: MLPrediction;
  dictionary_result?: any;
}

export class IntelligentTransactionClassifier {
  private dictionary: BankDictionary;
  private mlClassifier: TransactionMLClassifier;
  private cache: TransactionPatternCache;
  private useML: boolean;
  private enableCache: boolean;

  constructor(userLocation?: string, userId?: string, useML: boolean = true, enableCache: boolean = true) {
    this.dictionary = new BankDictionary(userLocation, userId);
    this.mlClassifier = new TransactionMLClassifier();
    this.cache = GlobalCacheManager.getInstance().getPatternCache();
    this.useML = useML;
    this.enableCache = enableCache;

    // Alimenta o modelo de ML com dados do dicionário
    this.initializeMLWithDictionaryData();
  }

  /**
   * Inicializa modelo de ML com dados do dicionário existente
   */
  private initializeMLWithDictionaryData(): void {
    const dictionaryData: MLTransaction[] = [];

    // Converte estabelecimentos do dicionário para dados de treinamento
    Object.entries(this.dictionary['dictionary'].merchants).forEach(([merchantKey, merchant]) => {
      dictionaryData.push({
        description: merchantKey,
        category: merchant.category,
        subcategory: merchant.subcategory,
        type: 'expense' // Assume despesas por padrão
      });
    });

    // Converte padrões bancários para dados de treinamento
    Object.entries(this.dictionary['dictionary'].banking).forEach(([context, patterns]) => {
      patterns.forEach(pattern => {
        dictionaryData.push({
          description: context,
          category: pattern.category,
          subcategory: pattern.subcategory,
          type: 'expense'
        });
      });
    });

    // Adiciona dados ao modelo de ML
    dictionaryData.forEach(data => {
      this.mlClassifier.addTrainingData(data);
    });
  }

  /**
   * Classifica transação usando sistema híbrido avançado
   * AVALIA TODAS AS OPÇÕES E ESCOLHE A DE MAIOR CONFIANÇA
   *
   * ESTRATÉGIA:
   * - Coleta TODAS as classificações possíveis
   * - Compara confiança e prioridade
   * - Retorna a melhor opção
   */
  async classifyTransaction(description: string, type: 'income' | 'expense'): Promise<IntelligentClassification> {
    const normalizedDescription = description.toLowerCase().trim();

    // Array para armazenar TODAS as possibilidades
    const candidates: Array<IntelligentClassification & { priority: number }> = [];

    // 1. PADROES APRENDIDOS GLOBALMENTE (MÁXIMA PRIORIDADE - 100)
    const globalLearnedResult = await this.getGlobalLearnedPattern(description, type);
    if (globalLearnedResult && globalLearnedResult.confidence >= 80) {
      candidates.push({
        ...globalLearnedResult,
        method: 'global_learned',
        features_used: ['global_learned_patterns', 'user_confirmed'],
        learned_from_user: true,
        priority: 100
      });
    }

    // 2. CACHE LOCAL (ALTA PRIORIDADE - 98)
    if (this.enableCache) {
      const cachedResult = this.cache.getCachedPattern(normalizedDescription);
      if (cachedResult && cachedResult.confidence >= 75) {
        candidates.push({
          ...cachedResult,
          method: 'cached',
          features_used: ['cache', 'previously_classified'],
          priority: 98
        });
      }
    }

    // 3. USAR BANKDICTIONARY (que já faz a competição interna)
    const dictionaryResult = this.dictionary.categorize(description, type);
    if (dictionaryResult && dictionaryResult.confidence >= 60) {
      // BankDictionary já retorna a melhor opção entre merchant/banking/keywords
      const priority = dictionaryResult.method === 'learned_pattern' ? 100 :
                      dictionaryResult.method === 'merchant_specific' ? 95 :
                      dictionaryResult.method === 'banking_pattern' ? 85 :
                      dictionaryResult.method === 'keyword_match' ? 70 : 60;
      
      candidates.push({
        category: dictionaryResult.category,
        subcategory: dictionaryResult.subcategory,
        confidence: dictionaryResult.confidence,
        method: dictionaryResult.method || 'dictionary',
        features_used: ['bank_dictionary', 'comprehensive'],
        learned_from_user: dictionaryResult.learned || false,
        priority
      });
    }

    // 4. MACHINE LEARNING (MÉDIA PRIORIDADE - 65)
    if (this.useML) {
      const mlResult = this.getMLClassification(description, type);
      if (mlResult && mlResult.confidence >= 50) {
        candidates.push({
          category: mlResult.category,
          subcategory: mlResult.subcategory,
          confidence: mlResult.confidence,
          method: 'ml_prediction',
          features_used: mlResult.features_used,
          ml_prediction: mlResult,
          priority: 65
        });
      }
    }

    // 5. ESCOLHER A MELHOR OPÇÃO
    if (candidates.length > 0) {
      // Ordenar por: 1) Confiança, 2) Prioridade, 3) Se é aprendido
      candidates.sort((a, b) => {
        // Primeiro: maior confiança
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        // Segundo: maior prioridade
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Terceiro: preferir aprendidos
        if (b.learned_from_user !== a.learned_from_user) {
          return (b.learned_from_user ? 1 : 0) - (a.learned_from_user ? 1 : 0);
        }
        return 0;
      });

      const bestMatch = candidates[0];

      // Salva no cache
      if (this.enableCache && bestMatch.confidence >= 70) {
        this.cache.setCachedPattern(normalizedDescription, {
          category: bestMatch.category,
          subcategory: bestMatch.subcategory,
          confidence: bestMatch.confidence,
          method: bestMatch.method,
          features_used: bestMatch.features_used,
          learned_from_user: bestMatch.learned_from_user
        });
      }

      // Remove o campo 'priority' antes de retornar
      const { priority, ...result } = bestMatch;
      return result;
    }

    // 6. CATEGORIA PADRÃO baseada no tipo (último recurso)
    const defaultCategory = type === 'income'
      ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)'
      : 'Outros';

    return {
      category: defaultCategory,
      confidence: 40,
      method: 'default_fallback',
      features_used: ['type_based_default'],
      learned_from_user: false
    };
  }

  /**
   * Obtém padrões aprendidos globalmente do Supabase
   */
  private async getGlobalLearnedPattern(description: string, type: 'income' | 'expense'): Promise<IntelligentClassification | null> {
    try {
      // Busca padrões mais frequentes primeiro
      const { data: frequentPatterns } = await supabase
        .from('global_learned_patterns')
        .select('description, category, subcategory, confidence, usage_count')
        .eq('is_active', true)
        .gte('confidence', 80)
        .gte('usage_count', 3)
        .order('usage_count', { ascending: false })
        .limit(500);

      if (frequentPatterns && frequentPatterns.length > 0) {
        // Busca por correspondência exata primeiro
        const exactMatch = frequentPatterns.find(pattern =>
          pattern.description.toLowerCase() === description.toLowerCase()
        );

        if (exactMatch) {
          return {
            category: exactMatch.category,
            subcategory: exactMatch.subcategory,
            confidence: Math.min(exactMatch.confidence + (exactMatch.usage_count * 2), 98),
            method: 'global_exact_match',
            features_used: ['global_learned_exact', 'high_frequency'],
            learned_from_user: true
          };
        }

        // Busca por correspondência parcial (contém)
        const partialMatch = frequentPatterns.find(pattern =>
          description.toLowerCase().includes(pattern.description.toLowerCase()) ||
          pattern.description.toLowerCase().includes(description.toLowerCase())
        );

        if (partialMatch) {
          return {
            category: partialMatch.category,
            subcategory: partialMatch.subcategory,
            confidence: Math.min(partialMatch.confidence + (partialMatch.usage_count * 1.5), 95),
            method: 'global_partial_match',
            features_used: ['global_learned_partial', 'frequency_boosted'],
            learned_from_user: true
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar padrões aprendidos globalmente:', error);
      return null;
    }
  }

  /**
   * Obtém classificação de estabelecimentos específicos
   */
  private async getMerchantClassification(description: string, type: 'income' | 'expense'): Promise<IntelligentClassification | null> {
    try {
      const result = this.dictionary.categorize(description, type);

      // Só considera estabelecimentos específicos com confiança média-alta
      if (result.confidence >= 70 && result.category !== 'Outros' && result.category !== 'Outras Receitas (Aluguéis, extras, reembolso etc.)') {
        return {
          category: result.category,
          subcategory: result.subcategory,
          confidence: result.confidence,
          method: 'merchant_classification',
          features_used: ['merchant_specific', 'medium_high_confidence'],
          learned_from_user: result.learned || false
        };
      }

      return null;
    } catch (error) {
      console.error('Erro na classificação de estabelecimentos:', error);
      return null;
    }
  }

  /**
   * Obtém classificação de padrões bancários contextuais
   */
  private async getBankingPatternClassification(description: string, type: 'income' | 'expense'): Promise<IntelligentClassification | null> {
    try {
      // Lógica específica para padrões bancários
      const bankingKeywords = {
        'pix enviado': { category: 'Outros', subcategory: 'Transferências' },
        'pix recebido': { category: 'Outras Receitas (Aluguéis, extras, reembolso etc.)', subcategory: 'PIX Recebido' },
        'pagamento efetuado': { category: 'Outros', subcategory: 'Pagamentos' },
        'transferencia': { category: 'Outros', subcategory: 'Transferências' },
        'debito automatico': { category: 'Outros', subcategory: 'Débitos Automáticos' },
        'juros': { category: 'Tarifas Bancárias / Juros / Impostos / Taxas', subcategory: 'Juros' },
        'multa': { category: 'Tarifas Bancárias / Juros / Impostos / Taxas', subcategory: 'Multas' },
        'taxa': { category: 'Tarifas Bancárias / Juros / Impostos / Taxas', subcategory: 'Taxas' }
      };

      const descLower = description.toLowerCase();
      for (const [keyword, categoryInfo] of Object.entries(bankingKeywords)) {
        if (descLower.includes(keyword)) {
          return {
            category: categoryInfo.category,
            subcategory: categoryInfo.subcategory,
            confidence: 80,
            method: 'banking_keyword',
            features_used: ['banking_keywords', 'contextual_match']
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Erro na classificação bancária:', error);
      return null;
    }
  }

  /**
   * Obtém classificação por palavras-chave genéricas
   */
  private async getKeywordClassification(description: string, type: 'income' | 'expense'): Promise<IntelligentClassification | null> {
    try {
      const result = this.dictionary.categorize(description, type);

      // Só considera palavras-chave com confiança média
      if (result.confidence >= 65 && result.confidence < 85) {
        return {
          category: result.category,
          subcategory: result.subcategory,
          confidence: result.confidence,
          method: 'keyword_classification',
          features_used: ['keyword_generic', 'medium_confidence'],
          learned_from_user: result.learned || false
        };
      }

      return null;
    } catch (error) {
      console.error('Erro na classificação por palavras-chave:', error);
      return null;
    }
  }

  /**
   * Obtém classificação do dicionário (mantido para compatibilidade)
   */
  private async getDictionaryClassification(description: string, type: 'income' | 'expense') {
    try {
      const result = this.dictionary.categorize(description, type);

      // Mapeia categorias do dicionário para categorias padrão do banco
      const categoryMapping: { [key: string]: string } = {
        // Categorias de receitas
        'Outras Receitas (Aluguéis, extras, reembolso etc.)': 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
        'Salário / 13° Salário / Férias': 'Salário / 13° Salário / Férias',
        'Pró Labore': 'Pró Labore',
        'Participação de Lucros / Comissões': 'Participação de Lucros / Comissões',
        'Renda de Investimentos': 'Renda de Investimentos',

        // Categorias de despesas
        'Alimentação': 'Alimentação',
        'Transporte': 'Transporte',
        'Casa': 'Casa',
        'Telefone / Apps': 'Telefone / Apps',
        'Proteção Pessoal / Saúde / Farmácia': 'Proteção Pessoal / Saúde / Farmácia',
        'Bem Estar / Beleza': 'Bem Estar / Beleza',
        'Roupas e acessórios': 'Roupas e acessórios',
        'Lazer': 'Lazer',
        'Educação': 'Outros',
        'Pet': 'Pet',
        'Presentes / Compras': 'Presentes / Compras',
        'Despesas Pessoais': 'Despesas Pessoais',
        'Tarifas Bancárias / Juros / Impostos / Taxas': 'Tarifas Bancárias / Juros / Impostos / Taxas',
        'Diarista / Prestadores Serv.': 'Diarista / Prestadores Serv.',
        'Empréstimos / Financiamentos': 'Empréstimos / Financiamentos',
        'Férias / Viagens': 'Férias / Viagens',
        'Filhos / Dependentes': 'Filhos / Dependentes',
        'Investimentos (pelo menos 20% da receita)': 'Investimentos (pelo menos 20% da receita)',
        'Gastos com PJ / Profissionais Autônomos': 'Gastos com PJ / Profissionais Autônomos',
        'Assinaturas': 'Telefone / Apps',
        'Refeição': 'Alimentação',
        'Moradia': 'Casa',

        // Fallbacks
        'Outros': 'Outros',
        'Outras Receitas': 'Outras Receitas (Aluguéis, extras, reembolso etc.)'
      };

      const mappedCategory = categoryMapping[result.category] || (type === 'income' ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)' : 'Outros');

      return {
        category: mappedCategory,
        subcategory: result.subcategory,
        confidence: result.confidence,
        method: 'dictionary',
        learned_from_user: result.learned || false,
        features_used: ['dictionary_rules', 'learned_patterns']
      };
    } catch (error) {
      return {
        category: type === 'income' ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)' : 'Outros',
        confidence: 0.3,
        method: 'dictionary',
        features_used: ['fallback']
      };
    }
  }

  /**
   * Obtém classificação do modelo de ML
   */
  private getMLClassification(description: string, type: 'income' | 'expense'): MLPrediction | null {
    if (!this.useML) return null;

    try {
      const result = this.mlClassifier.predictCategory(description, type);

      if (!result) return null;

      // Mapeia categorias do ML para categorias padrão do banco
      const categoryMapping: { [key: string]: string } = {
        // Categorias de receitas
        'Outras Receitas (Aluguéis, extras, reembolso etc.)': 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
        'Salário / 13° Salário / Férias': 'Salário / 13° Salário / Férias',
        'Pró Labore': 'Pró Labore',
        'Participação de Lucros / Comissões': 'Participação de Lucros / Comissões',
        'Renda de Investimentos': 'Renda de Investimentos',

        // Categorias de despesas
        'Alimentação': 'Alimentação',
        'Transporte': 'Transporte',
        'Casa': 'Casa',
        'Telefone / Apps': 'Telefone / Apps',
        'Proteção Pessoal / Saúde / Farmácia': 'Proteção Pessoal / Saúde / Farmácia',
        'Bem Estar / Beleza': 'Bem Estar / Beleza',
        'Roupas e acessórios': 'Roupas e acessórios',
        'Lazer': 'Lazer',
        'Educação': 'Outros',
        'Pet': 'Pet',
        'Presentes / Compras': 'Presentes / Compras',
        'Despesas Pessoais': 'Despesas Pessoais',
        'Tarifas Bancárias / Juros / Impostos / Taxas': 'Tarifas Bancárias / Juros / Impostos / Taxas',
        'Diarista / Prestadores Serv.': 'Diarista / Prestadores Serv.',
        'Empréstimos / Financiamentos': 'Empréstimos / Financiamentos',
        'Férias / Viagens': 'Férias / Viagens',
        'Filhos / Dependentes': 'Filhos / Dependentes',
        'Investimentos (pelo menos 20% da receita)': 'Investimentos (pelo menos 20% da receita)',
        'Gastos com PJ / Profissionais Autônomos': 'Gastos com PJ / Profissionais Autônomos',
        'Assinaturas': 'Telefone / Apps',
        'Refeição': 'Alimentação',
        'Moradia': 'Casa',

        // Fallbacks
        'Outros': 'Outros',
        'Outras Receitas': 'Outras Receitas (Aluguéis, extras, reembolso etc.)'
      };

      const mappedCategory = categoryMapping[result.category] || (type === 'income' ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)' : 'Outros');

      return {
        ...result,
        category: mappedCategory
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Decide melhor classificação baseada em lógica híbrida
   */
  private decideBestClassification(results: any, description: string, type: 'income' | 'expense'): IntelligentClassification {
    const dictResult = results.dictionary;
    const mlResult = results.ml;

    // 1. Se dicionário tem alta confiança (>90%), usa dicionário
    if (dictResult.confidence >= 90) {
      return {
        ...dictResult,
        method: 'dictionary',
        features_used: [...dictResult.features_used, 'high_confidence']
      };
    }

    // 2. Se ML está disponível e tem confiança alta (>80%), usa ML
    if (mlResult && mlResult.confidence >= 80) {
      return {
        category: mlResult.category,
        subcategory: mlResult.subcategory,
        confidence: mlResult.confidence,
        method: 'ml',
        features_used: mlResult.features_used,
        ml_prediction: mlResult
      };
    }

    // 3. Se dicionário tem confiança média (70-89%) e ML concorda, usa dicionário
    if (dictResult.confidence >= 70 && mlResult) {
      const categoryMatch = dictResult.category === mlResult.category;
      const subcategoryMatch = (!dictResult.subcategory && !mlResult.subcategory) ||
                              (dictResult.subcategory === mlResult.subcategory);

      if (categoryMatch && subcategoryMatch) {
        return {
          category: dictResult.category,
          subcategory: dictResult.subcategory,
          confidence: (dictResult.confidence + mlResult.confidence) / 2,
          method: 'hybrid',
          features_used: ['dictionary_consensus', 'ml_consensus'],
          dictionary_result: dictResult,
          ml_prediction: mlResult
        };
      }
    }

    // 4. Se ML tem confiança média e dicionário baixa, usa ML
    if (mlResult && mlResult.confidence >= 60 && dictResult.confidence < 70) {
      return {
        category: mlResult.category,
        subcategory: mlResult.subcategory,
        confidence: mlResult.confidence,
        method: 'ml',
        features_used: mlResult.features_used,
        ml_prediction: mlResult
      };
    }

    // 5. Fallback: usa dicionário (mais confiável para casos específicos)
    return {
      ...dictResult,
      method: 'dictionary',
      features_used: [...dictResult.features_used, 'fallback_primary']
    };
  }

  /**
   * Aprende com correção do usuário - Sistema de Aprendizado Avançado
   *
   * Implementa múltiplas estratégias de aprendizado:
   * 1. Persistência global no Supabase
   * 2. Aprendizado local no BankDictionary
   * 3. Treinamento do modelo de ML
   * 4. Cache inteligente
   * 5. Detecção de padrões recorrentes
   */
  async learnFromUserCorrection(description: string, correctCategory: string, subcategory?: string, type: 'income' | 'expense' = 'expense'): Promise<void> {
    const normalizedDescription = description.toLowerCase().trim();
    const currentTime = new Date().toISOString();

    try {
      // 1. PERSISTÊNCIA GLOBAL NO SUPABASE (MÁXIMA PRIORIDADE)
      await this.saveToGlobalLearning(description, correctCategory, subcategory, type, currentTime);

      // 2. APRENDIZADO LOCAL NO BANKDICTIONARY
      await this.dictionary.learnFromCorrection(description, correctCategory, subcategory, 90);

      // 3. TREINAMENTO DO MODELO DE ML
    const newTrainingData: MLTransaction = {
      description,
      category: correctCategory,
      subcategory,
        type
    };
    this.mlClassifier.addTrainingData(newTrainingData);

      // 4. ATUALIZAÇÃO DO CACHE
      if (this.enableCache) {
        const learnedResult = {
          category: correctCategory,
          subcategory,
          confidence: 95,
          method: 'user_corrected',
          features_used: ['user_correction', 'high_confidence'],
          learned_from_user: true
        };
        this.cache.setCachedPattern(normalizedDescription, learnedResult);
      }

      // 5. DETECÇÃO DE PADRÕES RECORRENTES
      await this.detectRecurrentPatterns(description, correctCategory, subcategory, type);

    } catch (error) {
      console.error('Erro no aprendizado avançado:', error);
    }
  }

  /**
   * Salva padrão aprendido no banco global Supabase
   */
  private async saveToGlobalLearning(description: string, category: string, subcategory?: string, type: 'income' | 'expense' = 'expense', timestamp: string = new Date().toISOString()): Promise<void> {
    try {
      // Usa a função RPC do banco para atualizar padrões aprendidos
      await (supabase as any).rpc('update_global_learned_pattern', {
        p_description: description,
        p_category: category,
        p_subcategory: subcategory,
        p_confidence: 90,
        p_user_vote: true,
        p_pattern_type: type
      });

    } catch (error) {
      console.error('Erro ao salvar no banco global:', error);
    }
  }

  /**
   * Detecta e registra padrões recorrentes
   */
  private async detectRecurrentPatterns(description: string, category: string, subcategory?: string, type: 'income' | 'expense' = 'expense'): Promise<void> {
    try {
      // Busca transações similares no histórico recente (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: similarTransactions } = await supabase
        .from('transactions')
        .select('description, category_id')
        .ilike('description', `%${description.split(' ')[0]}%`)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .limit(10);

      if (similarTransactions && similarTransactions.length >= 3) {
        // Registra como padrão frequente
        await this.saveToGlobalLearning(
          description,
          category,
          subcategory,
          type,
          new Date().toISOString()
        );
      }
    } catch (error) {
      console.error('Erro na detecção de padrões recorrentes:', error);
    }
  }

  /**
   * Obtém estatísticas dos dois sistemas
   */
  getSystemStats(): {
    dictionary: any;
    ml: any;
    hybrid: {
      total_classifications: number;
      dictionary_usage: number;
      ml_usage: number;
      hybrid_usage: number;
      average_confidence: number;
    };
  } {
    return {
      dictionary: this.dictionary.getStats(),
      ml: this.mlClassifier.getModelStats(),
      hybrid: {
        total_classifications: 0, // Será incrementado durante uso
        dictionary_usage: 0,
        ml_usage: 0,
        hybrid_usage: 0,
        average_confidence: 0
      }
    };
  }

  /**
   * Valida sistema híbrido com dados de teste
   */
  async validateHybridSystem(testData: Array<{ description: string; expectedCategory: string; type: 'income' | 'expense' }>): Promise<{
    accuracy: number;
    precision_by_category: { [category: string]: number };
    recall_by_category: { [category: string]: number };
    f1_score: number;
    method_distribution: { [method: string]: number };
  }> {
    let correct = 0;
    let totalClassifications = 0;
    const methodUsage: { [method: string]: number } = {};
    const predictionsByCategory: { [category: string]: { correct: number; total: number } } = {};

    for (const testCase of testData) {
      totalClassifications++;
      const result = await this.classifyTransaction(testCase.description, testCase.type);

      // Conta uso de métodos
      methodUsage[result.method] = (methodUsage[result.method] || 0) + 1;

      // Verifica acurácia
      if (!predictionsByCategory[testCase.expectedCategory]) {
        predictionsByCategory[testCase.expectedCategory] = { correct: 0, total: 0 };
      }
      predictionsByCategory[testCase.expectedCategory].total++;

      if (result.category === testCase.expectedCategory) {
        correct++;
        predictionsByCategory[testCase.expectedCategory].correct++;
      }
    }

    const accuracy = testData.length > 0 ? correct / testData.length : 0;

    // Calcula métricas por categoria
    const precisionByCategory: { [category: string]: number } = {};
    const recallByCategory: { [category: string]: number } = {};

    Object.entries(predictionsByCategory).forEach(([category, stats]) => {
      precisionByCategory[category] = stats.total > 0 ? stats.correct / stats.total : 0;
      recallByCategory[category] = testData.filter(t => t.expectedCategory === category).length > 0
        ? stats.correct / testData.filter(t => t.expectedCategory === category).length
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
      f1_score: avgF1,
      method_distribution: methodUsage
    };
  }

  /**
   * Exporta dados de treinamento híbrido
   */
  exportTrainingData(): {
    dictionary: any;
    ml: MLTransaction[];
  } {
    return {
      dictionary: this.dictionary.exportDictionary(),
      ml: this.mlClassifier.exportTrainingData()
    };
  }

  /**
   * Importa dados de treinamento híbrido
   */
  importTrainingData(data: { dictionary: any; ml: MLTransaction[] }): void {
    if (data.dictionary) {
      this.dictionary.importDictionary(data.dictionary);
    }
    if (data.ml) {
      this.mlClassifier.importTrainingData(data.ml);
    }
  }

  /**
   * Obtém dicionário para acesso direto
   */
  getDictionary(): BankDictionary {
    return this.dictionary;
  }

  /**
   * Obtém classificador de ML para acesso direto
   */
  getMLClassifier(): TransactionMLClassifier {
    return this.mlClassifier;
  }

  /**
   * Obtém cache para acesso direto
   */
  getCache(): TransactionPatternCache {
    return this.cache;
  }

  /**
   * Obtém estatísticas de performance completas
   */
  getPerformanceStats(): {
    dictionary: any;
    ml: any;
    cache: any;
    hybrid: {
      total_classifications: number;
      cache_hits: number;
      dictionary_usage: number;
      ml_usage: number;
      hybrid_usage: number;
      average_confidence: number;
      average_response_time: number;
    };
  } {
    const cacheStats = this.cache.getAllStats();
    const dictStats = this.dictionary.getStats();
    const mlStats = this.mlClassifier.getModelStats();

    return {
      dictionary: dictStats,
      ml: mlStats,
      cache: cacheStats,
      hybrid: {
        total_classifications: 0, // Será incrementado durante uso
        cache_hits: cacheStats.totalHits,
        dictionary_usage: 0,
        ml_usage: 0,
        hybrid_usage: 0,
        average_confidence: 0,
        average_response_time: 0
      }
    };
  }

  /**
   * Limpa cache do sistema
   */
  clearCache(): void {
    this.cache.clearAll();
  }

  /**
   * Otimiza cache baseado em padrões de uso
   */
  optimizeCache(): void {
    this.cache.optimize();
  }

  /**
   * Pré-carrega padrões frequentemente usados no cache e no dicionário local
   */
  async preloadFrequentPatterns(): Promise<void> {
    if (!this.enableCache) return;

    try {
      // 1. CARREGA PADRÕES GLOBAIS MAIS FREQUENTES
      const { data: frequentPatterns } = await supabase
        .from('global_learned_patterns')
        .select('description, category, subcategory, confidence, usage_count')
        .eq('is_active', true)
        .gte('confidence', 75)
        .gte('usage_count', 2)
        .order('usage_count', { ascending: false })
        .limit(300);

      if (frequentPatterns && frequentPatterns.length > 0) {
        frequentPatterns.forEach(pattern => {
          // Adiciona ao cache
          const result = {
            category: pattern.category,
            subcategory: pattern.subcategory,
            confidence: Math.min(pattern.confidence + (pattern.usage_count * 2), 98),
            method: 'global_preloaded' as const,
            features_used: ['global_preload', 'high_frequency'],
            learned_from_user: true
          };

          this.cache.setCachedPattern(pattern.description, result);

          // Também adiciona ao dicionário local para aprendizado
          if (pattern.usage_count >= 5) {
            this.dictionary.addLearnedPattern(
              pattern.description,
              pattern.category,
              pattern.subcategory,
              pattern.confidence,
              new Date().toISOString()
            );
          }
        });
      }

      // 2. CARREGA PADRÕES DE ESTABELECIMENTOS FREQUENTES
      const { data: merchantPatterns } = await supabase
        .from('global_learned_patterns')
        .select('description, category, subcategory, confidence, usage_count')
        .eq('is_active', true)
        .gte('confidence', 85)
        .gte('usage_count', 3)
        .ilike('description', '%uber%|%ifood%|%mercado%|%farmacia%|%posto%|%netflix%|%spotify%|%academia%|%dentista%|%dr%')
        .order('usage_count', { ascending: false })
        .limit(200);

      if (merchantPatterns && merchantPatterns.length > 0) {
        merchantPatterns.forEach(pattern => {
          this.cache.setCachedPattern(pattern.description, {
            category: pattern.category,
            subcategory: pattern.subcategory,
            confidence: pattern.confidence,
            method: 'merchant_preloaded' as const,
            features_used: ['merchant_preload'],
            learned_from_user: true
          });
        });
      }

    } catch (error) {
      console.error('Erro no pré-carregamento:', error);
    }
  }

  /**
   * Habilita/Desabilita cache
   */
  setCacheEnabled(enabled: boolean): void {
    this.enableCache = enabled;
  }

  /**
   * Define configuração de cache
   */
  configureCache(config: {
    patternCacheSize?: number;
    merchantCacheSize?: number;
    categoryCacheSize?: number;
    ttl?: number;
  }): void {
    if (config.patternCacheSize) {
      // Acesso interno ao cache para redimensionar
      (this.cache as any).patternCache.resize(config.patternCacheSize);
    }
    if (config.merchantCacheSize) {
      (this.cache as any).merchantCache.resize(config.merchantCacheSize);
    }
    if (config.categoryCacheSize) {
      (this.cache as any).categoryCache.resize(config.categoryCacheSize);
    }
    if (config.ttl) {
      (this.cache as any).patternCache.setTTL(config.ttl);
      (this.cache as any).merchantCache.setTTL(config.ttl);
      (this.cache as any).categoryCache.setTTL(config.ttl);
    }
  }
}
