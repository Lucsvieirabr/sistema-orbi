/**
 * Cliente API para integração com funções de parsing e extração de dados
 */

import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Worker do PDF.js.
// O bundle da Vercel nao expoe `pdf.worker.min.mjs` na raiz do dominio (o
// rewrite SPA devolve o index.html, quebrando o import dinamico do worker).
// Apontamos para o mesmo build publicado no npm, travado na versao exata do
// pacote instalado (`pdfjsLib.version`), o que elimina qualquer mismatch entre
// a API e o worker. Sendo cross-origin, o proprio PDF.js encapsula o worker em
// um blob (permitido pelo CSP: `worker-src 'self' blob:`).
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/** Resultado normalizado da extração de texto de um PDF. */
export interface PdfExtractionResult {
  rawText: string;
  /** OK = texto nativo; SCANNED_PDF = imagem (precisa de OCR); EXTRACTION_FAILED = pdf.js falhou. */
  code: 'OK' | 'SCANNED_PDF' | 'EXTRACTION_FAILED';
  source: 'local-pdfjs' | 'edge-function' | 'ocr';
  pages: number;
  characters: number;
  lines: number;
  isScanned: boolean;
}

/** Abaixo disso não há conteúdo suficiente para interpretar um extrato. */
const MIN_MEANINGFUL_CHARS = 80;

/* ===========================================================================
 * EXTRAÇÃO NATIVA LOCAL (pdf.js no navegador)
 *
 * Por que existe: a extração nativa dependia INTEIRAMENTE da Edge Function
 * `extract-pdf-text`. Se ela não estivesse publicada, estivesse com rate limit
 * (20 PDFs/h), fora do ar, ou o PDF passasse de 4MB, o fluxo caía no OCR — e o
 * OCR devolve datas quebradas ("29,JUN", "O1JUL", "29UN") que nenhum parser de
 * fatura reconhece. O sintoma era uma fatura de 72 lançamentos importar 3.
 *
 * O `pdfjs-dist` já é dependência do projeto e já está carregado aqui (era
 * usado só para rasterizar as páginas para o OCR). `getTextContent()` entrega
 * a MESMA camada de texto que a Edge Function lê — sem rede, sem JWT, sem
 * limite de payload e sem divergência de versão do pdf.js entre cliente e
 * servidor. A Edge Function passa a ser plano B, e o OCR plano C.
 * ======================================================================== */

/** Tolerância vertical (pt) para considerar dois itens na MESMA linha. */
const LINE_Y_TOLERANCE = 2.5;
/** Fração da altura da fonte que caracteriza um espaço entre dois itens. */
const SPACE_GAP_RATIO = 0.28;
/** Controle/formatação (categoria Unicode C), preservando \n. */
const CONTROL_OR_FORMAT = /[^\P{C}\n]/gu;
/** Whitespace horizontal (espaço, tab, NBSP, espaços tipográficos), sem \n. */
const HORIZONTAL_WS = /[^\S\n]+/g;

/**
 * Agrupa os `items` de uma página em linhas de texto ordenadas.
 *
 * pdf.js entrega `items` sem nenhuma noção de linha — cada item traz sua
 * matriz `transform` ([a,b,c,d,e,f], com e=x e f=y). Agrupar por Y reconstitui
 * a linha visual; o vão horizontal entre `x + width` do item anterior e o `x`
 * do próximo reconstitui o espaço entre as colunas (data | máscara |
 * descrição | valor). Sem isso, `items.map(i => i.str).join(' ')` produziria
 * uma única linha gigante e todo parser — que é orientado a linha — acharia
 * zero transações.
 */
function itemsToLines(items: any[]): string[] {
  type Positioned = { str: string; x: number; y: number; w: number; h: number };

  const positioned: Positioned[] = [];

  for (const item of items) {
    const str: string = typeof item?.str === 'string' ? item.str : '';
    if (!str || !str.trim()) continue;

    const tr: number[] = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
    positioned.push({
      str,
      x: tr[4] ?? 0,
      y: tr[5] ?? 0,
      w: typeof item.width === 'number' ? item.width : 0,
      h: Math.abs(tr[3] ?? 0) || (typeof item.height === 'number' ? item.height : 10) || 10,
    });
  }

  if (positioned.length === 0) return [];

  // Y decrescente: no PDF a origem fica no canto inferior esquerdo.
  positioned.sort((a, b) => (b.y - a.y) || (a.x - b.x));

  const rows: { y: number; items: Positioned[] }[] = [];
  let current: { y: number; items: Positioned[] } | null = null;

  for (const it of positioned) {
    if (!current || Math.abs(current.y - it.y) > LINE_Y_TOLERANCE) {
      current = { y: it.y, items: [it] };
      rows.push(current);
    } else {
      current.items.push(it);
      // Média corrente do Y: evita "escorregar" a linha em sub/sobrescrito.
      current.y = (current.y * (current.items.length - 1) + it.y) / current.items.length;
    }
  }

  const lines: string[] = [];

  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);

    let text = '';
    let prevEnd: number | null = null;
    let prevHeight = 10;

    for (const it of row.items) {
      if (prevEnd !== null) {
        const gap = it.x - prevEnd;
        const threshold = Math.max(1, prevHeight * SPACE_GAP_RATIO);
        if (gap > threshold) text += ' ';
      }
      text += it.str;
      prevEnd = it.x + (it.w || 0);
      prevHeight = it.h || prevHeight;
    }

    const normalized = text.replace(HORIZONTAL_WS, ' ').trim();
    if (normalized) lines.push(normalized);
  }

  return lines;
}

/** Limpeza conservadora: nunca `\s+`, que colapsaria as quebras de linha. */
function cleanExtractedText(text: string): string {
  if (!text) return '';

  return text
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_OR_FORMAT, '')
    .replace(HORIZONTAL_WS, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1].trim() !== ''))
    .join('\n')
    .trim();
}

/** Teto de páginas: PDF pequeno com milhares de páginas trava a aba. */
const MAX_LOCAL_PAGES = 100;

/**
 * Extrai a camada de texto do PDF no próprio navegador, preservando linhas.
 * Devolve `null` quando o PDF não tem camada de texto (digitalizado) ou quando
 * o pdf.js não consegue abrir o arquivo — nos dois casos o chamador segue
 * para os planos B e C.
 */
async function extractTextLocally(file: File): Promise<PdfExtractionResult | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      // Nunca resolver referências externas a partir de um arquivo do usuário.
      isEvalSupported: false,
      disableAutoFetch: true,
    }).promise;

    const numPages = Math.min(pdf.numPages, MAX_LOCAL_PAGES);
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      pageTexts.push(itemsToLines(textContent.items as any[]).join('\n'));
    }

    // \n simples entre páginas: uma transação nunca cruza a quebra de página,
    // e um separador decorado viraria uma linha inválida para o parser.
    const rawText = cleanExtractedText(pageTexts.join('\n'));
    const characters = rawText.length;

    if (characters < MIN_MEANINGFUL_CHARS) {
      return {
        rawText,
        code: 'SCANNED_PDF',
        source: 'local-pdfjs',
        pages: numPages,
        characters,
        lines: rawText ? rawText.split('\n').length : 0,
        isScanned: true,
      };
    }

    return {
      rawText,
      code: 'OK',
      source: 'local-pdfjs',
      pages: numPages,
      characters,
      lines: rawText.split('\n').length,
      isScanned: false,
    };
  } catch (error) {
    console.warn('[parser_api] extração nativa local falhou:', error);
    return null;
  }
}

/**
 * Sentinelas da versão ANTIGA da Edge Function. Mantidas apenas para o período
 * em que o front novo pode conversar com a função ainda não redeployada.
 * O bug original: o cliente comparava com "PDF_PROCESSADO_EXTRAÇÃO_MÍNIMA"
 * (acentuado) enquanto a função devolvia "PDF_PROCESSADO_EXTRACAO_MINIMA"
 * (sem acento) — a comparação nunca batia.
 */
const LEGACY_FAILURE_SENTINELS = [
  'PDF_PROCESSADO_ERRO',
  'PDF_PROCESSADO_EXTRACAO_MINIMA',
  'PDF_PROCESSADO_EXTRAÇÃO_MÍNIMA',
];

function isLegacyFailureSentinel(text: string): boolean {
  const normalized = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
  return LEGACY_FAILURE_SENTINELS.some(sentinel =>
    normalized.includes(sentinel.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()),
  );
}

/**
 * Converte um arquivo File para base64
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      // Remove o prefixo "data:mime/type;base64," para obter apenas o base64
      const base64 = base64String.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

/**
 * Extrai texto de um arquivo PDF usando a Edge Function extract-pdf-text.
 *
 * A função devolve `{ rawText, code, pages, characters, lines, isScanned }`.
 * Versões antigas devolviam apenas `{ rawText }` com sentinelas em string —
 * ambos os formatos são tratados aqui.
 */
export async function extractTextFromPdf(pdfBase64: string): Promise<PdfExtractionResult> {
  // SEGURANÇA: usa o client singleton (que carrega a sessão do usuário) em
  // vez de instanciar um client novo só com a anon key. A Edge Function
  // extract-pdf-text exige JWT de usuário final — um client sem sessão
  // enviaria apenas a anon key e receberia 401.
  const { supabase } = await import('@/integrations/supabase/client');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Sessão expirada. Faça login novamente para importar PDFs.');
  }

  const { data, error } = await supabase.functions.invoke('extract-pdf-text', {
    body: { pdf: pdfBase64 },
  });

  if (error) {
    console.error('[parser_api] Edge Function extract-pdf-text falhou:', error);
    throw new Error(`Erro na extração de PDF: ${error.message}`);
  }

  if (!data || typeof data.rawText !== 'string') {
    throw new Error('Resposta inválida da função de extração de PDF.');
  }

  const rawText: string = data.rawText;

  // Compatibilidade com a versão antiga (sentinela em string).
  if (!data.code && isLegacyFailureSentinel(rawText)) {
    return {
      rawText: '',
      code: 'EXTRACTION_FAILED',
      source: 'edge-function',
      pages: 0,
      characters: 0,
      lines: 0,
      isScanned: false,
    };
  }

  const characters = typeof data.characters === 'number' ? data.characters : rawText.length;

  return {
    rawText,
    code: data.code ?? (characters >= MIN_MEANINGFUL_CHARS ? 'OK' : 'SCANNED_PDF'),
    source: 'edge-function',
    pages: typeof data.pages === 'number' ? data.pages : 0,
    characters,
    lines: typeof data.lines === 'number'
      ? data.lines
      : (rawText ? rawText.split('\n').length : 0),
    isScanned: Boolean(data.isScanned) || characters < MIN_MEANINGFUL_CHARS,
  };
}

/**
 * Converte PDF em array de imagens usando PDF.js
 */
async function pdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const images: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // Scale 2x para melhor qualidade OCR

    // Criar canvas para renderizar a página
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Não foi possível criar contexto 2D do canvas.');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Renderizar página no canvas
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // Converter canvas para data URL (imagem)
    const imageData = canvas.toDataURL('image/png');
    images.push(imageData);
  }

  return images;
}

/**
 * Extrai texto de imagem usando Tesseract.js (OCR).
 *
 * `preserve_interword_spaces` mantém o espaçamento entre colunas — sem isso, a
 * linha "29 JUN Mercado R$ 60,37" volta com as colunas coladas e nenhum parser
 * consegue separar descrição de valor.
 */
async function extractTextFromImage(imageDataUrl: string): Promise<string> {
  try {
    const result = await Tesseract.recognize(
      imageDataUrl,
      'por', // Português
      {
        // Logger removido para evitar poluição do console
        // O comentário do topo desta função dizia que
        // `preserve_interword_spaces` estava ligado, mas o objeto de opções
        // estava vazio — as colunas voltavam coladas. Agora está de fato
        // ligado (`'1'`, string, é o formato que o Tesseract espera).
        preserve_interword_spaces: '1',
      } as any
    );

    return result.data.text ?? '';
  } catch (error) {
    console.error('[parser_api] Erro no OCR:', error);
    return '';
  }
}

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB
const EDGE_FUNCTION_SAFE_LIMIT = 4 * 1024 * 1024; // base64 infla ~37%; edge function payload cap ~6MB

async function isPdfSignatureValid(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
}

/**
 * Processa um arquivo PDF completo (extração nativa + fallback OCR).
 *
 * Ordem (mudou — ver o bloco EXTRAÇÃO NATIVA LOCAL no topo do arquivo):
 *  1. pdf.js NO NAVEGADOR (`extractTextLocally`). Determinístico, sem rede.
 *  2. Edge Function `extract-pdf-text`, só se o passo 1 não achar camada de
 *     texto — cobre o caso de um pdf.js server-side de versão diferente
 *     conseguir abrir um arquivo que o do cliente não abriu.
 *  3. OCR local com Tesseract (PDF realmente digitalizado).
 *  4. Se nem o OCR produzir texto útil, erro EXPLÍCITO dizendo o motivo.
 *
 * O OCR era alcançado cedo demais: bastava a Edge Function não estar
 * publicada, estar em rate limit ou o PDF passar de 4MB. E o texto de OCR
 * quebra as datas da fatura ("29,JUN", "O1JUL"), o que reduzia uma fatura de
 * 72 lançamentos a um punhado. Agora o OCR só entra quando é de fato a única
 * opção — PDF sem camada de texto.
 */
export async function processPdfFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const result = await processPdfFileDetailed(file, onProgress);
  return result.rawText;
}

/** Igual a `processPdfFile`, mas devolve também o diagnóstico da extração. */
export async function processPdfFileDetailed(
  file: File,
  onProgress?: (progress: number) => void
): Promise<PdfExtractionResult> {
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Arquivo deve ser um PDF válido.');
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(`PDF excede o limite de ${MAX_PDF_BYTES / 1024 / 1024}MB.`);
  }
  if (!(await isPdfSignatureValid(file))) {
    throw new Error('Arquivo corrompido ou não é um PDF real (assinatura %PDF ausente).');
  }

  onProgress?.(10);

  let edgeResult: PdfExtractionResult | null = null;
  let edgeError: unknown = null;

  // Passo 1: pdf.js no navegador. É o caminho normal — o mesmo `pdfjs-dist`
  // que já rasteriza as páginas para o OCR também lê a camada de texto.
  const localResult = await extractTextLocally(file);

  if (localResult) {
    console.info('[parser_api] extração nativa local:', {
      code: localResult.code,
      paginas: localResult.pages,
      caracteres: localResult.characters,
      linhas: localResult.lines,
    });

    if (localResult.code === 'OK' && localResult.characters >= MIN_MEANINGFUL_CHARS) {
      onProgress?.(100);
      return localResult;
    }

    console.warn(
      '[parser_api] PDF sem camada de texto utilizável localmente (chars=%d). Tentando Edge Function.',
      localResult.characters,
    );
  }

  onProgress?.(15);

  // Passo 2: extração nativa via Edge Function (só quando o payload cabe no
  // limite do gateway).
  if (file.size <= EDGE_FUNCTION_SAFE_LIMIT) {
    try {
      const base64 = (await fileToBase64(file)).replace(/\s/g, '');
      edgeResult = await extractTextFromPdf(base64);

      console.info('[parser_api] extração nativa:', {
        code: edgeResult.code,
        paginas: edgeResult.pages,
        caracteres: edgeResult.characters,
        linhas: edgeResult.lines,
      });

      if (edgeResult.code === 'OK' && edgeResult.characters >= MIN_MEANINGFUL_CHARS) {
        onProgress?.(100);
        return edgeResult;
      }

      console.warn(
        '[parser_api] PDF sem camada de texto utilizável (code=%s, chars=%d). Caindo para OCR local.',
        edgeResult.code,
        edgeResult.characters,
      );
    } catch (error) {
      edgeError = error;
      // Sessão expirada não deve virar "tenta OCR": o usuário precisa saber.
      if (error instanceof Error && /sess[ãa]o expirada/i.test(error.message)) {
        throw error;
      }
      console.warn('[parser_api] Extração via Edge Function falhou, usando OCR local:', error);
    }
  }

  // Passo 3: OCR local. Último recurso — o texto de OCR degrada as datas da
  // fatura e derruba boa parte dos lançamentos.
  onProgress?.(20);

  let images: string[] = [];
  try {
    images = await pdfToImages(file);
  } catch (error) {
    console.error('[parser_api] Falha ao rasterizar o PDF para OCR:', error);
    throw new Error(
      'Não foi possível ler este PDF. Ele pode estar protegido por senha ou corrompido. ' +
      'Tente exportar o extrato novamente pelo aplicativo do banco (ou use o CSV/OFX).'
    );
  }

  onProgress?.(40);

  const textParts: string[] = [];
  const progressPerPage = images.length > 0 ? 50 / images.length : 50;

  for (let i = 0; i < images.length; i++) {
    const pageText = await extractTextFromImage(images[i]);
    textParts.push(pageText);
    onProgress?.(40 + ((i + 1) * progressPerPage));
  }

  onProgress?.(100);

  // \n simples entre páginas: separador "decorado" viraria linha inválida para
  // os parsers, que são orientados a linha.
  const ocrText = textParts.join('\n').trim();
  const characters = ocrText.length;

  // Passo 3: erro explícito quando nem o OCR devolveu conteúdo utilizável.
  if (characters < MIN_MEANINGFUL_CHARS) {
    if (edgeError) {
      console.error('[parser_api] Erro original da Edge Function:', edgeError);
    }
    throw new Error(
      'Não foi possível extrair texto deste PDF. ' +
      (edgeResult?.isScanned || images.length > 0
        ? 'O arquivo parece ser uma imagem digitalizada de baixa qualidade. '
        : '') +
      'Baixe a fatura/extrato em PDF original do aplicativo do banco (não uma foto ou digitalização), ' +
      'ou importe o arquivo CSV/OFX.'
    );
  }

  console.info('[parser_api] extração via OCR:', {
    paginas: images.length,
    caracteres: characters,
  });

  return {
    rawText: ocrText,
    code: 'OK',
    source: 'ocr',
    pages: images.length,
    characters,
    lines: ocrText.split('\n').length,
    isScanned: true,
  };
}
