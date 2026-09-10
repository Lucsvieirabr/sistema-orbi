# APIs externas do Orbi — o que custa, o que não custa, o que sobrou

Revisão de 2026-09-10. Levantamento feito por varredura de `Deno.env.get(...)`
nas Edge Functions e de todas as URLs `http(s)://` em `src/`, `supabase/` e
`scripts/`.

## Pagas / com cota — em uso

| Nome | Onde | Custo | Veredito |
|---|---|---|---|
| **Asaas** | `asaas-*` (5 Edge Functions) | por cobrança emitida | **Manter** — é o gateway da assinatura, é a receita. |
| **Supabase** | infra inteira (Postgres, Auth, Storage, Edge Functions) | plano da conta | **Manter** — é o backend. |

## Pagas — removidas nesta entrega

| Nome | Onde estava | Ação pendente |
|---|---|---|
| **logo.dev** | `search-logo`, `get-company-logo`, `series.logo_url`, bucket `company-logos` | **Revogar `LOGO_DEV_TOKEN` e `LOGO_DEV_TOKEN_IMAGES`** no painel do logo.dev e rodar `supabase secrets unset LOGO_DEV_TOKEN LOGO_DEV_TOKEN_IMAGES`. Enquanto os tokens existirem, existe cota consumível. |

Por que saiu: era a única dependência paga fora da cobrança, a cota era gasta
por qualquer usuário autenticado, e o bucket público aceitava escrita de
qualquer conta `authenticated`.

## Gratuitas, mas são dependência de terceiro em runtime

| Nome | Onde | Observação |
|---|---|---|
| `unpkg.com` | `src/integrations/parser_api.ts` — worker do `pdfjs-dist` | Se cair, a importação de PDF para de funcionar. Candidato a self-host em `public/`. |
| `deno.land/std`, `esm.sh` | imports das Edge Functions | Resolvidos no deploy, não a cada request. |

## Não existe (e é bom que não exista)

Não há **nenhuma API de IA paga** no projeto. A classificação de transações é
heurística própria (`IntelligentTransactionClassifier`, `BankDictionary`,
tabelas `merchants_dictionary` / `learned_patterns`), e OCR e parsing de PDF
rodam no cliente (`tesseract.js`, `pdfjs-dist`). Custo por classificação: zero.

## Resposta curta

Sobrando, nenhuma. A única que sobrava era a **logo.dev** — foi removida.
Falta só revogar os dois tokens dela.
