/**
 * Cliente API para integração com funções de parsing e extração de dados
 */

import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker do PDF.js com múltiplas estratégias de fallback
try {
  // Estratégia 1: Tentar usar o worker do public (mais confiável)
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
} catch (error) {
  try {
    // Estratégia 2: Usar URL relativa ao módulo
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (fallbackError) {
    // Estratégia 3: Fallback para CDN com protocolo explícito
    console.warn('Usando CDN como último recurso para PDF.js worker');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }
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
 * Extrai texto de um arquivo PDF usando a Edge Function extract-pdf-text
 * @param pdfBase64 - PDF em formato base64
 * @returns Promise<string> - Texto extraído do PDF
 */
export async function extractTextFromPdf(pdfBase64: string): Promise<string> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Configuração do Supabase não encontrada');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase.functions.invoke('extract-pdf-text', {
      body: {
        pdf: pdfBase64
      }
    });

    if (error) {
      console.error('Erro na extração de PDF:', error);
      throw new Error(`Erro na extração de PDF: ${error.message}`);
    }

    if (!data || !data.rawText) {
      throw new Error('Resposta inválida da função de extração de PDF');
    }

    return data.rawText;
  } catch (error) {
    console.error('Erro ao extrair texto do PDF:', error);
    throw error;
  }
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
      throw new Error('Não foi possível criar contexto 2D do canvas');
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
 * Extrai texto de imagem usando Tesseract.js (OCR)
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
    
    return result.data.text;
  } catch (error) {
    console.error('Erro no OCR:', error);
    return '';
  }
}

/**
 * Processa um arquivo PDF completo (converte para base64 e extrai texto)
 * Com suporte robusto para PDFs de imagem via OCR
 * @param file - Arquivo PDF
 * @param onProgress - Callback opcional para progresso (0-100)
 * @returns Promise<string> - Texto extraído do PDF
 */
export async function processPdfFile(
  file: File, 
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!file.type.includes('pdf')) {
    throw new Error('Arquivo deve ser um PDF válido');
  }

  try {
    // Passo 1: Tentar extração rápida via Edge Function (para PDFs digitais)
    onProgress?.(10);
    
    try {
      const base64 = await fileToBase64(file);
      const extractedText = await extractTextFromPdf(base64);
      
      // Se conseguiu extrair texto significativo, retornar
      if (extractedText && 
          !extractedText.includes('PDF_PROCESSADO_ERRO') &&
          !extractedText.includes('PDF_PROCESSADO_EXTRAÇÃO_MÍNIMA') &&
          extractedText.trim().length > 100) {
        onProgress?.(100);
        return extractedText;
      }
    } catch (error) {
      // Silencioso: vai tentar OCR
    }
    
    // Passo 2: PDF é baseado em imagem, usar OCR local
    onProgress?.(20);
    
    // Converter PDF em imagens
    const images = await pdfToImages(file);
    onProgress?.(40);
    
    // Extrair texto de cada imagem com OCR
    const textParts: string[] = [];
    const progressPerPage = 50 / images.length;
    
    for (let i = 0; i < images.length; i++) {
      const pageText = await extractTextFromImage(images[i]);
      textParts.push(pageText);
      
      onProgress?.(40 + ((i + 1) * progressPerPage));
    }
    
    onProgress?.(100);
    
    // Combinar texto de todas as páginas
    const finalText = textParts.join('\n\n--- NOVA PÁGINA ---\n\n');
    
    if (!finalText.trim()) {
      throw new Error('Não foi possível extrair texto do PDF. Verifique se o arquivo está legível.');
    }
    
    return finalText;
    
  } catch (error) {
    console.error('Erro ao processar arquivo PDF:', error);
    throw error;
  }
}
