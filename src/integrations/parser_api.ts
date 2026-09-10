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
  source: 'edge-function' | 'ocr';
  pages: number;
  characters: number;
  lines: number;
  isScanned: boolean;
}

/** Abaixo disso não há conteúdo suficiente para interpretar um extrato. */
const MIN_MEANINGFUL_CHARS = 80;

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
      }
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
 * Ordem:
 *  1. Edge Function `extract-pdf-text` (pdf.js server-side, preserva linhas).
 *  2. Se o PDF for digitalizado (`SCANNED_PDF`), grande demais para a função,
 *     ou a extração falhar: OCR local com Tesseract.
 *  3. Se nem o OCR produzir texto útil, erro EXPLÍCITO dizendo o motivo — em
 *     vez do genérico "Nenhuma transação foi detectada no arquivo", que fazia
 *     o usuário achar que o extrato estava vazio.
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

  // Passo 1: extração nativa via Edge Function (só quando o payload cabe no
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

  // Passo 2: OCR local (PDF digitalizado ou grande demais para a Edge Function)
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
