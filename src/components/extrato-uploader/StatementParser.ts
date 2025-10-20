import { supabase } from '@/integrations/supabase/client';
import { ParsedTransaction } from './CSVParser';

/**
 * Interface para transação normalizada
 */
export interface NormalizedTransaction {
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

/**
 * Motor de interpretação heurística universal para textos de extratos bancários
 * Suporta tanto dados estruturados (CSV) quanto texto bruto extraído de PDFs (OCR)
 */
export class StatementParser {
  private categoryMap: { [key: string]: { id: string; type: 'income' | 'expense' } } = {};

  constructor() {
    this.loadCategoryMap();
  }

  /**
   * Método principal: interpreta texto bruto de extrato bancário
   * Converte texto em CSV estruturado e usa o parser CSV existente (mais robusto)
   */
  async parseRawTextStatement(rawText: string): Promise<ParsedTransaction[]> {
    // Estratégia: converter texto bruto em CSV e usar CSVParser existente
    const csvData = this.convertTextToCSV(rawText);
    
    if (csvData.length === 0) {
      return [];
    }
    
    // Usar o CSVParser existente que já funciona perfeitamente
    const { CSVParser } = await import('./CSVParser');
    const csvParser = new CSVParser();
    const result = csvParser.parseCSVData(csvData);
    
    return result.transactions;
  }

  /**
   * Converte texto bruto de extrato em formato CSV estruturado
   * Detecta padrão de transações e gera array de objetos compatível com CSVParser
   */
  private convertTextToCSV(rawText: string): Array<Record<string, string>> {
    const transactions: Array<Record<string, string>> = [];

    // Detectar automaticamente o formato do extrato
    const formatType = this.detectStatementFormat(rawText);

    console.log(`🔍 Formato detectado: ${formatType}`);
    console.log(`📄 Tamanho do texto: ${rawText.length} caracteres`);

    if (formatType === 'caixa') {
      console.log('📋 Usando formato CAIXA');
      return this.extractCaixaFormat(rawText);
    } else if (formatType === 'sicredi') {
      console.log('📋 Usando formato SICREDI');
      return this.extractGenericTableFormat(rawText);
    } else if (formatType === 'generic_table') {
      console.log('📋 Usando formato TABELA GENÉRICA');
      return this.extractGenericTableFormat(rawText);
    } else {
      console.log('📋 Usando formato GENÉRICO (fallback)');
      // Fallback: tentar padrão genérico
      return this.extractGenericFormat(rawText);
    }
  }

  /**
   * Limpa descrição de transação removendo padrões bancários comuns
   * Exemplo: "CARTAO DEBITO - ROYAL CAKE - BR - R" → "ROYAL CAKE"
   * Exemplo: "SUBADQ PANIFICADORA L - BR - R" → "PANIFICADORA L"
   */
  private cleanDescription(description: string): string {
    if (!description) return '';
    
    let cleaned = description;
    
    // 1. Remover prefixos bancários comuns
    cleaned = cleaned.replace(/^CARTAO\s+(?:DE\s+)?DEBITO\s*[-—]?\s*/i, '');
    cleaned = cleaned.replace(/^CARTAO\s+(?:DE\s+)?CREDITO\s*[-—]?\s*/i, '');
    cleaned = cleaned.replace(/^COMPRA\s+(?:COM\s+)?CARTAO\s*[-—]?\s*/i, '');
    cleaned = cleaned.replace(/^PAGAMENTO\s+(?:COM\s+)?CARTAO\s*[-—]?\s*/i, '');
    cleaned = cleaned.replace(/^PIX\s+(?:RECEBIDO|ENVIADO|TRANSFERENCIA)\s*[-—]?\s*/i, '');
    cleaned = cleaned.replace(/^TED(?:INTERNET)?\s*[-—]?\s*/i, '');
    cleaned = cleaned.replace(/^DOC\s*[-—]?\s*/i, '');
    cleaned = cleaned.replace(/^TRANSFERENCIA\s+(?:ENVIADA|RECEBIDA)?\s*[-—]?\s*/i, '');
    cleaned = cleaned.replace(/^DEBITO\s+(?:AUTOMATICO|PRESTACAO|HAB)\s*[-—]?\s*/i, '');
    cleaned = cleaned.replace(/^DEB\s+AUT\s*[-—]?\s*/i, '');
    cleaned = cleaned.replace(/^PAGAMENTO\s+(?:DE\s+)?(?:BOLETO|CONTA|FATURA)\s*[-—]?\s*/i, '');
    cleaned = cleaned.replace(/^PAG\s+(?:BOL|BOLETO)\s*[-—]?\s*/i, '');
    
    // 2. Remover códigos de sub-adquirente e estabelecimento
    cleaned = cleaned.replace(/^SUBADQ\s+/i, ''); // "SUBADQ PANIFICADORA" → "PANIFICADORA"
    cleaned = cleaned.replace(/\s*-\s*SUBADQ\s+/i, ' '); // Remover do meio também
    
    // 3. Remover sufixos bancários/geográficos do final
    cleaned = cleaned.replace(/\s*-?\s*BR\s*-?\s*[A-Z]\s*$/i, ''); // " BR R" ou " - BR - R"
    cleaned = cleaned.replace(/\s+BR\s+R\s*$/i, ''); // " BR R" sem travessão
    cleaned = cleaned.replace(/\s*-\s*BRASIL\s*$/i, '');
    cleaned = cleaned.replace(/\s*-\s*BRA\s*$/i, '');
    cleaned = cleaned.replace(/\s*-\s*[A-Z]{2}\s*-\s*[A-Z]{1,2}\s*$/i, ''); // " - XX - Y"
    
    // 4. Remover CPF/CNPJ mascarados e números de documento
    cleaned = cleaned.replace(/[-—]\s*[\*\d,\.\/]{5,}/g, ' '); // CPF/CNPJ mascarado
    cleaned = cleaned.replace(/\*{3,}[\d,\.\/]+\*{3,}/g, ' '); // ***123.456***
    cleaned = cleaned.replace(/\$\*\*/g, ''); // $**
    
    // 5. Travessão grudado em palavras
    cleaned = cleaned.replace(/[-—]([A-Z])/g, ' $1'); // —PALAVRA → PALAVRA
    
    // 6. Normalizar espaços e travessões isolados
    cleaned = cleaned.replace(/\s+/g, ' '); // Múltiplos espaços → um espaço
    cleaned = cleaned.replace(/^[-—]\s*/, ''); // Travessão no início
    cleaned = cleaned.replace(/\s*[-—]$/,''); // Travessão no final
    cleaned = cleaned.replace(/\s*-\s*/g, ' '); // Travessões entre palavras
    
    return cleaned.trim();
  }

  /**
   * Detecta automaticamente o formato do extrato
   */
  private detectStatementFormat(text: string): 'caixa' | 'sicredi' | 'generic_table' | 'generic' {
    // Formato Caixa: tem hora (HH:MM:SS) e travessão —
    if (/\d{1,2}\/\d{1,2}\/\d{4}\s*[-—]\s*\d{2}:\d{2}:\d{2}/.test(text)) {
      return 'caixa';
    }

    // Formato Sicredi: contém "Sicredi" ou padrão típico do extrato Sicredi
    if (/sicredi/i.test(text) ||
        (/Extrato de conta corrente/i.test(text) && /\d{2}\/\d{2}\/\d{4}/.test(text))) {
      return 'sicredi';
    }

    // Formato tabular genérico: linhas com data seguida de texto e valor
    if (text.split('\n').some(line => {
      return /\d{2}\/\d{2}\/\d{4}\s+.+?\s+R?\$?\s*[\d.,]+/.test(line);
    })) {
      return 'generic_table';
    }

    return 'generic';
  }

  /**
   * Extrai transações do formato Caixa
   */
  private extractCaixaFormat(rawText: string): Array<Record<string, string>> {
    const transactions: Array<Record<string, string>> = [];
    
    // Regex para formato Caixa: DD/MM/YYYY - HH:MM:SS NUMERO DESCRICAO VALOR C/D
    const caixaRegex = /(\d{1,2}\/\d{1,2}\/\d{4})\s*[-—]?\s*\d{2}:\d{2}:\d{2}\s+(?:[-—]?\s*)?\d+\s*[-—]?\s*(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*([CD])(?=\s|$)/gi;
    
    const matches = [...rawText.matchAll(caixaRegex)];
    
    for (const match of matches) {
      const date = match[1];
      let description = match[2].trim();
      const value = match[3];
      const typeChar = match[4].toUpperCase();
      
      // Limpar descrição com padrões avançados
      description = this.cleanDescription(description);
      
      // Filtrar saldos
      if (description.toLowerCase().includes('saldo')) continue;
      if (!description || description.length < 3) {
        description = match[2].trim();
      }
      
      transactions.push({
        'Data': date,
        'Lançamento': description,
        'Valor': value,
        'Tipo': typeChar === 'C' ? 'Crédito' : 'Débito'
      });
    }
    
    return transactions;
  }

  /**
   * Extrai transações de formato tabular genérico (Sicredi, Nubank, etc)
   */
  private extractGenericTableFormat(rawText: string): Array<Record<string, string>> {
    const transactions: Array<Record<string, string>> = [];

    // LOG: Mostrar quantas linhas com data existem
    const linesWithDate = rawText.split('\n').filter(line => /\d{2}\/\d{2}\/\d{4}/.test(line));
    console.log(`🔍 SICREDI: ${linesWithDate.length} linhas com data encontradas no texto`);

    // Mostrar algumas linhas para debug
    console.log('Primeiras 5 linhas com data:');
    linesWithDate.slice(0, 5).forEach((line, i) => {
      console.log(`  ${i + 1}. ${line}`);
    });

    // Abordagem alternativa: processar linha por linha
    const lines = rawText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Pular linhas vazias ou muito curtas
      if (!line || line.length < 10) continue;

      // Verificar se a linha tem formato de transação: data + descrição + valor
      const transactionMatch = line.match(/(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\s*R?\$?\s*\d{1,3}(?:\.\d{3})*,\d{2})/i);

      if (transactionMatch) {
        const date = transactionMatch[1];
        let description = transactionMatch[2].trim();
        let value = transactionMatch[3].trim();

        console.log(`\n📝 Linha ${i + 1}:`, {
          date,
          description_original: description.substring(0, 60),
          value
        });

        // Pular linhas de saldo e headers
        if (description.toLowerCase().includes('saldo') ||
            description.toLowerCase().includes('descrição') ||
            description.toLowerCase().includes('movimentações') ||
            description.toLowerCase().includes('lançamento') ||
            description.toLowerCase().includes('data')) {
          console.log('  ⏭️ Pulado (header/saldo)');
          continue;
        }

        // Limpar descrição avançada
        const cleanedDesc = this.cleanDescription(description);

        console.log(`  🧹 Descrição limpa: "${cleanedDesc}"`);

        if (!cleanedDesc || cleanedDesc.length < 3) {
          console.log('  ❌ Descrição muito curta após limpeza');
          continue;
        }

        description = cleanedDesc;

        // Detectar tipo baseado no sinal (+ ou -)
        const isCredit = value.includes('+') || (!value.includes('-') && !value.startsWith('R$-'));
        const type = isCredit ? 'Crédito' : 'Débito';

        // Limpar valor: remover R$, +, -, espaços (valor sempre positivo)
        const cleanValue = value
          .replace(/[R$\s]/g, '')
          .replace(/^[+-]/, '')
          .trim();

        transactions.push({
          'Data': date,
          'Lançamento': description,
          'Valor': cleanValue,
          'Tipo': type
        });

        console.log(`  ✅ Transação adicionada: ${description.substring(0, 40)} - ${value} (${type})`);
      }
    }

    console.log(`\n📊 SICREDI: Total de ${transactions.length} transações extraídas`);

    return transactions;
  }

  /**
   * Extrai transações de formato genérico (fallback)
   */
  private extractGenericFormat(rawText: string): Array<Record<string, string>> {
    const transactions: Array<Record<string, string>> = [];
    
    // Regex genérico: DD/MM/YYYY ... valor
    const genericRegex = /(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/gi;
    
    const matches = [...rawText.matchAll(genericRegex)];
    
    for (const match of matches) {
      const date = match[1];
      let description = match[2].trim();
      const value = match[3];
      
      // Limpar descrição com padrões avançados
      description = this.cleanDescription(description);
      
      if (description.toLowerCase().includes('saldo') || 
          description.toLowerCase().includes('total') ||
          description.length < 3) {
        continue;
      }
      
      const type = value.startsWith('-') ? 'Débito' : 'Crédito';
      
      transactions.push({
        'Data': date,
        'Lançamento': description,
        'Valor': value.replace('-', ''),
        'Tipo': type
      });
    }
    
    return transactions;
  }


  /**
   * Converte diferentes formatos de data (reutilizando lógica do CSVParser)
   */
  private parseDate(rawDate: string): string | null {
    if (!rawDate) return null;

    const trimmedDate = rawDate.trim();
    const cleanedDate = trimmedDate.replace(/\s+/g, ' ').replace(/[^\d/.\-]/g, '');

    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // DD/MM/YY
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, // DD.MM.YYYY
      /^(\d{2})(\d{2})(\d{4})$/, // DDMMYYYY
      /^(\d{4})(\d{2})(\d{2})$/ // YYYYMMDD
    ];

    for (const format of formats) {
      const match = cleanedDate.match(format);
      if (match) {
        const [, part1, part2, part3] = match;

        try {
          let year: number, month: number, day: number;

          if (format === formats[0] || format === formats[2] || format === formats[4]) {
            day = parseInt(part1);
            month = parseInt(part2);
            year = parseInt(part3);
            if (year < 100) year += year < 50 ? 2000 : 1900;
          } else if (format === formats[1]) {
            day = parseInt(part1);
            month = parseInt(part2);
            year = parseInt(part3) + 2000;
          } else if (format === formats[3]) {
            year = parseInt(part1);
            month = parseInt(part2);
            day = parseInt(part3);
          } else if (format === formats[5]) {
            day = parseInt(part1);
            month = parseInt(part2);
            year = parseInt(part3);
          } else if (format === formats[6]) {
            year = parseInt(part1);
            month = parseInt(part2);
            day = parseInt(part3);
          }

          if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          }
        } catch (error) {
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Converte diferentes formatos de valor (reutilizando lógica do CSVParser)
   */
  private parseValue(rawValue: string): number | null {
    if (!rawValue) return null;

    const cleaned = rawValue.trim()
      .replace(/\s+/g, '')
      .replace(/[R$\s]/g, '')
      .replace(/[^\d.,\-+]/g, '');

    if (!cleaned) return null;

    let numericValue: number;

    if (cleaned.includes(',') && !cleaned.includes('.')) {
      numericValue = parseFloat(cleaned.replace(',', '.'));
    } else if (cleaned.includes(',') && cleaned.includes('.')) {
      numericValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else if (cleaned.includes('.') && !cleaned.includes(',')) {
      numericValue = parseFloat(cleaned);
    } else {
      numericValue = parseFloat(cleaned);
    }

    return isNaN(numericValue) || !isFinite(numericValue) ? null : numericValue;
  }

  /**
   * Categoriza transação baseada na descrição (reutilizando lógica existente)
   */
  private categorizeTransaction(description: string, type: 'income' | 'expense'): { category_id?: string; category_name?: string } {
    const descText = description.toLowerCase();

    for (const [keyword, category] of Object.entries(this.categoryMap)) {
      if (descText.includes(keyword) && category.type === type) {
        return {
          category_id: category.id,
          category_name: keyword
        };
      }
    }

    // Categoria padrão
    if (type === 'income') {
      return { category_name: 'Outras Receitas (Aluguéis, extras, reembolso etc.)' };
    } else {
      return { category_name: 'Outros' };
    }
  }

  /**
   * Detecta parcelas baseado em padrões na descrição (reutilizando lógica existente)
   */
  private detectInstallments(description: string): { installments?: number; installment_number?: number } {
    const descText = description.toLowerCase();

    const patterns = [
      /(\d+)\/(\d+)/,
      /(\d+)\s+de\s+(\d+)/,
      /parcela\s+(\d+)\/(\d+)/i,
      /(\d+)\/(\d+)\s*parc/i,
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
   * Carrega mapeamento de categorias (reutilizando lógica existente)
   */
  private async loadCategoryMap() {
    try {
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, category_type');

      if (categories) {
        categories.forEach(category => {
          this.categoryMap[category.name.toLowerCase()] = {
            id: category.id,
            type: category.category_type as 'income' | 'expense'
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
   * Constrói mapeamento de palavras-chave (reutilizando lógica existente)
   */
  private buildKeywordMap() {
    const keywordMap: { [key: string]: string } = {
      // Alimentação
      'supermercado': 'Alimentação',
      'mercado': 'Alimentação',
      'atacado': 'Alimentação',
      'ifood': 'Alimentação',
      'restaurante': 'Alimentação',
      'lanchonete': 'Alimentação',
      'padaria': 'Alimentação',

      // Transporte
      'uber': 'Transporte',
      '99': 'Transporte',
      'taxi': 'Transporte',
      'posto': 'Transporte',
      'combustivel': 'Transporte',
      'gasolina': 'Transporte',
      'etanol': 'Transporte',

      // Saúde/Beleza
      'farmacia': 'Proteção Pessoal / Saúde / Farmácia',
      'saude': 'Proteção Pessoal / Saúde / Farmácia',
      'beleza': 'Bem Estar / Beleza',
      'cabelo': 'Bem Estar / Beleza',

      // Casa
      'casa': 'Casa',
      'moveis': 'Casa',
      'construcao': 'Casa',

      // Lazer
      'cinema': 'Lazer',
      'lazer': 'Lazer',
      'entretenimento': 'Lazer',

      // Educação
      'escola': 'Educação',
      'curso': 'Educação',

      // Vestuário
      'roupa': 'Roupas e acessórios',
      'shopping': 'Roupas e acessórios',

      // Comunicação
      'telefone': 'Assinaturas',
      'celular': 'Assinaturas',
      'internet': 'Assinaturas',

      // Serviços
      'diarista': 'Diarista / Prestadores Serv.',
      'prestador': 'Diarista / Prestadores Serv.',

      // Pet
      'pet': 'Pet',
      'veterinario': 'Pet',

      // Financeiro
      'juro': 'Tarifas Bancárias / Juros / Impostos / Taxas',
      'taxa': 'Tarifas Bancárias / Juros / Impostos / Taxas',
      'tarifa': 'Tarifas Bancárias / Juros / Impostos / Taxas',

      // Ganhos
      'salario': 'Salário / 13° Salário / Férias',
      'pro labore': 'Pró Labore',
      'investimento': 'Renda de Investimentos',
      'aluguel': 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
      'reembolso': 'Outras Receitas (Aluguéis, extras, reembolso etc.)'
    };

    Object.entries(keywordMap).forEach(([keyword, categoryName]) => {
      if (this.categoryMap[categoryName.toLowerCase()]) {
        this.categoryMap[keyword] = this.categoryMap[categoryName.toLowerCase()];
      }
    });
  }
}
