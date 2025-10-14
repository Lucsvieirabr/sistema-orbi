/**
 * CSVParser Melhorado com Dicionário Pesado
 *
 * Esta versão integra o dicionário pesado para melhorar drasticamente
 * a precisão da categorização automática de transações.
 */

import { ParsedTransaction } from './CSVParser';
import { BankDictionary } from './BankDictionary';

export class EnhancedCSVParser {
  private dictionary: BankDictionary;

  constructor() {
    this.dictionary = new BankDictionary();
  }

  /**
   * Analisa dados CSV usando dicionário pesado para categorização
   */
  parseCSVData(csvData: Record<string, string>[]): { transactions: ParsedTransaction[], errors: string[] } {
    const errors: string[] = [];
    const transactions: ParsedTransaction[] = [];

    if (!csvData || csvData.length === 0) {
      errors.push('Dados CSV vazios ou inválidos');
      return { transactions: [], errors };
    }

    // Filtrar linhas de metadata e saldos
    const filteredData = csvData.filter(row => !this.isMetadataRow(row) && !this.isSaldoRow(row));

    if (filteredData.length === 0) {
      errors.push('Nenhuma linha de dados válida encontrada após filtrar metadata e saldos');
      return { transactions: [], errors };
    }

    // Identificar colunas automaticamente (mesma lógica do CSVParser original)
    const headers = Object.keys(filteredData[0]);
    const columnMapping = this.identifyColumns(headers);

    if (!columnMapping.date || !columnMapping.description || !columnMapping.value) {
      errors.push('Não foi possível identificar as colunas obrigatórias (data, descrição, valor) no arquivo CSV');
      return { transactions: [], errors };
    }

    // Processar cada linha usando o dicionário pesado
    filteredData.forEach((row, index) => {
      try {
        const transaction = this.parseRowWithHeavyDictionary(row, columnMapping, index);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        errors.push(`Erro na linha ${index + 1}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    });

    return { transactions, errors };
  }

  /**
   * Filtra linhas de metadata que não são transações
   */
  private isMetadataRow(row: Record<string, string>): boolean {
    const values = Object.values(row).join(' ').toLowerCase();

    // Padrões comuns de metadata
    const metadataPatterns = [
      'conta',
      'período',
      'saldo inicial',
      'saldo final',
      'extrato',
      'banco',
      'agência',
      'conta corrente'
    ];

    return metadataPatterns.some(pattern => values.includes(pattern));
  }

  /**
   * Verifica se a linha representa um saldo (não é uma transação real)
   */
  private isSaldoRow(row: Record<string, string>): boolean {
    const values = Object.values(row).join(' ').toLowerCase();

    // Padrões que indicam saldo (não transações reais)
    const saldoPatterns = [
      /\bs\s*a\s*l\s*d\s*o\b/i,     // "S A L D O" ou "saldo" (com ou sem espaços)
      /^saldo\b/i,                  // "Saldo" no início
      /\bsaldo anterior\b/i,        // "Saldo anterior"
      /\bsaldo inicial\b/i,         // "Saldo inicial"
      /\bsaldo final\b/i,           // "Saldo final"
      /\bsaldo do dia\b/i,          // "Saldo do dia"
      /\bsaldo atual\b/i            // "Saldo atual"
    ];

    return saldoPatterns.some(pattern => pattern.test(values));
  }

  /**
   * Identifica colunas automaticamente baseado em palavras-chave
   */
  private identifyColumns(headers: string[]): {
    date?: string;
    description?: string;
    value?: string;
    balance?: string;
    type?: string;
  } {
    const mapping: Record<string, string> = {};

    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().trim();

      // Data
      if (this.matchesKeyword(lowerHeader, ['data', 'date', 'lancamento', 'lançamento'])) {
        mapping.date = header;
      }

      // Descrição
      if (this.matchesKeyword(lowerHeader, ['descricao', 'descrição', 'description', 'title', 'historico', 'histórico', 'referencia', 'referência'])) {
        mapping.description = header;
      }

      // Valor
      if (this.matchesKeyword(lowerHeader, ['valor', 'value', 'amount', 'montante', 'total'])) {
        mapping.value = header;
      }

      // Saldo
      if (this.matchesKeyword(lowerHeader, ['saldo', 'balance', 'saldo atual'])) {
        mapping.balance = header;
      }

      // Tipo/Histórico
      if (this.matchesKeyword(lowerHeader, ['tipo', 'type', 'historico', 'histórico', 'natureza'])) {
        mapping.type = header;
      }
    });

    return mapping;
  }

  /**
   * Verifica se header corresponde a alguma palavra-chave
   */
  private matchesKeyword(header: string, keywords: string[]): boolean {
    return keywords.some(keyword =>
      header.includes(keyword) || header === keyword
    );
  }

  /**
   * Analisa uma linha específica usando dicionário pesado
   */
  private parseRowWithHeavyDictionary(row: Record<string, string>, columnMapping: Record<string, string>, index: number): ParsedTransaction | null {
    // Extrair valores básicos
    const rawDate = row[columnMapping.date];
    const rawValue = row[columnMapping.value];
    const rawType = row[columnMapping.type];

    // Construir descrição seguindo lógica de prioridade melhorada
    let rawDescription = '';
    const lancamento = row[columnMapping.description] || '';
    const detalhes = row['Detalhes'] || '';

    // PRIORIDADE 1: Extrair de 'Detalhes' tudo que vem após o horário (Pix, Compra com Cartão)
    if (detalhes.trim()) {
      const extractedFromDetails = this.extractDescriptionAfterTime(detalhes);
      if (extractedFromDetails && extractedFromDetails.trim()) {
        rawDescription = extractedFromDetails.trim();
      }
    }

    // PRIORIDADE 2: Se não encontrou após horário, verificar se Detalhes tem conteúdo direto
    // Útil para "Pagamento de Boleto", "Pagamento de Impostos", etc.
    if (!rawDescription && detalhes.trim()) {
      const directContent = this.extractDirectDetailsContent(detalhes, lancamento);
      if (directContent && directContent.trim()) {
        rawDescription = directContent.trim();
      }
    }

    // PRIORIDADE 3: Se ainda não encontrou em Detalhes, usar coluna de descrição principal (Lançamento)
    if (!rawDescription && lancamento) {
      rawDescription = lancamento;
    }

    if (!rawDate || !rawDescription || !rawValue) {
      throw new Error('Dados obrigatórios ausentes (data, descrição ou valor)');
    }

    // Converter data (mesma lógica do CSVParser original)
    const date = this.parseDate(rawDate);
    if (!date) {
      throw new Error(`Formato de data inválido: ${rawDate}`);
    }

    // Converter valor (mesma lógica do CSVParser original)
    const value = this.parseValue(rawValue);
    if (value === null) {
      throw new Error(`Valor inválido: ${rawValue}`);
    }

    // Determinar tipo (income/expense) - mesma lógica do CSVParser original
    const type = this.determineTransactionType(value, rawType, rawDescription);

    // 🔥 USAR DICIONÁRIO PESADO PARA CATEGORIZAÇÃO
    const categorization = this.dictionary.categorize(rawDescription, type);

    // Detecção de parcelas (mesma lógica do CSVParser original)
    const { installments, installment_number } = this.detectInstallments(rawDescription);

    return {
      id: `temp_${index}_${Date.now()}`,
      date,
      description: rawDescription.trim(),
      value: Math.abs(value),
      type,
      category_id: undefined, // Será definido pelo usuário ou por busca na tabela categories
      category_name: categorization.category,
      installments: installments || undefined,
      installment_number: installment_number || undefined,
      is_fixed: false,
      payment_method: type === 'expense' ? 'debit' : undefined,
      // 🔥 NOVOS CAMPOS DO DICIONÁRIO PESADO
      confidence: categorization.confidence,
      subcategory: categorization.subcategory
    };
  }

  /**
   * Converte diferentes formatos de data
   */
  private parseDate(rawDate: string): string | null {
    if (!rawDate) return null;

    const trimmedDate = rawDate.trim();

    // Tentar diferentes formatos
    const formats = [
      // DD/MM/YYYY (brasileiro)
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // YYYY-MM-DD (ISO)
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // DD-MM-YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/
    ];

    for (const format of formats) {
      const match = trimmedDate.match(format);
      if (match) {
        const [, part1, part2, part3] = match;

        if (format === formats[0]) {
          // DD/MM/YYYY -> YYYY-MM-DD
          return `${part3}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
        } else if (format === formats[1]) {
          // YYYY-MM-DD já está no formato correto
          return trimmedDate;
        } else if (format === formats[2]) {
          // DD-MM-YYYY -> YYYY-MM-DD
          return `${part3}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
        }
      }
    }

    return null;
  }

  /**
   * Converte diferentes formatos de valor
   */
  private parseValue(rawValue: string): number | null {
    if (!rawValue) return null;

    // Remover espaços e converter
    const cleaned = rawValue.trim().replace(/\s/g, '');

    // Tratar diferentes formatos
    let numericValue: number;

    if (cleaned.includes(',')) {
      // Formato brasileiro: 1.234,56 ou -1.234,56
      numericValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
      // Formato americano: 1234.56 ou -1234.56
      numericValue = parseFloat(cleaned);
    }

    return isNaN(numericValue) ? null : numericValue;
  }

  /**
   * Determina se é receita ou despesa baseado no valor e contexto
   */
  private determineTransactionType(value: number, rawType?: string, description?: string): 'income' | 'expense' {
    // Primeiro, verificar se há indicador explícito no tipo/histórico
    if (rawType) {
      const typeText = rawType.toLowerCase();
      if (typeText.includes('recebido') || typeText.includes('recebimento') ||
          typeText.includes('credito') || typeText.includes('crédito') ||
          typeText.includes('entrada') || typeText.includes('income')) {
        return 'income';
      }
      if (typeText.includes('enviado') || typeText.includes('envio') ||
          typeText.includes('debito') || typeText.includes('débito') ||
          typeText.includes('saida') || typeText.includes('saída') ||
          typeText.includes('pagamento') || typeText.includes('expense')) {
        return 'expense';
      }
    }

    // Verificar descrição para indicadores
    if (description) {
      const descText = description.toLowerCase();
      if (descText.includes('pix recebido') || descText.includes('recebido') ||
          descText.includes('devolução') || descText.includes('reembolso') ||
          descText.includes('salário') || descText.includes('renda')) {
        return 'income';
      }
      if (descText.includes('pix enviado') || descText.includes('enviado') ||
          descText.includes('pagamento') || descText.includes('compra')) {
        return 'expense';
      }
    }

    // Por padrão, usar o sinal do valor
    return value >= 0 ? 'income' : 'expense';
  }

  /**
   * Detecta parcelas baseado em padrões na descrição
   */
  private detectInstallments(description: string): { installments?: number; installment_number?: number } {
    const descText = description.toLowerCase();

    // Padrões comuns de parcelas
    const patterns = [
      /(\d+)\/(\d+)/,        // 1/12, 2/12
      /(\d+)\s+de\s+(\d+)/,  // 1 de 12, 2 de 12
      /parcela\s+(\d+)\/(\d+)/i, // Parcela 1/12
      /(\d+)\/(\d+)\s*parc/i, // 1/12 parc
    ];

    for (const pattern of patterns) {
      const match = descText.match(pattern);
      if (match) {
        const current = parseInt(match[1]);
        const total = parseInt(match[2]);

        if (current > 0 && total > 0 && current <= total) {
          return {
            installments: total,
            installment_number: current
          };
        }
      }
    }

    return {};
  }

  /**
   * Extrai descrição após o horário em formato DD/MM HH:MM ou HH:MM
   * Exemplos:
   * - "30/08 09:19 CULTURA FITNESS" -> "CULTURA FITNESS"
   * - "14/09 21:00 KFC" -> "KFC"
   * - "17/09 11:05 BISTEK SUPERMERCA" -> "BISTEK SUPERMERCA"
   */
  private extractDescriptionAfterTime(details: string): string {
    // Procurar por padrão: DD/MM HH:MM ou apenas HH:MM
    const timePattern = /(\d{1,2}\/\d{1,2}\s+)?(\d{1,2}):(\d{2})/;

    const match = details.match(timePattern);
    if (match) {
      const timeText = match[0];
      const timeIndex = details.indexOf(timeText);

      // Pegar tudo que vem após o horário
      const afterTime = details.substring(timeIndex + timeText.length).trim();

      if (afterTime.length > 0) {
        // Se há conteúdo após o horário, esse é o nome/entidade
        return afterTime;
      }
    }

    return '';
  }

  /**
   * Extrai conteúdo direto do campo Detalhes quando não há horário
   * Usado para transações como "Pagamento de Boleto" onde o Detalhes contém o nome da entidade
   * Exemplos:
   * - Lançamento: "Pagamento de Boleto", Detalhes: "NU PAGAMENTOS SA" -> "NU PAGAMENTOS SA"
   * - Lançamento: "Pagamento de Impostos", Detalhes: "DAS - SIMPLES NACIONAL" -> "DAS - SIMPLES NACIONAL"
   */
  private extractDirectDetailsContent(details: string, lancamento: string): string {
    if (!details || !details.trim()) {
      return '';
    }

    const detailsClean = details.trim();
    const lancamentoLower = lancamento.toLowerCase();

    // Lista de tipos de lançamento que devem usar o campo Detalhes como descrição principal
    const shouldUseDetails = [
      'pagamento de boleto',
      'pagamento boleto',
      'pagamento de impostos',
      'pagamento imposto',
      'pagamento recebido',
      'ted',
      'tedinternet',
      'doc',
      'transferencia',
      'transferência',
      'debito automatico',
      'débito automático'
    ];

    // Verificar se o lançamento está na lista de tipos que devem usar Detalhes
    const shouldExtract = shouldUseDetails.some(type => lancamentoLower.includes(type));

    if (shouldExtract) {
      // Verificar se o conteúdo de Detalhes é útil (não é apenas descrição genérica)
      const isUsefulContent = this.isUsefulDetailsContent(detailsClean);
      
      if (isUsefulContent) {
        return detailsClean;
      }
    }

    return '';
  }

  /**
   * Verifica se o conteúdo do campo Detalhes é útil como descrição
   * Retorna false para conteúdos genéricos ou vazios
   */
  private isUsefulDetailsContent(details: string): boolean {
    if (!details || details.trim().length < 3) {
      return false;
    }

    // Lista de padrões genéricos que NÃO são úteis como descrição principal
    const genericPatterns = [
      /^cobran[cç]a referente/i,
      /^referente/i,
      /^pagamento referente/i,
      /^taxa referente/i,
      /^tarifa referente/i,
      /^\d+$/,  // Apenas números
      /^[\d\s\-\/]+$/  // Apenas números, espaços e separadores
    ];

    // Se corresponder a algum padrão genérico, não é útil
    const isGeneric = genericPatterns.some(pattern => pattern.test(details));
    if (isGeneric) {
      return false;
    }

    // Se contém pelo menos uma letra e tem tamanho razoável, é útil
    const hasLetters = /[a-zA-Z]/.test(details);
    const hasReasonableLength = details.length >= 3;

    return hasLetters && hasReasonableLength;
  }

  /**
   * Obtém estatísticas de uso do dicionário
   */
  getDictionaryStats() {
    return this.dictionary.getStats();
  }

  /**
   * Permite aprendizado baseado em correções do usuário
   */
  learnFromCorrection(description: string, correctCategory: string, subcategory?: string) {
    this.dictionary.learnFromCorrection(description, correctCategory, subcategory);
  }
}
