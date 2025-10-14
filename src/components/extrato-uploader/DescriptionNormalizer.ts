/**
 * Utilitários para normalização e análise avançada de descrições de transações
 * 
 * Features:
 * - Detecção e separação de camelCase
 * - Análise palavra por palavra
 * - Extração de keywords compostas
 */

export interface NormalizedVariants {
  original: string;
  normalized: string;
  camelCaseSeparated?: string;
  wordByWord: string[];
  keywords: string[];
}

/**
 * Detecta se uma string está em camelCase
 */
export function isCamelCase(text: string): boolean {
  // Verifica se tem letras maiúsculas no meio da string (não no início)
  return /[a-z][A-Z]/.test(text);
}

/**
 * Separa camelCase em palavras
 * Exemplos:
 * - "DiskAguaEGas" -> "Disk Agua E Gas"
 * - "iFood" -> "i Food"
 * - "McDonalds" -> "Mc Donalds"
 */
export function separateCamelCase(text: string): string {
  // Adiciona espaço antes de letras maiúsculas
  // Mas mantém sequências de maiúsculas juntas (como "E" em "DiskAguaEGas")
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // minúscula seguida de maiúscula
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // Sequência de maiúsculas seguida de minúscula
    .trim();
}

/**
 * Extrai todas as palavras relevantes de uma descrição
 * Remove stopwords e palavras muito curtas
 */
export function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    'de', 'da', 'do', 'dos', 'das', 'e', 'em', 'o', 'a', 'os', 'as',
    'para', 'com', 'sem', 'por', 'na', 'no', 'ao', 'aos', 'pela', 'pelo'
  ]);

  return text
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^\w]/g, '')) // Remove pontuação
    .filter(word => 
      word.length >= 3 && // Pelo menos 3 caracteres
      !stopwords.has(word) && // Não é stopword
      !/^\d+$/.test(word) // Não é só número
    );
}

/**
 * Gera todas as variantes normalizadas de uma descrição
 */
export function generateNormalizedVariants(description: string): NormalizedVariants {
  const normalized = description.toLowerCase().trim();
  
  // Detecta e separa camelCase
  let camelCaseSeparated: string | undefined;
  if (isCamelCase(description)) {
    camelCaseSeparated = separateCamelCase(description);
  }

  // Extrai palavras individuais
  const textToAnalyze = camelCaseSeparated || description;
  const wordByWord = textToAnalyze
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 0);

  // Extrai keywords relevantes
  const keywords = extractKeywords(textToAnalyze);

  return {
    original: description,
    normalized,
    camelCaseSeparated,
    wordByWord,
    keywords
  };
}

/**
 * Normaliza uma descrição para busca
 * Remove acentos, converte para lowercase, remove caracteres especiais
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, ' ') // Remove caracteres especiais
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim();
}

/**
 * Calcula similaridade entre duas strings (0-1)
 * Usa algoritmo de Levenshtein simplificado
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calcula distância de edição (Levenshtein)
 */
function getEditDistance(str1: string, str2: string): number {
  const costs: number[] = [];
  
  for (let i = 0; i <= str1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= str2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (str1.charAt(i - 1) !== str2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[str2.length] = lastValue;
    }
  }
  
  return costs[str2.length];
}

/**
 * Identifica o tipo de descrição
 */
export function identifyDescriptionType(description: string): {
  type: 'camelCase' | 'allCaps' | 'titleCase' | 'mixed' | 'lowercase';
  needsSpecialProcessing: boolean;
} {
  if (isCamelCase(description)) {
    return { type: 'camelCase', needsSpecialProcessing: true };
  }

  if (description === description.toUpperCase() && /[A-Z]/.test(description)) {
    return { type: 'allCaps', needsSpecialProcessing: true };
  }

  if (/^[A-Z][a-z]+(?: [A-Z][a-z]+)*$/.test(description)) {
    return { type: 'titleCase', needsSpecialProcessing: false };
  }

  if (description === description.toLowerCase()) {
    return { type: 'lowercase', needsSpecialProcessing: false };
  }

  return { type: 'mixed', needsSpecialProcessing: true };
}

/**
 * Extrai possíveis nomes de estabelecimentos de uma descrição complexa
 */
export function extractPossibleMerchantNames(description: string): string[] {
  const variants = generateNormalizedVariants(description);
  const possibilities: string[] = [];

  // Adiciona original
  possibilities.push(description);

  // Adiciona camelCase separado
  if (variants.camelCaseSeparated) {
    possibilities.push(variants.camelCaseSeparated);
  }

  // Adiciona combinações de palavras (2-3 palavras consecutivas)
  const words = variants.wordByWord;
  for (let i = 0; i < words.length; i++) {
    // 2 palavras
    if (i + 1 < words.length) {
      possibilities.push(`${words[i]} ${words[i + 1]}`);
    }
    // 3 palavras
    if (i + 2 < words.length) {
      possibilities.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  // Remove duplicatas e retorna
  return [...new Set(possibilities)];
}

