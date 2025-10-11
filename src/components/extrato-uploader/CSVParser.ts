import { supabase } from '@/integrations/supabase/client';

export interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  value: number;
  type: 'income' | 'expense';
  category_id?: string;
  category_name?: string;
  installments?: number;
  installment_number?: number;
  is_fixed?: boolean;
  account_id?: string;
  credit_card_id?: string;
  payment_method?: 'debit' | 'credit';
}

export interface CategoryMap {
  [key: string]: {
    category_id: string;
    category_name: string;
    category_type: 'income' | 'expense';
  };
}

export class CSVParser {
  private categoryMap: CategoryMap = {};

  constructor() {
    this.loadCategoryMap();
  }

  /**
   * Carrega o mapeamento de categorias do banco de dados
   */
  private async loadCategoryMap() {
    try {
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, category_type');

      if (categories) {
        // Criar mapeamento de palavras-chave para categorias
        categories.forEach(category => {
          this.categoryMap[category.name.toLowerCase()] = {
            category_id: category.id,
            category_name: category.name,
            category_type: category.category_type as 'income' | 'expense'
          };
        });

        // Adicionar mapeamentos de palavras-chave
        this.buildKeywordMap();
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  }

  /**
   * Constrói mapeamento de palavras-chave para categorias
   */
  private buildKeywordMap() {
    const keywordMap: { [key: string]: string } = {
      // Alimentação
      'supermercado': 'Alimentação',
      'mercado': 'Alimentação',
      'atacado': 'Alimentação',
      'atacadista': 'Alimentação',
      'komprao': 'Alimentação',
      'fort': 'Alimentação',
      'comper': 'Alimentação',
      'ifood': 'Alimentação',
      'restaurante': 'Alimentação',
      'lanchonete': 'Alimentação',
      'padaria': 'Alimentação',
      'cafeteria': 'Alimentação',
      'cafe': 'Alimentação',
      'cantina': 'Alimentação',
      'doceria': 'Alimentação',
      'armazem': 'Alimentação',

      // Transporte
      'uber': 'Transporte',
      '99': 'Transporte',
      'taxi': 'Transporte',
      'posto': 'Transporte',
      'combustivel': 'Transporte',
      'gasolina': 'Transporte',
      'etanol': 'Transporte',
      'diesel': 'Transporte',
      'estacionamento': 'Transporte',
      'pedagio': 'Transporte',
      'tucha': 'Transporte',

      // Saúde/Beleza
      'farmacia': 'Proteção Pessoal / Saúde / Farmácia',
      'saude': 'Proteção Pessoal / Saúde / Farmácia',
      'medicina': 'Proteção Pessoal / Saúde / Farmácia',
      'consulta': 'Proteção Pessoal / Saúde / Farmácia',
      'dentista': 'Proteção Pessoal / Saúde / Farmácia',
      'beleza': 'Bem Estar / Beleza',
      'cabelo': 'Bem Estar / Beleza',
      'barbearia': 'Bem Estar / Beleza',
      'estetica': 'Bem Estar / Beleza',

      // Casa
      'casa': 'Casa',
      'home': 'Casa',
      'moveis': 'Casa',
      'eletrodomestico': 'Casa',
      'construcao': 'Casa',
      'reforma': 'Casa',
      'material': 'Casa',

      // Lazer
      'cinema': 'Lazer',
      'teatro': 'Lazer',
      'show': 'Lazer',
      'parque': 'Lazer',
      'lazer': 'Lazer',
      'entretenimento': 'Lazer',
      'jogo': 'Lazer',
      'game': 'Lazer',

      // Educação
      'escola': 'Educação',
      'curso': 'Educação',
      'faculdade': 'Educação',
      'livro': 'Educação',
      'material escolar': 'Educação',

      // Vestuário
      'roupa': 'Roupas e acessórios',
      'calcado': 'Roupas e acessórios',
      'acessorio': 'Roupas e acessórios',
      'shopping': 'Roupas e acessórios',
      'loja': 'Roupas e acessórios',

      // Comunicação
      'telefone': 'Telefone / Apps',
      'celular': 'Telefone / Apps',
      'internet': 'Telefone / Apps',
      'app': 'Telefone / Apps',
      'aplicativo': 'Telefone / Apps',

      // Serviços
      'diarista': 'Diarista / Prestadores Serv.',
      'prestador': 'Diarista / Prestadores Serv.',
      'servico': 'Diarista / Prestadores Serv.',
      'manutencao': 'Diarista / Prestadores Serv.',

      // Pet
      'pet': 'Pet',
      'cao': 'Pet',
      'gato': 'Pet',
      'veterinario': 'Pet',
      'raccao': 'Pet',
      'petshop': 'Pet',

      // Financeiro
      'juro': 'Tarifas Bancárias / Juros / Impostos / Taxas',
      'taxa': 'Tarifas Bancárias / Juros / Impostos / Taxas',
      'imposto': 'Tarifas Bancárias / Juros / Impostos / Taxas',
      'tarifa': 'Tarifas Bancárias / Juros / Impostos / Taxas',
      'bancaria': 'Tarifas Bancárias / Juros / Impostos / Taxas',
      'receita federal': 'Tarifas Bancárias / Juros / Impostos / Taxas',

      // Ganhos
      'salario': 'Salário / 13° Salário / Férias',
      'pro labore': 'Pró Labore',
      'comissao': 'Participação de Lucros / Comissões',
      'bonus': 'Participação de Lucros / Comissões',
      'investimento': 'Renda de Investimentos',
      'renda': 'Renda de Investimentos',
      'dividendo': 'Renda de Investimentos',
      'aluguel': 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
      'reembolso': 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
      'codetime': 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
      'pix recebido': 'Outras Receitas (Aluguéis, extras, reembolso etc.)'
    };

    // Aplicar mapeamentos de palavras-chave
    Object.entries(keywordMap).forEach(([keyword, categoryName]) => {
      if (this.categoryMap[categoryName.toLowerCase()]) {
        this.categoryMap[keyword] = this.categoryMap[categoryName.toLowerCase()];
      }
    });
  }

  /**
   * Analisa dados CSV e identifica colunas automaticamente
   */
  parseCSVData(csvData: Record<string, string>[]): { transactions: ParsedTransaction[], errors: string[] } {
    const errors: string[] = [];
    const transactions: ParsedTransaction[] = [];

    if (!csvData || csvData.length === 0) {
      errors.push('Dados CSV vazios ou inválidos');
      return { transactions: [], errors };
    }

    // Identificar colunas automaticamente
    const headers = Object.keys(csvData[0]);
    const columnMapping = this.identifyColumns(headers);

    if (!columnMapping.date || !columnMapping.description || !columnMapping.value) {
      errors.push('Não foi possível identificar as colunas obrigatórias (data, descrição, valor) no arquivo CSV');
      return { transactions: [], errors };
    }

    // Processar cada linha
    csvData.forEach((row, index) => {
      try {
        const transaction = this.parseRow(row, columnMapping, index);
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
   * Analisa uma linha específica do CSV
   */
  private parseRow(row: Record<string, string>, columnMapping: Record<string, string>, index: number): ParsedTransaction | null {
    // Extrair valores básicos
    const rawDate = row[columnMapping.date];
    const rawDescription = row[columnMapping.description];
    const rawValue = row[columnMapping.value];
    const rawType = row[columnMapping.type];

    if (!rawDate || !rawDescription || !rawValue) {
      throw new Error('Dados obrigatórios ausentes (data, descrição ou valor)');
    }

    // Converter data
    const date = this.parseDate(rawDate);
    if (!date) {
      throw new Error(`Formato de data inválido: ${rawDate}`);
    }

    // Converter valor
    const value = this.parseValue(rawValue);
    if (value === null) {
      throw new Error(`Valor inválido: ${rawValue}`);
    }

    // Determinar tipo (income/expense)
    const type = this.determineTransactionType(value, rawType, rawDescription);

    // Categorização automática
    const { category_id, category_name } = this.categorizeTransaction(rawDescription, type);

    // Detecção de parcelas
    const { installments, installment_number } = this.detectInstallments(rawDescription);

    return {
      id: `temp_${index}_${Date.now()}`,
      date,
      description: rawDescription.trim(),
      value: Math.abs(value),
      type,
      category_id,
      category_name,
      installments: installments || undefined,
      installment_number: installment_number || undefined,
      is_fixed: false, // Será definido pelo usuário no dialog
      payment_method: type === 'expense' ? 'debit' : undefined
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
   * Categoriza transação baseada na descrição
   */
  private categorizeTransaction(description: string, type: 'income' | 'expense'): { category_id?: string; category_name?: string } {
    const descText = description.toLowerCase();

    // Procurar por palavras-chave no mapeamento
    for (const [keyword, category] of Object.entries(this.categoryMap)) {
      if (descText.includes(keyword) && category.category_type === type) {
        return {
          category_id: category.category_id,
          category_name: category.category_name
        };
      }
    }

    // Se não encontrou categoria específica, usar categoria padrão
    if (type === 'income') {
      const defaultIncome = this.categoryMap['outras receitas (aluguéis, extras, reembolso etc.)'];
      return {
        category_id: defaultIncome?.category_id,
        category_name: defaultIncome?.category_name
      };
    } else {
      const defaultExpense = this.categoryMap['outros'];
      return {
        category_id: defaultExpense?.category_id,
        category_name: defaultExpense?.category_name
      };
    }
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
}
