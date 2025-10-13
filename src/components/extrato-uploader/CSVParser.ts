import { supabase } from '@/integrations/supabase/client';

// Interface do Schema Canônico conforme especificação técnica
export interface CanonicalTransaction {
  id: string;
  instituicao_origem: string;
  data_lancamento: string; // YYYY-MM-DD
  descricao_original: string;
  valor_bruto: number; // Sem sinal, apenas magnitude
  sinal: '+' | '-'; // + para crédito, - para débito
  tipo_movimentacao: 'CRÉDITO' | 'DÉBITO';
  categoria_principal?: string;
  subcategoria?: string;
  // Campos adicionais para compatibilidade com sistema atual
  category_id?: string;
  category_name?: string;
  installments?: number;
  installment_number?: number;
  is_fixed?: boolean;
  account_id?: string;
  credit_card_id?: string;
  payment_method?: 'debit' | 'credit';
}

// Interface para dados brutos antes da normalização
export interface RawCSVRow {
  [key: string]: string;
}

// Interface para resultado do parsing
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
   * Detecta automaticamente o locale e delimitador do CSV
   * Análise baseada em padrões brasileiros vs globais
   */
  private detectCSVLocale(sampleRows: RawCSVRow[]): { delimiter: string; locale: 'BR' | 'GLOBAL' } {
    if (sampleRows.length === 0) {
      return { delimiter: ',', locale: 'GLOBAL' };
    }

    // Analisar primeira linha válida (ignorar headers)
    const firstRow = sampleRows.find(row => {
      const values = Object.values(row);
      return values.some(val => val && val.trim().length > 0);
    });

    if (!firstRow) {
      return { delimiter: ',', locale: 'GLOBAL' };
    }

    const rowText = Object.values(firstRow).join('');

    // Contar delimitadores potenciais
    const commaCount = (rowText.match(/,/g) || []).length;
    const semicolonCount = (rowText.match(/;/g) || []).length;

    // Verificar padrões de data brasileira vs global
    const hasBRDate = /\d{1,2}\/\d{1,2}\/\d{4}/.test(rowText);
    const hasGlobalDate = /\d{4}-\d{1,2}-\d{1,2}/.test(rowText);

    // Verificar padrões de valor brasileiro vs global
    const hasBRDecimal = /\d+,\d+/.test(rowText) && !/\d+\.\d+/.test(rowText);
    const hasGlobalDecimal = /\d+\.\d+/.test(rowText) && !/\d+,\d+/.test(rowText);

    // Decisão baseada em múltiplos fatores
    if (semicolonCount > commaCount && (hasBRDate || hasBRDecimal)) {
      return { delimiter: ';', locale: 'BR' };
    }

    if (commaCount > semicolonCount && (hasGlobalDate || hasGlobalDecimal)) {
      return { delimiter: ',', locale: 'GLOBAL' };
    }

    // Fallback conservador
    return { delimiter: ';', locale: 'BR' };
  }

  /**
   * Limpa caracteres especiais e problemas de encoding
   * Tratamento específico para caracteres latinos quebrados
   */
  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .trim()
      // Remove caracteres de encoding quebrado comuns
      .replace(/�/g, '')
      // Normaliza caracteres latinos
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      // Trata caracteres especiais comuns em bancos brasileiros
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C')
      .replace(/ã/g, 'a')
      .replace(/Ã/g, 'A')
      .replace(/õ/g, 'o')
      .replace(/Õ/g, 'O')
      .replace(/á/g, 'a')
      .replace(/Á/g, 'A')
      .replace(/é/g, 'e')
      .replace(/É/g, 'E')
      .replace(/í/g, 'i')
      .replace(/Í/g, 'I')
      .replace(/ó/g, 'o')
      .replace(/Ó/g, 'O')
      .replace(/ú/g, 'u')
      .replace(/Ú/g, 'U')
      // Remove caracteres especiais desnecessários
      .replace(/[^\w\s\-\/]/g, ' ')
      // Remove espaços múltiplos
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Filtra linhas de metadata que não são transações
   */
  private isMetadataRow(row: RawCSVRow): boolean {
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
  private isSaldoRow(row: RawCSVRow): boolean {
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
      'telefone': 'Assinaturas',
      'celular': 'Assinaturas',
      'internet': 'Assinaturas',
      'app': 'Assinaturas',
      'aplicativo': 'Assinaturas',

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
   * Analisa dados CSV usando arquitetura de duas etapas conforme especificação técnica
   * Etapa 1: Pré-processamento estrutural (Meta-Parser)
   * Etapa 2: Mapeamento semântico (Schema Mapping)
   */
  parseCSVData(csvData: Record<string, string>[]): { transactions: ParsedTransaction[], errors: string[], canonical: CanonicalTransaction[] } {
    const errors: string[] = [];
    const transactions: ParsedTransaction[] = [];
    const canonical: CanonicalTransaction[] = [];

    if (!csvData || csvData.length === 0) {
      errors.push('Dados CSV vazios ou inválidos');
      return { transactions: [], errors, canonical: [] };
    }

    // ETAPA 1: Pré-processamento estrutural (Meta-Parser)
    const localeInfo = this.detectCSVLocale(csvData as RawCSVRow[]);

    // Converter dados brutos para formato interno
    const rawRows = csvData as RawCSVRow[];

    // Filtrar linhas de metadata e saldos
    const dataRows = rawRows.filter(row => !this.isMetadataRow(row) && !this.isSaldoRow(row));

    if (dataRows.length === 0) {
      errors.push('Nenhuma linha de dados válida encontrada após filtrar metadata');
      return { transactions: [], errors, canonical: [] };
    }

    // Identificar estrutura das colunas
    const headers = Object.keys(dataRows[0]);
    const columnMapping = this.identifyColumns(headers);

    if (!columnMapping.date || !columnMapping.description || !columnMapping.value) {
      errors.push('Não foi possível identificar as colunas obrigatórias (data, descrição, valor) no arquivo CSV');
      return { transactions: [], errors, canonical: [] };
    }

    // ETAPA 2: Mapeamento semântico (Schema Mapping)
    dataRows.forEach((row, index) => {
      try {
        const canonicalTransaction = this.parseToCanonical(row, columnMapping, localeInfo, index);
        if (canonicalTransaction) {
          canonical.push(canonicalTransaction);

          // Converter para formato legado (compatibilidade)
          const legacyTransaction = this.convertCanonicalToLegacy(canonicalTransaction);
          transactions.push(legacyTransaction);
        }
      } catch (error) {
        // Apenas logar erros reais, não linhas inválidas que foram filtradas
        if (error instanceof Error && !error.message.includes('Dados obrigatórios ausentes')) {
          errors.push(`Erro na linha ${index + 1}: ${error.message}`);
        }
      }
    });

    return { transactions, errors, canonical };
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

    // Regras de identificação mais específicas e ordenadas por prioridade
    const rules = [
      // DATA - Prioridade máxima para identificar data primeiro
      {
        patterns: ['data', 'date'],
        exact: true,
        assign: 'date'
      },
      {
        patterns: ['data lançamento', 'data lancamento', 'lançamento', 'lancamento'],
        exact: false,
        assign: 'date'
      },

      // DESCRIÇÃO - Segunda prioridade
      {
        patterns: ['descrição', 'descricao', 'description'],
        exact: true,
        assign: 'description'
      },
      {
        patterns: ['lançamento', 'lancamento', 'lançament', 'lancement', 'lanamento'],
        exact: true,
        assign: 'description'
      },
      {
        patterns: ['histórico', 'historico', 'referência', 'referencia', 'title'],
        exact: true,
        assign: 'description'
      },
      {
        patterns: ['detalhes', 'detalhe', 'detalhe', 'obs', 'observação', 'observacao'],
        exact: true,
        assign: 'description'
      },

      // VALOR - Terceira prioridade
      {
        patterns: ['valor', 'value'],
        exact: true,
        assign: 'value'
      },
      {
        patterns: ['amount', 'montante', 'total'],
        exact: true,
        assign: 'value'
      },

      // TIPO - Quarta prioridade
      {
        patterns: ['tipo', 'type'],
        exact: true,
        assign: 'type'
      },
      {
        patterns: ['tipo lançamento', 'tipo lancamento', 'tipo', 'natureza'],
        exact: false,
        assign: 'type'
      },

      // SALDO - Quinta prioridade
      {
        patterns: ['saldo', 'balance'],
        exact: true,
        assign: 'balance'
      }
    ];

    // Aplicar regras em ordem
    rules.forEach(rule => {
      if (mapping[rule.assign as keyof typeof mapping]) {
        return; // Já foi atribuída, pular
      }

      headers.forEach(header => {
        if (mapping[header] || mapping[rule.assign as keyof typeof mapping]) {
          return; // Header já foi mapeado ou target já foi atribuído
        }

        const cleanHeader = this.cleanText(header).toLowerCase();
        const lowerHeader = header.toLowerCase().trim();

        const matches = rule.patterns.some(pattern => {
          if (rule.exact) {
            // Para correspondência exata, tenta header original e limpo
            const cleanPattern = this.cleanText(pattern).toLowerCase();
            return lowerHeader === pattern ||
                   cleanHeader === pattern ||
                   cleanHeader === cleanPattern;
          } else {
            // Para correspondência parcial, tenta header original e limpo
            const cleanPattern = this.cleanText(pattern).toLowerCase();
            return lowerHeader.includes(pattern) ||
                   cleanHeader.includes(pattern) ||
                   cleanHeader.includes(cleanPattern);
          }
        });

        if (matches) {
          mapping[rule.assign as keyof typeof mapping] = header;
        }
      });
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

    // Construir descrição seguindo lógica de prioridade: Detalhes (após horário) > Lançamento
    let rawDescription = '';

    // PRIORIDADE 1: Extrair de 'Detalhes' tudo que vem após o horário
    if (row['Detalhes'] && row['Detalhes'].trim()) {
      const extractedFromDetails = this.extractDescriptionAfterTime(row['Detalhes']);
      if (extractedFromDetails && extractedFromDetails.trim()) {
        rawDescription = extractedFromDetails.trim();
      }
    }

    // PRIORIDADE 2: Se não encontrou em Detalhes, usar coluna de descrição principal
    if (!rawDescription && columnMapping.description && row[columnMapping.description]) {
      rawDescription = row[columnMapping.description];
    }

    // PRIORIDADE 3: Se ainda não encontrou, tentar extrair de Detalhes sem horário
    if (!rawDescription && row['Detalhes'] && row['Detalhes'].trim()) {
      rawDescription = this.extractLastMeaningfulWord(row['Detalhes']);
    }

    const rawValue = row[columnMapping.value];
    const rawType = row[columnMapping.type];

    // Filtrar linhas inválidas
    if (!rawDate || !rawDescription || !rawValue) {
      return null; // Retorna null em vez de lançar erro para linhas inválidas
    }

    // Não processar linhas de saldo ou datas inválidas
    if (rawDate === '00/00/0000' ||
        rawDescription.toLowerCase().includes('saldo do dia') ||
        rawDescription.toLowerCase().includes('saldo anterior') ||
        rawDescription.toLowerCase().includes('saldo') && rawDescription.toLowerCase().includes('dia')) {
      return null;
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

    // Limpar possíveis caracteres especiais e espaços extras
    const cleanedDate = trimmedDate.replace(/\s+/g, ' ').replace(/[^\d/\-.]/g, '');

    // Tentar diferentes formatos
    const formats = [
      // DD/MM/YYYY (brasileiro mais comum)
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // DD/MM/YY (ano com 2 dígitos)
      /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
      // YYYY-MM-DD (ISO)
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // DD-MM-YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      // DD.MM.YYYY (ponto como separador)
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
      // DDMMYYYY (sem separador)
      /^(\d{2})(\d{2})(\d{4})$/,
      // YYYYMMDD (sem separador)
      /^(\d{4})(\d{2})(\d{2})$/
    ];

    for (const format of formats) {
      const match = cleanedDate.match(format);
      if (match) {
        const [, part1, part2, part3] = match;

        try {
          let year: number, month: number, day: number;

          if (format === formats[0] || format === formats[2] || format === formats[4]) {
            // Formatos DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
            day = parseInt(part1);
            month = parseInt(part2);
            year = parseInt(part3);

            // Se ano tem 2 dígitos, assumir século 20 ou 21
            if (year < 100) {
              year += year < 50 ? 2000 : 1900;
            }
          } else if (format === formats[1]) {
            // Formato DD/MM/YY
            day = parseInt(part1);
            month = parseInt(part2);
            year = parseInt(part3) + 2000; // Assumir século 21
          } else if (format === formats[3]) {
            // Formato YYYY-MM-DD
            year = parseInt(part1);
            month = parseInt(part2);
            day = parseInt(part3);
          } else if (format === formats[5]) {
            // Formato DDMMYYYY
            day = parseInt(part1);
            month = parseInt(part2);
            year = parseInt(part3);
          } else if (format === formats[6]) {
            // Formato YYYYMMDD
            year = parseInt(part1);
            month = parseInt(part2);
            day = parseInt(part3);
          }

          // Validar se a data é válida
          if (year >= 1900 && year <= 2100 &&
              month >= 1 && month <= 12 &&
              day >= 1 && day <= 31) {
            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          }
        } catch (error) {
          // Continuar tentando outros formatos
          continue;
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

    // Remover espaços e símbolos comuns
    const cleaned = rawValue.trim()
      .replace(/\s+/g, '') // Remove espaços
      .replace(/[R$\s]/g, '') // Remove R$ e espaços
      .replace(/[^\d.,\-+]/g, ''); // Mantém apenas números, pontos, vírgulas e sinais

    // Se não sobrou nada, retorna null
    if (!cleaned) return null;

    let numericValue: number;

    // Detectar se é formato brasileiro (vírgula como separador decimal)
    if (cleaned.includes(',') && !cleaned.includes('.')) {
      // Formato brasileiro simples: 1234,56 ou -1234,56
      numericValue = parseFloat(cleaned.replace(',', '.'));
    } else if (cleaned.includes(',') && cleaned.includes('.')) {
      // Formato brasileiro com milhares: 1.234,56 ou -1.234,56
      // Remove pontos de milhares e troca vírgula por ponto
      numericValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else if (cleaned.includes('.') && !cleaned.includes(',')) {
      // Formato americano: 1234.56 ou -1234.56
      numericValue = parseFloat(cleaned);
    } else {
      // Apenas números ou formato desconhecido
      numericValue = parseFloat(cleaned);
    }

    return isNaN(numericValue) || !isFinite(numericValue) ? null : numericValue;
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
   * Extrai a última palavra significativa de uma descrição
   * Remove códigos numéricos, horários e datas
   */
  private extractLastMeaningfulWord(description: string): string {
    const words = description.split(/\s+/).filter(word => word.trim().length > 0);

    // Procurar pela última palavra que não seja:
    // - Apenas números
    // - Horário (HH:MM)
    // - Data (DD/MM)
    // - Código longo de números
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i].trim();

      if (word.length > 2 &&
          !/^\d+$/.test(word) && // Não é apenas número
          !/^(\d{1,2}):(\d{2})$/.test(word) && // Não é horário
          !/^(\d{1,2})\/(\d{1,2})$/.test(word) && // Não é data DD/MM
          !/^\d{8,}$/.test(word)) { // Não é código numérico longo
        return word;
      }
    }

    return description;
  }

  /**
   * Converte linha bruta para formato canônico conforme especificação técnica
   */
  private parseToCanonical(row: RawCSVRow, columnMapping: Record<string, string>, localeInfo: { delimiter: string; locale: 'BR' | 'GLOBAL' }, index: number): CanonicalTransaction | null {
    // Extrair valores básicos com limpeza
    const rawDate = row[columnMapping.date];
    const rawValue = row[columnMapping.value];
    const rawType = row[columnMapping.type];

    // Construir descrição seguindo lógica de prioridade
    let rawDescription = '';

    // PRIORIDADE 1: Extrair de 'Detalhes' tudo que vem após o horário
    if (row['Detalhes'] && row['Detalhes'].trim()) {
      const extractedFromDetails = this.extractDescriptionAfterTime(row['Detalhes']);
      if (extractedFromDetails && extractedFromDetails.trim()) {
        rawDescription = this.cleanText(extractedFromDetails.trim());
      }
    }

    // PRIORIDADE 2: Se não encontrou em Detalhes, usar coluna de descrição principal
    if (!rawDescription && columnMapping.description && row[columnMapping.description]) {
      rawDescription = this.cleanText(row[columnMapping.description]);
    }

    // PRIORIDADE 3: Se ainda não encontrou, tentar extrair de Detalhes sem horário
    if (!rawDescription && row['Detalhes'] && row['Detalhes'].trim()) {
      rawDescription = this.cleanText(this.extractLastMeaningfulWord(row['Detalhes']));
    }

    // Filtrar linhas inválidas
    if (!rawDate || !rawDescription || !rawValue) {
      return null;
    }

    // Não processar linhas de saldo ou datas inválidas
    if (rawDate === '00/00/0000' ||
        rawDescription.toLowerCase().includes('saldo do dia') ||
        rawDescription.toLowerCase().includes('saldo anterior') ||
        rawDescription.toLowerCase().includes('saldo') && rawDescription.toLowerCase().includes('dia')) {
      return null;
    }

    // Converter data
    const date = this.parseDate(rawDate);
    if (!date) {
      throw new Error(`Formato de data inválido: ${rawDate}`);
    }

    // Converter valor
    const numericValue = this.parseValue(rawValue);
    if (numericValue === null) {
      throw new Error(`Valor inválido: ${rawValue}`);
    }

    // Determinar sinal baseado no valor (conforme especificação técnica)
    const sinal = numericValue < 0 ? '-' : '+';

    // Tipo de movimentação baseado no sinal
    const tipoMovimentacao = numericValue < 0 ? 'DÉBITO' : 'CRÉDITO';

    // Instituição de origem (tentar detectar do contexto)
    const instituicaoOrigem = this.detectInstitution(rawDescription);

    return {
      id: `TXN-${date.replace(/-/g, '')}-${String(index + 1).padStart(3, '0')}`,
      instituicao_origem: instituicaoOrigem,
      data_lancamento: date,
      descricao_original: rawDescription,
      valor_bruto: Math.abs(numericValue),
      sinal,
      tipo_movimentacao: tipoMovimentacao
    };
  }

  /**
   * Converte transação canônica para formato legado (compatibilidade)
   */
  private convertCanonicalToLegacy(canonical: CanonicalTransaction): ParsedTransaction {
    return {
      id: canonical.id,
      date: canonical.data_lancamento,
      description: canonical.descricao_original,
      value: canonical.valor_bruto,
      type: canonical.tipo_movimentacao === 'CRÉDITO' ? 'income' : 'expense',
      category_id: canonical.category_id,
      category_name: canonical.categoria_principal,
      installments: canonical.installments,
      installment_number: canonical.installment_number,
      is_fixed: canonical.is_fixed,
      account_id: canonical.account_id,
      credit_card_id: canonical.credit_card_id,
      payment_method: canonical.payment_method
    };
  }

  /**
   * Tenta detectar instituição financeira baseada na descrição
   */
  private detectInstitution(description: string): string {
    const descLower = description.toLowerCase();

    // Padrões comuns de instituições
    if (descLower.includes('nubank') || descLower.includes('nu')) return 'NUBANK';
    if (descLower.includes('ailos')) return 'AILOS';
    if (descLower.includes('itau') || descLower.includes('itaú')) return 'ITAU';
    if (descLower.includes('bradesco')) return 'BRADESCO';
    if (descLower.includes('santander')) return 'SANTANDER';
    if (descLower.includes('caixa')) return 'CAIXA';
    if (descLower.includes('banco do brasil') || descLower.includes('bb')) return 'BANCO_DO_BRASIL';

    return 'OUTROS';
  }

  /**
   * Determina se é receita ou despesa baseado APENAS no sinal do valor
   * Seguindo a lógica solicitada: negativo = despesa, positivo = receita
   */
  private determineTransactionType(value: number, rawType?: string, description?: string): 'income' | 'expense' {
    // Regra simples baseada apenas no sinal do valor
    // Negativo = despesa, Positivo = receita
    return value < 0 ? 'expense' : 'income';
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
