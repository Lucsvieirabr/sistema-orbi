import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFor, preflight, jsonFor } from "../_shared/cors.ts";
import { requireUser, errorStatus } from "../_shared/auth.ts";
import { gateUser, gateFailure } from "../_shared/gate.ts";

/**
 * Edge Function para extrair texto de arquivos PDF.
 *
 * CORRECOES DE SEGURANCA:
 *  1. [AUTH] A funcao aceitava payloads de ate 15MB de QUALQUER origem, sem
 *     JWT. Endpoint publico de parsing = DoS barato e consumo de compute
 *     pago por terceiros. Agora exige usuario autenticado.
 *  2. [RATE LIMIT] 20 PDFs por hora por usuario.
 *  3. [PAYLOAD] limite aplicado ANTES da decodificacao (a validacao antiga
 *     rodava depois do atob, ou seja, o servidor ja tinha materializado o
 *     buffer inteiro na memoria).
 *  4. [ERRO] deixa de ecoar error.message em 500 (vazava caminho/stack).
 *  5. [CORS] origem restrita a ALLOWED_ORIGINS.
 */
const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15MB decodificado
// base64 infla ~4/3; +1KB de folga para whitespace.
const MAX_BASE64_CHARS = Math.ceil(MAX_PDF_BYTES * 4 / 3) + 1024;
const MAX_PAGES = 100;

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

    const rawText = await extractTextFromPdfBytes(pdfBytes);

    return jsonFor(req, { rawText });
  } catch (error) {
    return gateFailure(req, error, 'extract-pdf-text');
  }
});

/**
 * Extrai texto de PDF (bytes ja decodificados e validados) usando pdfjs-dist.
 */
async function extractTextFromPdfBytes(pdfBytes: Uint8Array): Promise<string> {
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

    let fullText = '';

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');

      fullText += pageText + '\n\n';
    }

    if (fullText && fullText.trim().length > 0) {
      return cleanExtractedText(fullText);
    }

    return "PDF_PROCESSADO_EXTRACAO_MINIMA";
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    return "PDF_PROCESSADO_ERRO_EXTRACAO";
  }
}

/**
 * Limpa texto extraido removendo lixo binario e metadados de PDF.
 */
function cleanExtractedText(text: string): string {
  if (!text) return '';

  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\/Title\s*\(/g, '')
    .replace(/\/Author\s*\(/g, '')
    .replace(/\/Subject\s*\(/g, '')
    .replace(/\/Creator\s*\(/g, '')
    .replace(/\/Producer\s*\(/g, '')
    .replace(/\f/g, ' ')
    .replace(/^[0-9]+\s*$/gm, '')
    .replace(/^D:\d{14}/gm, '')
    .replace(/\/Type\s*\/Page/g, '')
    .replace(/\/Parent\s*\d+/g, '')
    .replace(/\/MediaBox\s*\[.*?\]/g, '')
    .replace(/\/Resources\s*<</g, '')
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
