# Extração de Dados de Transações via CSV

Este documento explica como o sistema Orbi extrai e processa informações de transações a partir de arquivos CSV bancários.

## 📋 Visão Geral do Processo

O processo de extração ocorre em **4 etapas principais**:

1. **Leitura do Arquivo CSV**
2. **Detecção Automática de Formato**
3. **Identificação de Colunas**
4. **Extração e Normalização de Dados**

---

## 1. Leitura do Arquivo CSV 📂

**Arquivo:** `src/components/extrato-uploader/ExtratoUploader.tsx`

### Como funciona:

O sistema usa a biblioteca **PapaParse** para ler o arquivo CSV enviado pelo usuário:

```typescript
const parseCSVFile = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    import('papaparse').then(({ default: Papa }) => {
      Papa.parse(file, {
        header: true,           // Primeira linha como cabeçalho
        skipEmptyLines: true,   // Ignora linhas vazias
        encoding: 'utf-8',      // Encoding UTF-8
        transformHeader: (header: string) => {
          return header.trim(); // Remove espaços dos cabeçalhos
        },
        transform: (value: string) => {
          return value ? value.trim() : ''; // Remove espaços dos valores
        },
        complete: (results: any) => {
          if (results.data.length === 0) {
            reject(new Error('Arquivo CSV vazio'));
            return;
          }
          resolve(results.data);
        },
        error: (error: Error) => {
          reject(new Error(`Erro ao ler arquivo: ${error.message}`));
        }
      });
    });
  });
};
```

### O que é feito:
- ✅ Lê o CSV completo
- ✅ Converte primeira linha em cabeçalhos
- ✅ Remove linhas vazias
- ✅ Limpa espaços em branco
- ✅ Retorna array de objetos com os dados

**Exemplo de saída:**
```javascript
[
  {
    "Data": "01/10/2024",
    "Lançamento": "Compra com Cartão",
    "Detalhes": "30/09 14:20 IFOOD",
    "Valor": "-45,50"
  },
  {
    "Data": "02/10/2024",
    "Lançamento": "PIX Recebido",
    "Detalhes": "João Silva",
    "Valor": "200,00"
  }
]
```

---

## 2. Detecção Automática de Formato 🔍

**Arquivo:** `src/components/extrato-uploader/CSVParser.ts`

### 2.1 Identificação de Locale (BR vs Internacional)

O sistema detecta automaticamente se o CSV é brasileiro ou internacional:

```typescript
private detectCSVLocale(sampleRows: RawCSVRow[]): { delimiter: string; locale: 'BR' | 'GLOBAL' } {
  const rowText = Object.values(firstRow).join('');

  // Conta delimitadores
  const commaCount = (rowText.match(/,/g) || []).length;
  const semicolonCount = (rowText.match(/;/g) || []).length;

  // Verifica padrões de data
  const hasBRDate = /\d{1,2}\/\d{1,2}\/\d{4}/.test(rowText);      // 01/10/2024
  const hasGlobalDate = /\d{4}-\d{1,2}-\d{1,2}/.test(rowText);    // 2024-10-01

  // Verifica padrões de valor
  const hasBRDecimal = /\d+,\d+/.test(rowText);                   // 1.234,56
  const hasGlobalDecimal = /\d+\.\d+/.test(rowText);              // 1234.56

  // Decisão baseada em múltiplos fatores
  if (semicolonCount > commaCount && (hasBRDate || hasBRDecimal)) {
    return { delimiter: ';', locale: 'BR' };
  }

  if (commaCount > semicolonCount && (hasGlobalDate || hasGlobalDecimal)) {
    return { delimiter: ',', locale: 'GLOBAL' };
  }

  return { delimiter: ';', locale: 'BR' }; // Fallback padrão
}
```

### Detecta:
- **Delimitador:** `;` (Brasil) ou `,` (Internacional)
- **Formato de data:** `DD/MM/YYYY` ou `YYYY-MM-DD`
- **Separador decimal:** `,` (Brasil) ou `.` (Internacional)

---

## 3. Identificação Automática de Colunas 🎯

**Arquivo:** `src/components/extrato-uploader/CSVParser.ts`

O sistema identifica automaticamente as colunas do CSV, independente do banco:

```typescript
private identifyColumns(headers: string[]): {
  date?: string;
  description?: string;
  value?: string;
  balance?: string;
  type?: string;
} {
  const rules = [
    // DATA
    { patterns: ['data', 'date'], exact: true, assign: 'date' },
    { patterns: ['data lançamento', 'data lancamento'], exact: false, assign: 'date' },
    
    // DESCRIÇÃO
    { patterns: ['descrição', 'descricao', 'description'], exact: true, assign: 'description' },
    { patterns: ['lançamento', 'lancamento'], exact: true, assign: 'description' },
    { patterns: ['histórico', 'historico', 'referência'], exact: true, assign: 'description' },
    
    // VALOR
    { patterns: ['valor', 'value', 'amount'], exact: true, assign: 'value' },
    
    // TIPO
    { patterns: ['tipo', 'type'], exact: true, assign: 'type' }
  ];

  // Aplica regras e retorna mapeamento
}
```

### Suporta diferentes formatos de bancos:

| Banco | Colunas Típicas |
|-------|----------------|
| **Nubank** | Data, Lançamento, Detalhes, Valor |
| **Itaú** | Data, Descrição, Valor |
| **Bradesco** | Data, Histórico, Valor, Saldo |
| **Santander** | Data Lançamento, Tipo, Valor |
| **Caixa** | Data, Referência, Valor |

### Como funciona:
1. ✅ Lê os cabeçalhos do CSV
2. ✅ Aplica regras de correspondência (exata ou parcial)
3. ✅ Trata acentos e caracteres especiais
4. ✅ Retorna mapeamento: `{ date: "Data", description: "Lançamento", value: "Valor" }`

---

## 4. Extração e Normalização de Dados 🔧

### 4.1 Filtros de Linhas Inválidas

O sistema remove linhas que não são transações:

```typescript
// Remove metadata do banco
private isMetadataRow(row: RawCSVRow): boolean {
  const values = Object.values(row).join(' ').toLowerCase();
  
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

// Remove linhas de saldo
private isSaldoRow(row: RawCSVRow): boolean {
  const values = Object.values(row).join(' ').toLowerCase();
  
  const saldoPatterns = [
    /\bs\s*a\s*l\s*d\s*o\b/i,      // "S A L D O"
    /\bsaldo anterior\b/i,          // "Saldo anterior"
    /\bsaldo do dia\b/i,            // "Saldo do dia"
  ];
  
  return saldoPatterns.some(pattern => pattern.test(values));
}
```

**Exemplo de linhas filtradas:**
```csv
❌ Conta: 12345-6
❌ Período: 01/10/2024 a 31/10/2024
❌ Saldo Inicial: R$ 1.000,00
✅ 01/10/2024, Compra com Cartão, IFOOD, -45,50
✅ 02/10/2024, PIX Recebido, João Silva, 200,00
❌ Saldo do Dia: R$ 1.154,50
```

---

### 4.2 Extração Inteligente de Descrições

O sistema usa **3 níveis de prioridade** para extrair a descrição:

#### **PRIORIDADE 1: Extração após horário**

```typescript
private extractDescriptionAfterTime(details: string): string {
  // Procura padrão: DD/MM HH:MM ou HH:MM
  const timePattern = /(\d{1,2}\/\d{1,2}\s+)?(\d{1,2}):(\d{2})/;
  
  const match = details.match(timePattern);
  if (match) {
    const timeText = match[0];
    const timeIndex = details.indexOf(timeText);
    
    // Pega tudo após o horário
    const afterTime = details.substring(timeIndex + timeText.length).trim();
    
    if (afterTime.length > 0) {
      return afterTime;
    }
  }
  
  return '';
}
```

**Exemplos:**
- `"30/08 09:19 CULTURA FITNESS"` → `"CULTURA FITNESS"`
- `"14/09 21:00 KFC"` → `"KFC"`
- `"17/09 11:05 BISTEK SUPERMERCA"` → `"BISTEK SUPERMERCA"`

#### **PRIORIDADE 2: Conteúdo direto de Detalhes**

```typescript
private extractDirectDetailsContent(details: string, lancamento: string): string {
  const detailsClean = details.trim();
  const lancamentoLower = lancamento.toLowerCase();
  
  // Tipos que devem usar campo Detalhes
  const shouldUseDetails = [
    'pagamento de boleto',
    'pagamento de impostos',
    'ted',
    'transferencia',
    'debito automatico'
  ];
  
  const shouldExtract = shouldUseDetails.some(type => 
    lancamentoLower.includes(type)
  );
  
  if (shouldExtract && this.isUsefulDetailsContent(detailsClean)) {
    return detailsClean;
  }
  
  return '';
}
```

**Exemplos:**
- Lançamento: `"Pagamento de Boleto"` + Detalhes: `"NU PAGAMENTOS SA"` → `"NU PAGAMENTOS SA"`
- Lançamento: `"Pagamento de Impostos"` + Detalhes: `"DAS - SIMPLES NACIONAL"` → `"DAS - SIMPLES NACIONAL"`
- Lançamento: `"TEDinternet"` + Detalhes: `"EMPRESA XYZ LTDA"` → `"EMPRESA XYZ LTDA"`

#### **PRIORIDADE 3: Campo principal de Lançamento**

Se não encontrou nos níveis anteriores, usa o campo "Lançamento" ou "Descrição":

```typescript
// Se ainda não encontrou descrição
if (!rawDescription && lancamento) {
  rawDescription = lancamento;
}
```

---

### 4.3 Conversão de Datas

O sistema suporta múltiplos formatos de data:

```typescript
private parseDate(rawDate: string): string | null {
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,    // DD/MM/YYYY (Brasil)
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,    // DD/MM/YY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,      // YYYY-MM-DD (ISO)
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,      // DD-MM-YYYY
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,    // DD.MM.YYYY
    /^(\d{2})(\d{2})(\d{4})$/,             // DDMMYYYY (sem separador)
    /^(\d{4})(\d{2})(\d{2})$/              // YYYYMMDD (sem separador)
  ];

  for (const format of formats) {
    const match = cleanedDate.match(format);
    if (match) {
      // Converte para formato padrão: YYYY-MM-DD
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  return null;
}
```

**Conversões suportadas:**
- `01/10/2024` → `2024-10-01`
- `01/10/24` → `2024-10-01`
- `2024-10-01` → `2024-10-01`
- `01-10-2024` → `2024-10-01`
- `01.10.2024` → `2024-10-01`
- `01102024` → `2024-10-01`
- `20241001` → `2024-10-01`

---

### 4.4 Conversão de Valores

O sistema converte valores em diferentes formatos:

```typescript
private parseValue(rawValue: string): number | null {
  // Remove espaços e símbolos
  const cleaned = rawValue.trim()
    .replace(/\s+/g, '')           // Remove espaços
    .replace(/[R$\s]/g, '')        // Remove R$ e espaços
    .replace(/[^\d.,\-+]/g, '');   // Mantém apenas números, pontos, vírgulas e sinais

  let numericValue: number;

  // Formato brasileiro simples: 1234,56 ou -1234,56
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    numericValue = parseFloat(cleaned.replace(',', '.'));
  } 
  // Formato brasileiro com milhares: 1.234,56 ou -1.234,56
  else if (cleaned.includes(',') && cleaned.includes('.')) {
    numericValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  } 
  // Formato americano: 1234.56 ou -1234.56
  else if (cleaned.includes('.') && !cleaned.includes(',')) {
    numericValue = parseFloat(cleaned);
  } 
  // Apenas números
  else {
    numericValue = parseFloat(cleaned);
  }

  return isNaN(numericValue) || !isFinite(numericValue) ? null : numericValue;
}
```

**Conversões suportadas:**

| Formato de Entrada | Saída (Number) |
|-------------------|----------------|
| `"R$ 1.234,56"` | `1234.56` |
| `"-1.234,56"` | `-1234.56` |
| `"1234.56"` | `1234.56` |
| `"-45,50"` | `-45.50` |
| `"1234"` | `1234` |
| `"R$ -1.234.567,89"` | `-1234567.89` |

---

### 4.5 Detecção de Tipo (Receita/Despesa)

O sistema determina se é receita ou despesa:

```typescript
private determineTransactionType(
  value: number, 
  rawType?: string, 
  description?: string
): 'income' | 'expense' {
  // Regra simples: baseado no sinal do valor
  // Negativo = despesa, Positivo = receita
  return value < 0 ? 'expense' : 'income';
}
```

**Exemplos:**
- Valor: `-45.50` → `expense` (despesa)
- Valor: `200.00` → `income` (receita)
- Valor: `-1234.56` → `expense` (despesa)

---

### 4.6 Detecção de Parcelas

O sistema identifica transações parceladas:

```typescript
private detectInstallments(description: string): { 
  installments?: number; 
  installment_number?: number 
} {
  const patterns = [
    /(\d+)\/(\d+)/,              // 1/12, 2/12
    /(\d+)\s+de\s+(\d+)/,        // 1 de 12, 2 de 12
    /parcela\s+(\d+)\/(\d+)/i,   // Parcela 1/12
    /(\d+)\/(\d+)\s*parc/i,      // 1/12 parc
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
```

**Exemplos de detecção:**
- `"COMPRA AMAZON 1/12"` → `{ installments: 12, installment_number: 1 }`
- `"MAGAZINE LUIZA PARCELA 3/6"` → `{ installments: 6, installment_number: 3 }`
- `"IFOOD 2 de 4"` → `{ installments: 4, installment_number: 2 }`

---

## 5. Resultado Final da Extração 📊

Após todas as etapas, cada linha do CSV é convertida em uma transação estruturada:

```typescript
interface ParsedTransaction {
  id: string;                    // ID temporário único
  date: string;                  // Data no formato YYYY-MM-DD
  description: string;           // Descrição limpa e normalizada
  value: number;                 // Valor absoluto (sem sinal)
  type: 'income' | 'expense';    // Tipo da transação
  installments?: number;         // Total de parcelas (se houver)
  installment_number?: number;   // Número da parcela atual
}
```

### Exemplo de conversão completa:

**CSV de entrada:**
```csv
Data,Lançamento,Detalhes,Valor
01/10/2024,Compra com Cartão,30/09 14:20 IFOOD,-45,50
02/10/2024,PIX Recebido,João Silva,200,00
15/10/2024,Compra Parcelada,AMAZON 1/12,-1.234,56
```

**Transações extraídas:**
```json
[
  {
    "id": "temp_0_1729512000000",
    "date": "2024-10-01",
    "description": "IFOOD",
    "value": 45.50,
    "type": "expense"
  },
  {
    "id": "temp_1_1729512000001",
    "date": "2024-10-02",
    "description": "João Silva",
    "value": 200.00,
    "type": "income"
  },
  {
    "id": "temp_2_1729512000002",
    "date": "2024-10-15",
    "description": "AMAZON",
    "value": 1234.56,
    "type": "expense",
    "installments": 12,
    "installment_number": 1
  }
]
```

---

## 🎯 Resumo do Fluxo de Extração

```
┌─────────────────────┐
│  1. Upload CSV      │
│  (PapaParse)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  2. Detecção        │
│  - Locale (BR/US)   │
│  - Delimitador      │
│  - Formato de dados │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  3. Identificação   │
│  de Colunas         │
│  (Automática)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  4. Filtros         │
│  - Remove metadata  │
│  - Remove saldos    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  5. Extração        │
│  - Descrição        │
│  - Data             │
│  - Valor            │
│  - Tipo             │
│  - Parcelas         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  6. Normalização    │
│  - Formatos padrão  │
│  - Limpeza de dados │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  ✅ Transações      │
│  Estruturadas       │
│  (Prontas para IA)  │
└─────────────────────┘
```

---

## 📌 Próximos Passos

Após a extração, as transações seguem para o processo de **Classificação Inteligente com IA**, que está documentado em `DOCUMENTACAO_SISTEMA_ORBI.md`.

---

## 🔧 Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `ExtratoUploader.tsx` | Interface de upload e orquestração |
| `CSVParser.ts` | Lógica de parsing e extração |
| `EnhancedCSVParser.ts` | Versão melhorada com dicionário |
| `BankDictionary.ts` | Dicionário de bancos e padrões |

---

**Documentação gerada automaticamente**  
Sistema Orbi - Gestão Financeira Inteligente

