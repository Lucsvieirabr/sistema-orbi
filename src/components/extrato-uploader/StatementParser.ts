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

/** Diagnóstico da interpretação — usado para mensagens de erro acionáveis. */
export interface StatementParseDiagnostics {
  format: StatementFormat;
  totalLines: number;
  candidateLines: number;
  matchedLines: number;
  skippedLines: number;
  transactions: number;
}

export type StatementFormat =
  | 'card_invoice'
  | 'caixa'
  | 'sicredi'
  | 'generic_table'
  | 'generic';

/**
 * Abreviações de mês em faturas/extratos brasileiros (pt-BR).
 * Nubank, Itaú, Inter e C6 usam todos o formato "DD MMM".
 */
const MONTH_ABBR: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
  // Variações que aparecem em PDFs gerados com locale en-US.
  FEB: 2, APR: 4, MAY: 5, AUG: 8, SEP: 9, OCT: 10, DEC: 12,
};

/**
 * Sinal negativo: faturas usam MINUS SIGN (U+2212) e EN/EM DASH, não apenas o
 * hífen ASCII. Tratar só "-" fazia todo pagamento/estorno virar despesa.
 */
const MINUS_CHARS = '\\-−–—';
const MINUS_CLASS = `[${MINUS_CHARS}]`;
const SIGN_CLASS = `[+${MINUS_CHARS}]`;

/** Máscara de cartão: "•••• 0040", "···· 0040", "**** 0040". */
const CARD_MASK = /[•·∙●*.]{3,}\s*\d{3,4}/g;

/**
 * Linhas que começam com data mas NÃO são transações (totais, subtotais,
 * blocos de detalhamento de parcelamento, conversão de moeda, rodapé).
 */
const NON_TRANSACTION_PATTERNS: RegExp[] = [
  /^total\s+a\s+pagar/i,
  /^total\s+de\s+compras/i,
  /^total\s+d[eo]s?\s/i,
  /^subtotal/i,
  /^convers[ãa]o\s*[:=]/i,
  /^pagamentos?\s+e\s+financiamentos/i,
  /^saldo\b/i,
  /^fatura\s+anterior/i,
  /^pagamento\s+m[íi]nimo/i,
  /^limite\s+(total|dispon|adicional|utilizado)/i,
  /^iof\s+de\s+compras\s+internacionais/i,
  /^encargos/i,
  /^juros\s+(rotativo|de\s+parcelamento|e\s+mora)/i,
  /^valor\s+(de\s+entrada|da\s+parcela|m[áa]ximo|total)/i,
  /^parcelar\s+em/i,
  /^cet\b/i,
  /^BRL\s+[\d.,]+\s*=/i,
  /^USD\s+[\d.,]+\s*=/i,
  /^fechamento\s+da\s+pr[óo]xima/i,
  /^pr[óo]ximas\s+faturas/i,
  /^resumo\s+da\s+fatura/i,
  /^\d{1,3}\s+de\s+\d{1,3}$/, // rodapé "5 de 8"
];

/**
 * Motor de interpretação heurística universal para textos de extratos bancários
 * Suporta dados estruturados (CSV), texto de PDF nativo e texto de OCR.
 */
export class StatementParser {
  private categoryMap: { [key: string]: { id: string; type: 'income' | 'expense' } } = {};
  private lastDiagnostics: StatementParseDiagnostics | null = null;

  constructor() {
    this.loadCategoryMap();
  }

  /** Diagnóstico da última execução de `parseRawTextStatement`. */
  getDiagnostics(): StatementParseDiagnostics | null {
    return this.lastDiagnostics;
  }

  /**
   * Método principal: interpreta texto bruto de extrato/fatura.
   *
   * Faturas de cartão (Nubank & cia) são tratadas por um parser dedicado que
   * devolve `ParsedTransaction` direto. O caminho antigo — converter para CSV
   * e reaproveitar o `CSVParser` — permanece para extratos de conta corrente,
   * mas NÃO serve para fatura: o `CSVParser` descarta qualquer linha cujo
   * texto contenha "conta"/"período"/"extrato" (`isMetadataRow`), o que
   * eliminaria lançamentos legítimos como "Limite convertido em saldo na sua
   * conta do Nubank", e além disso perde `installments`/`installment_number`.
   */
  async parseRawTextStatement(rawText: string): Promise<ParsedTransaction[]> {
    const text = this.normalizeRawText(rawText);

    if (!text) {
      this.lastDiagnostics = {
        format: 'generic',
        totalLines: 0,
        candidateLines: 0,
        matchedLines: 0,
        skippedLines: 0,
        transactions: 0,
      };
      return [];
    }

    const format = this.detectStatementFormat(text);
    const lines = text.split('\n');

    console.log('[StatementParser] formato detectado:', format, {
      caracteres: text.length,
      linhas: lines.length,
    });

    if (format === 'card_invoice') {
      const transactions = this.extractCardInvoiceFormat(text);
      this.lastDiagnostics = {
        format,
        totalLines: lines.length,
        candidateLines: lines.filter(l => this.hasAnyDate(l)).length,
        matchedLines: transactions.length,
        skippedLines: 0,
        transactions: transactions.length,
      };
      return transactions;
    }

    const csvData = this.convertTextToCSV(text, format);

    this.lastDiagnostics = {
      format,
      totalLines: lines.length,
      candidateLines: lines.filter(l => this.hasAnyDate(l)).length,
      matchedLines: csvData.length,
      skippedLines: 0,
      transactions: 0,
    };

    if (csvData.length === 0) {
      return [];
    }

    const { CSVParser } = await import('./CSVParser');
    const csvParser = new CSVParser();
    const result = csvParser.parseCSVData(csvData);

    this.lastDiagnostics.transactions = result.transactions.length;

    return result.transactions;
  }

  /**
   * Normaliza o texto bruto antes de qualquer heurística.
   *
   * IMPORTANTE: colapsa apenas espaço HORIZONTAL. Nunca `\s+`, que destruiria
   * as quebras de linha — todo o parsing abaixo é orientado a linha.
   */
  private normalizeRawText(rawText: string): string {
    if (!rawText) return '';

    return rawText
      .replace(/\r\n?/g, '\n')
      // Controle/format (categoria Unicode C), preservando \n.
      .replace(/[^\P{C}\n]/gu, '')
      // Espaço horizontal (inclui NBSP e espaços tipográficos), sem \n.
      .replace(/[^\S\n]+/g, ' ')
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
  }

  private hasAnyDate(line: string): boolean {
    return /\d{1,2}\/\d{1,2}(\/\d{2,4})?/.test(line) ||
           new RegExp(`\\b\\d{1,2}\\s+(${Object.keys(MONTH_ABBR).join('|')})\\b`, 'i').test(line);
  }

  /**
   * Converte texto bruto de extrato em formato CSV estruturado
   */
  private convertTextToCSV(rawText: string, formatType: StatementFormat): Array<Record<string, string>> {
    if (formatType === 'caixa') {
      return this.extractCaixaFormat(rawText);
    }
    if (formatType === 'sicredi' || formatType === 'generic_table') {
      return this.extractGenericTableFormat(rawText);
    }
    return this.extractGenericFormat(rawText);
  }

  /**
   * Limpa descrição de transação removendo padrões bancários comuns
   * Exemplo: "CARTAO DEBITO - ROYAL CAKE - BR - R" → "ROYAL CAKE"
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
    cleaned = cleaned.replace(/^SUBADQ\s+/i, '');
    cleaned = cleaned.replace(/\s*-\s*SUBADQ\s+/i, ' ');

    // 3. Remover sufixos bancários/geográficos do final
    cleaned = cleaned.replace(/\s*-?\s*BR\s*-?\s*[A-Z]\s*$/i, '');
    cleaned = cleaned.replace(/\s+BR\s+R\s*$/i, '');
    cleaned = cleaned.replace(/\s*-\s*BRASIL\s*$/i, '');
    cleaned = cleaned.replace(/\s*-\s*BRA\s*$/i, '');
    cleaned = cleaned.replace(/\s*-\s*[A-Z]{2}\s*-\s*[A-Z]{1,2}\s*$/i, '');

    // 4. Remover CPF/CNPJ mascarados e números de documento
    cleaned = cleaned.replace(/[-—]\s*[\*\d,\.\/]{5,}/g, ' ');
    cleaned = cleaned.replace(/\*{3,}[\d,\.\/]+\*{3,}/g, ' ');
    cleaned = cleaned.replace(/\$\*\*/g, '');

    // 5. Travessão grudado em palavras
    cleaned = cleaned.replace(/[-—]([A-Z])/g, ' $1');

    // 6. Normalizar espaços e travessões isolados
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/^[-—]\s*/, '');
    cleaned = cleaned.replace(/\s*[-—]$/, '');
    cleaned = cleaned.replace(/\s*-\s*/g, ' ');

    return cleaned.trim();
  }

  /**
   * Detecta automaticamente o formato do extrato
   */
  private detectStatementFormat(text: string): StatementFormat {
    // Fatura de cartão (Nubank, Itaú, Inter, C6...): datas "DD MMM" + valores
    // "R$ 0,00" na mesma linha. Precisa vir ANTES dos demais: o texto de uma
    // fatura também contém datas DD/MM/YYYY soltas no cabeçalho/rodapé, o que
    // levaria à detecção errada de 'generic_table'.
    if (this.countCardInvoiceLines(text) >= 3) {
      return 'card_invoice';
    }

    // Formato Caixa: tem hora (HH:MM:SS) e travessão —
    if (/\d{1,2}\/\d{1,2}\/\d{4}\s*[-—]\s*\d{2}:\d{2}:\d{2}/.test(text)) {
      return 'caixa';
    }

    // Formato Sicredi
    if (/sicredi/i.test(text) ||
        (/Extrato de conta corrente/i.test(text) && /\d{2}\/\d{2}\/\d{4}/.test(text))) {
      return 'sicredi';
    }

    // Formato tabular genérico: linhas com data seguida de texto e valor
    if (text.split('\n').some(line => {
      return /\d{1,2}\/\d{1,2}\/\d{2,4}\s+.+?\s+R?\$?\s*[\d.]*\d,\d{2}/.test(line);
    })) {
      return 'generic_table';
    }

    return 'generic';
  }

  /**
   * Regex de uma linha de lançamento em fatura: "DD MMM [máscara] desc R$ 0,00".
   *
   * O separador entre dia e mês é `[\s.,]*` — TOLERANTE, não `\s+`.
   * Motivo verificado em texto real de OCR da mesma fatura: o Tesseract devolve
   * "29,JUN", "29JUN", "27 JUL." e "O1JUL" no lugar de "29 JUN". Exigir espaço
   * derrubava essas linhas silenciosamente; numa fatura de 72 lançamentos
   * sobravam pouquíssimos — justamente os de descrição longa, que o OCR
   * alinhava melhor. O dia continua preso a 1-2 dígitos e o valor continua
   * ancorado no fim da linha, então afrouxar o separador não abre espaço para
   * falso positivo.
   */
  private cardInvoiceLineRegex(): RegExp {
    const months = Object.keys(MONTH_ABBR).join('|');
    return new RegExp(
      `^(\\d{1,2})[\\s.,]*(${months})\\.?\\s+(.+?)\\s+(${MINUS_CLASS})?\\s*R\\$\\s*(\\d{1,3}(?:\\.\\d{3})*,\\d{2})$`,
      'i',
    );
  }

  /**
   * Descobre quais "últimos 4 dígitos" pertencem à máscara do cartão neste
   * documento — e não à descrição de um estabelecimento.
   *
   * Duas fontes, porque o OCR destrói a máscara:
   *  1. máscara íntegra em qualquer lugar do texto ("•••• 0040");
   *  2. um mesmo grupo de 4 dígitos aparecendo logo após a data em 3+ linhas
   *     — repetição assim só acontece com a máscara, nunca com o nome de um
   *     estabelecimento.
   *
   * A exigência de fazer parte deste conjunto é o que impede que "226 Liv
   * Ctba" ou "1234 Loja" percam o começo da descrição.
   */
  private collectCardLast4(text: string): Set<string> {
    const found = new Set<string>();

    const intact = /[•·∙●*]{2,}\s*(\d{4})\b/g;
    let match: RegExpExecArray | null;
    while ((match = intact.exec(text)) !== null) {
      found.add(match[1]);
    }

    const months = Object.keys(MONTH_ABBR).join('|');
    const afterDate = new RegExp(
      `^\\d{1,2}[\\s.,]*(?:${months})\\.?\\s+[^\\p{L}\\p{N}]*(\\d{4})\\s+\\S`,
      'iu',
    );

    const counts = new Map<string, number>();
    for (const line of text.split('\n')) {
      const hit = line.trim().match(afterDate);
      if (hit) counts.set(hit[1], (counts.get(hit[1]) ?? 0) + 1);
    }
    for (const [digits, occurrences] of counts) {
      if (occurrences >= 3) found.add(digits);
    }

    return found;
  }

  private countCardInvoiceLines(text: string): number {
    const re = this.cardInvoiceLineRegex();
    let count = 0;
    for (const line of text.split('\n')) {
      if (re.test(line.trim())) count++;
    }
    return count;
  }

  private monthFromAbbr(abbr: string): number | null {
    const key = abbr
      .normalize('NFD')
      .replace(/\p{M}/gu, '') // remove acentos combinantes
      .toUpperCase()
      .slice(0, 3);
    return MONTH_ABBR[key] ?? null;
  }

  /**
   * Descobre o ano de cada lançamento da fatura.
   *
   * Faturas brasileiras omitem o ano nas linhas de transação ("29 JUN"). O ano
   * vem do cabeçalho ("FATURA 06 AGO 2026" / "Data de vencimento: 06 AGO 2026")
   * combinado com o período de apuração ("TRANSAÇÕES DE 29 JUN A 30 JUL").
   * Quando o período cruza a virada do ano (ex.: 28 DEZ a 27 JAN), os meses do
   * início do período pertencem ao ano anterior.
   */
  private buildYearResolver(text: string): (month: number) => number {
    const months = Object.keys(MONTH_ABBR).join('|');
    const now = new Date();

    const dueMatch =
      text.match(new RegExp(
        `(?:data\\s+de\\s+vencimento|vencimento(?:\\s+da\\s+fatura)?)\\s*:?\\s*(\\d{1,2})\\s+(${months})\\.?\\s+(\\d{4})`,
        'i',
      )) ||
      text.match(new RegExp(`\\bFATURA\\s+(\\d{1,2})\\s+(${months})\\.?\\s+(\\d{4})`, 'i'));

    const dueMonth = dueMatch ? this.monthFromAbbr(dueMatch[2]) : null;
    const dueYear = dueMatch ? parseInt(dueMatch[3], 10) : null;

    const periodMatch = text.match(new RegExp(
      `(?:TRANSA[ÇC][ÕO]ES\\s+DE|Per[íi]odo\\s+vigente\\s*:?)\\s*(\\d{1,2})\\s+(${months})\\.?\\s*(?:a|à|at[ée])\\s*(\\d{1,2})\\s+(${months})`,
      'i',
    ));

    const periodStartMonth = periodMatch ? this.monthFromAbbr(periodMatch[2]) : null;
    const periodEndMonth = periodMatch ? this.monthFromAbbr(periodMatch[4]) : null;

    const refYear = dueYear ?? now.getFullYear();
    const refMonth = dueMonth ?? (now.getMonth() + 1);

    if (periodStartMonth && periodEndMonth) {
      // O período sempre termina antes (ou no mesmo mês) do vencimento.
      const endYear = periodEndMonth > refMonth ? refYear - 1 : refYear;
      const startYear = periodStartMonth > periodEndMonth ? endYear - 1 : endYear;

      return (month: number) =>
        (startYear !== endYear && month >= periodStartMonth) ? startYear : endYear;
    }

    // Sem período no cabeçalho: mês posterior ao vencimento só pode ser do ano
    // anterior (fatura de janeiro com compras de dezembro).
    return (month: number) => (month > refMonth ? refYear - 1 : refYear);
  }

  /**
   * Extrai lançamentos de FATURA DE CARTÃO DE CRÉDITO (Nubank e similares).
   *
   * Formato tratado (uma transação por linha):
   *   "29 JUN •••• 0040 Komprao Koch Atacadis R$ 60,37"
   *   "29 JUN •••• 0040 C A Modas - Parcela 3/3 R$ 59,99"
   *   "02 JUL IOF de \"Cursor, Ai Powered Ide\" R$ 3,94"
   *   "04 JUL Pagamento em 04 JUL −R$ 2.678,34"   (crédito: MINUS SIGN U+2212)
   *
   * Devolve `ParsedTransaction` direto (sem passar pelo CSVParser) para
   * preservar `installments`/`installment_number` e a descrição original —
   * que é o insumo do classificador de IA.
   */
  private extractCardInvoiceFormat(rawText: string): ParsedTransaction[] {
    const lineRegex = this.cardInvoiceLineRegex();
    const yearOf = this.buildYearResolver(rawText);
    const knownLast4 = this.collectCardLast4(rawText);
    const parcelaRegex = new RegExp(
      `\\s*${MINUS_CLASS}?\\s*parcela\\s+(\\d{1,2})\\s*/\\s*(\\d{1,2})\\s*$`,
      'i',
    );

    const transactions: ParsedTransaction[] = [];
    let skipped = 0;
    let index = 0;

    for (const rawLine of rawText.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      const match = line.match(lineRegex);
      if (!match) continue;

      const day = parseInt(match[1], 10);
      const month = this.monthFromAbbr(match[2]);
      const isNegative = Boolean(match[4]);
      const rawValue = match[5];
      let description = match[3].trim();

      if (!month || day < 1 || day > 31) {
        skipped++;
        continue;
      }

      if (NON_TRANSACTION_PATTERNS.some(pattern => pattern.test(description))) {
        skipped++;
        continue;
      }

      // Máscara do cartão ("•••• 0040") não é descrição — mas os 4 dígitos
      // dizem de qual cartão/portador é a linha. Guardamos antes de remover.
      let cardLast4: string | undefined;

      const maskMatch = description.match(/[•·∙●*.]{2,}\s*(\d{3,4})\b/);
      if (maskMatch) {
        cardLast4 = maskMatch[1];
        description = description.replace(CARD_MASK, ' ');
      }

      // Máscara degradada pelo OCR. Os bullets viram um caractere só, ou
      // nenhum: "+0040 Ocafe", "* 0040 CA Modas", "“0040 Art Levain",
      // "- 0040 Gc Executive Barber", "0040 Cursor". Sem isso os 4 dígitos
      // ficavam grudados na descrição e iam parar no classificador de IA.
      if (!cardLast4) {
        const degraded = description.match(/^[^\p{L}\p{N}]*(\d{4})\s+(?=\S)/u);
        if (degraded && knownLast4.has(degraded[1])) {
          cardLast4 = degraded[1];
          description = description.slice(degraded[0].length);
        }
      }

      // Restos de máscara ("®", "__", "+", "*") no início da descrição.
      // A aspa fica de fora: 'IOF de "Cursor, Ai Powered Ide"' é legítima.
      description = description.replace(/^[^\p{L}\p{N}"]+/u, '');
      // Prefixo de CNPJ do estabelecimento ("39.489.726 MARCOS ROBERTO...").
      description = description.replace(/^\d{2}\.\d{3}\.\d{3}(?:\/\d{4}-\d{2})?\s+/, '');
      description = description.replace(/\s+/g, ' ').trim();

      let installments: number | undefined;
      let installmentNumber: number | undefined;

      const parcela = description.match(parcelaRegex);
      if (parcela) {
        const current = parseInt(parcela[1], 10);
        const total = parseInt(parcela[2], 10);
        if (current > 0 && total > 0 && current <= total) {
          installmentNumber = current;
          installments = total;
        }
        description = description.slice(0, parcela.index).trim();
      }

      description = description.replace(/\s*[-–—]\s*$/, '').trim();

      if (description.length < 2) {
        skipped++;
        continue;
      }

      if (NON_TRANSACTION_PATTERNS.some(pattern => pattern.test(description))) {
        skipped++;
        continue;
      }

      const value = this.parseValue(rawValue);
      if (value === null || value === 0) {
        skipped++;
        continue;
      }

      const year = yearOf(month);
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      transactions.push({
        id: `TXN-${date.replace(/-/g, '')}-${String(++index).padStart(3, '0')}`,
        date,
        description,
        value: Math.abs(value),
        // Em fatura, valor negativo é pagamento/estorno (entra como crédito).
        type: isNegative ? 'income' : 'expense',
        payment_method: 'credit',
        installments,
        installment_number: installmentNumber,
        card_last4: cardLast4,
      });
    }

    console.log('[StatementParser] fatura de cartão:', {
      transacoes: transactions.length,
      linhasIgnoradas: skipped,
    });

    return transactions;
  }

  /**
   * Extrai transações do formato Caixa
   */
  private extractCaixaFormat(rawText: string): Array<Record<string, string>> {
    const transactions: Array<Record<string, string>> = [];

    const caixaRegex = /(\d{1,2}\/\d{1,2}\/\d{4})\s*[-—]?\s*\d{2}:\d{2}:\d{2}\s+(?:[-—]?\s*)?\d+\s*[-—]?\s*(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*([CD])(?=\s|$)/gi;

    const matches = [...rawText.matchAll(caixaRegex)];

    for (const match of matches) {
      const date = match[1];
      let description = match[2].trim();
      const value = match[3];
      const typeChar = match[4].toUpperCase();

      description = this.cleanDescription(description);

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
   * Extrai transações de formato tabular genérico (Sicredi, extratos de conta).
   *
   * Correções: aceita ano com 2 dígitos, valor com ou sem "R$", sinal antes ou
   * depois do "R$", e sinal negativo Unicode (U+2212 / en dash / em dash).
   */
  private extractGenericTableFormat(rawText: string): Array<Record<string, string>> {
    const transactions: Array<Record<string, string>> = [];
    const lines = rawText.split('\n');

    const lineRegex = new RegExp(
      `(\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)\\s+(.+?)\\s+(${SIGN_CLASS}?\\s*R?\\$?\\s*${MINUS_CLASS}?\\s*\\d{1,3}(?:\\.\\d{3})*,\\d{2})\\s*$`,
      'i',
    );

    let skipped = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.length < 10) continue;

      const match = line.match(lineRegex);
      if (!match) continue;

      const date = match[1];
      let description = match[2].trim();
      const value = match[3].trim();

      if (/saldo|descri[çc][ãa]o|movimenta[çc][õo]es|^lan[çc]amento$|^data$/i.test(description)) {
        skipped++;
        continue;
      }

      const cleanedDesc = this.cleanDescription(description);
      if (!cleanedDesc || cleanedDesc.length < 3) {
        skipped++;
        continue;
      }
      description = cleanedDesc;

      const isDebit = new RegExp(MINUS_CLASS).test(value);
      const type = isDebit ? 'Débito' : 'Crédito';

      const cleanValue = value
        .replace(/[R$\s]/g, '')
        .replace(new RegExp(`^${SIGN_CLASS}+`), '')
        .trim();

      transactions.push({
        'Data': date,
        'Lançamento': description,
        'Valor': cleanValue,
        'Tipo': type
      });
    }

    console.log('[StatementParser] tabela genérica:', {
      transacoes: transactions.length,
      linhasIgnoradas: skipped,
    });

    return transactions;
  }

  /**
   * Extrai transações de formato genérico (fallback)
   */
  private extractGenericFormat(rawText: string): Array<Record<string, string>> {
    const transactions: Array<Record<string, string>> = [];

    const genericRegex = new RegExp(
      `(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})\\s+(.+?)\\s+(${MINUS_CLASS}?\\s*R?\\$?\\s*\\d{1,3}(?:\\.\\d{3})*,\\d{2}|${MINUS_CLASS}?\\s*\\d+,\\d{2})`,
      'gi',
    );

    const matches = [...rawText.matchAll(genericRegex)];

    for (const match of matches) {
      const date = match[1];
      let description = match[2].trim();
      const value = match[3];

      description = this.cleanDescription(description);

      if (description.toLowerCase().includes('saldo') ||
          description.toLowerCase().includes('total') ||
          description.length < 3) {
        continue;
      }

      const type = new RegExp(MINUS_CLASS).test(value) ? 'Débito' : 'Crédito';

      transactions.push({
        'Data': date,
        'Lançamento': description,
        'Valor': value.replace(new RegExp(MINUS_CLASS, 'g'), '').replace(/[R$\s]/g, ''),
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

    const formats: Array<{ re: RegExp; order: 'dmy' | 'ymd' }> = [
      { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: 'dmy' },
      { re: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, order: 'dmy' },
      { re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: 'ymd' },
      { re: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: 'dmy' },
      { re: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, order: 'dmy' },
      { re: /^(\d{2})(\d{2})(\d{4})$/, order: 'dmy' },
      { re: /^(\d{4})(\d{2})(\d{2})$/, order: 'ymd' },
    ];

    for (const format of formats) {
      const match = cleanedDate.match(format.re);
      if (!match) continue;

      const [, part1, part2, part3] = match;

      let year: number, month: number, day: number;

      if (format.order === 'dmy') {
        day = parseInt(part1, 10);
        month = parseInt(part2, 10);
        year = parseInt(part3, 10);
        if (year < 100) year += year < 50 ? 2000 : 1900;
      } else {
        year = parseInt(part1, 10);
        month = parseInt(part2, 10);
        day = parseInt(part3, 10);
      }

      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
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
      .replace(new RegExp(MINUS_CLASS, 'g'), '-')
      .replace(/[^\d.,\-+]/g, '');

    if (!cleaned) return null;

    let numericValue: number;

    if (cleaned.includes(',') && !cleaned.includes('.')) {
      numericValue = parseFloat(cleaned.replace(',', '.'));
    } else if (cleaned.includes(',') && cleaned.includes('.')) {
      numericValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
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
      /parcela\s+(\d+)\s*\/\s*(\d+)/i,
      /(\d+)\s*\/\s*(\d+)\s*parc/i,
      /(\d+)\s+de\s+(\d+)/,
      /(\d+)\s*\/\s*(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = descText.match(pattern);
      if (match) {
        const current = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);

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
      const { data: categories, error } = await supabase
        .from('categories')
        .select('id, name, category_type');

      if (error) throw error;

      if (categories) {
        categories.forEach(category => {
          this.categoryMap[category.name.toLowerCase()] = {
            id: category.id,
            type: category.category_type as 'income' | 'expense'
          };
        });

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
