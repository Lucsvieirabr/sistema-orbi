# Orbi Document Extractor

Serviço Python privado que lê extratos e faturas e devolve transações prontas para o classificador.
Só é chamado pela Edge Function `extract-pdf-text`, que aplica o gate (origem, rate limit, JWT) antes de repassar o arquivo.

```
Browser ──(JWT)──> Edge Function extract-pdf-text ──(Bearer EXTRACTOR_SERVICE_TOKEN)──> POST /v1/extract
```

## Extratores

| Entrada | Extrator | Biblioteca |
|---|---|---|
| `.ofx` (SGML v1 e XML v2) | `OfxExtractor` | parser próprio de tags, tolerante a tags SGML sem fechamento |
| PDF gerado pelo banco | `NativePdfExtractor` | `pdfplumber` (palavras com coordenadas, `dedupe_chars`, descarte de texto rotacionado e glifos `(cid:)`) |
| PDF digitalizado, imagem (PNG/JPG/WEBP/TIFF) | `ScannedPdfExtractor` | Tesseract via `pytesseract` (`image_to_data`, coordenadas por palavra) |

PDF misto: páginas sem camada de texto passam individualmente pelo OCR.

## Interpretação (`app/parsing`)

- Linhas reconstruídas por coordenada Y; valores e datas lidos por palavra, não por regex sobre a linha inteira.
- Cabeçalho `Data | Histórico | Documento | Débito | Crédito | Valor | Saldo` define colunas por posição X: coluna de saldo nunca vira valor, débito/crédito definem o tipo, número de documento sai da descrição.
- Extrato: data herdada em linhas sem data (agrupamento por dia), descrição quebrada em duas linhas, sufixos `D`/`C`, sinais `-`, `−`, `(valor)`.
- Fatura (Nubank, Itaú e similares): `DD MMM` e `DD/MM`, colunas lado a lado, máscara `•••• 0040`, parcelas (`Parcela 3/3`, `PARC 02/10`, `02/10`), ano inferido pelo vencimento e período.
- Tipo do documento (fatura × extrato) inferido pelo conteúdo.

## Contrato

`POST /v1/extract` — corpo binário (`application/octet-stream`), máximo `EXTRACTOR_MAX_BYTES`.

```json
{
  "source": "pdf_native | pdf_ocr | image_ocr | ofx",
  "documentKind": "card_invoice | bank_statement",
  "pages": 3,
  "characters": 5231,
  "lines": 180,
  "transactions": [
    { "id": "TXN-20260629-001", "date": "2026-06-29", "description": "C A Modas", "value": 59.99,
      "type": "expense", "payment_method": "credit", "installments": 3, "installment_number": 3, "card_last4": "0040" }
  ],
  "diagnostics": { "strategy": "columns | lines | ofx", "totalLines": 180, "candidateLines": 75,
                   "matchedLines": 72, "skippedLines": 3, "transactions": 72 },
  "warnings": ["OCR_PAGE_LIMIT_REACHED"]
}
```

Erros: `{ "error": "mensagem", "code": "..." }` — `UNAUTHORIZED` 401, `EMPTY_FILE` 400, `FILE_TOO_LARGE` 413,
`UNSUPPORTED_FORMAT` 415, `PDF_PROTECTED` / `PDF_INVALID` / `OFX_INVALID` / `IMAGE_INVALID` / `NO_TEXT` 422,
`OCR_UNAVAILABLE` 503, `INTERNAL_ERROR` 500.

`GET /health` — `{ "status": "ok", "ocr": true }`.

## Configuração

| Variável | Padrão | Uso |
|---|---|---|
| `EXTRACTOR_SERVICE_TOKEN` | — (obrigatória, ≥ 32 caracteres) | segredo compartilhado com a Edge Function |
| `EXTRACTOR_MAX_BYTES` | `15728640` | tamanho máximo do arquivo |
| `EXTRACTOR_MAX_PAGES` | `60` | páginas lidas por PDF nativo |
| `EXTRACTOR_OCR_MAX_PAGES` | `20` | páginas/quadros lidos por OCR |
| `EXTRACTOR_OCR_DPI` | `300` | resolução de rasterização |
| `EXTRACTOR_OCR_LANGUAGES` | `por+eng` | idiomas do Tesseract (os não instalados são ignorados) |
| `EXTRACTOR_OCR_PSM` | `6` | page segmentation mode |
| `EXTRACTOR_OCR_PAGE_TIMEOUT` | `60` | segundos por página |
| `EXTRACTOR_MIN_TEXT_CHARS` | `80` | abaixo disso o PDF é tratado como digitalizado |
| `EXTRACTOR_MAX_CONCURRENCY` | `2` | extrações simultâneas por processo |
| `EXTRACTOR_WORKERS` | `1` | processos uvicorn (imagem Docker) |
| `PORT` | `8080` | porta HTTP |

## Rodar localmente

```bash
cd services/document-extractor
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
sudo apt-get install tesseract-ocr tesseract-ocr-por
export EXTRACTOR_SERVICE_TOKEN="$(openssl rand -hex 32)"
uvicorn app.main:create_app --factory --port 8080
python -m unittest discover -s tests -t .
```

## Deploy

```bash
docker build -t orbi-document-extractor services/document-extractor
docker run -p 8080:8080 -e EXTRACTOR_SERVICE_TOKEN=... orbi-document-extractor
```

Qualquer host de contêiner com HTTPS serve (Cloud Run, Fly.io, Render, Railway). Depois:

```bash
supabase secrets set DOCUMENT_EXTRACTOR_URL=https://extrator.seu-dominio.com DOCUMENT_EXTRACTOR_TOKEN=<mesmo token>
supabase functions deploy extract-pdf-text
```

Não expor o serviço sem o token: ele não valida JWT de usuário nem aplica rate limit — isso é papel da Edge Function.
