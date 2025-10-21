/**
 * LIMPEZA ESTRATÉGICA DE DESCRIÇÕES DE TRANSAÇÕES (Frontend)
 * 
 * Versão TypeScript pura para uso no frontend.
 * Remove ruídos bancários para extrair a ENTIDADE real da transação.
 */

// ============================================================================
// PADRÕES DE RUÍDO BANCÁRIO
// ============================================================================

const BANKING_NOISE_PATTERNS = [
  // PIX
  /\bPIX\s+ENVIADO\b/gi,
  /\bPIX\s+RECEBIDO\b/gi,
  /\bPIX\s+TRANSFERENCIA\b/gi,
  /\bTRANSFERENCIA\s+PIX\b/gi,
  /\bPIX\b/gi,

  // Pagamentos
  /\bPAGAMENTO\s+EFETUADO\b/gi,
  /\bPAGTO\s+EFETUADO\b/gi,
  /\bPAGAMENTO\s+DE\b/gi,
  /\bPAGTO\s+DE\b/gi,
  /\bPAGAMENTO\b/gi,
  /\bPAGTO\b/gi,

  // Cartão
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

  // Débitos
  /\bDEBITO\s+AUTOMATICO\b/gi,
  /\bDEB\s+AUTOMATICO\b/gi,
  /\bDEBITO\s+DIRETO\b/gi,
  /\bDEB\s+AUT\b/gi,
  /\bDEBITO\b/gi,

  // Transferências
  /\bTRANSFERENCIA\s+ENVIADA\b/gi,
  /\bTRANSFERENCIA\s+RECEBIDA\b/gi,
  /\bTRANSFERENCIA\s+ENTRE\s+CONTAS\b/gi,
  /\bTED\s+ENVIADA\b/gi,
  /\bTED\s+RECEBIDA\b/gi,
  /\bDOC\s+ENVIADA\b/gi,
  /\bDOC\s+RECEBIDA\b/gi,
  /\bTRANSFERENCIA\b/gi,

  // Investimentos
  /\bAPLICACAO\s+INVESTIMENTO\b/gi,
  /\bRESGATE\s+INVESTIMENTO\b/gi,
  /\bINVESTIMENTO\b/gi,

  // Sufixos empresariais
  /\s+\-\s+BR\b/gi,
  /\s+BR\b/gi,
  /\bLTDA\b\.?/gi,
  /\bS\.A\./gi,
  /\bS\/A\b/gi,
  /\bEIRELI\b/gi,
  /\bME\b/gi,
  /\bEPP\b/gi,
  /\bCIA\b/gi,

  // Domínios web
  /\.COM\.BR\b/gi,
  /\.COM\b/gi,
  /\.BR\b/gi,
  /\.NET\b/gi,
  /\.ORG\b/gi,
  /WWW\./gi,

  // Apps
  /\*TRIP\b/gi,
  /\*EATS\b/gi,
  /\bAPP\b/gi,
  /\bAPLICATIVO\b/gi,

  // Datas e códigos
  /\b\d{2}\/\d{2}\/\d{4}\b/g,
  /\b\d{2}\/\d{2}\b/g,
  /\b\d{8,}\b/g,

  // Genéricos
  /\bESTABELECIMENTO\b/gi,
  /\bLOJA\b/gi,
  /\bFILIAL\b/gi,
  /\bUNIDADE\b/gi,
];

const TRANSACTION_STOPWORDS = new Set([
  'de', 'da', 'do', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas',
  'para', 'com', 'sem', 'por',
  'ao', 'aos', 'pela', 'pelo',
  'o', 'a', 'os', 'as', 'e',
  'ref', 'cod', 'codigo', 'num', 'numero',
  'data', 'hora', 'tipo',
]);

// ============================================================================
// FUNÇÕES PRINCIPAIS
// ============================================================================

export interface CleanedTransaction {
  original: string;
  cleaned: string;
  tokens: string[];
  removedPatterns: string[];
}

export function cleanTransactionDescription(description: string): CleanedTransaction {
  const original = description;
  let cleaned = description;
  const removedPatterns: string[] = [];

  // Remove padrões de ruído
  for (const pattern of BANKING_NOISE_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      removedPatterns.push(match[0]);
    }
    cleaned = cleaned.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
  }

  // Remove pontuação
  cleaned = cleaned.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // Tokeniza e remove stopwords
  const tokens = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter(token => 
      token.length >= 2 &&
      !TRANSACTION_STOPWORDS.has(token) &&
      !/^\d+$/.test(token)
    );

  return {
    original,
    cleaned: tokens.join(' '),
    tokens,
    removedPatterns: Array.from(new Set(removedPatterns))
  };
}

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

export function extractBankingContext(description: string): string | null {
  const descLower = description.toLowerCase();

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

export function isCleanedDescriptionValid(cleaned: string, minLength: number = 3): boolean {
  return cleaned.length >= minLength && cleaned.split(' ').length >= 1;
}

