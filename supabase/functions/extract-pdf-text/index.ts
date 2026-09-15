import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { preflight, jsonFor } from "../_shared/cors.ts";
import { gateUser, gateFailure } from "../_shared/gate.ts";

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 140_000;
const UNAVAILABLE_MESSAGE = 'Leitura de documentos indisponível no momento.';
const FORWARDED_STATUSES = new Set([400, 413, 415, 422, 503]);

class ExtractionError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

interface ExtractorConfig {
  url: string;
  token: string;
}

function extractorConfig(): ExtractorConfig | null {
  const url = (Deno.env.get('DOCUMENT_EXTRACTOR_URL') ?? '').trim().replace(/\/+$/, '');
  const token = (Deno.env.get('DOCUMENT_EXTRACTOR_TOKEN') ?? '').trim();
  return url && token ? { url, token } : null;
}

function tooLarge(): ExtractionError {
  return new ExtractionError(413, 'FILE_TOO_LARGE', `O arquivo excede ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB.`);
}

async function readDocument(req: Request): Promise<ArrayBuffer> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_DOCUMENT_BYTES) throw tooLarge();
  if (!req.body) throw new ExtractionError(400, 'EMPTY_FILE', 'O arquivo está vazio.');

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_DOCUMENT_BYTES) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }

  if (size === 0) throw new ExtractionError(400, 'EMPTY_FILE', 'O arquivo está vazio.');

  const document = new ArrayBuffer(size);
  const view = new Uint8Array(document);
  let offset = 0;
  for (const chunk of chunks) {
    view.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return document;
}

async function callExtractor(config: ExtractorConfig, document: ArrayBuffer): Promise<{ status: number; body: unknown }> {
  let response: Response;

  try {
    response = await fetch(`${config.url}/v1/extract`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: document,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const name = (error as Error)?.name;
    console.error('[extract-pdf-text] extrator inacessível:', name, (error as Error)?.message);
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new ExtractionError(504, 'EXTRACTOR_TIMEOUT', 'A leitura do documento demorou demais. Envie um arquivo com menos páginas.');
    }
    throw new ExtractionError(502, 'EXTRACTOR_UNAVAILABLE', UNAVAILABLE_MESSAGE);
  }

  const payload = await response.json().catch(() => null) as
    | { transactions?: unknown; code?: unknown; error?: unknown }
    | null;

  if (response.ok && payload && Array.isArray(payload.transactions)) {
    return { status: 200, body: payload };
  }

  if (FORWARDED_STATUSES.has(response.status) && typeof payload?.code === 'string') {
    return {
      status: response.status,
      body: { error: typeof payload.error === 'string' ? payload.error : UNAVAILABLE_MESSAGE, code: payload.code },
    };
  }

  console.error('[extract-pdf-text] resposta inesperada do extrator:', response.status, payload?.code);
  throw new ExtractionError(502, 'EXTRACTOR_UNAVAILABLE', UNAVAILABLE_MESSAGE);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);

  try {
    await gateUser(req, {
      bucket: 'extract-pdf-text',
      ipLimit: 40,
      userLimit: 20,
      windowSeconds: 3600,
    });

    const config = extractorConfig();
    if (!config) {
      console.error('[extract-pdf-text] DOCUMENT_EXTRACTOR_URL/DOCUMENT_EXTRACTOR_TOKEN ausentes');
      throw new ExtractionError(503, 'EXTRACTOR_UNAVAILABLE', UNAVAILABLE_MESSAGE);
    }

    const document = await readDocument(req);
    const started = Date.now();
    const result = await callExtractor(config, document);

    console.log('[extract-pdf-text]', {
      bytes: document.byteLength,
      status: result.status,
      durationMs: Date.now() - started,
    });

    return jsonFor(req, result.body, result.status);
  } catch (error) {
    if (error instanceof ExtractionError) {
      return jsonFor(req, { error: error.message, code: error.code }, error.status);
    }
    return gateFailure(req, error, 'extract-pdf-text');
  }
});
