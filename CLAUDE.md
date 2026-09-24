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
**Classificação de extrato**: Edge Function `classify-transactions` v2 é o caminho real (`ExtratoUploader` → `BatchClassifier`, 1 request por até 500 linhas). 3 leituras por request (dicionário `merchants_dictionary` em cache de 15 min por isolate, `user_learned_patterns`, categorias sistema+próprias) e classificação 100% em memória: `description-cleaner.ts` (acento NFD, gateway `IFD*`/`PAG*`/`MP*`, datas/parcelas/códigos) → aprendido do usuário (assinatura exata → resíduo sem canal → Jaccard ≥ 0.8) → `banking-rules.ts` (siglas BR com direção: TAR/CESTA/IOF/JUROS/CRED SAL/APLIC-RESG CDB·RDB/REND PAGO/PAGTO FATURA/SAQUE; ordem = precedência) → canal (PIX/TED/boleto/CP ELO) removido + entidade no `merchant-index.ts` (n-grama exato/compacto/prefixo + fuzzy trigrama/Damerau) → fallback `Outros`/`Outras Receitas` com subcategoria `A Classificar` se confiança < 60 (`classifier.ts`). Categoria devolvida sempre existe e tem o tipo do lançamento. Front também cai no fallback se a função falhar — nunca aborta a importação. Sigla bancária nova = regra em `banking-rules.ts`; merchant novo = linha no dicionário (checar alias antes, sem duplicar). Legado client-side (`IntelligentTransactionClassifier.ts`, `TransactionMLClassifier.ts`, `BankDictionary.ts`) só é usado para aprender correções (`update_user_learned_pattern`).
**Borda / anti-abuso**: `supabase/functions/_shared/gate.ts` é a porta única das Edge Functions — método → origem (`cors.ts`, allowlist `ALLOWED_ORIGINS`) → rate limit por IP → JWT → rate limit por usuário → handler. Contador em `public.rate_limit_counters` via RPC `consume_rate_limit_key` (janela fixa, UPSERT atômico, exclusiva de `service_role`). 429 sempre com `Retry-After`. Rotas de dinheiro (`asaas-create-payment`, `asaas-create-customer`, `asaas-manage-subscription`) são `strict: true` = contador indisponível BLOQUEIA; rotas de leitura/CPU são fail-open. `/auth/v1/*` não passa por Edge Function — o teto é `[auth.rate_limit]` em `supabase/config.toml` + Cloudflare Turnstile validado pelo próprio GoTrue (captcha do Supabase Auth, provider `turnstile`).
**Deploy**: Cloudflare Workers static assets (`wrangler.jsonc` + `public/_headers`; SPA via `not_found_handling`, sem `_redirects` — o Workers o rejeita como loop; lockfile só `package-lock.json`, `bun.lockb` faz o Cloudflare usar bun frozen), Netlify (`netlify.toml`) e/ou Vercel (`vercel.json`) + `nginx.conf` (self-host alternativo). SPA estática; Supabase é o backend + 1 contêiner privado (`services/document-extractor`, Dockerfile próprio, autenticado só pelo `EXTRACTOR_SERVICE_TOKEN` — nunca exposto ao browser).
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
 ├─ goals (N)                    PREMIUM — name, target_value, deadline?, icon (kebab lucide), color (#hex), executed_at? (virou projeto)
 │   └─ goal_allocations (N)     amount ≠ 0 (>0 aporte, <0 resgate), allocated_on, note? — saldo da meta nunca < 0
 ├─ split_contracts (N)          PREMIUM — person_id -> people, category_id -> categories (só expense), proportion_percentage
 │                                numeric(5,2) 0–100 = % que a PESSOA compensa, note?, is_active, UNIQUE(user_id, person_id, category_id)
 ├─ ledgers (N)                  PREMIUM — evento/viagem: name, description?, start/end_date?, owner_weight, pix_key?, pix_name?,
 │   │                            status open|settled, settled_at
 │   ├─ ledger_participants (N)  person_id -> people, weight (0–100), UNIQUE(ledger_id, person_id)
 │   └─ ledger_entries (N)       gasto pago por TERCEIRO: paid_by_person_id -> people, description, value > 0, entry_date
 │                                (trigger adiciona o pagador como participante)
 ├─ projects (N)                 PREMIUM — Projetos de Vida: name, kind(event|trip|purchase|home|family|other), icon, color, budget,
 │                                funded_from_goal, start/end_date, status active|archived, final_report jsonb,
 │                                goal_id? UNIQUE (-> goals, meta executada), ledger_id? UNIQUE (-> ledgers, acerto)
 ├─ monthly_summaries (N)        PREMIUM — snapshot mensal da Inflação Pessoal, UNIQUE(user_id, period_month); escrita só por DEFINER
 ├─ user_notifications (N)       avisos (budget_inflation | project_archived), UNIQUE(user_id, dedupe_key); cliente só lê/marca read_at
 ├─ merchants_dictionary / learned_patterns / keyword patterns  cache de ML de categorização
 ├─ bug_reports, notes           utilitários
 └─ audit_logs                   somente leitura p/ admin_users
```

**`transactions`** (linha = 1 evento financeiro; parcela e recorrência = várias linhas ligadas por `series_id`):
`id, user_id, description, value(numeric), date, type(expense|income|transfer), payment_method(debit|credit), status(PENDING|PAID|CANCELED), account_id?, credit_card_id?, category_id?, person_id?, series_id?, is_fixed, is_shared, installment_number?, liquidation_date?, compensation_value(default 0), linked_txn_id?(self-FK), composition_details?(text JSON, só auditoria/UI — NUNCA usado em cálculo de saldo), ledger_id?(-> ledgers, ON DELETE SET NULL, PREMIUM), project_id?(-> projects, ON DELETE SET NULL, PREMIUM), created_at, updated_at`.

Cardinalidades-chave: `account 1─N transactions`, `credit_card 1─N transactions`, `series 1─N transactions` (parcelas/recorrências), `transactions 1─1 transactions` via `linked_txn_id` (par de rateio, self-referencing, `ON DELETE CASCADE`), `credit_card N─1 account` (via `connected_account_id`, quem paga a fatura).

**Views** (RLS respeitada via `security_invoker = true`, migration `20251001000000`):
- `vw_account_current_balance(account_id, user_id, current_balance)` — "saldo real".
- `vw_account_projected_balance(account_id, user_id, projected_balance)` — saldo real + compromissos futuros não cancelados.
- `series_summary` — agregados de série (parcelas pagas/pendentes, valores).
- `vw_goal_progress` — saldo, % , `months_left` e `monthly_needed` por meta (security_invoker).

---

## [FINANCIAL BUSINESS RULES]

### 1. Cálculo de saldo (CRÍTICO — comportamento ATUAL verificado no SQL vigente)
`vw_account_current_balance.current_balance = initial_balance + Σ(income PAID, date<=hoje) − Σ(expense PAID, date<=hoje)`. PENDING não entra no saldo real (copy do Extrato: "Marque como pago para o saldo acompanhar"). Filtro `status='PAID'` restaurado na migration `20260923100000` (a de `20250928000000` o tinha removido).
`vw_account_projected_balance = initial_balance + Σ(income, status≠CANCELED) − Σ(expense, status≠CANCELED)` — qualquer data (antes somava o realizado duas vezes).
"Hoje" nas views = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`; RPCs que usam `CURRENT_DATE` têm `SET timezone = 'America/Sao_Paulo'` (o banco roda em UTC: entre 21h e 00h BRT o `CURRENT_DATE` puro já é amanhã). RPC nova com data = mesmo `SET`.
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
`getCardStatementPeriod(statementDay, refDate)` em `src/lib/utils.ts` — regra de mercado padrão: fechamento no dia `statementDay`; transação em `[dia_fechamento_anterior+1, dia_fechamento_atual]` pertence à fatura que vence no mês do fechamento atual. `isTransactionInBillingPeriod()` classifica cada transação de cartão por esse período (não pela data-calendário do mês). `use-card-usage.ts`: `used` (fatura em aberto) = `Σexpense − Σincome (estornos)` do período, sem CANCELED; `committed` (limite comprometido, base de "% do limite" e "disponível") = mesma conta sobre TODAS as `PENDING` do cartão, incluindo parcelas futuras. Compra no cartão nasce `PENDING` (todas as parcelas) e vira `PAID` ao pagar a fatura. Excluir cartão: FK `ON DELETE SET NULL` — lançamentos ficam sem vínculo. `credit_cards.connected_account_id` aponta a conta que paga a fatura — **não há automação de débito da fatura**; é informativo/manual.

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
- **DRE** (`orbi_monthly_closing`, 1 varredura por `idx_transactions_user_date`): Receitas → (−) fixas (`is_fixed` na transação ou série) → (−) parcelamentos (série >1 parcela, sem rateio) → (−) variáveis → (=) resultado → (−) aportes em metas → (=) sobra livre. Receita de rateio (linha B: income + `is_shared` + `linked_txn_id`) fica FORA — a despesa A já entra líquida; contar as duas duplica o rateio. Pendentes (`income_pending`/`expenses_pending`/`pending_count`) usam o mês da FATURA para compra de cartão (igual ao Extrato), o resto é competência. Retorna variação vs mês anterior, taxa de poupança, maior despesa, top 8 categorias com teto, tendência de 6 meses.
- **Aportes**: trigger soma o saldo sob `orbi_quota_lock(user, 'goal:<id>')` — resgate acima do guardado e exclusão de aporte que deixaria saldo negativo são bloqueados (23514). Cascata de exclusão da meta passa direto.
- **Front**: catálogo de UX em `src/lib/features/premium-modules.ts` (rota, nome comercial, pitch, benefícios). Rotas `/sistema/budgets|goals|analytics` (+ atalhos `/budgets` etc.). Mês na URL (`?mes=AAAA-MM`). Upgrade sempre para `/pricing?change=1`. Páginas públicas (`/`, `/pricing`, `/legal/*`) renderizam para qualquer estado de sessão — logado vê CTA "Acessar Sistema" em vez de "Entrar"/"Comece Agora"; redirect forçado de logado só em `/login` e `/admin` (formulários de auth).
- Feature nova de plano: registrar em `orbi-features.ts`, ligar no jsonb dos planos via migration, gate no RLS/trigger/RPC e em `FEATURE_ROWS` (Pricing), `plan-highlights.ts` e `plan-impact.ts`.

### 12. Motor Preditivo + Contratos de Rateio + Acertos de Viagem (migrations `20260916021503`, `20260916021607`)
Exclusivos Pro/Casal. Features: `motor_preditivo`, `contratos_rateio` (ligadas onde `orcamentos` já estava). Rotas `/sistema/forecast` e `/sistema/ledgers` (`?aba=contratos`, `?evento=<uuid>`), `PremiumRoute` + cadeado na sidebar (via `PREMIUM_MODULE_LIST`).
- **Ralo diário** (`orbi_daily_burn_rate(p_days=90, p_scope)`): Σ despesa não cancelada nos últimos N dias, líquida de rateio (`value − compensation_value`), SEM `is_fixed` (transação ou série) e SEM série com > 1 parcela, ÷ N. Top 5 categorias.
- **Projeção** (`orbi_cash_forecast(p_horizon_days 7–400, p_scope)`): `current_balance` = Σ `vw_account_current_balance` do escopo; eventos = (a) transações sem cartão com `date > hoje`, não canceladas; (b) compras de cartão agrupadas por fatura no dia de vencimento (fechamento: dia < `statement_date` → mês da compra, senão mês seguinte; vencimento no mesmo mês se `due_date > statement_date`, senão no seguinte); (c) próximas ocorrências de séries `is_fixed` a partir da última transação gerada. PENDING vencido de conta (data <= hoje, fora do saldo real) entra como evento de amanhã. A curva é montada no CLIENTE (`src/lib/forecast.ts`): saldo[d] = saldo[d−1] + eventos[d] − ralo; `projection.breakdown` soma por tipo e a tela mostra a composição (hoje + agendados + faturas + recorrentes + projetos − ralo = saldo final). Ruptura = 1º dia < 0; "faltarão" = déficit NO dia da ruptura (o menor saldo aparece à parte como "ponto mais baixo"). Datas fora do mês corrente com ano (`formatDayMonthOrYear`). Datas pela `as_of` do servidor (fuso de Brasília).
- **Eventos Fantasmas** (What-If): só `useState` da tela, nunca no banco. Parcelas mensais (`addMonths` preserva o dia), resíduo de centavos na última.
- **Contratos de rateio**: sugestão pré-preenchida no formulário de rateio do Extrato (`SplitCompensationField`). Pessoa com contrato ativo na categoria → % do contrato; sem contrato → divisão igual. Editável até R$ 0,00: com 0 o gasto é salvo inteiro (`is_shared=false`, sem linha B). Com valor, `compensation_value` = total editado e cada linha B recebe a parte proporcional. Sem a feature, o fluxo legado (divisão igual) não muda.
- **Acertos de viagem**: saldo = pago − parte; parte = total × peso ÷ Σ pesos (dono = `owner_weight`). "Pago" do dono = Σ despesas do dono com `ledger_id`; terceiros = `ledger_entries`. `orbi_ledger_summary` devolve participantes + transferências mínimas (gulosa). `orbi_ledger_settle` (dono) passa para PAID todas as PENDING com `ledger_id` do evento **e** as linhas B ligadas (`linked_txn_id`), e marca o evento `settled`. Evento liquidado não aceita novo vínculo (trigger `orbi_transactions_ledger_guard`, só dispara quando `ledger_id` muda — o Extrato só manda `ledger_id` no UPDATE se mudou).
- **PIX Copia e Cola**: BR Code estático gerado no navegador (`src/lib/pix.ts`, CRC16-CCITT validado com o exemplo do BCB). Chave de recebimento do dono fica em `ledgers.pix_key`; a de terceiros vem de `people.pix`.

### 13. Projetos de Vida + Inflação Pessoal (migrations `20260916122647` → `20260916125505`)
Exclusivos Pro/Casal. Features: `projetos_vida`, `inflacao_pessoal` (ligadas onde `orcamentos` já estava). Rotas `/sistema/projects` (`?projeto=<uuid>`) e `/sistema/inflation` (`?base=3|6|12`, `?categoria=<uuid>`), `PremiumRoute` + cadeado via `PREMIUM_MODULE_LIST`. Mesma defesa em 4 camadas (RLS com `orbi_has_feature` → trigger P0004/P0005 + tenant → RPC `orbi_require_feature` → front).
- **Projeto = centro de custo transversal**: `transactions.project_id` (qualquer tipo). Trigger `orbi_transactions_project_guard` (só quando `project_id` muda): dono igual, projeto `active`; tirar/mover lançamento de projeto arquivado é bloqueado. Projeto com `ledger_id` e plano com `contratos_rateio`: despesa nova no projeto herda `ledger_id` (acerto de viagem) automaticamente. Extrato: `ProjectPicker` em ganho/gasto/parcelado (parcelas: `use-installments` faz UPDATE por `series_id` após a RPC).
- **Custo** = Σ despesa não cancelada `value − compensation_value` (pago = PAID, agendado = PENDING). Linha B de rateio (income + is_shared + linked_txn_id) nunca conta como receita do projeto. `remaining = budget − custo`. RPCs: `orbi_projects_list(p_scope)`, `orbi_project_overview(id)` (totais, ritmo tempo×orçamento, categorias, timeline mensal, 300 lançamentos).
- **Executar meta** (`orbi_goal_execute`): lock `goal:<id>`, saldo da meta > 0 → cria projeto com `budget = guardado + extra`, `funded_from_goal = guardado`, opcional ledger; seta `goals.executed_at`. Meta executada congela aportes/resgates (guard 23514). Excluir o projeto libera a meta. `goal_id`, `funded_from_goal`, `status`, `final_report`, `archived_at` e `goals.executed_at` só mudam dentro das RPCs, via GUC transacional (`set_config('orbi.goal_execute'|'orbi.project_status'|'orbi.goal_release', …, true)`) — cliente que tenta direto é ignorado/recusado. `budget` nunca abaixo de `funded_from_goal`.
- **Arquivamento**: `orbi_project_archive` (dono) ou cron `orbi-projects-auto-archive` (03:10 UTC, `end_date < hoje`) → `orbi_project_close` grava `final_report` (custo, variação %, top categorias) + notificação `project_archived`. `orbi_project_reopen(id, nova_data_fim ≥ hoje)` descarta o relatório.
- **Isolamento do DRE**: `orbi_monthly_closing(p_month, p_scope, p_exclude_projects = true)` e `orbi_budget_overview(…, p_exclude_projects = true)` tiram lançamentos com `project_id` das linhas, tendência e consumo; o DRE devolve bloco `projects` (gasto do mês por projeto). Front: switch "Incluir projetos de vida" (`?projetos=incluir`). `orbi_daily_burn_rate` ignora projetos; `orbi_cash_forecast` soma eventos `kind='project'` = (orçamento − custo lançado) ÷ dias até o fim, em blocos semanais, + lista `projects`.
- **Inflação Pessoal** (`orbi_personal_inflation_compute(user, mês)`, só DEFINER/cron): janela atual = média dos 3 meses fechados até o mês; bases 3, 6 e 12 meses antes. Só categorias essenciais (`orbi_is_essential_category`: mercado/alimentação/refeição, farmácia/saúde, combustível/transporte, casa/contas, assinaturas, pet); fora: projetos, parcelamentos não fixos, cancelados; rateio líquido. Estabelecimento = `merchants_dictionary.merchant_key` normalizado (maior match) ou raiz de 2 tokens (`orbi_merchant_root`, sem gateway/canal/dígitos). Índice da categoria = média ponderada (gasto da base) da razão de **mediana do ticket** por estabelecimento pareado, limitada a [0,5; 2]; sem par → razão do gasto mensal. Índice pessoal = Σ peso_base × (índice − 1). Headline = base 12 → 6 → 3 (a primeira disponível). Grava `monthly_summaries`. Mês de referência = mês anterior: categoria com índice > 10% e orçamento no mês corrente → notificação `budget_inflation` com `suggested_limit = teto × (1 + %)`.
- **Leitura**: `orbi_personal_inflation(p_months 3–24, p_refresh)` recalcula meses ausentes (o de referência se > 6 h; refresh se > 2 min, lock `inflation`) e devolve headline, categorias com movers, histórico e alertas não lidos. Cron `orbi-personal-inflation-monthly` (dia 1, 04:30 UTC). Card de alerta no Dashboard (teaser com upgrade para Free) e no Fechamento do mês; alertas com "Reajustar para R$ X" em Orçamentos e na tela; sino `NotificationsBell` no header.

### 14. Plano Casal — herança de plano e autoria (migration `20260922171500`)
- **Plano efetivo**: `orbi_effective_plan_owner(uid)` (INTERNA, sem EXECUTE p/ cliente) = dono do grupo se `uid` é membro vinculado e o dono tem `familia_compartilhada` no PRÓPRIO plano (`orbi_own_active_plan`); senão o próprio `uid`. `orbi_active_plan_features/limits`, `orbi_quota_snapshot` e `get_my_subscription_status` resolvem por ele → parceiro herda features, limites (contados por pessoa) e acesso. Status herdado vem com `inherited=true` e SEM dados de cobrança do dono (`subscription_id`, `next_due_date`, `grace_period_end`, `blocked_reason` = null); herança sem acesso liberado cai para a assinatura própria (parceiro nunca vai para /billing do dono).
- **Gate de leitura**: `orbi_family_user_ids()` só devolve o grupo enquanto o dono tiver `familia_compartilhada` — downgrade corta a leitura cruzada. `orbi_my_family_group_id()` é determinístico (`created_at ASC`).
- **Vínculo**: `orbi_claim_family_invites()` e o auto-vínculo de `check_family_members_limit` exigem `auth.users.email_confirmed_at IS NOT NULL` (e-mail de `auth.users`, não do JWT), 1 grupo por pessoa; `user_id` enviado pelo cliente no convite é ignorado. Front chama `claimFamilyInvites()` (`lib/family-access.ts`) ANTES de ler o status (`useSubscriptionStatus`, `resolvePostAuthRoute`).
- **Autoria**: RPC `orbi_family_directory()` → `[{user_id, is_self, name}]` (só 1º nome, mesmo gate). `useFamilyGroup()` expõe `isLinked` (= diretório com 2+ pessoas) e `authorOf(user_id)`; `<AuthorTag>` (`components/family/AuthorTag.tsx`) no início da linha de metadados do Extrato e do Dashboard quando `viewMode === 'couple' && isLinked`.
- **Me-Space × We-Space** (`src/hooks/use-space.ts` sobre o store de `use-view-mode`): seletor único `SpaceSwitch` (`components/family/ViewModeToggle.tsx`) no `AppHeader` — nenhuma página tem toggle próprio. Troca remonta o palco do `AppLayout` (`key={mode}`, keyframes `space-in-me|we`, CSS puro: `framer-motion` é bloqueado pela política de pacotes). `isWeSpace` = preferência Casal **e** parceiro vinculado. Avatares: `AuthorTag` (linhas), `OwnerMark` (contas/cartões/metas/orçamentos), `SplitPill` (linha A de rateio, `is_shared` + `compensation_value > 0`).
- **Edição mútua** (migration `20260922190000`): policy `family_update_transactions` (UPDATE aditivo) + trigger `orbi_transactions_family_guard` — parceiro só muda descrição, valor, data, categoria (sistema ou do dono), status e pagador; conta/cartão/pessoa/série/par/evento/projeto/tipo são do dono (42501). INSERT/DELETE seguem só do dono (`assertOwnTransaction` antes de excluir). Busca por id: **sem** `.eq('user_id')` e com `.maybeSingle()` (o filtro + `.single()` dava 406/PGRST116 em transação do parceiro). UPDATE com `.select('id')` → 0 linhas = `SHARED_EDIT_DENIED_MESSAGE`. Modal mostra `SharedAuthorNotice` ("Criado por …").
- **Perfil / avatar** (migration `20260922200000`): `user_profiles.display_name` (1–40, uma linha) + `avatar_path` (CHECK `<user_id>/<hex32>.(webp|png|jpg)`). Bucket `avatars` PRIVADO (2 MB, jpeg/png/webp): INSERT/DELETE só na própria pasta, SELECT dono + `orbi_family_user_ids()` (`orbi_can_read_avatar`), sem UPDATE/upsert. Imagem só por signed URL de 1 h (`lib/avatar-storage.ts`, cache em `useAvatarSrc`). Upload: `assertValidAvatarFile` (tamanho/extensão/MIME/magic bytes) → `normalizeAvatar` (canvas 512 px, sem EXIF) → upload → upsert do caminho → remove o antigo. `orbi_family_directory` devolve `name` (apelido ou 1º nome) + `avatar_path`. UI: `<UserAvatar>` (`components/ui/user-avatar.tsx`: foto → iniciais navy/chart-6 → glifo), `AuthorAvatar`/`PartnerBadge` (nunca "Parceiro" fixo), `ProfileSettings` em Configurações → Geral.
- **Pagador**: `transactions.paid_by_user_id` (NULL = dono), só informativo (não entra em saldo). `PayerPicker` no Nosso espaço para gasto simples/rateio; o client só envia a coluna quando escolhida (`payerField`). DRE Casal: RPC `orbi_couple_expense_split(p_month, p_exclude_projects)` → `CoupleSplitCard` ("Você representou X%…"), despesa líquida de rateio atribuída ao pagador.

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
 │   ├─ projects/            ProjectDetail, ProjectEditor, ExecuteGoalDialog, AttachTransactionsDialog, ProjectPicker, PaceMeter (orçamento × prazo), project-meta
 │   ├─ inflation/           InflationAlertCard, BudgetInflationAlerts, inflation-meta
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

## AppSec & Security Guidelines

> OBRIGATÓRIO para todo código novo ou alterado. Zero Trust: todo input do cliente é malicioso até ser validado; toda saída ao cliente contém só o que a UI usa. Violação = bug de segurança, não estilo.

### 1. Edge Functions — ordem fixa de defesa (`supabase/functions/_shared/*`)
```
OPTIONS → preflight(req)
gateUser/gateAnonymous(req, { bucket, ipLimit, userLimit, windowSeconds, strict, maxBodyBytes })
  método → origem (ALLOWED_ORIGINS) → Content-Length ≤ maxBodyBytes → rate limit IP → JWT → rate limit usuário
parseJson(req, schemaZod, { maxBytes })      ← ÚNICA forma de ler body JSON
handler (service_role só aqui, sempre filtrando por user.id do JWT)
jsonFor(req, projeção)                        ← nunca a linha crua do banco / do gateway
catch → gateFailure(req, error, 'nome-da-funcao', envelope)
```
- **Proibido**: `await req.json()`, `body as Tipo`, ler body antes do gate, handler sem `gateUser`/`gateAnonymous` (exceção única: webhook, que tem gate próprio equivalente), `Access-Control-Allow-Origin: *`, `Object.assign(new Error(msg), { status })`.
- Toda função nova: bloco `[functions.<nome>] verify_jwt = true` em `supabase/config.toml` (só webhook com `false` + segredo próprio).

### 2. Validação de input (Zod, server E client)
- **Server**: `_shared/validation.ts` → `parseJson` (415 se Content-Type não-JSON, 413 por tamanho real do stream, 400 JSON malformado/não-objeto) + `validate`. Schemas com `.strict()` em rotas que mudam estado (campo extra = 400). Primitivos prontos: `uuidSchema`, `isoDateSchema`, `singleLine(max)`/`requiredLine`/`multiLine` (removem controle/zero-width), `cpfCnpjSchema`, `mobilePhoneSchema`, `gatewayIdSchema`. Erro 400 devolve `{ code:'INVALID_PAYLOAD', issues:[{path,message}] }` sem ecoar o valor recebido (errorMap sanitizado).
- **Client**: `src/lib/validation/schemas.ts` + `parseOrThrow(schema, values)` antes de TODO insert/update/rpc com dado de formulário. Limites do schema = espelho EXATO das CHECK constraints SQL (mudou um, muda o outro). Entidades cobertas: account, creditCard, person, category, transaction, series, note, bugReport, budget, goal, goalAllocation, adminUser.
- **Enums/ids**: sempre `z.enum` / `uuidSchema`; nunca aceitar texto livre em coluna de domínio fechado.
- **Tamanho**: todo array tem `.max()`, toda string tem `.max()`, todo body tem `maxBytes`. Sem teto = amplificador de DoS.

### 3. Injeção (SQL / PostgREST / path / HTML)
- **SQL**: nunca concatenar input em SQL. Em plpgsql dinâmico só `format('%I', ident)` / `%L` ou `EXECUTE ... USING`. RPC SECURITY DEFINER: `SET search_path = public, pg_temp` (+ `extensions` se usar pgcrypto), dono derivado de `auth.uid()` via `require_self()` — nunca de `p_user_id` do cliente. `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE` só para a role necessária.
- **PostgREST**: preferir `.eq()/.in()` (parametrizados). `.or()`/`.filter()` com string interpolada SÓ com valor validado por `assertUuid()`/enum. LIKE: `sanitizeSearchTerm()` (neutraliza `% _ \`).
- **Path de API externa**: id em URL do Asaas sempre via `asaasId()` (regex `[A-Za-z0-9_-]{1,64}`); query string com `encodeURIComponent`.
- **XSS**: proibido `dangerouslySetInnerHTML` (exceção existente: `ui/chart.tsx`, com escape), `eval`, `new Function`, `innerHTML`. URL vinda de banco/gateway/usuário: `safePaymentUrl`/`safeHttpsUrl`/`safeImageSrc` (`src/lib/safe-url.ts`) antes de `href`/`src`; abrir externo só com `openExternalUrl()` (`noopener,noreferrer`, allowlist de host). CSP (`netlify.toml`/`vercel.json`/`nginx.conf`/`public/_headers`, idênticas): `script-src 'self' https://challenges.cloudflare.com` (único host externo: Turnstile; `frame-src` idem) sem inline/`wasm-unsafe-eval`, `connect-src` só `*.supabase.co`. Dependência que exija afrouxar CSP = recusar ou isolar no `document-extractor`.

### 4. Rate limit & brute force
- Toda Edge Function: `ipLimit` + `userLimit` (janela padrão 3600s). Rota de dinheiro/estado de assinatura: `strict: true` (contador fora = bloqueia). Leitura/CPU: fail-open.
- 429 SEMPRE com `Retry-After` (vem de `RateLimitError`). Front deve respeitar e não fazer retry em loop.
- IP: `clientIp()` normaliza (`cf-connecting-ip` → `x-real-ip` → 1º `x-forwarded-for`), IPv6 agregado em /64 (troca de endereço dentro do bloco não fura o limite).
- Segredo comparado no servidor (webhook/token): `assertNotLockedOut()` (RPC `peek_rate_limit_key`, sem incremento) ANTES da comparação; `consumeRateLimit()` no bucket de falha só quando falhar; comparação em tempo constante. Allowlist opcional `ASAAS_WEBHOOK_ALLOWED_IPS`.
- `/auth/v1/*` (login/signup/recover) não passa por Edge Function: teto em `[auth.rate_limit]` do `config.toml` + captcha (`[auth.captcha]`) obrigatório em produção. Senha: min 8 usuário (`password-strength.ts`), min 12 + letras e números para admin (`admin_create_admin_user`).

### 5. Secrets
- Frontend só conhece `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`, `VITE_TURNSTILE_SITE_KEY` (site key pública) e verificações de SEO. `vite.config.ts` (`assertNoSecretsInClientEnv`) derruba o build com `VITE_*` de nome secreto ou site key com formato de secret. Qualquer `VITE_*` vai para o bundle público — **proibido** `VITE_` com service role, chave Asaas, token de webhook/extrator ou qualquer credencial.
- `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` (≥32 chars), `DOCUMENT_EXTRACTOR_TOKEN`/`EXTRACTOR_SERVICE_TOKEN` (≥32 chars): só `supabase secrets set` / env do contêiner. Nunca em código, migration, seed, log, resposta ou mensagem de erro. `.env*` fora do git (exceto `.env.example` sem valores).
- `adminClient()` (service_role) só dentro de Edge Function, depois do gate, e toda query com `.eq('user_id', user.id)`. Leitura que pode respeitar RLS usa `userClient(req)`.
- Env ausente → `HttpError(503)` com `internal` (log), nunca string vazia silenciosa.

### 6. Vazamento de dados em respostas
- **Projeção obrigatória**: resposta de Edge Function monta objeto explícito. `user_subscriptions` → `toPublicSubscription()`; cobrança → `toPublicPayment()` (URL validada). Nunca devolver: `asaas_customer_id`, `asaas_subscription_id`, `metadata`, `payload` de webhook, `process_error`, `encrypted_password`, `raw_app_meta_data`, tokens, `user_id` de terceiros, stack/SQL/mensagem de gateway 5xx.
- **Erros**: lançar `HttpError(status, mensagemPublica, { code, internal })` (`_shared/errors.ts`). `gateFailure` expõe mensagem só se status < 500; 5xx → mensagem genérica + log com `internal`. Erro não-`HttpError` (PostgrestError, Error cru, erro de lib) = 500 genérico SEMPRE. `AsaasError`: 400/422 do gateway → 422 com descrição sanitizada; demais → 502 genérico.
- **Select**: `select('*')` proibido em dado exposto a `anon` e em linha que vai para resposta; listar colunas. `subscription_plans` para `anon` tem GRANT por coluna (sem `asaas_plan_id`/`metadata`) — select de vitrine usa a lista de `use-subscription.ts`.
- **RPC**: retorno `jsonb`/`TABLE` com só os campos da tela; RPC admin começa com `IF NOT public.is_admin()/is_super_admin() THEN RAISE ... ERRCODE '42501'`.
- Logs (`console.*`): sem token, senha, CPF/CNPJ, e-mail completo ou body cru.

### 7. Banco (RLS é a autoridade final)
- Tabela nova: `ENABLE` + `FORCE ROW LEVEL SECURITY`, policies `TO authenticated` com `auth.uid() = user_id` (USING + WITH CHECK), `REVOKE ALL FROM anon`, adicionar em `orbi_tenant_tables()`, CHECK constraints de tamanho/formato espelhando o Zod, trigger de guarda para dono imutável e cota (`orbi_quota_lock`).
- View: `security_invoker = true`. Função: `SECURITY INVOKER` por padrão; `DEFINER` só com search_path fixo e checagem de identidade.
- Tabela de infraestrutura (contadores, ledger de webhook): sem policy para `anon`/`authenticated`, escrita só por `service_role`.

### 7.1 Autenticação — recuperação de senha e MFA (TOTP)
- **Camadas**: chamadas `supabase.auth.*` de fluxo ficam em `src/services/auth/` (`password-recovery.ts`, `mfa.ts`) e lançam `AuthFlowError` já traduzido; mensagens por `error.code` em `src/lib/auth/auth-errors.ts` (nunca `error.message` do GoTrue na UI). Rotas em `AUTH_ROUTES` (`src/lib/auth/redirect.ts`).
- **Recuperação**: `/esqueci-senha` → `resetPasswordForEmail(email, { redirectTo: origem atual + /redefinir-senha })`, resposta idêntica com ou sem conta (anti-enumeração). `/redefinir-senha` aceita `?token_hash=&type=recovery` (template `supabase/templates/recovery.html`, consumido só no envio da nova senha via `verifyOtp`) e `?code=` (PKCE, trocado pelo `detectSessionInUrl`; só no mesmo navegador). URL limpa com `history.replaceState` logo após ler. Conta com MFA: GoTrue exige aal2 para `updateUser({ password })` → a tela pede o TOTP antes. Sucesso encerra as outras sessões (`signOut({ scope: 'others' })`).
- **Estágio da sessão** (`src/lib/auth/assurance.ts`, síncrono — nunca chamar API do supabase-js dentro de `onAuthStateChange`, trava o lock): `anonymous` | `mfa_required` (aal1 + fator verificado) | `authenticated`. `App.tsx` trata `mfa_required` como não autenticado em `/sistema`, `/billing`, `/admin/*` e manda para `/login/verificacao` (`?destino=admin` no painel). `/esqueci-senha` e `/redefinir-senha` são sempre acessíveis.
- **MFA**: Configurações → Segurança (`MfaSettings`): 1 TOTP verificado por conta; `unverified` abandonados são removidos antes de novo `enroll`; QR só como SVG em data URI (`<img>`, nunca innerHTML); desativar exige código novo mesmo em aal2 e faz `refreshSession`.
- **Banco é a autoridade**: rota não protege dado. Dado sensível exige `auth.jwt()->>'aal' = 'aal2'` na policy, ou a camada RESTRICTIVE `public.orbi_mfa_satisfied()` / `PERFORM orbi_require_mfa_session()` em RPC (migration `20260916165204`). Modelo completo: `docs/sql/2026-09-16_mfa_aal2_rls_exemplo.sql`.

### 7.2 Captcha (Cloudflare Turnstile)
- Superfícies: login (`action=login`), cadastro (`signup`), login admin (`admin_login`), esqueci a senha (`password_reset`). Token vai em `options.captchaToken` do supabase-js; quem chama o siteverify é o GoTrue com o secret guardado no painel do Supabase (Auth → Attack Protection). Secret NUNCA em repo, `.env`, `VITE_*`, Edge Function ou log.
- `TurnstileField` + `useTurnstile()` (`src/components/auth/TurnstileField.tsx`), loader em `src/lib/auth/turnstile.ts` (`render=explicit`, sem script inline, `interaction-only`). Token de uso único: `reset()` depois de TODA tentativa. Envio só é segurado enquanto o token carrega; erro de widget não trava o cliente (o servidor decide com `captcha_failed`).
- Nova rota de auth que chame `signInWithPassword`/`signUp`/`signInWithOtp`/`resetPasswordForEmail`/`resend` precisa do widget — com captcha ligado, sem token = 400.

### 8. Checklist de PR (bloqueante)
`[ ]` gate + rate limit IP/usuário `[ ]` `parseJson` + schema `.strict()` com `.max()` em tudo `[ ]` `parseOrThrow` no client `[ ]` projeção explícita na resposta `[ ]` erros via `HttpError` `[ ]` RLS + FORCE + CHECK na tabela nova `[ ]` nenhum secret em `VITE_*`/código/log `[ ]` URL externa por `safe-url.ts` `[ ]` CSP inalterada ou mais restrita.

---

## ⚠️ GOTCHAS (verificados no código — não hipotéticos)

1. **Data no cliente**: nunca `toISOString().slice(0, 10)` (UTC; entre 21h e 00h BRT vira o dia seguinte) nem `new Date("YYYY-MM-DD")` (meia-noite UTC = dia anterior em BRT). Use `toDateKey(date)` / `fromDateKey(key)` / `getCurrentDateString()` de `lib/utils.ts`. Campos de valor: `NumericInput` seleciona tudo no foco e edita em `1500,50` (`lib/money-input.ts`, teste em `tests/money-input.test.mjs`).
2. **RPCs `create_installment_series`/`update_installment_series`/`delete_installment_series` e `maintain_fixed_transaction_series`/`generate_future_fixed_transactions` existem no banco mas NÃO são o caminho usado em produção** — `MonthlyStatement.tsx` faz inserts/updates diretos nas tabelas `series`/`transactions`. Os hooks `use-installments.ts` (chama a RPC certa) e `use-series.ts` (chama RPC com assinatura de parâmetros DIFERENTE da função real — `p_total_value`/`p_start_date` não existem na função atual) parecem código morto/quebrado, não confirmados em uso por nenhuma página além de import não utilizado em `MonthlyStatement.tsx`.
3. **`generate_future_fixed_transactions` (SQL) referencia `series.account_id`, `series.credit_card_id`, `series.person_id`** — colunas que **não existem** na tabela `series` (confirmado em `types.ts`) → essa função quebraria se chamada. Não usar/depender dela sem antes corrigir o schema ou a função.
4. Antes de alterar qualquer função/view/policy, checar `src/integrations/supabase/types.ts` para o schema real — as migrations têm colunas adicionadas e removidas (ex.: `installments`/`installment_number`/`is_fixed` foram removidas de `transactions` na migration `20250131000008` e depois `is_fixed` foi READICIONADA em `20251001000001`).
5. Existe documentação humana extensa em `docs/DOCUMENTACAO_SISTEMA_ORBI.md` — consultar antes de assumir lacuna; este arquivo é o guia denso para IA, aquele é a referência detalhada para humanos.
6. **`service_role` precisa de GRANT de tabela mesmo com `BYPASSRLS`/`orbi_service_bypass`** — RLS e privilégio são camadas distintas. Sem o GRANT as Edge Functions levam `permission denied for table X` (403) — foi o que quebrou o checkout Asaas (migration `20260915223818`, que também seta DEFAULT PRIVILEGES). Tabela nova: `GRANT ... TO authenticated` conforme a policy + herdar o default do `service_role`; nunca `REVOKE ALL ... FROM service_role`.


<strict_output_rules>
- MODO DE EXECUÇÃO SILENCIOSA: Você é um agente executor. Sua única função é analisar o contexto, modificar/criar os arquivos necessários no sistema e finalizar a tarefa.
- ZERO CONVERSA: É estritamente proibido gerar saídas de texto conversacional, introduções, explicações de código, resumos ou justificativas sem ser solicitado explicações!. 
- SAÍDA OBRIGATÓRIA: Após aplicar todas as alterações de código com sucesso, sua resposta final no chat DEVE ser APENAS a palavra: "Feito."
</strict_output_rules>