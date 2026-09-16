# extract-pdf-text

Porta de entrada da importação de documentos (PDF nativo, PDF digitalizado, imagem e OFX).
Não interpreta arquivo nenhum: aplica o gate e repassa o binário ao serviço Python `services/document-extractor`.

```
supabase.functions.invoke('extract-pdf-text', { body: file })
  └─ gate: método → origem → rate limit IP (40/h) → JWT → rate limit usuário (20/h)
  └─ corpo binário ≤ 15MB (lido em streaming, abortado ao estourar)
  └─ POST {DOCUMENT_EXTRACTOR_URL}/v1/extract  Authorization: Bearer DOCUMENT_EXTRACTOR_TOKEN  (timeout 140s)
```

## Secrets

```bash
supabase secrets set \
  DOCUMENT_EXTRACTOR_URL=https://extrator.seu-dominio.com \
  DOCUMENT_EXTRACTOR_TOKEN=<mesmo valor de EXTRACTOR_SERVICE_TOKEN do serviço>
supabase functions deploy extract-pdf-text
```

## Respostas

- `200` — contrato do extrator (`source`, `documentKind`, `transactions`, `diagnostics`, `warnings`). Ver `services/document-extractor/README.md`.
- `400/413/415/422/503` — `{ error, code }` repassado do extrator (`PDF_PROTECTED`, `NO_TEXT`, `OCR_UNAVAILABLE`...).
- `429` — gate, com `Retry-After`.
- `502` `EXTRACTOR_UNAVAILABLE` — extrator fora do ar, token divergente ou resposta inválida (detalhe só no log).
- `503` `EXTRACTOR_UNAVAILABLE` — secrets ausentes.
- `504` `EXTRACTOR_TIMEOUT` — extração acima de 140s.
