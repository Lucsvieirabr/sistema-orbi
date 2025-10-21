/**
 * LIMPEZA ESTRATÉGICA EM DUAS PASSAGENS
 * 
 * NOVA ARQUITETURA:
 * - Camada 0 (100): Padrões do Usuário (PRIORIDADE ABSOLUTA)
 * - Camada 1 (95):  Entidades Nomeadas (merchants_dictionary)
 * - Camada 2 (85):  Padrões Bancários Contextuais
 * - Camada 3 (70):  Keywords genéricos
 * - Camada 4 (65):  Machine Learning
 * - Fallback (40):  Categoria padrão
 * 
 * PROCESSO:
 * 1. Passagem de CONTEXTO (string original) → detecta contexto bancário
 * 2. Limpeza estratégica → remove ruídos bancários
 * 3. Passagem de ENTIDADE (string limpa) → identifica estabelecimento
 * 4. Decisão final → escolhe melhor resultado por prioridade
 */

import { BankDictionary } from './BankDictionary';
import { TransactionMLClassifier, MLPrediction, MLTransaction } from './TransactionMLClassifier';
import { GlobalCacheManager, TransactionPatternCache } from './IntelligentCache';
import { supabase } from '@/integrations/supabase/client';
import { 
  generateNormalizedVariants, 
  identifyDescriptionType,
  extractPossibleMerchantNames,
  extractKeywords,
  NormalizedVariants
} from './DescriptionNormalizer';
import {
  cleanTransactionDescription,
  hasHighPriorityBankingContext,
  extractBankingContext,
  isCleanedDescriptionValid
} from './TransactionCleaner';

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

    // Nota: O BankDictionary agora carrega dados do Supabase dinamicamente,
    // então não precisamos mais pré-carregar dados no ML.
    // O ML já tem dados de treinamento iniciais no TransactionMLClassifier.
  }

  /**
   * ============================================================================
   * LIMPEZA ESTRATÉGICA EM DUAS PASSAGENS
   * ============================================================================
   * 
   * NOVA ARQUITETURA:
   * 
   * Passagem 1 (CONTEXTO): Usa string ORIGINAL para detectar contexto bancário
   * Passagem 2 (ENTIDADE): Usa string LIMPA para identificar estabelecimento real
   * 
   * PRIORIDADES:
   * - Camada 0 (100): Padrões do Usuário (ABSOLUTA)
   * - Camada 1 (95):  Entidades Nomeadas (merchants_dictionary)
   * - Camada 2 (85):  Padrões Bancários Contextuais
   * - Camada 3 (70):  Keywords genéricos
   * - Camada 4 (65):  Machine Learning
   * - Fallback (40):  Categoria padrão
   */
  async classifyTransaction(description: string, type: 'income' | 'expense'): Promise<IntelligentClassification> {
    const normalizedDescription = description.toLowerCase().trim();

    // =========================================================================
    // ETAPA 0: LIMPEZA ESTRATÉGICA
    // =========================================================================
    const cleaningResult = cleanTransactionDescription(description);
    const { cleaned, tokens, removedPatterns } = cleaningResult;
    const hasValidCleanedDesc = isCleanedDescriptionValid(cleaned);

    // =========================================================================
    // ETAPA 1: CAMADA 0 - PADRÕES DO USUÁRIO (PRIORIDADE ABSOLUTA)
    // =========================================================================
    // Testa AMBAS: original e limpa
    const userResultOriginal = await this.getUserLearnedPattern(description, type);
    const userResultCleaned = hasValidCleanedDesc 
      ? await this.getUserLearnedPattern(cleaned, type)
      : null;

    // Se encontrou match do usuário com confiança alta, retorna IMEDIATAMENTE
    const userResult = userResultOriginal || userResultCleaned;
    if (userResult && userResult.confidence >= 80) {
      return {
        ...userResult,
        method: 'hybrid',
        features_used: ['user_learned_absolute_priority', 'layer_0'],
        learned_from_user: true
      };
    }

    // =========================================================================
    // ETAPA 2: PASSAGEM DE CONTEXTO (String ORIGINAL)
    // =========================================================================
    let bankingContextResult: IntelligentClassification | null = null;
    
    // Detecta contexto bancário na string original
    const bankingContext = extractBankingContext(description);
    
    if (bankingContext) {
      const contextClassification = await this.getBankingPatternClassification(description, type);
      
      if (contextClassification) {
        bankingContextResult = contextClassification;

        // Se é contexto de ALTA PRIORIDADE (TARIFA, JUROS, MULTA), retorna imediatamente
        if (hasHighPriorityBankingContext(description)) {
          return bankingContextResult;
        }
      }
    }

    // =========================================================================
    // ETAPA 3: PASSAGEM DE ENTIDADE (String LIMPA)
    // =========================================================================
    const entityCandidates: Array<IntelligentClassification & { priority: number }> = [];

    if (hasValidCleanedDesc) {
      // CAMADA 1: ENTIDADES NOMEADAS (Merchants Dictionary)
      const merchantResult = await this.getMerchantClassification(cleaned, type);
      if (merchantResult && merchantResult.confidence >= 60) {
        entityCandidates.push({
          ...merchantResult,
          method: 'hybrid',
          features_used: ['merchant_entity', 'cleaned_description', 'layer_1'],
          priority: 95
        });
      }

      // CAMADA 3: KEYWORDS (Busca por palavras-chave nos tokens limpos)
      if (tokens.length > 0) {
        const keywordResult = await this.classifyByIndividualKeywords(tokens, type);
        if (keywordResult) {
          entityCandidates.push({
            ...keywordResult,
            priority: 70
          });
        }
      }

      // Tenta também com variantes camelCase se aplicável
      const variants = generateNormalizedVariants(cleaned);
      if (variants.camelCaseSeparated) {
        const camelResult = await this.getMerchantClassification(variants.camelCaseSeparated, type);
        if (camelResult && camelResult.confidence >= 60) {
          entityCandidates.push({
            ...camelResult,
            confidence: camelResult.confidence * 0.95,
            method: 'hybrid',
            features_used: ['merchant_entity_camel', 'layer_1'],
            priority: 93
          });
        }
      }
    }

    // CAMADA 4: MACHINE LEARNING (se habilitado)
    if (this.useML) {
      const mlResult = this.getMLClassification(hasValidCleanedDesc ? cleaned : description, type);
      if (mlResult && mlResult.confidence >= 50) {
        entityCandidates.push({
          category: mlResult.category,
          subcategory: mlResult.subcategory,
          confidence: mlResult.confidence,
          method: 'ml',
          features_used: [...mlResult.features_used, 'layer_4'],
          ml_prediction: mlResult,
          priority: 65
        });
      }
    }

    // =========================================================================
    // ETAPA 4: DECISÃO FINAL (Escolhe o melhor resultado)
    // =========================================================================
    
    // Adiciona resultado bancário aos candidatos (se houver)
    if (bankingContextResult) {
      entityCandidates.push({
        ...bankingContextResult,
        priority: 85
      });
    }

    // Adiciona resultado do usuário com confiança média (se houver)
    if (userResult) {
      entityCandidates.push({
        ...userResult,
        method: 'hybrid',
        features_used: ['user_learned_medium', 'layer_0'],
        learned_from_user: true,
        priority: 100
      });
    }

    // Se tem candidatos, escolhe o melhor
    if (entityCandidates.length > 0) {
      // Ordena por: 1) Prioridade, 2) Confiança
      entityCandidates.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return b.confidence - a.confidence;
      });

      const bestMatch = entityCandidates[0];
      const { priority, ...result } = bestMatch;

      // Salva no cache se confiança for boa
      if (this.enableCache && bestMatch.confidence >= 70) {
        this.cache.setCachedPattern(normalizedDescription, result);
      }

      return {
        ...result,
        features_used: [
          ...result.features_used,
          `removed_patterns:${removedPatterns.length}`,
          `cleaned_valid:${hasValidCleanedDesc}`
        ]
      };
    }

    // =========================================================================
    // FALLBACK: Categoria padrão
    // =========================================================================
    const defaultCategory = type === 'income'
      ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)'
      : 'Outros';

    return {
      category: defaultCategory,
      confidence: 40,
      method: 'hybrid',
      features_used: ['type_based_default', 'no_match_found'],
      learned_from_user: false
    };
  }

  /**
   * Classifica usando uma descrição específica (variante)
   * Método auxiliar que implementa a lógica de classificação original
   */
  private async classifyWithDescription(
    description: string, 
    type: 'income' | 'expense',
    normalizedDescription: string
  ): Promise<IntelligentClassification> {

    // Array para armazenar TODAS as possibilidades
    const candidates: Array<IntelligentClassification & { priority: number }> = [];

    // 1. PADROES APRENDIDOS DO USUÁRIO (MÁXIMA PRIORIDADE - 100)
    const userLearnedResult = await this.getUserLearnedPattern(description, type);
    if (userLearnedResult && userLearnedResult.confidence >= 80) {
      candidates.push({
        ...userLearnedResult,
        method: 'user_learned',
        features_used: ['user_learned_patterns', 'user_confirmed'],
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
    const dictionaryResult = await this.dictionary.categorizeAsync(description, type);
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
   * Classifica analisando palavras-chave individuais
   * Útil quando a descrição completa falha mas contém palavras relevantes
   * 
   * Exemplo: "CATARINENSE COBRANCAS" -> analisa "COBRANCAS" -> "Taxas"
   * Exemplo: "Empresa De Navegacao Santa" -> analisa "NAVEGACAO" -> "Transporte"
   */
  private async classifyByIndividualKeywords(
    keywords: string[],
    type: 'income' | 'expense'
  ): Promise<IntelligentClassification | null> {
    const keywordResults: Array<{
      keyword: string;
      classification: IntelligentClassification;
    }> = [];

    // Tenta classificar cada palavra-chave individualmente
    for (const keyword of keywords) {
      try {
        // Busca no dicionário
        const result = await this.dictionary.categorizeAsync(keyword, type);
        
        if (result && result.confidence >= 60) {
          keywordResults.push({
            keyword,
            classification: {
              category: result.category,
              subcategory: result.subcategory,
              confidence: result.confidence * 0.85, // Reduz um pouco a confiança (palavra isolada)
              method: 'keyword_analysis',
              features_used: ['individual_keyword', keyword],
              learned_from_user: result.learned
            }
          });
        }
      } catch (error) {
        // Continua para próxima palavra
        continue;
      }
    }

    // Se encontrou classificações, retorna a de maior confiança
    if (keywordResults.length > 0) {
      keywordResults.sort((a, b) => b.classification.confidence - a.classification.confidence);
      
      const best = keywordResults[0];
      return {
        ...best.classification,
        features_used: [
          ...best.classification.features_used,
          'keyword_extraction',
          `matched_${best.keyword}`
        ]
      };
    }

    return null;
  }

  /**
   * Obtém padrões aprendidos do usuário (user_learned_patterns)
   */
  private async getUserLearnedPattern(description: string, type: 'income' | 'expense'): Promise<IntelligentClassification | null> {
    try {
      const normalizedDesc = description.toLowerCase().trim();
      
      const { data: pattern, error } = await supabase
        .from('user_learned_patterns')
        .select('description, category, subcategory, confidence, usage_count')
        .eq('normalized_description', normalizedDesc)
        .gte('confidence', 75)
        .single();

      if (error || !pattern) {
        return null;
      }

      return {
        category: pattern.category,
        subcategory: pattern.subcategory,
        confidence: Math.min(pattern.confidence + (pattern.usage_count * 3), 98),
        method: 'user_learned',
        features_used: ['user_learned_pattern', 'exact_match'],
        learned_from_user: true
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Obtém classificação de estabelecimentos específicos
   */
  private async getMerchantClassification(description: string, type: 'income' | 'expense'): Promise<IntelligentClassification | null> {
    try {
      const result = await this.dictionary.categorizeAsync(description, type);

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
      const result = await this.dictionary.categorizeAsync(description, type);

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
      const result = await this.dictionary.categorizeAsync(description, type);

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
        'Assinaturas': 'Assinaturas',
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
        'Assinaturas': 'Assinaturas',
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
        'Assinaturas': 'Assinaturas',
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
        'Assinaturas': 'Assinaturas',
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
   * Aprende com correção do usuário - Salva apenas em user_learned_patterns
   */
  async learnFromUserCorrection(description: string, correctCategory: string, subcategory?: string, type: 'income' | 'expense' = 'expense'): Promise<void> {
    const normalizedDescription = description.toLowerCase().trim();

    try {
      // 1. SALVAR EM USER_LEARNED_PATTERNS
      await this.saveToUserLearning(description, correctCategory, subcategory);

      // 2. TREINAMENTO DO MODELO DE ML
      const newTrainingData: MLTransaction = {
        description,
        category: correctCategory,
        subcategory,
        type
      };
      this.mlClassifier.addTrainingData(newTrainingData);

      // 3. ATUALIZAÇÃO DO CACHE
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
    } catch (error) {
      console.error('Erro no aprendizado:', error);
    }
  }

  /**
   * Salva padrão aprendido apenas em user_learned_patterns
   */
  private async saveToUserLearning(description: string, category: string, subcategory?: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_user_learned_pattern', {
        p_description: description,
        p_category: category,
        p_subcategory: subcategory,
        p_confidence: 90
      });

      if (error) {
        console.error('Erro ao salvar padrão do usuário:', error);
      }
    } catch (error) {
      console.error('Erro ao salvar padrão aprendido:', error);
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
   * Pré-carrega padrões do usuário no cache
   */
  async preloadFrequentPatterns(): Promise<void> {
    if (!this.enableCache) return;

    try {
      const { data: userPatterns } = await supabase
        .from('user_learned_patterns')
        .select('description, category, subcategory, confidence, usage_count')
        .gte('confidence', 75)
        .order('usage_count', { ascending: false })
        .limit(100);

      if (userPatterns && userPatterns.length > 0) {
        userPatterns.forEach(pattern => {
          this.cache.setCachedPattern(pattern.description, {
            category: pattern.category,
            subcategory: pattern.subcategory,
            confidence: Math.min(pattern.confidence + (pattern.usage_count * 3), 98),
            method: 'user_preloaded' as const,
            features_used: ['user_preload', 'high_frequency'],
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
