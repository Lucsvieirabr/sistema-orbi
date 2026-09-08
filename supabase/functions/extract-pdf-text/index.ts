import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Edge Function para extrair texto de arquivos PDF
 * Usa pdfjs-dist para PDFs digitais; PDFs de imagem seguem via OCR local no client
 */
const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15MB decodificado

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Apenas aceitar POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido. Use POST.' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const body = await req.text();
    let requestData;

    try {
      requestData = JSON.parse(body);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'JSON inválido no corpo da requisição.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { pdf } = requestData;

    // Validar entrada
    if (!pdf || typeof pdf !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Campo "pdf" é obrigatório e deve ser uma string base64.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Sanitizar base64 (remove whitespace/newlines que quebram atob) e decodificar
    const sanitized = pdf.replace(/\s/g, '');
    let pdfBytes: Uint8Array;

    try {
      pdfBytes = Uint8Array.from(atob(sanitized), c => c.charCodeAt(0));
    } catch (error) {
      console.error('Erro ao decodificar base64:', error);
      return new Response(
        JSON.stringify({ error: 'Base64 inválido ou corrompido.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validar limite de tamanho (evita travar a função com payloads gigantes)
    if (pdfBytes.length > MAX_PDF_BYTES) {
      return new Response(
        JSON.stringify({ error: `PDF excede ${MAX_PDF_BYTES / 1024 / 1024}MB — use OCR local.` }),
        {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validar assinatura do arquivo (%PDF)
    const isPDF = pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50 && pdfBytes[2] === 0x44 && pdfBytes[3] === 0x46;
    if (!isPDF) {
      return new Response(
        JSON.stringify({ error: 'Conteúdo não é um PDF válido (assinatura %PDF ausente).' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Extrair texto do PDF
    const rawText = await extractTextFromPdfBytes(pdfBytes);

    return new Response(
      JSON.stringify({ rawText }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro na extração de PDF:', error);

    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Extrai texto de PDF (bytes já decodificados e validados) usando pdfjs-dist
 * PDF.js é mantido pela Mozilla e funciona perfeitamente em Edge Functions
 */
async function extractTextFromPdfBytes(pdfBytes: Uint8Array): Promise<string> {
  try {
    // Importar pdfjs-dist (compatível com Deno/Edge Functions)
    const pdfjsLib = await import("https://esm.sh/pdfjs-dist@3.11.174/build/pdf.mjs");

    // Carregar o documento PDF
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes,
      useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;

    console.log(`PDF carregado com ${numPages} páginas`);

    // Extrair texto de todas as páginas
    let fullText = '';

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Concatenar todos os items de texto da página
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');

      fullText += pageText + '\n\n';
    }

    // Se conseguiu extrair texto significativo, retornar limpo
    if (fullText && fullText.trim().length > 100) {
      return cleanExtractedText(fullText);
    }

    // Fallback: tentar retornar mesmo com pouco texto
    if (fullText && fullText.trim().length > 0) {
      return cleanExtractedText(fullText);
    }

    // Último recurso: retornar indicador de extração mínima
    return "PDF_PROCESSADO_EXTRAÇÃO_MÍNIMA";

  } catch (error) {
    console.error('Erro ao processar PDF:', error);

    // Em caso de erro, retornar indicador de erro
    return "PDF_PROCESSADO_ERRO_EXTRAÇÃO";
  }
}

/**
 * Limpa texto extraído removendo lixo binário e metadados de PDF
 */
function cleanExtractedText(text: string): string {
  if (!text) return '';

  return text
    // Remover caracteres de controle e bytes inválidos
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remover sequências comuns de metadados PDF
    .replace(/\/Title\s*\(/g, '')
    .replace(/\/Author\s*\(/g, '')
    .replace(/\/Subject\s*\(/g, '')
    .replace(/\/Creator\s*\(/g, '')
    .replace(/\/Producer\s*\(/g, '')
    // Remover números de página comuns
    .replace(/\f/g, ' ') // Form feed (quebra de página)
    // Remover linhas que parecem metadados técnicos
    .replace(/^[0-9]+\s*$/gm, '') // Apenas números
    .replace(/^D:\d{14}/gm, '') // Timestamps PDF
    .replace(/\/Type\s*\/Page/g, '')
    .replace(/\/Parent\s*\d+/g, '')
    .replace(/\/MediaBox\s*\[.*?\]/g, '')
    .replace(/\/Resources\s*<</g, '')
    // Remover espaços múltiplos
    .replace(/\s+/g, ' ')
    // Remover linhas vazias múltiplas
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
