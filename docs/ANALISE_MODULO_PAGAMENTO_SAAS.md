# Análise do módulo de pagamento SaaS (Orbi × Asaas)

> Documento de auditoria para fechamento do módulo. Fonte: código vigente em 11/09/2026 (rotas, hooks, Edge Functions, RPCs e migrations). Não é spec de produto — descreve o que **existe hoje**, o que **quebra** e o que **falta** para o módulo ser comercialmente completo.


---

## 1. Veredito

O **backend de cobrança está avançado**: customer Asaas, assinatura recorrente, webhook idempotente, reconciliação no login, cancelamento no fim do período, reativação sem cobrança duplicada, RPC autoritativa de acesso, gates de quota e aceite legal (LGPD/CDC).

O **produto comercial ainda não fecha**, principalmente por três classes de problema:

1. **Navegação anti-mercado** — usuário logado com plano **não consegue** ver a landing nem a página de preços. Upgrade, comparação e marketing institucional ficam inacessíveis.
2. **Checkout incompleto** — não pede CPF, não espera a confirmação do pagamento, não devolve o usuário ao app, não mostra histórico/recibo.
3. **Operação de dinheiro com buracos** — cancelamento admin e downgrade para Free **não derrubam** a assinatura no Asaas; trial nunca é iniciado; documentação operacional está defasada.

Prioridade de fechamento sugerida: **P0 navegação + P0 money-leak + P1 checkout/retorno**, nesta ordem. Sem o P0 de navegação, o próprio botão “Trocar de plano” (Configurações) é inútil.

---

## 2. Inventário do que existe

### 2.1 Superfície de produto

| Peça | Caminho | Papel |
|------|---------|--------|
| Landing | `src/pages/Landing.tsx` + `PricingSection` | Marketing + CTA de plano |
| Preços | `src/pages/Pricing.tsx` | Catálogo, aceite, checkout |
| Login/cadastro | `src/components/auth/AuthForm.tsx` + `use-auth.ts` | Auth + roteamento pós-login |
| Billing (bloqueio) | `src/pages/Billing.tsx` | Inadimplência / pagamento pendente |
| Configurações → Assinatura | `src/components/settings/SubscriptionSettings.tsx` | Extrato do plano, cancelar, retomar, 2ª via |
| Dialog de cancelamento | `CancelSubscriptionDialog.tsx` | 2 etapas + aceite explícito |
| Dialog de consentimento | `SubscriptionConsentDialog.tsx` | Aceite legal antes de cobrar |
| Dialog de pagamento | `src/components/payment/PaymentDialog.tsx` | Abre invoice Asaas em nova aba |
| Guards | `SubscriptionGuard`, `FeatureGuard`, `LimitGuard`, `FeaturePageGuard` | Acesso ao app / feature / cota |
| Admin | `/admin/plans`, `/admin/subscriptions`, `/admin/users` | CRUD de planos e lista de assinaturas |
| Plano Casal | `FamilyGroupSettings` + RPCs `orbi_*` | 2 acessos / 1 assinatura (sem e-mail transacional) |

### 2.2 Backend

| Função | Auth | Papel |
|--------|------|--------|
| `asaas-create-customer` | JWT + rate limit strict | Cria/reusa customer Asaas, grava `user_profiles.asaas_customer_id` |
| `asaas-create-payment` | JWT + rate limit strict (10/h) | Cria ou atualiza **subscription** Asaas + linha em `user_subscriptions` |
| `asaas-manage-subscription` | JWT + rate limit strict | `cancel` / `reactivate` / `invoice` |
| `asaas-sync-subscription` | JWT, fail-open | Reconcilia com Asaas no login |
| `asaas-webhook-handler` | token `asaas-access-token`, **sem JWT** | Eventos de pagamento/assinatura |
| RPC `get_my_subscription_status` | `authenticated` | Fonte da verdade de acesso (SECURITY DEFINER) |
| RPC `activate_free_plan(p_plan_id)` | `authenticated` | Ativa plano `price=0` no servidor |
| RPCs `orbi_active_plan_limits/features` | triggers de cota | Limites reais no Postgres |
| `admin_cancel_subscription` | admin | **Só** `UPDATE status='canceled'` no banco |

### 2.3 Dados

- `subscription_plans` — catálogo (seed canônico Free/`basic`, Pro, Casal em `20260910120003`).
- `user_subscriptions` — uma linha “vigente” por usuário na prática; várias linhas históricas com `canceled`.
- `payment_history` — espelho das cobranças Asaas (`asaas_payment_id` unique).
- `asaas_webhook_events` — ledger de idempotência (PK do event id).
- `user_profiles.asaas_customer_id`.
- Colunas de PIX (`pix_qr_code`, `pix_copy_paste`) **existem e não são preenchidas**.
- `trial_days` / `trial_start` / `trial_end` **existem e o checkout nunca as preenche**.

---

## 3. Fluxo completo (como o código se comporta hoje)

```mermaid
flowchart TD
  A[Visitante na landing /] --> B{/pricing ou CTA de plano}
  B --> C{Sessão?}
  C -->|não| D[Salva orbi_selected_plan no localStorage]
  D --> E[/login ?modo=cadastro]
  E --> F{Login ou cadastro}
  F -->|cadastro| G[/pricing]
  F -->|login| H[resolvePostAuthRoute]
  H --> I{RPC get_my_subscription_status}
  I -->|allowed| J[/sistema]
  I -->|blocked / pending_payment| K[/billing]
  I -->|no_plan| G
  G --> L{Plano gratuito?}
  L -->|sim| M[RPC activate_free_plan]
  M --> J
  L -->|não| N[Dialog de consentimento legal]
  N --> O[Edge asaas-create-payment]
  O --> P[status = pending]
  P --> Q[PaymentDialog abre invoice Asaas em nova aba]
  Q --> R[Webhook PAYMENT_CONFIRMED]
  R --> S[status = active]
  S --> J
```

### 3.1 Visitante (não autenticado)

1. Vê `/` (landing) e `/pricing` normalmente.
2. CTA da landing (`PricingSection.choose`) grava `localStorage.orbi_selected_plan` e manda para `/login?modo=cadastro`.
3. CTA de `/pricing` sem sessão faz o mesmo e vai para `/login`.
4. Cadastro (`useAuth.register`) grava aceite dos termos no `user_metadata` e **sempre** navega para `/pricing` — não verifica se o e-mail precisa ser confirmado.
5. Login (`useAuth.login`) chama `asaas-sync-subscription` e depois a RPC; destino: `/sistema`, `/billing` ou `/pricing`.

### 3.2 Ativação de plano gratuito

- Front chama `activate_free_plan(p_plan_id)`.
- Backend recusa se `price_monthly` ou `price_yearly` > 0.
- Cancela linhas vigentes (`pending|trial|active|past_due`) e insere `status=active`, ciclo `yearly`, validade 1 ano.
- **Não fala com o Asaas.** Se o usuário tinha assinatura paga viva no gateway, a cobrança **continua**.

Caminho paralelo: `asaas-create-payment` com plano de valor 0 faz o mesmo no banco (cancela vigentes, insere free) e **também não deleta** a subscription Asaas.

### 3.3 Checkout de plano pago

1. `requestPlan` → `SubscriptionConsentDialog` (preço, ciclo, renovação automática, art. 49 CDC, checkbox obrigatório).
2. `recordLegalConsent` grava no `user_metadata` (falha aqui **não** bloqueia a cobrança).
3. `asaas-create-payment`:
   - Garante customer Asaas (`findOrCreateCustomer` por id, senão e-mail, senão POST).
   - **CPF e telefone são opcionais no body e o front nunca envia.**
   - Cria `POST /subscriptions` com `billingType: UNDEFINED` (o usuário escolhe PIX/boleto/cartão **na página do Asaas**).
   - Ou `PUT` na subscription existente se já há `asaas_subscription_id` e não há cancelamento agendado (upgrade/downgrade imediato, `updatePendingPayments: true`).
   - Se havia `cancel_at_period_end` com período aberto, cria **nova** subscription com 1ª cobrança em `current_period_end` (não cobra o intervalo já pago).
   - Primeira assinatura: linha `status='pending'`, `current_period_*` já preenchidos (otimistas — o acesso só libera quando a RPC vê `active`/`trial`/`past_due_grace`).
4. Front abre `PaymentDialog`, que após 1,5 s faz `window.open(invoiceUrl)` — popup blockers matam isso em silêncio.
5. **Não há polling.** **Não há `successUrl`/`autoRedirectUrl` na criação da subscription.** O handler `?payment=success` em `AppLayout` é código morto.

### 3.4 Confirmação (webhook)

`asaas-webhook-handler`:

- Rate limit por IP (fail-open).
- Token obrigatório (`ASAAS_WEBHOOK_TOKEN`); comparação em tempo constante.
- Idempotência via `INSERT` em `asaas_webhook_events` (23505 = duplicata, 200).
- Erro de processamento: **200** de propósito (evita retry infinito); o evento fica com `process_error` para reprocesso manual — **não há UI/job de reprocesso**.

Eventos tratados:

| Evento | Efeito |
|--------|--------|
| `PAYMENT_CONFIRMED` / `RECEIVED` / `RECEIVED_IN_CASH` | `payment_history=confirmed`, assinatura `active`, período recalculado a partir da data do pagamento |
| `PAYMENT_CREATED` / `UPDATED` | histórico `pending` |
| `PAYMENT_OVERDUE` | histórico `failed`, assinatura `past_due` + `grace_period_end` (`ASAAS_GRACE_DAYS`, default 3) |
| `PAYMENT_DELETED` / `REFUNDED` / `CHARGEBACK_*` / `REVERSED` | revoga se não restar pagamento `confirmed`; respeita cancelamento agendado |
| `SUBSCRIPTION_DELETED` / `INACTIVATED` | `canceled`, **exceto** se `cancel_at_period_end` com período aberto |
| `SUBSCRIPTION_CREATED` / `UPDATED` | sincroniza `next_due_date` |

A RPC `get_my_subscription_status` **não lê o webhook em tempo real**. Ela deriva `access` da linha:

| `status` efetivo | `access` | Destino do guard |
|------------------|----------|------------------|
| `active`, `trial`, `past_due_grace` | `allowed` | `/sistema` |
| `pending` | `pending_payment` | `/billing` |
| `past_due`, `expired` | `blocked` | `/billing` |
| sem linha / cancelada / cancelamento agendado já vencido | `no_plan` | `/pricing` |
| sem JWT | `unauthenticated` | `/login` |

Carência de **renovação atrasada** na RPC: 5 dias (`current_period_end + 5 days` → `past_due_grace`). Isso **não é o mesmo** `ASAAS_GRACE_DAYS=3` do webhook. Duas janelas convivem.

Cancelamento agendado com `current_period_end` no passado é filtrado na RPC → `no_plan` (não manda para `/billing` como inadimplente). Correto.

### 3.5 Uso do produto com plano

- `SubscriptionGuard` envolve `/sistema/*`. Erro de RPC **não** rebaixa para `no_plan` (tela de retry).
- Features/limites: UI (`useFeature`/`useLimit`/`LimitGuard`) + triggers Postgres com `orbi_quota_lock` (advisory lock). UI sozinha não é autoridade.
- Upsell (`FeaturePageGuard`, `LimitGuard`, gráfico de assinaturas, “+” de limite) navega para `/pricing` **sem** `?change` — ver §5.

### 3.6 Cancelar / retomar

Decisão **sempre** no backend (`asaas-manage-subscription`):

- Período pago em curso (`active`/`trial` + `current_period_end > now`) → `cancel_at_period_end=true`, status permanece `active`, **DELETE** da subscription no Asaas. Ordem: **banco antes do Asaas** (o webhook `SUBSCRIPTION_DELETED` chega em ms).
- `pending` / `past_due` / período vencido → `status=canceled` na hora.
- Falha no Asaas desfaz o UPDATE. 404 Asaas = já removida = sucesso.
- `reactivate`: nova subscription Asaas, 1ª cobrança no fim do período atual. Falha ao gravar no banco deleta a subscription recém-criada.
- Assinar de novo pela página de preços, dentro do período, segue a mesma lógica de “não cobrar o intervalo já pago”.

UI: duas etapas, checkbox, botão destrutivo só após aceite. Não é um clique.

**Não há fallback automático para Free.** O dialog *mostra* o que o usuário perderia versus o plano Free, mas ao vencer o período a RPC devolve `no_plan` e o guard manda para `/pricing`.

### 3.7 Segunda via e bloqueio

- `/billing` só para autenticado. Se `allowed` → `/sistema`; se `no_plan` → `/pricing`.
- `invoice` busca cobrança `PENDING` ou `OVERDUE` no Asaas e devolve a URL.
- Botão “Já paguei, atualizar” chama `asaas-sync-subscription`.

---

## 4. Máquina de estados da assinatura

```
                    cadastro
                       │
                       ▼
                  (sem linha)  ──────────────────────────────► access = no_plan
                       │
          ┌────────────┼────────────────┐
          ▼            ▼                ▼
        Free         Pago             (admin ativa)
     activate_     create-payment
     free_plan         │
          │            ▼
          │         pending  ──► access = pending_payment ──► /billing
          │            │
          │            │ webhook CONFIRMED / sync
          │            ▼
          └──────►  active / trial  ──► access = allowed ──► /sistema
                       │
          ┌────────────┼─────────────────────────────┐
          ▼            ▼                             ▼
   cancel_at_period  overdue                      PUT upgrade
   _end = true       past_due ──► grace ──► expired/blocked
          │            │
          │            ▼
          │         /billing
          ▼
   current_period_end passa
          │
          ▼
       no_plan ──► /pricing
```

Estados no schema que **quase não são usados pelo checkout**: `trial` (coluna e seed `trial_days` existem; nenhum fluxo seta `trial_start/end`).

---

## 5. Falhas de navegação (fora do padrão de mercado)

Estas são as falhas relatadas (landing e preços) **confirmadas no código**, mais o efeito em cascata.

### 5.1 Landing `/` — usuário logado nunca vê marketing

```101:103:src/App.tsx
              <Route
                path="/"
                element={isAuthenticated ? <Navigate to="/sistema" replace /> : <Landing />}
              />
```

Qualquer sessão válida em `/` é substituída por `/sistema`. Não há query string de escape, não há “continuar como visitante”, o logo da landing (`Link to="/"`) num contexto autenticado nem chega a renderizar porque a rota nem monta o componente.

**Padrão de mercado (Notion, Linear, Stripe, Slack, Figma, Spotify, Netflix):** a home institucional é pública. Login muda o CTA (“Ir para o app”), não seqüestra a URL. Quem colou `orbi.app/` num e-mail, quem quer reler o pitch, quem compara o produto com o concorrente, precisa conseguir abrir a landing **logado**.

Efeito prático: loop. Usuário tenta voltar (botão do browser, digitou `/`, favorito) → `replace` para `/sistema` → tenta de novo → mesma coisa. O `replace` ainda apaga a entrada `/` do histórico, então o “voltar” do browser também não ajuda.

### 5.2 `/pricing` — plano ativo é expulso na hora

A rota em `App.tsx` é pública:

```106:106:src/App.tsx
              <Route path="/pricing" element={<Pricing />} />
```

Mas o próprio `Pricing.tsx` redireciona quem já tem acesso:

```322:333:src/pages/Pricing.tsx
      if (status?.access === 'allowed' && status?.plan_id) {
        setUserActivePlan(status.plan_id);

        const wantsPlanChange =
          new URLSearchParams(window.location.search).has('change')
          || localStorage.getItem('orbi_selected_plan') !== null;

        if (!wantsPlanChange) {
          navigate('/sistema', { replace: true });
        }
      }
```

Escape hatch previsto: `?change` **ou** `orbi_selected_plan` no localStorage.

**Nenhum CTA do produto usa `?change`.** Busca no repo: o único lugar que lê esse query param é o próprio `Pricing.tsx`. Todos os “Ver planos” / “Trocar de plano” / “Fazer upgrade” navegam para `'/pricing'` puro:

| Origem | O que o usuário espera | O que acontece se `access=allowed` |
|--------|------------------------|-------------------------------------|
| Configurações → Assinatura → “Trocar de plano” | Comparar e mudar de plano | Bounce imediato para `/sistema` |
| Configurações → “Ver planos” (Free) | Upgrade | Bounce |
| Dialog de cancelamento → “troque de plano” | Downgrade em vez de cancelar | Bounce |
| `FeaturePageGuard` / `LimitGuard` / `FeatureGuard` | Upgrade para desbloquear feature | Bounce |
| `select-with-add-button` (cota) | Ver planos | Bounce |
| `SubscriptionChart` | Ver planos | Bounce |
| `/billing` → “Ver planos” | OK — aqui `access` não é `allowed` | Funciona |

Resultado: **é impossível, pela UI, um assinante ativo chegar na página de preços.** O único jeito é colar ` /pricing?change` na barra de endereço — e ninguém vai descobrir isso.

**Padrão de mercado:** `/pricing` (ou `/plans`, `/billing/upgrade`) é visível logado, com o plano atual marcado (“Plano atual”) e CTAs de upgrade/downgrade. Stripe Billing Portal, Notion Settings → Plan, GitHub Pricing, Linear Settings → Billing — todos deixam o usuário **olhar** os planos sem perder o produto.

### 5.3 `/login` autenticado → `/sistema`

```123:126:src/App.tsx
              <Route 
                path="/login" 
                element={isAuthenticated ? <Navigate to="/sistema" replace /> : <AuthForm />} 
              />
```

Isso **é** padrão de mercado (não mostrar o form de login para quem já está dentro). Não misturar com os itens 5.1 e 5.2.

Exceção razoável a considerar depois: deep link `/login?next=/pricing?change` para o fluxo “escolhi plano na landing já logado em outro dispositivo”. Hoje não existe `next`.

### 5.4 Logout vai para `/pricing`, não para a landing

`useAuth.logout` e `Billing.handleLogout` navegam para `/pricing`. Depois de sair, a pessoa cai no catálogo, não na home. Aceitável, mas inconsistente com “landing como porta da marca”.

### 5.5 Loop combinado (o que o usuário descreveu)

1. Loga com plano → `resolvePostAuthRoute` → `/sistema`.
2. Tenta `/` → `Navigate` → `/sistema`.
3. Tenta `/pricing` (ou clica “Trocar de plano”) → `Pricing` vê `allowed` → `/sistema`.
4. Histórico com `replace: true` impede o botão voltar de pousar em `/` ou `/pricing`.

Isso não é “proteção de rota”. É seqüestro de URLs públicas.

### 5.6 Correção alvo (para implementação posterior — não feita neste documento)

- `/` sempre renderiza `Landing`. Se autenticado, só muda CTAs (“Abrir o Orbi”, “Sair”).
- `/pricing` sempre renderiza o catálogo. Se autenticado com plano, marca “Plano atual” (o código **já faz isso** via `userActivePlan`) e **não redireciona**.
- Remover o `useEffect` de expulsão em `Pricing.tsx` (linhas 325–333). O `?change` vira desnecessário.
- Manter `/login` e `/sistema` protegidos como estão.
- Opcional: `?next=` pós-login para não perder o contexto do CTA.

---

## 6. Demais falhas e pendências

Legenda: **P0** bloqueia venda/operação correta de dinheiro · **P1** UX/compliance incompletos · **P2** polish / dívida.

### 6.1 P0 — Dinheiro e acesso

| ID | Problema | Evidência | Risco |
|----|----------|-----------|--------|
| P0-1 | Landing e pricing seqüestrados (ver §5) | `App.tsx`, `Pricing.tsx` | Upgrade/downgrade pela UI impossível; conversão e suporte quebram |
| P0-2 | Downgrade para Free **não cancela** a subscription no Asaas | `activate_free_plan` e ramo `amount==0` de `asaas-create-payment` só mexem no Postgres | Cliente “vai para Free” e **continua sendo cobrado** |
| P0-3 | `admin_cancel_subscription` só faz `UPDATE status='canceled'` | `20251017120000_add_admin_functions.sql` | Admin “cancela” no painel e o Asaas segue gerando fatura |
| P0-4 | Checkout não coleta CPF/CNPJ | `Pricing` nunca passa `cpfCnpj`; `findOrCreateCustomer` cria customer sem documento | Asaas recusa PIX/boleto/NF para pessoa física BR sem CPF; falha opaca no toast |
| P0-5 | Após pagar, o app não fica sabendo sozinho | Sem polling, sem `successUrl`, `?payment=success` morto | Usuário paga, volta à aba do Orbi ainda `pending`, acha que não funcionou; depende de webhook + F5 ou “Já paguei” em `/billing` — e o checkout **nem manda** para `/billing` |
| P0-6 | Primeira assinatura paga deixa `status=pending` e o usuário **permanece em `/pricing`** com um dialog | `Pricing` só redireciona `allowed` | Fecha o dialog → tela de planos sem instrução clara; tenta `/sistema` → spinner → `/billing`. Fluxo quebrado de ponta a ponta |

### 6.2 P1 — Checkout, ciclo de vida, operação

| ID | Problema | Detalhe |
|----|----------|---------|
| P1-1 | Sem retorno do Asaas para o app | Criação da subscription não envia `successUrl` / `autoRedirectUrl` / `callback`. O usuário fica órfão na aba do gateway |
| P1-2 | `PaymentDialog` usa `window.open` após 1,5 s | Bloqueado por popup blocker; o dialog promete “Redirecionando…” e mente |
| P1-3 | Dialog **não** mostra PIX copia-e-cola / QR / boleto | `docs/INTEGRACAO_ASAAS.md` afirma o contrário. Colunas `pix_*` no banco nunca são escritas. Só há a URL da invoice |
| P1-4 | Sem histórico de pagamentos na conta do usuário | `payment_history` existe; admin soma receita do mês; o titular não vê faturas, recibos, NF |
| P1-5 | Sem troca de meio de pagamento in-app | Só via página Asaas da cobrança em aberto |
| P1-6 | Upgrade/downgrade é **imediato** (PUT) | Não há “vale no próximo ciclo”, nem preview de valor, nem crédito proporcional. Downgrade de Casal → Pro no meio do mês corta `familia_compartilhada` na hora |
| P1-7 | Trial não é produto | Schema + UI de badge “Período de teste” + métrica no admin. Checkout nunca cria `trial` |
| P1-8 | Duas janelas de carência | Webhook `ASAAS_GRACE_DAYS=3`; RPC `+ 5 days`. Estados divergem entre “Asaas atrasou” e “período local venceu” |
| P1-9 | Sem e-mail transacional Orbi | Confirmação de pagamento, dunning, “sua assinatura acaba em X” dependem só das notificações Asaas (`notificationDisabled: false`) |
| P1-10 | Cadastro não trata confirmação de e-mail | `signUp` → `/pricing` direto. Se o projeto exigir confirm e-mail, a sessão pode ser nula e o usuário cai em `/pricing` como visitante, escolhe plano, vai para `/login` de novo |
| P1-11 | Sem “esqueci minha senha” | Só troca de senha logado (`PasswordSettings`). Recuperação de conta inexistente |
| P1-12 | Plano Casal sem convite de verdade | Comentário no hook: “Sem e-mail transacional, sem token, sem página de aceite”. Parceiro precisa já ter (ou criar) conta com o **mesmo** e-mail |
| P1-13 | `onboarding_completed` no perfil nunca entra no fluxo de pagamento | Trigger cria perfil com `false`; não há wizard pós-plano |
| P1-14 | Logout / cancelamento agendado vencido → `/pricing`, mas se a pessoa ainda estiver logada e o cache da RPC atrasar, `SubscriptionGuard` e `Pricing` podem brigar | Edge case de corrida |
| P1-15 | Reprocesso de webhook com `process_error` é manual | 200 proposital; sem tela admin nem job |
| P1-16 | Documentação operacional defasada | `SAAS_SETUP.md` diz Asaas não implementado; `INTEGRACAO_ASAAS.md` descreve pagamento avulso e QR no dialog |

### 6.3 P1 — Compliance e confiança

| ID | Problema | Detalhe |
|----|----------|---------|
| P1-17 | Aceite legal da assinatura vive em `user_metadata` | Editável pelo próprio usuário; não é prova forte (LGPD art. 8º). Melhor tabela append-only |
| P1-18 | Termos prometem 7 dias de arrependimento (CDC art. 49) | Não há fluxo de estorno in-app. Só o caminho Asaas (admin/manual) |
| P1-19 | Política fala em NF e histórico por 5 anos | Não há emissão de NF pelo Orbi nem listagem para o titular |
| P1-20 | `recordLegalConsent` não bloqueia se o `updateUser` falhar | Comentário admite isso. Cobrança segue sem trilha |

### 6.4 P2 — Dívida, consistência, admin

| ID | Problema | Detalhe |
|----|----------|---------|
| P2-1 | `asaas-create-customer` quase não é chamado pelo front | Customer é criado dentro de `asaas-create-payment`. A function isolada é reserva |
| P2-2 | `PaymentResponse` / docs ainda falam `paymentMethod` e `invoiceUrl` | Hook devolve `{ id, url, value, dueDate, billingType }` |
| P2-3 | Feature `dashboard: false` no seed Free, mas `dashboard` é `isCore` | Inconsistência de catálogo; a rota `/sistema` não está atrás de `FeaturePageGuard` de dashboard |
| P2-4 | Admin não mostra `cancel_at_period_end`, `asaas_subscription_id`, 2ª via, sync | Lista + cancelar local |
| P2-5 | Admin “ativar plano” (`admin_activate_plan_for_user`) não cria cobrança | Pode entregar Pro de graça sem linha no Asaas — útil para cortesia, perigoso se usado como “assinatura paga” |
| P2-6 | Sem cupom / código promocional | Mencionado só como ideia em `INTEGRACAO_ASAAS.md` |
| P2-7 | Sem escolha in-app de PIX vs boleto vs cartão | `UNDEFINED` na invoice Asaas. OK como MVP se o retorno ao app existir |
| P2-8 | `usePayment.createPayment` invalida a query de status, mas o dialog não observa virar `active` | Mesmo com webhook rápido, a UI do checkout não celebra |
| P2-9 | Múltiplas linhas `user_subscriptions` | Sempre cancela as “stale”, mas não há unique constraint “uma ativa por usuário” |
| P2-10 | `INTEGRACAO_ASAAS.md` checklist ainda tem “configurar secrets / deploy / testar sandbox” | Precisa virar runbook atual com o que já está no `config.toml` |

### 6.5 O que já está sólido (não reabrir sem motivo)

- RPC `get_my_subscription_status` como autoridade; cliente não escreve acesso.
- `SubscriptionGuard` não trata erro de rede como `no_plan` (já quebrou contas Pro no passado).
- Cancelamento em 2 etapas + `cancel_at_period_end` + ordem banco→Asaas + preservação do período pago no webhook e no sync.
- Reativação cria subscription nova com 1ª cobrança no fim do período.
- Idempotência de webhook + token obrigatório + rate limit.
- Gates `strict` nas rotas de dinheiro; sync fail-open para não barrar login.
- Triggers de cota com `pg_advisory_xact_lock`.
- Aceite de termos no cadastro + dialog específico na cobrança (mesmo que a prova esteja fraca, a UI está certa).
- Seed de planos por UPSERT (não apaga assinaturas).
- Billing page de bloqueio sem vazar dados do sistema.

---

## 7. Jornadas a cobrir para declarar o módulo fechado

Checklist de aceite (produto). Cada item precisa funcionar **logado e deslogado**, desktop e mobile, sandbox Asaas.

### Visitante

- [ ] Abrir `/` e `/pricing` sem conta.
- [ ] Escolher plano na landing → cadastro → consentimento → invoice Asaas.
- [ ] Escolher plano já na `/pricing` → login → retomada do plano salvo (`orbi_selected_plan`, TTL 1 h).
- [ ] Plano Free → entra no `/sistema` na hora.
- [ ] Plano pago → após pagar, entra no `/sistema` **sem** truque manual.

### Assinante ativo (o buraco atual)

- [ ] Logado, abrir `/` e **permanecer** na landing.
- [ ] Logado, abrir `/pricing` e **ver** os três planos, com o atual marcado.
- [ ] Em Configurações, “Trocar de plano” chegar em `/pricing` e concluir upgrade.
- [ ] `FeaturePageGuard` “Ver planos” chegar em `/pricing` (não voltar ao dashboard).
- [ ] Comparar anual vs mensal sem ser expulso.

### Pagamento

- [ ] CPF válido no checkout (obrigatório para PF).
- [ ] PIX, boleto e cartão na invoice Asaas.
- [ ] Popup bloqueado → botão “Ir para o pagamento” ainda funciona.
- [ ] Voltar ao Orbi com assinatura já `active` (redirect ou polling).
- [ ] Cobrança recusada / vencida → `/billing` com 2ª via.
- [ ] “Já paguei” reconcilia sem webhook.

### Ciclo de vida

- [ ] Cancelar com período pago → acesso até a data; Asaas sem próxima fatura.
- [ ] Retomar → sem cobrança imediata.
- [ ] Cancelar `pending`/`past_due` → corte na hora.
- [ ] Admin cancelar → Asaas também para.
- [ ] Downgrade para Free → Asaas cancelado.
- [ ] Estorno/chargeback → acesso cai; não ressuscita `canceled` indevido.

### Conta

- [ ] Esqueci senha.
- [ ] Confirmação de e-mail (se habilitada no projeto) não perde o plano escolhido.
- [ ] Histórico de cobranças visível.
- [ ] Plano Casal: convite que o parceiro entende o que fazer.

---

## 8. Sequência sugerida de implementação (quando for a hora)

Não é escopo deste documento executar. Ordem que destrava o módulo sem retrabalho:

1. **Navegação pública** — tirar o `Navigate` de `/` e o redirect de `/pricing` quando `allowed`. Ajustar CTAs da landing para sessão existente (“Abrir o Orbi”). Um PR pequeno, desbloqueia upgrade.
2. **Money-leak** — `activate_free_plan` / downgrade Free / `admin_cancel_subscription` precisam DELETE (ou equivalente) no Asaas, com a mesma disciplina do `asaas-manage-subscription` (banco primeiro, rollback se o gateway falhar, 404 = ok).
3. **Checkout** — CPF obrigatório; após criar cobrança, ir para `/billing` (ou tela de “aguardando pagamento”) em vez de ficar em `/pricing`; polling curto + `successUrl` da invoice de volta ao app.
4. **Histórico + 2ª via na Configurações** — listar `payment_history` do titular... Criar/Aba em configurações pra essa listagem
6. **Cupom / NF / e-mail** — só depois dos cinco acima. Não são o que impede a primeira cobrança honesta.
7.E-mail de comprovante e E-mails obrigatórios comercialmente, vamos utilizar resend, com toda segurança ratelimit , cors , esconder key e tudo, mas somente implementar resend pra isso se precisar mesmo muito, perguntar com /plan .

---

## 9. Mapa rápido de arquivos

```
src/App.tsx                                          rotas + sequestro de /
src/pages/Pricing.tsx                                catálogo + sequestro de /pricing
src/pages/Billing.tsx                                bloqueio / 2ª via
src/pages/Landing.tsx + components/landing/*         marketing
src/hooks/use-auth.ts                                pós-login / cadastro / logout
src/hooks/use-subscription.ts                        RPC de status + catálogo de planos
src/hooks/use-payment.ts                             invoke das Edge Functions
src/components/guards/SubscriptionGuard.tsx          porta de /sistema
src/components/guards/FeatureGuard.tsx               upsell → /pricing (sem ?change)
src/components/settings/SubscriptionSettings.tsx     gestão da assinatura
src/components/settings/CancelSubscriptionDialog.tsx cancelamento 2 etapas
src/components/payment/PaymentDialog.tsx             abre invoice Asaas
src/components/legal/*                               aceite LGPD/CDC

supabase/functions/asaas-create-payment/index.ts
supabase/functions/asaas-manage-subscription/index.ts
supabase/functions/asaas-webhook-handler/index.ts
supabase/functions/asaas-sync-subscription/index.ts
supabase/functions/asaas-create-customer/index.ts
supabase/functions/_shared/asaas.ts
supabase/functions/_shared/gate.ts

supabase/migrations/20260909140000_fix_activate_free_plan_rpc.sql
supabase/migrations/20260911120000_subscription_cancel_at_period_end.sql
supabase/migrations/20260910120003_seed_business_plans.sql
supabase/migrations/20260908000000_asaas_security_hardening.sql
```

---

## 10. Notas para quem for corrigir a navegação

O redirect de `/pricing` foi introduzido com a intenção de “conta com plano vigente nunca fica presa na tela de ativação”. A intenção é válida **só no pós-cadastro automático** (usuário autenticado sem `?change` que caiu em `/pricing` porque o login mandou `no_plan`… espera: se tem plano `allowed`, o login já manda para `/sistema`. O único jeito de um `allowed` aterrissar em `/pricing` é **clicar** num CTA de planos. Ou seja: o `useEffect` que expulsa `allowed` **só dispara no caminho que o produto deveria permitir**.

Não é proteção contra tela de ativação. É um tiro no próprio upgrade.

Para o pós-cadastro (C1: conta nova → `/pricing`), `access` é `no_plan`, então o `if (access === 'allowed')` **já não pega**. Remover o redirect não prende conta nova na tela de planos contra a vontade — ela está lá de propósito.

---

*Gerado a partir do código em 11/09/2026. Próxima revisão: depois dos P0.*
