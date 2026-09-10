import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFor, preflight, jsonFor } from "../_shared/cors.ts";
import { requireUser, errorStatus } from "../_shared/auth.ts";
import { gateUser, gateFailure } from "../_shared/gate.ts";

/**
 * Edge Function para extrair texto de arquivos PDF.
 *
 * CORRECOES DE SEGURANCA (historico):
 *  1. [AUTH] exige usuario autenticado.
 *  2. [RATE LIMIT] 20 PDFs por hora por usuario.
 *  3. [PAYLOAD] limite aplicado ANTES da decodificacao.
 *  4. [ERRO] nao ecoa error.message em 500.
 *  5. [CORS] origem restrita a ALLOWED_ORIGINS.
 *
 * CORRECAO DE PARSING (bug "nenhuma transacao foi detectada no arquivo"):
 *  6. [LAYOUT] A versao anterior fazia `items.map(str).join(' ')` e, no
 *     cleanup, `replace(/\s+/g, ' ')`. Isso destruia TODA quebra de linha do
 *     documento: o extrato chegava ao StatementParser como UMA unica linha
 *     gigante. Todo parser downstream e orientado a linha
 *     (`rawText.split('\n')`), logo o resultado era sempre 0 transacoes.
 *     Agora as linhas sao reconstruidas pela coordenada Y do `transform` de
 *     cada item, e as colunas pelo gap horizontal (x + width) — que e como
 *     uma fatura/extrato em PDF realmente se organiza.
 *  7. [DIAGNOSTICO] a funcao devolve metadados (paginas, caracteres, linhas,
 *     itens de texto, `isScanned`) + um `code` legivel, em vez das sentinelas
 *     magicas em string ("PDF_PROCESSADO_ERRO_EXTRACAO") que o cliente
 *     comparava com acentuacao divergente e que nunca batiam.
 */
const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15MB decodificado
// base64 infla ~4/3; +1KB de folga para whitespace.
const MAX_BASE64_CHARS = Math.ceil(MAX_PDF_BYTES * 4 / 3) + 1024;
const MAX_PAGES = 100;

/** Tolerancia vertical (pt) para considerar dois itens na MESMA linha. */
const LINE_Y_TOLERANCE = 2.5;
/** Fracao da altura da fonte que caracteriza um espaco entre dois itens. */
const SPACE_GAP_RATIO = 0.28;
/** Abaixo disso o PDF e tratado como digitalizado (imagem) -> OCR no cliente. */
const MIN_MEANINGFUL_CHARS = 80;

/**
 * Caracteres de controle/formatacao (categoria Unicode C), preservando \n.
 * Cobre tambem zero-width (U+200B/200C/200D) e BOM, que o pdf.js as vezes
 * emite entre glifos e que quebram comparacao de string no parser.
 */
const CONTROL_OR_FORMAT = /[^\P{C}\n]/gu;
/** Whitespace horizontal (espaco, tab, NBSP, espacos tipograficos), sem \n. */
const HORIZONTAL_WS = /[^\S\n]+/g;

type ExtractionResult = {
  rawText: string;
  code: 'OK' | 'SCANNED_PDF' | 'EXTRACTION_FAILED';
  pages: number;
  characters: number;
  lines: number;
  textItems: number;
  isScanned: boolean;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);

  try {
    // [GATE] metodo -> origem -> rate limit por IP -> JWT -> cota do usuario.
    // O teto por IP vem ANTES do JWT: parsing de PDF e a rota mais cara em CPU
    // da aplicacao e validar token ja custa uma chamada ao GoTrue.
    // 20 PDFs/h por usuario; 40/h por IP (cobre casal/escritorio atras de NAT).
    await gateUser(req, {
      bucket: 'extract-pdf-text',
      ipLimit: 40,
      userLimit: 20,
      windowSeconds: 3600,
    });

    let requestData: { pdf?: unknown };
    try {
      requestData = await req.json();
    } catch {
      return jsonFor(req, { error: 'JSON invalido no corpo da requisicao.' }, 400);
    }

    const { pdf } = requestData;

    if (!pdf || typeof pdf !== 'string') {
      return jsonFor(req, { error: 'Campo "pdf" e obrigatorio e deve ser uma string base64.' }, 400);
    }

    // [3] Barra o payload ANTES de decodificar.
    if (pdf.length > MAX_BASE64_CHARS) {
      return jsonFor(
        req,
        { error: `PDF excede ${MAX_PDF_BYTES / 1024 / 1024}MB — use OCR local.` },
        413,
      );
    }

    const sanitized = pdf.replace(/\s/g, '');

    // Formato base64 estrito: atob aceita lixo silenciosamente em alguns casos.
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(sanitized) || sanitized.length % 4 !== 0) {
      return jsonFor(req, { error: 'Base64 invalido ou corrompido.' }, 400);
    }

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = Uint8Array.from(atob(sanitized), c => c.charCodeAt(0));
    } catch {
      return jsonFor(req, { error: 'Base64 invalido ou corrompido.' }, 400);
    }

    if (pdfBytes.length > MAX_PDF_BYTES) {
      return jsonFor(
        req,
        { error: `PDF excede ${MAX_PDF_BYTES / 1024 / 1024}MB — use OCR local.` },
        413,
      );
    }

    // Assinatura %PDF
    const isPDF = pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50 &&
                  pdfBytes[2] === 0x44 && pdfBytes[3] === 0x46;
    if (!isPDF) {
      return jsonFor(req, { error: 'Conteudo nao e um PDF valido (assinatura %PDF ausente).' }, 400);
    }

    const result = await extractTextFromPdfBytes(pdfBytes);

    console.log('[extract-pdf-text]', {
      code: result.code,
      pages: result.pages,
      lines: result.lines,
      characters: result.characters,
      textItems: result.textItems,
    });

    // 200 em todos os casos: `code`/`isScanned` dizem ao cliente se ele deve
    // cair para o OCR local. Um erro HTTP aqui faria o cliente abortar a
    // importacao de um PDF que o Tesseract ainda conseguiria ler.
    return jsonFor(req, result);
  } catch (error) {
    return gateFailure(req, error, 'extract-pdf-text');
  }
});

/**
 * Extrai texto de PDF preservando a estrutura de LINHAS e COLUNAS.
 *
 * pdf.js entrega `items` sem qualquer nocao de linha — cada item traz sua
 * matriz `transform` ([a,b,c,d,e,f], onde e=x e f=y no espaco do PDF). O
 * agrupamento por Y (com tolerancia) reconstitui a linha visual; o gap
 * horizontal entre `x + width` do item anterior e o `x` do proximo reconstitui
 * o espaco entre as colunas (data | descricao | valor).
 */
async function extractTextFromPdfBytes(pdfBytes: Uint8Array): Promise<ExtractionResult> {
  try {
    const pdfjsLib = await import("https://esm.sh/pdfjs-dist@3.11.174/build/pdf.mjs");

    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes,
      useSystemFonts: true,
      // Nunca resolver referencias externas a partir de um arquivo do usuario.
      isEvalSupported: false,
      disableAutoFetch: true,
    });

    const pdfDocument = await loadingTask.promise;

    // Teto de paginas: PDF pequeno com milhares de paginas e vetor de DoS.
    const numPages = Math.min(pdfDocument.numPages, MAX_PAGES);

    const pageTexts: string[] = [];
    let textItems = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      textItems += textContent.items.length;
      pageTexts.push(itemsToLines(textContent.items).join('\n'));
    }

    // \n simples entre paginas: uma transacao nunca cruza a quebra de pagina, e
    // um separador ruidoso ("--- NOVA PAGINA ---") viraria uma linha invalida.
    const rawText = cleanExtractedText(pageTexts.join('\n'));
    const characters = rawText.length;
    const lines = rawText ? rawText.split('\n').length : 0;

    // Fatura digitalizada: pdf.js abre o documento e nao encontra glifo algum
    // (apenas XObject de imagem). Sinalizamos para o cliente rodar Tesseract.
    if (characters < MIN_MEANINGFUL_CHARS) {
      return { rawText, code: 'SCANNED_PDF', pages: numPages, characters, lines, textItems, isScanned: true };
    }

    return { rawText, code: 'OK', pages: numPages, characters, lines, textItems, isScanned: false };
  } catch (error) {
    // Log server-side completo; o cliente recebe apenas o `code`.
    console.error('[extract-pdf-text] falha ao processar PDF:', error);
    return {
      rawText: '',
      code: 'EXTRACTION_FAILED',
      pages: 0,
      characters: 0,
      lines: 0,
      textItems: 0,
      isScanned: false,
    };
  }
}

/**
 * Agrupa os `items` de uma pagina em linhas de texto ordenadas
 * (topo -> base, esquerda -> direita).
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

  // Ordena por Y decrescente (no PDF a origem fica no canto inferior esquerdo).
  positioned.sort((a, b) => (b.y - a.y) || (a.x - b.x));

  const rows: { y: number; items: Positioned[] }[] = [];
  let current: { y: number; items: Positioned[] } | null = null;

  for (const it of positioned) {
    if (!current || Math.abs(current.y - it.y) > LINE_Y_TOLERANCE) {
      current = { y: it.y, items: [it] };
      rows.push(current);
    } else {
      current.items.push(it);
      // Media corrente do Y: evita "escorregar" a linha em textos com
      // sub/sobrescrito ou pequenas variacoes de baseline.
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

/**
 * Limpeza conservadora: remove controle/lixo binario e normaliza espaco
 * HORIZONTAL — nunca `\s+`, que colapsaria as quebras de linha reconstruidas
 * acima (era exatamente esse o bug que zerava a importacao).
 */
function cleanExtractedText(text: string): string {
  if (!text) return '';

  return text
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_OR_FORMAT, '')
    .replace(HORIZONTAL_WS, ' ')
    .split('\n')
    .map(line => line.trim())
    // Colapsa linhas vazias consecutivas sem eliminar a separacao.
    .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1].trim() !== ''))
    .join('\n')
    .trim();
}
