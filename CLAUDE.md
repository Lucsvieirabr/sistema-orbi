# CLAUDE.md — Sistema Orbi

> Doc mestre de arquitetura p/ IA. Denso, sem prosa. Fatos verificados no código-fonte (sem suposições).

---

## [CORE STACK]

**Frontend**: React 18.3 + TypeScript (strict:false, noImplicitAny:false, strictNullChecks:false) + Vite 5 (SWC) + React Router v6 (`BrowserRouter`).
**UI**: shadcn/ui (Radix primitives) + Tailwind 3 + `class-variance-authority` + `lucide-react`. Componentes gerados em `src/components/ui/*` — NÃO reescrever do zero, seguir padrão existente.
**State/Data**: `@tanstack/react-query` v5 (cache server-state) + hooks custom (`src/hooks/*`) — SEM Redux/Zustand/Context global de dados. Realtime via `supabase.channel().on('postgres_changes', ...)` (usado em `use-accounts.ts`) invalidando query-keys do React Query.
**Forms**: `react-hook-form` + `zod` + `@hookform/resolvers`.
**Backend**: Supabase (BaaS) = Postgres + Auth (`auth.users`) + Row Level Security + Edge Functions (Deno, `supabase/functions/*`) + Storage (sem bucket ativo — o `company-logos` foi removido junto com a integração logo.dev).
**Cliente DB**: `@supabase/supabase-js` v2, instância única em `src/integrations/supabase/client.ts`. Tipos gerados em `src/integrations/supabase/types.ts` (`Tables<'x'>`, `TablesInsert<'x'>`, `TablesUpdate<'x'>`, `Database`) — fonte de verdade do schema real (mais confiável que migrations individuais para saber colunas atuais).
**Migrations**: SQL puro em `supabase/migrations/*.sql`, aplicadas em ordem lexicográfica de timestamp (Postgres `CREATE OR REPLACE` sobrescreve silenciosamente — ver GOTCHAS).
**Pagamentos**: Asaas (gateway BR) via Edge Functions (`asaas-create-customer`, `asaas-create-payment`, `asaas-webhook-handler`) — só para cobrança de **assinatura SaaS**, não para faturas de cartão de crédito do usuário (não há gateway de pagamento de fatura).
**Importação de extrato/fatura**: CSV é lido no cliente (`papaparse` + `CSVParser.ts`). PDF, OFX e imagem vão para o serviço Python `services/document-extractor` (Starlette + `pdfplumber` + Tesseract via `pytesseract`) através da Edge Function `extract-pdf-text`, que só faz gate + proxy (secrets `DOCUMENT_EXTRACTOR_URL`/`DOCUMENT_EXTRACTOR_TOKEN`). O serviço escolhe o extrator (`OfxExtractor` para .ofx SGML/XML, `NativePdfExtractor` para PDF com camada de texto, `ScannedPdfExtractor` para scan/imagem via OCR; PDF misto = OCR só nas páginas sem texto) e devolve TRANSAÇÕES PRONTAS — o parsing geométrico (linhas por coordenada Y, colunas Data/Histórico/Documento/Débito/Crédito/Valor/Saldo por X, data herdada, descrição quebrada em 2 linhas, sufixo D/C, fatura × extrato, parcelas, máscara `•••• 0040`) vive em `services/document-extractor/app/parsing/*`. Nada de `pdfjs-dist`/`tesseract.js` no bundle.
**ML client-side**: classificador heurístico próprio (`IntelligentTransactionClassifier.ts`, `TransactionMLClassifier.ts`, dicionário `BankDictionary.ts`) + Edge Function `classify-transactions` (server-side, usa tabela `learned_patterns` e `merchants_dictionary`).
**Borda / anti-abuso**: `supabase/functions/_shared/gate.ts` é a porta única das Edge Functions — método → origem (`cors.ts`, allowlist `ALLOWED_ORIGINS`) → rate limit por IP → JWT → rate limit por usuário → handler. Contador em `public.rate_limit_counters` via RPC `consume_rate_limit_key` (janela fixa, UPSERT atômico, exclusiva de `service_role`). 429 sempre com `Retry-After`. Rotas de dinheiro (`asaas-create-payment`, `asaas-create-customer`, `asaas-manage-subscription`) são `strict: true` = contador indisponível BLOQUEIA; rotas de leitura/CPU são fail-open. `/auth/v1/*` não passa por Edge Function — o teto é `[auth.rate_limit]` em `supabase/config.toml`.
**Deploy**: Netlify (`netlify.toml`) e/ou Vercel (`vercel.json`) + `nginx.conf` (self-host alternativo). SPA estática; Supabase é o backend + 1 contêiner privado (`services/document-extractor`, Dockerfile próprio, autenticado só pelo `EXTRACTOR_SERVICE_TOKEN` — nunca exposto ao browser).
**Lint**: ESLint 9 flat-config, `@typescript-eslint/no-unused-vars: off`, sem regra de formatação estrita (Prettier ausente).

---

## [DATA MODEL & RELATIONS]

Multi-tenant por linha: toda tabela de domínio tem `user_id -> auth.users.id`, isolada via RLS (`auth.uid() = user_id`). Fonte de verdade do schema = `src/integrations/supabase/types.ts` (migrations têm histórico com colunas obsoletas/mortas — ver GOTCHAS).

```
auth.users (Supabase Auth)
 ├─ user_profiles (1:1)         perfil estendido
 ├─ admin_users (1:0/1)         role: admin|super_admin — gate de /admin
 ├─ user_subscriptions (1:N, normalmente 1 ativa) -> subscription_plans (N:1)
 │     status: pending|trial|active|past_due|canceled|expired
 │     billing_cycle: monthly|annual
 │     subscription_plans.features (jsonb bool map) + .limits (jsonb, -1 = ilimitado)
 ├─ payment_history (N)         -> user_subscriptions (histórico Asaas)
 ├─ user_usage (N)              métricas de uso por período
 ├─ accounts (N)                 id, name, type(Corrente/Poupanca/Dinheiro), initial_balance, color
 ├─ credit_cards (N)             name, brand, limit, statement_date(1-31), due_date(1-31),
 │                                connected_account_id -> accounts (conta que paga a fatura)
 ├─ categories (N, OU is_system=true/user_id=NULL global)  name, category_type(expense/income), icon, is_system
 ├─ people (N)                   (ex-family_members, renomeada) name, pix — "quem" em rateios/dívidas
 ├─ series (N)                   description, total_value, total_installments, is_fixed,
 │                                frequency(daily/weekly/monthly/yearly), start_date, end_date,
 │                                category_id -> categories, created_by_txn_id
 │                                ⚠ NÃO tem account_id/credit_card_id/person_id (ver GOTCHAS)
 ├─ transactions (N)             ★ ENTIDADE CENTRAL — ver detalhe abaixo
 ├─ budgets (N)                  PREMIUM (Pro/Casal) — category_id -> categories (só expense, própria ou is_system),
 │                                amount_limit numeric(12,2) > 0, period_month (dia 1), UNIQUE(user_id, period_month, category_id)
 ├─ goals (N)                    PREMIUM — name, target_value, deadline?, icon (kebab lucide), color (#hex)
 │   └─ goal_allocations (N)     amount ≠ 0 (>0 aporte, <0 resgate), allocated_on, note? — saldo da meta nunca < 0
 ├─ merchants_dictionary / learned_patterns / keyword patterns  cache de ML de categorização
 ├─ bug_reports, notes           utilitários
 └─ audit_logs                   somente leitura p/ admin_users
```

**`transactions`** (linha = 1 evento financeiro; parcela e recorrência = várias linhas ligadas por `series_id`):
`id, user_id, description, value(numeric), date, type(expense|income|transfer), payment_method(debit|credit), status(PENDING|PAID|CANCELED), account_id?, credit_card_id?, category_id?, person_id?, series_id?, is_fixed, is_shared, installment_number?, liquidation_date?, compensation_value(default 0), linked_txn_id?(self-FK), composition_details?(text JSON, só auditoria/UI — NUNCA usado em cálculo de saldo), created_at, updated_at`.

Cardinalidades-chave: `account 1─N transactions`, `credit_card 1─N transactions`, `series 1─N transactions` (parcelas/recorrências), `transactions 1─1 transactions` via `linked_txn_id` (par de rateio, self-referencing, `ON DELETE CASCADE`), `credit_card N─1 account` (via `connected_account_id`, quem paga a fatura).

**Views** (RLS respeitada via `security_invoker = true`, migration `20251001000000`):
- `vw_account_current_balance(account_id, user_id, current_balance)` — "saldo real".
- `vw_account_projected_balance(account_id, user_id, projected_balance)` — saldo real + compromissos futuros não cancelados.
- `series_summary` — agregados de série (parcelas pagas/pendentes, valores).
- `vw_goal_progress` — saldo, % , `months_left` e `monthly_needed` por meta (security_invoker).

---

## [FINANCIAL BUSINESS RULES]

### 1. Cálculo de saldo (CRÍTICO — comportamento ATUAL verificado no SQL vigente)
`vw_account_current_balance.current_balance = initial_balance + Σ(income, date<=hoje) − Σ(expense, date<=hoje)`.
⚠️ **A view vigente NÃO filtra por `status`** (a versão de `20250929000000_add_vw_account_current_balance.sql`, aplicada DEPOIS da versão com filtro `status='PAID'` de `20250129000001`, sobrescreveu a lógica via `CREATE OR REPLACE VIEW` sem o filtro — o `COMMENT ON VIEW` antigo dizendo "only PAID" ficou desatualizado). Efeito real: transações `PENDING` já lançadas com `date <= hoje` entram no "saldo real" tanto quanto `PAID`. Confirmar intenção antes de "corrigir" — pode ser regressão não percebida.
`vw_account_projected_balance = current_balance_lógica + Σ(income, status≠CANCELED, sem filtro de data) − Σ(expense, status≠CANCELED, sem filtro de data)`.
`accounts.current_balance` no frontend (`use-accounts.ts`) = valor da view, com fallback `initial_balance` se não houver linha.

### 2. Status de transação
`PENDING → PAID → (pode voltar) PENDING` | `CANCELED` (terminal, view de saldo real ignora CANCELED só na projetada). Trigger `update_liquidation_date()`: seta `liquidation_date = NOW()` só na transição `!=PAID → PAID`; limpa ao sair de `PAID → PENDING`. `liquidation_date` é usado para ordenar o extrato (mais recente primeiro), não para cálculo de saldo.

### 3. Parcelamento (installments) — via `series` + N `transactions`
Fluxo **real em produção** (`pages/MonthlyStatement.tsx`, inserts diretos client-side):
1. Gera `seriesId = crypto.randomUUID()` no client.
2. `INSERT INTO series` com `total_value`, `total_installments`, `is_fixed`, `category_id`.
3. `INSERT INTO transactions` N vezes (uma por parcela), cada uma com `series_id`, `installment_number`, `value` individual, `date` própria, `status` própria.
Cálculo de valor de parcela: `roundCurrency(totalValue / totalInstallments)` (`src/lib/utils.ts`); resíduo de arredondamento distribuído manualmente entre parcelas não editadas (`redistributeInstallmentValues`) — sempre 2 casas decimais, `Math.round(v*100)/100`.
Trigger DB `update_series_total_value()` recalcula `series.total_value/total_installments` a cada INSERT/UPDATE/DELETE em `transactions` com aquele `series_id` — mantém a série em sync mesmo que o client edite parcelas soltas.

### 4. Transações fixas/recorrentes (`is_fixed=true` na série, `frequency`)
Geração de parcelas futuras é feita **client-side** em `MonthlyStatement.tsx` (`maintainFixedTransactionsForSeries`, `generateFixedTransactionsForPeriod`) ao montar a tela do mês — NÃO pelas RPCs SQL homônimas (ver GOTCHAS #2). `frequency ∈ {daily, weekly, monthly, yearly}`; respeita `series.end_date` se definido (NULL = infinita).

### 5. Fatura de cartão de crédito (statement period)
`getCardStatementPeriod(statementDay, refDate)` em `src/lib/utils.ts` — regra de mercado padrão: fechamento no dia `statementDay`; transação em `[dia_fechamento_anterior+1, dia_fechamento_atual]` pertence à fatura que vence no mês do fechamento atual. `isTransactionInBillingPeriod()` classifica cada transação de cartão por esse período (não pela data-calendário do mês). `use-card-usage.ts`: limite usado da fatura atual = `Σexpense − Σincome (estornos)` do período, excluindo `status=CANCELED`, com `Math.max(0, total)`. `credit_cards.connected_account_id` aponta a conta que paga a fatura — **não há automação de débito da fatura**; é informativo/manual.

### 6. Rateio de despesas / dívidas entre pessoas ("compensação") — sem tabela `debts` (dropada, migration `20250131000004`)
Padrão de par de transações ligadas por `linked_txn_id` (self-FK):
- **Transação A** (gasto bruto, paga pelo usuário): `type=expense`, `is_shared=true`, `compensation_value = valor_a_ser_ressarcido`, `linked_txn_id = null` inicialmente.
- **Transação B** (a receber da pessoa, `person_id` setado): `is_shared=true`, `compensation_value=0`, `linked_txn_id = A.id`.
Saldo "real" da transação A para efeito de dashboard = `value − compensation_value` (calculado no client em `Dashboard.tsx`, `use-monthly-transactions.ts`, `CardStatements.tsx` — **não** existe view SQL para isso). `composition_details` (texto JSON `[{value,description,date}]`) é só para exibir o detalhe do rateio — explicitamente documentado no SQL como "not used in balance calculations".
Sincronização de status: `useStatusSync().syncStatus()` — ao mudar status de 1 transação: se tem `series_id`, propaga para todas transações da mesma série **E mesma `person_id`**; senão se tem `linked_txn_id`, propaga para a transação principal ligada (mesma pessoa); senão atualiza só ela mesma.

### 7. Limites de plano (SaaS) — dupla camada (defesa em profundidade)
1. **Frontend**: `useSubscription().checkLimit(key, count)` / `<LimitGuard>` / `<FeatureGuard>` — UX (bloqueia botão, mostra upsell).
2. **Backend (fonte da verdade)**: triggers `BEFORE INSERT` em Postgres — `check_accounts_limit`, `check_categories_limit` (só conta `is_system=false`), `check_credit_cards_limit`, `check_people_limit`, `check_transactions_limit` (mensal, `DATE_TRUNC('month', date)`). Lêem `subscription_plans.limits->>'max_X'` da assinatura `status IN ('trial','active')` mais recente; `-1` = ilimitado; sem assinatura ativa = `RAISE EXCEPTION` (bloqueia insert). Defaults hardcoded se a key não existir no JSON: contas=3, categorias=20, cartões=2, pessoas=10, transações/mês=500.
Qualquer feature nova com limite deve ganhar trigger simétrico — validação só no client é bypassável via API direta.
3. **Atomicidade (migration `20260910120001`)**: todo trigger de cota chama `orbi_quota_lock(user_id, recurso)` (`pg_advisory_xact_lock`) ANTES do `COUNT(*)`. Sem isso, N requisições simultâneas do mesmo usuário liam o mesmo count em READ COMMITTED e passavam todas — comprovado: com teto 2 e 10 inserts concorrentes, a versão antiga gravava 10, a atual grava 2. Trigger novo de cota SEM advisory lock é bug, não estilo.
4. **Erros de cota têm ERRCODE**: `P0004` = sem assinatura ativa, `P0005` = cota/feature do plano. O front traduz em `src/lib/limits.ts` (`diagnoseLimitError`) — não parsear a string da mensagem.
5. **Fail-fast de UI**: `useQuota()` (`src/hooks/use-quota.ts`) lê a RPC `orbi_quota_snapshot()` — limites + uso agregado num round-trip só. É UX; a autoridade continua no trigger.

### 8. Categorias globais vs. custom
`categories.user_id IS NULL AND is_system=true` = categoria compartilhada (seed único, todos usuários enxergam via RLS `is_system=true OR auth.uid()=user_id`). Usuário só pode INSERT/UPDATE/DELETE onde `is_system=false AND user_id=auth.uid()` — não pode alterar/apagar categoria de sistema.

### 9. Precisão monetária
Toda operação de valor passa por `roundCurrency()` (2 casas, `Math.round`) antes de persistir — evitar erro de float acumulado em parcelamento/rateio. `numeric(12,2)` em colunas monetárias no SQL (`series.total_value`, `compensation_value`).

### 10. Cancelamento de assinatura (Configurações → Assinatura)
UI: `src/components/settings/SubscriptionSettings.tsx` + `CancelSubscriptionDialog.tsx` (2 etapas: impacto → aceite explícito; nunca 1 clique). Backend: `asaas-manage-subscription` `{action:'cancel'|'reactivate'|'invoice'}` via `usePayment()`.
- Período pago em curso (`active`/`trial`, `current_period_end > now`) → `cancel_at_period_end=true`, status segue `active`, `DELETE /subscriptions/:id` no Asaas. `pending`/`past_due`/período vencido → `status='canceled'` na hora.
- **Ordem obrigatória: UPDATE no banco ANTES do DELETE no Asaas** (o webhook `SUBSCRIPTION_DELETED` chega em ms; sem a marca ele cortaria o período pago). Falha no Asaas desfaz o UPDATE; 404 no Asaas = já removida = sucesso.
- Webhook (`isScheduledCancellation`) e `asaas-sync-subscription` preservam linha com cancelamento agendado; `PAYMENT_DELETED` não expira nem ressuscita linha `canceled`.
- Fim do acesso: RPC `get_my_subscription_status` ignora cancelamento agendado com período vencido → `no_plan` (/pricing, não /billing). `orbi_active_plan_limits/features` idem (migration `20260911120000`).
- `reactivate` = nova assinatura no Asaas com 1ª cobrança em `current_period_end`; `asaas-create-payment` faz o mesmo se o usuário assinar de novo dentro do período (não dá PUT na assinatura removida).

### 11. Módulos premium de planejamento — Orçamentos, Metas, Fechamento do mês (migration `20260915150000`)
Exclusivos Pro/Casal. Features no jsonb do plano: `orcamentos`, `metas`, `dre_pessoal` (true só em `pro`/`casal`).
- **Banco é a autoridade (4 camadas)**: (1) policies RLS das 3 tabelas exigem `(SELECT orbi_has_feature('<key>'))` — Free não LÊ nem escreve; (2) triggers `orbi_budgets_guard` / `orbi_goals_guard` / `orbi_goal_allocations_guard` repetem o gate com `P0005`/`P0004` e validam tenant (categoria de outro usuário, meta de outro usuário, dono imutável); (3) RPCs `orbi_budget_overview`, `orbi_monthly_closing` chamam `orbi_require_feature` antes de calcular; (4) front: `PremiumRoute` (rota) + cadeado no `AppSidebar`.
- **Plano Casal**: SELECT das 3 tabelas usa `orbi_family_user_ids()` (parceiro lê); escrita só no dono. RPCs aceitam `p_scope 'personal'|'couple'` e derivam o escopo de `auth.uid()` — nunca de parâmetro do cliente.
- **Consumo de orçamento** = Σ expense do mês (data de competência) em PAID+PENDING, sem CANCELED, valor líquido `value − compensation_value` (mesma regra do Dashboard). Sugestão = média dos 3 meses fechados anteriores.
- **DRE** (`orbi_monthly_closing`, 1 varredura por `idx_transactions_user_date`): Receitas → (−) fixas (`is_fixed` na transação ou série) → (−) parcelamentos (série >1 parcela, sem rateio) → (−) variáveis → (=) resultado → (−) aportes em metas → (=) sobra livre. Receita de rateio (linha B: income + `is_shared` + `linked_txn_id`) fica FORA — a despesa A já entra líquida; contar as duas duplica o rateio. Retorna variação vs mês anterior, taxa de poupança, maior despesa, top 8 categorias com teto, tendência de 6 meses.
- **Aportes**: trigger soma o saldo sob `orbi_quota_lock(user, 'goal:<id>')` — resgate acima do guardado e exclusão de aporte que deixaria saldo negativo são bloqueados (23514). Cascata de exclusão da meta passa direto.
- **Front**: catálogo de UX em `src/lib/features/premium-modules.ts` (rota, nome comercial, pitch, benefícios). Rotas `/sistema/budgets|goals|analytics` (+ atalhos `/budgets` etc.). Mês na URL (`?mes=AAAA-MM`). Upgrade sempre para `/pricing?change=1` (sem `change` o /pricing devolve quem tem plano para /sistema).
- Feature nova de plano: registrar em `orbi-features.ts`, ligar no jsonb dos planos via migration, gate no RLS/trigger/RPC e em `FEATURE_ROWS` (Pricing), `plan-highlights.ts` e `plan-impact.ts`.

---

## [PROJECT STRUCTURE & STATE]

```
src/
 ├─ App.tsx                 rotas + bootstrap de auth (onAuthStateChange) — fluxo documentado inline (casos C1-C7)
 ├─ layouts/AppLayout.tsx   shell autenticado (/sistema/*)
 ├─ admin/                  área /admin isolada: layouts, pages, components próprios (não reusa AppLayout)
 ├─ pages/                  1 arquivo por rota (roteável em App.tsx) — MonthlyStatement.tsx é o maior/mais crítico (170KB, orquestra parcelamento/recorrência/rateio client-side)
 ├─ components/
 │   ├─ ui/                 shadcn primitives — genérico, sem lógica de domínio
 │   ├─ planning/            LedgerStrip + UsageBar (faixa de leitura e barra de consumo), MonthSwitcher (+ useMonthParam), planning-utils (datas/moeda/erros), notify
 │   ├─ guards/              FeatureGuard, LimitGuard, FeaturePageGuard, SubscriptionGuard, PremiumRoute (+ PremiumPreview) — controle de acesso declarativo
 │   ├─ extrato-uploader/    pipeline de importação CSV/PDF/OFX/imagem + classificação
 │   ├─ dashboard/, people/, payment/, auth/, navigation/, bugs/
 ├─ hooks/                  1 hook por domínio, prefixo `use-` kebab-case; React Query p/ leitura, funções `async` diretas p/ mutação (padrão inconsistente entre hooks — alguns usam `useMutation`, outros try/catch manual)
 ├─ integrations/supabase/  client.ts (singleton) + types.ts (schema gerado, NÃO editar à mão)
 ├─ integrations/parser_api.ts  cliente HTTP da extração (invoke de `extract-pdf-text`, tradução de `code` -> mensagem pt-BR); `extrato-uploader/StatementParser.ts` valida a resposta e converte em `ParsedTransaction`
 ├─ lib/utils.ts            funções financeiras puras (roundCurrency, getCardStatementPeriod, cn, THEME) — cole aqui, não duplique em componente
 └─ lib/features/           feature-registry.ts (singleton `FeatureRegistry`) + orbi-features.ts (catálogo declarado de features/limits) — fonte de verdade do client sobre o que EXISTE (o que o user PODE usar vem do plano no backend)
supabase/
 ├─ migrations/             histórico cronológico, aplicado em ordem — schema real = types.ts, não a soma mental das migrations (ver GOTCHAS)
 └─ functions/               Edge Functions Deno, 1 pasta por função + `_shared/cors.ts`
services/document-extractor/  serviço Python privado (Starlette): `app/extractors/` (ofx, native_pdf, scanned_pdf, ocr), `app/parsing/` (tokens, descriptions, profile, statement_parser), `app/pipeline.py`, `tests/` (`python -m unittest discover -s tests -t .`)
docs/                        documentação humana pré-existente (DOCUMENTACAO_SISTEMA_ORBI.md é a mais completa) — consultar antes de assumir que algo não está documentado
```

**Estado "saldo atual"**: NÃO há store client de saldo. É sempre derivado via React Query (`queryKey: ["balances"]` / `["projected-balances"]`) lendo as views SQL — cache 0 client-side de lógica de saldo, invalidado via Supabase Realtime (`postgres_changes` em `accounts`/`transactions`) + `queryClient.invalidateQueries` manual após cada mutação relevante (`["monthly-transactions"]`, `["balances"]`, `["projected-balances"]`, `["person-transactions"]`, `["credit_cards"]`, `["accounts"]`).
**Sem transação atômica client-side**: sequências multi-`insert`/`update` (parcelamento, rateio, manutenção de fixas) são várias chamadas `supabase.from(...).insert/update` sequenciais SEM wrapper transacional — falha no meio deixa estado parcial (série sem todas parcelas, par de rateio sem `linked_txn_id`, etc.). Ao tocar nesse código, preservar ordem e considerar rollback manual em caso de erro.

---

## [CODING STANDARDS]

- **Nomenclatura arquivos**: componentes `PascalCase.tsx`; hooks `use-kebab-case.ts` exportando `useCamelCase()`; libs/utils `camelCase.ts`.
- **Imports**: alias `@/*` → `src/*` (configurado em `tsconfig` + `vite.config.ts`) — sempre usar alias, nunca `../../../`.
- **Tipagem**: `strict:false`, `noImplicitAny:false`, `strictNullChecks:false` no `tsconfig` — projeto tolera `any` implícito e null loose; ainda assim, tipar com `Tables<'nome_tabela'>`/`TablesInsert<...>`/`TablesUpdate<...>` de `integrations/supabase/types.ts` para qualquer dado vindo do Supabase (evita drift silencioso quando o schema muda).
- **Padrão de dado remoto**: `const { data, error } = await supabase.from(...)...; if (error) throw error;` — sempre checar `error` explicitamente antes de usar `data`, nunca ignorar.
- **Autenticação em hook/mutação**: obter usuário via `const { data: { user } } = await supabase.auth.getUser();` e usar `user.id` como `user_id` no insert — RLS já bloqueia cross-user, mas o client sempre filtra/preenche explicitamente também (defesa dupla, mesmo padrão dos limits).
- **Error handling**: sem camada global de erro; padrão é `try/catch` local + `toast()` (`useToast`/`sonner`) com `variant: "destructive"` para erros — sempre dar feedback visual, nunca falhar silenciosamente.
- **Moeda**: nunca fazer aritmética de valor monetário sem passar por `roundCurrency()`; nunca formatar valor manualmente — usar `formatCurrencyBRL()`.
- **Data**: nunca usar `new Date(dateString)` puro para strings `YYYY-MM-DD` (bug de fuso horário) — usar padrão do repo: `new Date(dateString + 'T00:00:00')` ou `getCurrentDateString()`/`formatDateForDisplay()` de `lib/utils.ts`.
- **RLS é a autoridade final**: toda tabela nova de domínio precisa `ENABLE ROW LEVEL SECURITY` + policy `auth.uid() = user_id` (ou variante system/global como `categories`) — sem isso, dado vaza entre usuários mesmo com filtro client-side correto.
- **Novo limite de plano**: exige trigger SQL simétrico ao guard de frontend (ver regra de negócio #7) — nunca confiar só em `useFeature`/`useLimit`.
- **Migrations**: nunca editar migration já aplicada/commitada — criar nova com timestamp maior; `CREATE OR REPLACE FUNCTION/VIEW` é a forma padrão de "corrigir" lógica anterior no repo (visto nos vários arquivos `fix_*.sql`).

---

## ⚠️ GOTCHAS (verificados no código — não hipotéticos)

1. **`vw_account_current_balance` não filtra `status` atualmente** (ver regra #1) — o comentário SQL da view está desatualizado e diz o contrário.
2. **RPCs `create_installment_series`/`update_installment_series`/`delete_installment_series` e `maintain_fixed_transaction_series`/`generate_future_fixed_transactions` existem no banco mas NÃO são o caminho usado em produção** — `MonthlyStatement.tsx` faz inserts/updates diretos nas tabelas `series`/`transactions`. Os hooks `use-installments.ts` (chama a RPC certa) e `use-series.ts` (chama RPC com assinatura de parâmetros DIFERENTE da função real — `p_total_value`/`p_start_date` não existem na função atual) parecem código morto/quebrado, não confirmados em uso por nenhuma página além de import não utilizado em `MonthlyStatement.tsx`.
3. **`generate_future_fixed_transactions` (SQL) referencia `series.account_id`, `series.credit_card_id`, `series.person_id`** — colunas que **não existem** na tabela `series` (confirmado em `types.ts`) → essa função quebraria se chamada. Não usar/depender dela sem antes corrigir o schema ou a função.
4. Antes de alterar qualquer função/view/policy, checar `src/integrations/supabase/types.ts` para o schema real — as migrations têm colunas adicionadas e removidas (ex.: `installments`/`installment_number`/`is_fixed` foram removidas de `transactions` na migration `20250131000008` e depois `is_fixed` foi READICIONADA em `20251001000001`).
5. Existe documentação humana extensa em `docs/DOCUMENTACAO_SISTEMA_ORBI.md` — consultar antes de assumir lacuna; este arquivo é o guia denso para IA, aquele é a referência detalhada para humanos.


<strict_output_rules>
- MODO DE EXECUÇÃO SILENCIOSA: Você é um agente executor. Sua única função é analisar o contexto, modificar/criar os arquivos necessários no sistema e finalizar a tarefa.
- ZERO CONVERSA: É estritamente proibido gerar saídas de texto conversacional, introduções, explicações de código, resumos ou justificativas sem ser solicitado explicações!. 
- SAÍDA OBRIGATÓRIA: Após aplicar todas as alterações de código com sucesso, sua resposta final no chat DEVE ser APENAS a palavra: "Feito."
</strict_output_rules>