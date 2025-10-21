/**
 * LIMPEZA ESTRATÉGICA DE DESCRIÇÕES DE TRANSAÇÕES
 * 
 * Remove ruídos bancários para extrair a ENTIDADE real da transação.
 * 
 * Exemplo:
 * "PIX ENVIADO CACAU SHOW BR" → "CACAU SHOW"
 * "PAGAMENTO EFETUADO NETFLIX.COM" → "NETFLIX"
 * "COMPRA CARTAO DEBITO UBER *TRIP" → "UBER"
 */

// ============================================================================
// PADRÕES DE RUÍDO BANCÁRIO (Ordenados por prioridade de remoção)
// ============================================================================

/**
 * Padrões que devem ser removidos ANTES de buscar a entidade
 */
const BANKING_NOISE_PATTERNS = [
  // === TRANSAÇÕES PIX ===
  /\bPIX\s+ENVIADO\b/gi,
  /\bPIX\s+RECEBIDO\b/gi,
  /\bPIX\s+TRANSFERENCIA\b/gi,
  /\bTRANSFERENCIA\s+PIX\b/gi,
  /\bPIX\b/gi, // PIX genérico (deve ser o último dos PIX)

  // === PAGAMENTOS ===
  /\bPAGAMENTO\s+EFETUADO\b/gi,
  /\bPAGTO\s+EFETUADO\b/gi,
  /\bPAGAMENTO\s+DE\b/gi,
  /\bPAGTO\s+DE\b/gi,
  /\bPAGAMENTO\b/gi,
  /\bPAGTO\b/gi,

  // === COMPRAS COM CARTÃO ===
  /\bCOMPRA\s+CARTAO\s+DEBITO\b/gi,
  /\bCOMPRA\s+CARTAO\s+CREDITO\b/gi,
  /\bCOMPRA\s+CARTAO\b/gi,
  /\bCOMPRA\s+COM\s+CARTAO\b/gi,
  /\bCOMPRA\s+NO\s+CARTAO\b/gi,
  /\bDEBITO\s+CARTAO\b/gi,
  /\bCARTAO\s+DEBITO\b/gi,
  /\bCARTAO\s+CREDITO\b/gi,
  /\bCOMPRA\b/gi,
  /\bCARTAO\b/gi,

  // === DÉBITOS ===
  /\bDEBITO\s+AUTOMATICO\b/gi,
  /\bDEB\s+AUTOMATICO\b/gi,
  /\bDEBITO\s+DIRETO\b/gi,
  /\bDEB\s+AUT\b/gi,
  /\bDEBITO\b/gi,

  // === TRANSFERÊNCIAS ===
  /\bTRANSFERENCIA\s+ENVIADA\b/gi,
  /\bTRANSFERENCIA\s+RECEBIDA\b/gi,
  /\bTRANSFERENCIA\s+ENTRE\s+CONTAS\b/gi,
  /\bTED\s+ENVIADA\b/gi,
  /\bTED\s+RECEBIDA\b/gi,
  /\bDOC\s+ENVIADA\b/gi,
  /\bDOC\s+RECEBIDA\b/gi,
  /\bTRANSFERENCIA\b/gi,

  // === INVESTIMENTOS ===
  /\bAPLICACAO\s+INVESTIMENTO\b/gi,
  /\bRESGATE\s+INVESTIMENTO\b/gi,
  /\bINVESTIMENTO\b/gi,

  // === SUFIXOS EMPRESARIAIS (BR, LTDA, etc) ===
  /\s+\-\s+BR\b/gi,
  /\s+BR\b/gi,
  /\bLTDA\b\.?/gi,
  /\bS\.A\./gi,
  /\bS\/A\b/gi,
  /\bEIRELI\b/gi,
  /\bME\b/gi,
  /\bEPP\b/gi,
  /\bCIA\b/gi,

  // === DOMÍNIOS E EXTENSÕES WEB ===
  /\.COM\.BR\b/gi,
  /\.COM\b/gi,
  /\.BR\b/gi,
  /\.NET\b/gi,
  /\.ORG\b/gi,
  /WWW\./gi,

  // === INDICADORES DE APLICATIVOS/PLATAFORMAS ===
  /\*TRIP\b/gi, // Uber Trip
  /\*EATS\b/gi, // Uber Eats
  /\bAPP\b/gi,
  /\bAPLICATIVO\b/gi,

  // === DATAS E CÓDIGOS ===
  /\b\d{2}\/\d{2}\/\d{4}\b/g, // Datas: 25/01/2024
  /\b\d{2}\/\d{2}\b/g, // Datas curtas: 25/01
  /\b\d{8,}\b/g, // Códigos numéricos longos

  // === PALAVRAS GENÉRICAS ===
  /\bESTABELECIMENTO\b/gi,
  /\bLOJA\b/gi,
  /\bFILIAL\b/gi,
  /\bUNIDADE\b/gi,
];

/**
 * Padrões de stopwords específicos de transações
 */
const TRANSACTION_STOPWORDS = new Set([
  'de', 'da', 'do', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas',
  'para', 'com', 'sem', 'por',
  'ao', 'aos', 'pela', 'pelo',
  'o', 'a', 'os', 'as',
  'e',
  // Adicionais específicos de transações
  'ref', 'cod', 'codigo', 'num', 'numero',
  'data', 'hora', 'tipo',
]);

// ============================================================================
// FUNÇÃO PRINCIPAL: LIMPEZA ESTRATÉGICA
// ============================================================================

/**
 * Remove ruídos bancários e extrai a ENTIDADE real da transação
 * 
 * @param description - Descrição original da transação
 * @returns Objeto com descrição original, limpa e tokens relevantes
 */
export function cleanTransactionDescription(description: string): {
  original: string;
  cleaned: string;
  tokens: string[];
  removedPatterns: string[];
} {
  const original = description;
  let cleaned = description;
  const removedPatterns: string[] = [];

  // PASSO 1: Remover padrões de ruído bancário
  for (const pattern of BANKING_NOISE_PATTERNS) {
    const beforeLength = cleaned.length;
    const match = cleaned.match(pattern);
    
    if (match) {
      removedPatterns.push(match[0]);
    }
    
    cleaned = cleaned.replace(pattern, ' ');
    
    // Se removeu algo, normaliza espaços
    if (cleaned.length < beforeLength) {
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
    }
  }

  // PASSO 2: Remover pontuação e caracteres especiais (mas mantém espaços)
  cleaned = cleaned
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // PASSO 3: Tokenizar e remover stopwords
  const tokens = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter(token => 
      token.length >= 2 && // Mínimo 2 caracteres
      !TRANSACTION_STOPWORDS.has(token) && // Não é stopword
      !/^\d+$/.test(token) // Não é só números
    );

  // PASSO 4: Reconstruir string limpa dos tokens
  const finalCleaned = tokens.join(' ');

  return {
    original,
    cleaned: finalCleaned,
    tokens,
    removedPatterns: Array.from(new Set(removedPatterns)) // Remove duplicatas
  };
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Verifica se uma descrição contém contexto bancário específico
 * (Útil para decisão de prioridade na Camada 2)
 */
export function hasHighPriorityBankingContext(description: string): boolean {
  const highPriorityPatterns = [
    /\bTARIFA\b/gi,
    /\bJUROS\b/gi,
    /\bMULTA\b/gi,
    /\bIOF\b/gi,
    /\bANUIDADE\b/gi,
    /\bIMPOSTO\b/gi,
  ];

  return highPriorityPatterns.some(pattern => pattern.test(description));
}

/**
 * Extrai o contexto bancário da descrição original
 * (Usado na Passagem 1 - Contexto)
 */
export function extractBankingContext(description: string): string | null {
  const descLower = description.toLowerCase();

  // Mapeamento de contextos bancários
  const contexts: Record<string, RegExp> = {
    'pix_enviado': /\bpix\s+enviado\b/i,
    'pix_recebido': /\bpix\s+recebido\b/i,
    'transferencia': /\btransferencia\b/i,
    'debito_automatico': /\bdebito\s+automatico\b/i,
    'pagamento': /\bpagamento\s+efetuado\b/i,
    'compra_cartao': /\bcompra\s+cartao\b/i,
    'tarifa': /\btarifa\b/i,
    'juros': /\bjuros\b/i,
    'multa': /\bmulta\b/i,
    'iof': /\biof\b/i,
    'anuidade': /\banuidade\b/i,
  };

  for (const [context, pattern] of Object.entries(contexts)) {
    if (pattern.test(descLower)) {
      return context;
    }
  }

  return null;
}

/**
 * Verifica se a string limpa ainda é válida (não ficou vazia demais)
 */
export function isCleanedDescriptionValid(cleaned: string, minLength: number = 3): boolean {
  return cleaned.length >= minLength && cleaned.split(' ').length >= 1;
}

/**
 * Tenta múltiplas variantes de limpeza (mais agressiva ou menos agressiva)
 */
export function getCleaningVariants(description: string): {
  aggressive: string;
  moderate: string;
  light: string;
} {
  // Limpeza agressiva: Remove tudo
  const aggressive = cleanTransactionDescription(description).cleaned;

  // Limpeza moderada: Remove apenas padrões prioritários
  let moderate = description;
  const priorityPatterns = BANKING_NOISE_PATTERNS.slice(0, 20); // Primeiros 20
  for (const pattern of priorityPatterns) {
    moderate = moderate.replace(pattern, ' ');
  }
  moderate = moderate.replace(/\s+/g, ' ').trim();

  // Limpeza leve: Remove apenas PIX e PAGAMENTO
  let light = description;
  const lightPatterns = BANKING_NOISE_PATTERNS.slice(0, 10); // Primeiros 10
  for (const pattern of lightPatterns) {
    light = light.replace(pattern, ' ');
  }
  light = light.replace(/\s+/g, ' ').trim();

  return {
    aggressive,
    moderate,
    light
  };
}

// ============================================================================
// TESTES/EXEMPLOS (Comentados - só para referência)
// ============================================================================

/*
EXEMPLOS DE USO:

Input: "PIX ENVIADO CACAU SHOW BR"
Output: {
  original: "PIX ENVIADO CACAU SHOW BR",
  cleaned: "cacau show",
  tokens: ["cacau", "show"],
  removedPatterns: ["PIX ENVIADO", "BR"]
}

Input: "COMPRA CARTAO DEBITO UBER *TRIP SAO PAULO"
Output: {
  original: "COMPRA CARTAO DEBITO UBER *TRIP SAO PAULO",
  cleaned: "uber sao paulo",
  tokens: ["uber", "sao", "paulo"],
  removedPatterns: ["COMPRA CARTAO DEBITO", "*TRIP"]
}

Input: "PAGAMENTO EFETUADO NETFLIX.COM"
Output: {
  original: "PAGAMENTO EFETUADO NETFLIX.COM",
  cleaned: "netflix",
  tokens: ["netflix"],
  removedPatterns: ["PAGAMENTO EFETUADO", ".COM"]
}
*/

