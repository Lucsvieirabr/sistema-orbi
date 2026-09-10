# 📚 Documentação Completa - Sistema Orbi

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Tecnologias Utilizadas](#tecnologias-utilizadas)
3. [Arquitetura do Sistema](#arquitetura-do-sistema)
4. [Estrutura de Banco de Dados](#estrutura-de-banco-de-dados)
5. [Rotas e Navegação](#rotas-e-navegação)
6. [Funcionalidades Principais](#funcionalidades-principais)
7. [Sistema SaaS](#sistema-saas)
8. [Edge Functions](#edge-functions)
9. [Hooks Customizados](#hooks-customizados)
10. [Componentes Principais](#componentes-principais)
11. [Autenticação e Segurança](#autenticação-e-segurança)
12. [Configuração e Deploy](#configuração-e-deploy)
13. [Estrutura de Pastas](#estrutura-de-pastas)

---

## 🎯 Visão Geral

O **Sistema Orbi** é uma plataforma SaaS completa de gestão financeira pessoal e empresarial desenvolvida em React com TypeScript. O sistema oferece controle de contas, transações, cartões de crédito, categorização inteligente com Machine Learning, relatórios avançados e muito mais.

### Principais Características

- 💳 Gestão completa de contas bancárias e cartões de crédito
- 🤖 Classificação inteligente de transações com Machine Learning
- 📊 Dashboard com métricas e gráficos em tempo real
- 🔄 Controle de parcelamentos e transações recorrentes
- 👥 Gestão de pessoas e transações compartilhadas
- 📈 Relatórios mensais detalhados
- 🏢 Sistema SaaS multi-tenant com planos de assinatura
- 💰 Integração com gateway de pagamentos Asaas
- 🔐 Painel administrativo completo
- 🌓 Tema claro/escuro
- 📱 Interface responsiva

---

## 🛠️ Tecnologias Utilizadas

### Frontend

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **React** | 18.3.1 | Biblioteca para construção de interfaces |
| **TypeScript** | 5.8.3 | Superset JavaScript com tipagem estática |
| **Vite** | 5.4.19 | Build tool e dev server ultra-rápido |
| **React Router** | 6.30.1 | Roteamento de aplicações React |
| **TanStack Query** | 5.83.0 | Gerenciamento de estado assíncrono |
| **Tailwind CSS** | 3.4.17 | Framework CSS utility-first |
| **shadcn/ui** | - | Componentes UI com Radix UI |
| **Lucide React** | 0.544.0 | Biblioteca de ícones |
| **Recharts** | 2.15.4 | Biblioteca de gráficos para React |
| **date-fns** | 3.6.0 | Manipulação de datas |
| **zod** | 3.25.76 | Validação de schemas |
| **react-hook-form** | 7.61.1 | Gerenciamento de formulários |
| **PapaParse** | 5.5.3 | Parser de CSV |

### Backend

| Tecnologia | Descrição |
|------------|-----------|
| **Supabase** | Backend-as-a-Service (PostgreSQL + Auth + Storage) |
| **PostgreSQL** | Banco de dados relacional |
| **Deno** | Runtime para Edge Functions |
| **Row Level Security (RLS)** | Segurança a nível de linha no PostgreSQL |

### Infraestrutura e Deploy

| Tecnologia | Descrição |
|------------|-----------|
| **Netlify** | Deploy e hospedagem do frontend |
| **Supabase Cloud** | Hospedagem do backend |
| **Nginx** | Servidor web (configuração incluída) |

### Integrações Externas

| Serviço | Uso |
|---------|-----|
| **Asaas** | Gateway de pagamentos (PIX, Boleto, Cartão) |

---

## 🏗️ Arquitetura do Sistema

### Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Public    │  │    User      │  │    Admin     │  │
│  │   Routes    │  │   Routes     │  │   Routes     │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / REST API
                         ▼
┌─────────────────────────────────────────────────────────┐
│                SUPABASE (Backend)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│  │   Auth   │  │   API    │  │   Edge Functions     │ │
│  └──────────┘  └──────────┘  └──────────────────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│  │ Database │  │ Storage  │  │   Realtime (WS)      │ │
│  └──────────┘  └──────────┘  └──────────────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ Webhooks
                         ▼
┌─────────────────────────────────────────────────────────┐
│              ASAAS (Pagamentos)                          │
│     PIX │ Boleto │ Cartão de Crédito                    │
└─────────────────────────────────────────────────────────┘
```

### Fluxo de Dados

1. **Autenticação**: Usuário faz login via Supabase Auth
2. **Autorização**: RLS valida permissões no PostgreSQL
3. **Estado**: TanStack Query gerencia cache e sincronização
4. **Realtime**: Updates automáticos via WebSocket
5. **Pagamentos**: Edge Functions comunicam com Asaas
6. **Storage**: Logos e imagens no Supabase Storage

### Padrões de Design

- **Component-Based Architecture**: Componentes reutilizáveis
- **Custom Hooks**: Lógica de negócio encapsulada
- **Layouts**: Layouts compartilhados para diferentes áreas
- **Guards**: Proteção de rotas baseada em permissões
- **API Layer**: Abstração com Supabase Client

---

## 🗄️ Estrutura de Banco de Dados

### Principais Tabelas

#### Tabelas de Usuários

**`user_profiles`**
```sql
- id (UUID, PK)
- email (TEXT)
- full_name (TEXT)
- avatar_url (TEXT)
- asaas_customer_id (TEXT) -- ID no gateway de pagamento
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**`admin_users`**
```sql
- id (UUID, PK)
- user_id (UUID, FK -> auth.users)
- role (TEXT) -- 'super_admin', 'admin', 'support'
- is_active (BOOLEAN)
- permissions (JSONB)
- created_at (TIMESTAMP)
```

#### Tabelas Financeiras

**`accounts`** - Contas bancárias
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- name (TEXT)
- type (TEXT) -- 'corrente', 'poupanca', 'investimento'
- initial_balance (DECIMAL)
- color (TEXT)
- created_at (TIMESTAMP)
```

**`transactions`** - Transações financeiras
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- account_id (UUID, FK)
- category_id (UUID, FK)
- series_id (UUID, FK) -- Para parcelamentos
- person_id (UUID, FK) -- Pessoa relacionada
- description (TEXT)
- value (DECIMAL)
- date (DATE)
- type (TEXT) -- 'income', 'expense'
- status (TEXT) -- 'pending', 'confirmed', 'canceled'
- is_fixed (BOOLEAN) -- Transação recorrente
- is_shared (BOOLEAN) -- Transação compartilhada
- installment_number (INTEGER)
- composition_details (JSONB)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**`credit_cards`** - Cartões de crédito
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- name (TEXT)
- brand (TEXT) -- 'visa', 'mastercard', 'elo'
- limit (DECIMAL)
- statement_date (INTEGER) -- Dia fechamento
- due_date (INTEGER) -- Dia vencimento
- connected_account_id (UUID, FK) -- Conta vinculada
- created_at (TIMESTAMP)
```

**`categories`** - Categorias de transações
```sql
- id (UUID, PK)
- user_id (UUID, FK) -- NULL para categorias globais
- name (TEXT)
- icon (TEXT)
- category_type (TEXT) -- 'income', 'expense'
- is_system (BOOLEAN) -- Categoria do sistema
- created_at (TIMESTAMP)
```

**`series`** - Séries de parcelamentos
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- description (TEXT)
- total_installments (INTEGER)
- total_value (DECIMAL)
- category_id (UUID, FK)
- is_recurring (BOOLEAN)
- recurrence_type (TEXT) -- 'monthly', 'weekly'
- created_at (TIMESTAMP)
```

**`people`** - Pessoas relacionadas
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- name (TEXT)
- email (TEXT)
- phone (TEXT)
- cpf_cnpj (TEXT)
- pix_key (TEXT)
- notes (TEXT)
- created_at (TIMESTAMP)
```

#### Tabelas SaaS

**`subscription_plans`** - Planos de assinatura
```sql
- id (UUID, PK)
- name (TEXT) -- 'Free', 'Pro', 'Premium'
- slug (TEXT, UNIQUE)
- description (TEXT)
- monthly_price (DECIMAL)
- annual_price (DECIMAL)
- features (TEXT[])
- limits (JSONB)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
```

**`user_subscriptions`** - Assinaturas dos usuários
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- plan_id (UUID, FK)
- status (TEXT) -- 'trial', 'active', 'past_due', 'canceled'
- billing_cycle (TEXT) -- 'monthly', 'annual'
- current_period_start (DATE)
- current_period_end (DATE)
- asaas_subscription_id (TEXT)
- created_at (TIMESTAMP)
```

**`payment_history`** - Histórico de pagamentos
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- subscription_id (UUID, FK)
- asaas_payment_id (TEXT)
- amount (DECIMAL)
- status (TEXT) -- 'pending', 'confirmed', 'failed'
- payment_method (TEXT) -- 'PIX', 'BOLETO', 'CREDIT_CARD'
- invoice_url (TEXT)
- bank_slip_url (TEXT)
- pix_qr_code (TEXT)
- pix_copy_paste (TEXT)
- paid_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

#### Tabelas de ML e Cache

**`learned_patterns`** - Padrões aprendidos por ML
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- normalized_merchant (TEXT)
- category_id (UUID, FK)
- confidence (DECIMAL)
- usage_count (INTEGER)
- last_used_at (TIMESTAMP)
```

**`merchants_dictionary`** - Dicionário de comerciantes
```sql
- id (UUID, PK)
- original_name (TEXT)
- normalized_name (TEXT)
- category_id (UUID, FK)
- confidence (DECIMAL)
```

**`keyword_patterns`** - Padrões de palavras-chave
```sql
- id (UUID, PK)
- keyword (TEXT)
- category_id (UUID, FK)
- weight (DECIMAL)
- context (TEXT)
```

#### Outras Tabelas

**`notes`** - Notas/Anotações
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- title (TEXT)
- content (TEXT)
- color (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**`bug_reports`** - Relatórios de bugs
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- title (TEXT)
- description (TEXT)
- severity (TEXT) -- 'low', 'medium', 'high', 'critical'
- status (TEXT) -- 'open', 'in_progress', 'resolved'
- created_at (TIMESTAMP)
```

**`audit_logs`** - Logs de auditoria
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- entity_type (TEXT)
- entity_id (UUID)
- action (TEXT) -- 'create', 'update', 'delete'
- old_data (JSONB)
- new_data (JSONB)
- metadata (JSONB)
- created_at (TIMESTAMP)
```

### Views Importantes

**`vw_account_current_balance`** - Saldo atual das contas
```sql
SELECT account_id, SUM(value) as current_balance
FROM transactions
WHERE status = 'confirmed'
GROUP BY account_id
```

### Funções SQL Importantes

- `is_admin()` - Verifica se usuário é admin
- `get_user_plan()` - Retorna plano do usuário
- `user_has_feature(feature)` - Verifica se usuário tem feature
- `admin_list_users()` - Lista usuários (apenas admin)
- `create_installment_series()` - Cria série de parcelamentos
- `update_transaction_series()` - Atualiza série de transações
- `search_merchant()` - Busca comerciante no dicionário

### Row Level Security (RLS)

Todas as tabelas têm políticas RLS configuradas:

```sql
-- Exemplo: Usuários só veem seus próprios dados
CREATE POLICY "Users can view own data"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins veem tudo
CREATE POLICY "Admins can view all"
  ON transactions FOR SELECT
  USING (is_admin());
```

---

## 🗺️ Rotas e Navegação

### Estrutura de Rotas

```typescript
/ (root)
├── /pricing                    [Público] Página de planos
├── /login                      [Público] Login de usuários
├── /admin                      [Público] Login administrativo
│
├── /sistema                    [Protegido] Área do usuário
│   ├── / (index)              → Dashboard
│   ├── /statement             → Extrato Mensal
│   ├── /categories            → Gestão de Categorias
│   ├── /accounts              → Gestão de Contas
│   ├── /cards                 → Gestão de Cartões
│   ├── /cards/:id/statements  → Fatura do Cartão
│   ├── /people                → Gestão de Pessoas
│   ├── /people/:id            → Detalhes da Pessoa
│   ├── /my-ai                 → IA - Classificação ML
│   ├── /notes                 → Notas/Anotações
│   └── /settings              → Configurações
│
└── /admin                      [Protegido Admin] Painel Admin
    ├── /dashboard             → Dashboard Admin
    ├── /users                 → Gestão de Usuários
    ├── /plans                 → Gestão de Planos
    ├── /subscriptions         → Gestão de Assinaturas
    ├── /admins                → Gestão de Admins
    └── /bug-reports           → Relatórios de Bugs
```

### Fluxo de Autenticação

```
┌─────────────┐
│   Usuário   │
└──────┬──────┘
       │
       ├──────► Não autenticado ──────► /pricing ou /login
       │
       └──────► Autenticado
                    │
                    ├──────► Sem assinatura ──────► /pricing
                    │
                    ├──────► Com assinatura ativa ──────► /sistema
                    │
                    └──────► É admin ──────► /admin/*
```

### Componentes de Layout

#### `AppLayout`
Layout principal para usuários autenticados:
- Header com busca global
- Sidebar com navegação
- Outlet para conteúdo dinâmico

#### `AdminLayout`
Layout para painel administrativo:
- Header admin
- Sidebar admin
- Outlet para páginas admin

---

## ⚙️ Funcionalidades Principais

### 1. Dashboard

**Página**: `/sistema`

Características:
- ✅ Saldo total de todas as contas
- ✅ Gráfico de evolução mensal
- ✅ Resumo de receitas e despesas
- ✅ Transações recentes
- ✅ Alertas de vencimentos
- ✅ Métricas de cartões de crédito

### 2. Extrato Mensal

**Página**: `/sistema/statement`

Características:
- ✅ Visualização mensal de transações
- ✅ Filtros por conta, categoria, pessoa
- ✅ Adicionar/Editar/Excluir transações
- ✅ Marcar como pago/pendente
- ✅ Parcelamento de transações
- ✅ Transações compartilhadas
- ✅ Upload de CSV bancário
- ✅ Classificação automática com ML
- ✅ Exportação de relatórios

**Upload de Extrato (CSV)**:
- Parser inteligente de CSV
- Detecção automática de bancos
- Normalização de descrições
- Cache de classificações
- Machine Learning para categorização

### 3. Gestão de Categorias

**Página**: `/sistema/categories`

Características:
- ✅ Categorias de receita e despesa
- ✅ Ícones personalizáveis
- ✅ Categorias do sistema (não editáveis)
- ✅ Categorias customizadas por usuário
- ✅ Estatísticas de uso

### 4. Gestão de Contas

**Página**: `/sistema/accounts`

Características:
- ✅ Criar múltiplas contas
- ✅ Tipos: Corrente, Poupança, Investimento
- ✅ Saldo inicial configurável
- ✅ Cores personalizadas
- ✅ Cálculo automático de saldo atual
- ✅ Histórico de transações

### 5. Gestão de Cartões de Crédito

**Página**: `/sistema/cards`

Características:
- ✅ Cadastro de múltiplos cartões
- ✅ Limite, data de fechamento e vencimento
- ✅ Vinculação com conta bancária
- ✅ Faturas mensais
- ✅ Controle de limite disponível
- ✅ Parcelamentos

**Fatura do Cartão**: `/sistema/cards/:id/statements`
- Transações do período
- Total da fatura
- Pagamento da fatura
- Exportação

### 6. Gestão de Pessoas

**Página**: `/sistema/people`

Características:
- ✅ Cadastro de pessoas físicas/jurídicas
- ✅ CPF/CNPJ, email, telefone
- ✅ Chave PIX
- ✅ Notas sobre a pessoa
- ✅ Transações relacionadas
- ✅ Débitos e créditos

**Detalhes da Pessoa**: `/sistema/people/:id`
- Histórico completo de transações
- Saldo devedor/credor
- Gráficos de movimentação

### 7. My AI - Classificação Inteligente

**Página**: `/sistema/my-ai`

Características:
- ✅ Machine Learning para classificação
- ✅ Padrões aprendidos
- ✅ Cache inteligente
- ✅ Dicionário de comerciantes
- ✅ Análise de palavras-chave
- ✅ Treinamento do modelo
- ✅ Histórico de acertos

**Algoritmo de ML**:
```
1. Normaliza descrição da transação
2. Busca em cache de padrões aprendidos
3. Consulta dicionário de comerciantes
4. Analisa palavras-chave com pesos
5. Aplica confiança baseada em uso
6. Retorna categoria sugerida
7. Aprende com confirmações do usuário
```

### 8. Notas

**Página**: `/sistema/notes`

Características:
- ✅ Criação de notas
- ✅ Cores personalizadas
- ✅ Editor de texto
- ✅ Busca de notas
- ✅ Organização por data

### 9. Configurações

**Página**: `/sistema/settings`

Características:
- ✅ Perfil do usuário
- ✅ Tema claro/escuro
- ✅ Notificações
- ✅ Preferências
- ✅ Dados da assinatura
- ✅ Histórico de pagamentos

---

## 💼 Sistema SaaS

### Arquitetura Multi-Tenant

O sistema implementa SaaS com:
- ✅ Múltiplos planos de assinatura
- ✅ Isolamento de dados por usuário (RLS)
- ✅ Controle de features por plano
- ✅ Limites por plano
- ✅ Billing e pagamentos
- ✅ Painel administrativo

### Planos de Assinatura

#### **Free**
```
Preço: R$ 0,00
Features:
- ✅ Dashboard básico
- ✅ Categorização manual
- ✅ 2 contas
- ✅ 1 cartão de crédito
- ✅ 100 transações/mês
- ✅ 3 pessoas
- ✅ Retenção: 6 meses
```

#### **Pro**
```
Preço: R$ 29,90/mês ou R$ 299,00/ano
Features:
- ✅ Todas do Free
- ✅ Classificação ML
- ✅ Relatórios avançados
- ✅ Exportação CSV
- ✅ Logos customizados
- ✅ Categorias customizadas
- ✅ Upload em massa
- ✅ Suporte prioritário
- ✅ 10 contas
- ✅ 5 cartões
- ✅ 1000 transações/mês
- ✅ 10 pessoas
- ✅ Retenção: 24 meses
```

#### **Premium**
```
Preço: R$ 59,90/mês ou R$ 599,00/ano
Features:
- ✅ Todas do Pro
- ✅ Recursos ilimitados
- ✅ API access
- ✅ White-label
- ✅ Suporte dedicado
- ✅ Relatórios personalizados
```

### Controle de Features

**Hook `useSubscription`**:
```typescript
const { 
  subscription,     // Dados da assinatura
  plan,            // Dados do plano
  hasFeature,      // Verifica se tem feature
  checkLimit,      // Verifica limite
  isPro,           // É plano Pro?
  isPremium        // É plano Premium?
} = useSubscription();

// Verificar feature
if (!hasFeature('ml_classification')) {
  return <UpgradePrompt />;
}

// Verificar limite
if (!checkLimit('max_accounts', currentCount)) {
  return <LimitReached />;
}
```

### Features Disponíveis

```typescript
const FEATURES = {
  // Básicas
  basic_dashboard: 'Dashboard Básico',
  manual_categorization: 'Categorização Manual',
  
  // Pro
  csv_export: 'Exportação CSV',
  ml_classification: 'Classificação ML',
  advanced_reports: 'Relatórios Avançados',
  priority_support: 'Suporte Prioritário',
  logo_customization: 'Logos Personalizados',
  custom_categories: 'Categorias Customizadas',
  bulk_import: 'Importação em Massa',
  scheduled_reports: 'Relatórios Agendados',
  
  // Premium
  api_access: 'Acesso à API',
  white_label: 'White Label',
  dedicated_support: 'Suporte Dedicado',
  custom_integrations: 'Integrações Customizadas'
};
```

### Limites por Plano

```typescript
const PLAN_LIMITS = {
  free: {
    max_accounts: 2,
    max_transactions_per_month: 100,
    max_credit_cards: 1,
    max_people: 3,
    retention_months: 6
  },
  pro: {
    max_accounts: 10,
    max_transactions_per_month: 1000,
    max_credit_cards: 5,
    max_people: 10,
    retention_months: 24
  },
  premium: {
    max_accounts: -1,  // Ilimitado
    max_transactions_per_month: -1,
    max_credit_cards: -1,
    max_people: -1,
    retention_months: -1
  }
};
```

### Integração com Asaas

**Gateway de Pagamentos**: Asaas

**Métodos de Pagamento**:
- ✅ PIX (instantâneo)
- ✅ Boleto Bancário
- ✅ Cartão de Crédito

**Fluxo de Pagamento**:

```
1. Usuário escolhe plano em /pricing
2. Sistema cria customer no Asaas (se não existir)
3. Gera cobrança via Edge Function
4. Mostra dados de pagamento (PIX/Boleto)
5. Usuário realiza pagamento
6. Asaas envia webhook
7. Sistema ativa assinatura
8. Usuário recebe acesso
```

**Edge Functions de Pagamento**:
- `asaas-create-customer` - Cria customer
- `asaas-create-payment` - Cria cobrança
- `asaas-webhook-handler` - Processa webhooks

### Painel Administrativo

**Acesso**: `/admin`

**Funcionalidades**:

1. **Dashboard** (`/admin/dashboard`)
   - Total de usuários
   - Receita mensal
   - Conversões
   - Métricas gerais

2. **Gestão de Usuários** (`/admin/users`)
   - Listar todos os usuários
   - Editar plano do usuário
   - Ativar/Desativar usuários
   - Ver detalhes completos
   - Histórico de pagamentos

3. **Gestão de Planos** (`/admin/plans`)
   - CRUD de planos
   - Configurar features
   - Definir limites
   - Ativar/Desativar planos

4. **Gestão de Assinaturas** (`/admin/subscriptions`)
   - Todas as assinaturas
   - Filtros por status
   - Cancelar assinaturas
   - Renovações

5. **Gestão de Admins** (`/admin/admins`)
   - Adicionar administradores
   - Definir permissões
   - Ativar/Desativar

6. **Relatórios de Bugs** (`/admin/bug-reports`)
   - Bugs reportados por usuários
   - Prioridade e status
   - Responder e resolver

---

## 🔧 Edge Functions

### Localização

`/supabase/functions/`

### Funções Disponíveis

#### 1. `classify-transactions`

**Descrição**: Classifica transações usando ML

**Entrada**:
```json
{
  "descriptions": ["UBER *EATS", "NETFLIX", "MERCADO LIVRE"]
}
```

**Saída**:
```json
{
  "classifications": [
    { "category": "Alimentação", "confidence": 0.95 },
    { "category": "Assinaturas", "confidence": 0.98 },
    { "category": "Compras Online", "confidence": 0.85 }
  ]
}
```

#### 2. `asaas-create-customer`

**Descrição**: Cria customer no Asaas

**Entrada**:
```json
{
  "userId": "uuid",
  "userEmail": "email@example.com",
  "userName": "John Doe",
  "cpfCnpj": "12345678901",
  "phone": "11999999999"
}
```

**Saída**:
```json
{
  "success": true,
  "customerId": "cus_xxxxx"
}
```

#### 3. `asaas-create-payment`

**Descrição**: Cria cobrança no Asaas

**Entrada**:
```json
{
  "planId": "uuid",
  "billingCycle": "monthly",
  "paymentMethod": "PIX"
}
```

**Saída**:
```json
{
  "success": true,
  "payment": {
    "id": "pay_xxxxx",
    "value": 29.90,
    "dueDate": "2025-11-19",
    "invoiceUrl": "https://...",
    "pixQrCode": "https://...",
    "pixCopyPaste": "00020126..."
  }
}
```

#### 4. `asaas-webhook-handler`

**Descrição**: Processa webhooks do Asaas

**Eventos Tratados**:
- `PAYMENT_CONFIRMED` - Ativa assinatura
- `PAYMENT_RECEIVED` - Registra pagamento
- `PAYMENT_OVERDUE` - Marca como vencido
- `PAYMENT_REFUNDED` - Processa reembolso
- `SUBSCRIPTION_CREATED` - Cria assinatura
- `SUBSCRIPTION_UPDATED` - Atualiza dados
- `SUBSCRIPTION_CANCELED` - Cancela assinatura

---

## 🎣 Hooks Customizados

### Localização

`/src/hooks/`

### Hooks Disponíveis

#### Autenticação

```typescript
// use-auth.ts
const { user, signIn, signUp, signOut, isLoading } = useAuth();

// use-admin-auth.ts
const { isAdmin, permissions } = useAdminAuth();
```

#### Dados Financeiros

```typescript
// use-accounts.ts
const { accounts, addAccount, updateAccount, deleteAccount } = useAccounts();

// use-transactions.ts
const { transactions, addTransaction, updateTransaction } = useMonthlyTransactions();

// use-credit-cards.ts
const { cards, addCard, updateCard, deleteCard } = useCreditCards();

// use-categories.ts
const { categories, addCategory, updateCategory } = useCategories();

// use-people.ts
const { people, addPerson, updatePerson, deletePerson } = usePeople();
```

#### SaaS

```typescript
// use-subscription.ts
const { 
  subscription, 
  plan, 
  hasFeature, 
  checkLimit,
  isLoading 
} = useSubscription();

// use-payment.ts
const { 
  createPayment, 
  paymentData, 
  isLoading 
} = usePayment();
```

#### ML e Cache

```typescript
// use-learned-patterns.ts
const { 
  patterns, 
  learnPattern, 
  getPatternForMerchant 
} = useLearnedPatterns();
```

#### UI

```typescript
// use-theme.tsx
const { theme, setTheme } = useTheme(); // 'light' | 'dark'

// use-mobile.tsx
const { isMobile } = useMobile();

// use-toast.ts
const { toast } = useToast();
```

---

## 🧩 Componentes Principais

### Componentes de Autenticação

#### `AuthForm`
**Localização**: `/src/components/auth/AuthForm.tsx`

Formulário de login/cadastro com:
- ✅ Login com email/senha
- ✅ Cadastro de novos usuários
- ✅ Validação de formulário
- ✅ Estados de loading

#### `AdminAuthForm`
**Localização**: `/src/admin/components/AdminAuthForm.tsx`

Formulário de login administrativo com:
- ✅ Visual diferenciado
- ✅ Validação de permissões admin
- ✅ Redirecionamento específico

### Componentes de Dashboard

#### `Dashboard`
**Localização**: `/src/components/dashboard/Dashboard.tsx`

Dashboard principal com:
- ✅ Cards de métricas
- ✅ Gráficos de evolução
- ✅ Transações recentes
- ✅ Alertas e notificações

#### `SubscriptionChart`
**Localização**: `/src/components/dashboard/SubscriptionChart.tsx`

Gráfico de assinaturas (admin):
- ✅ Visualização mensal
- ✅ Comparação de planos
- ✅ Métricas de conversão

### Componentes de Extrato

#### `ExtratoUploader`
**Localização**: `/src/components/extrato-uploader/ExtratoUploader.tsx`

Upload de CSV bancário:
- ✅ Drag and drop
- ✅ Parser inteligente
- ✅ Preview de dados
- ✅ Classificação automática
- ✅ Confirmação antes de salvar

**Componentes Auxiliares**:
- `CSVParser.ts` - Parser básico
- `EnhancedCSVParser.ts` - Parser avançado
- `BatchClassifier.ts` - Classificação em lote
- `IntelligentTransactionClassifier.ts` - ML classifier
- `BankDictionary.ts` - Dicionário de bancos
- `DescriptionNormalizer.ts` - Normalização
- `IntelligentCache.ts` - Cache inteligente
- `MerchantCache.ts` - Cache de comerciantes
- `ConfirmationDialog.tsx` - Confirmação de upload

### Componentes de Navegação

#### `AppHeader`
**Localização**: `/src/components/navigation/AppHeader.tsx`

Header principal:
- ✅ Logo
- ✅ Busca global
- ✅ Notificações
- ✅ Tema
- ✅ Perfil do usuário

#### `AppSidebar`
**Localização**: `/src/components/navigation/AppSidebar.tsx`

Sidebar de navegação:
- ✅ Menu principal
- ✅ Ícones Lucide
- ✅ Indicador de rota ativa
- ✅ Responsiva (mobile drawer)

#### `AdminSidebar`
**Localização**: `/src/admin/components/AdminSidebar.tsx`

Sidebar administrativa:
- ✅ Menu admin
- ✅ Navegação específica

### Componentes de Pagamento

#### `PaymentDialog`
**Localização**: `/src/components/payment/PaymentDialog.tsx`

Dialog de pagamento:
- ✅ Exibição de dados da cobrança
- ✅ QR Code PIX
- ✅ Código PIX copia e cola
- ✅ Link para boleto
- ✅ Link para fatura

### Guards

#### `SubscriptionGuard`
**Localização**: `/src/components/guards/SubscriptionGuard.tsx`

Proteção de rotas por assinatura:
- ✅ Verifica se usuário tem assinatura ativa
- ✅ Redireciona para /pricing se não tiver
- ✅ Loading state

#### `FeatureGuard`
**Localização**: `/src/components/guards/FeatureGuard.tsx`

Proteção por feature:
```tsx
<FeatureGuard feature="ml_classification">
  <MLFeature />
</FeatureGuard>
```

### Componentes UI (shadcn/ui)

**Localização**: `/src/components/ui/`

Biblioteca completa de componentes baseada em Radix UI:
- ✅ Button, Input, Select, Checkbox
- ✅ Dialog, AlertDialog, Sheet
- ✅ Card, Tabs, Accordion
- ✅ Toast, Popover, Dropdown
- ✅ Calendar, DatePicker
- ✅ Charts (Recharts integration)
- ✅ E mais 60+ componentes

---

## 🔐 Autenticação e Segurança

### Sistema de Autenticação

**Provedor**: Supabase Auth

**Métodos Suportados**:
- ✅ Email/Senha
- ✅ Magic Link (email)
- ⚠️ OAuth (preparado, não configurado)

### Fluxo de Autenticação

```typescript
// 1. Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// 2. Cadastro
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: { full_name: 'John Doe' }
  }
});

// 3. Logout
await supabase.auth.signOut();

// 4. Verificar sessão
const { data: { session } } = await supabase.auth.getSession();

// 5. Listener de mudanças
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // Usuário logou
  }
});
```

### Row Level Security (RLS)

Todas as tabelas possuem RLS habilitado:

```sql
-- Política: Usuários veem apenas seus dados
CREATE POLICY "user_isolation" ON transactions
  FOR ALL
  USING (auth.uid() = user_id);

-- Política: Admins veem tudo
CREATE POLICY "admin_access" ON transactions
  FOR ALL
  USING (is_admin());

-- Política: Planos públicos são visíveis
CREATE POLICY "public_plans" ON subscription_plans
  FOR SELECT
  USING (is_active = true);
```

### Função `is_admin()`

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE user_id = auth.uid() 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Proteção de Rotas

**Frontend**:
```typescript
// App.tsx
<Route
  path="/sistema"
  element={
    isAuthenticated ? (
      <SubscriptionGuard>
        <AppLayout />
      </SubscriptionGuard>
    ) : (
      <Navigate to="/login" />
    )
  }
/>
```

**Backend (RLS)**:
```sql
-- Apenas usuários autenticados
USING (auth.uid() IS NOT NULL)

-- Apenas admins
USING (is_admin())

-- Apenas donos dos dados
USING (auth.uid() = user_id)
```

### Segurança de Edge Functions

```typescript
// Validar Authorization header
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response('Unauthorized', { status: 401 });
}

// Validar webhook token
const webhookToken = req.headers.get('X-Webhook-Token');
if (webhookToken !== Deno.env.get('ASAAS_WEBHOOK_TOKEN')) {
  return new Response('Invalid token', { status: 403 });
}
```

### Variáveis de Ambiente Sensíveis

```bash
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# Asaas (apenas Edge Functions)
ASAAS_API_KEY=xxx
ASAAS_SANDBOX=true
ASAAS_WEBHOOK_TOKEN=xxx
```

**⚠️ IMPORTANTE**:
- Nunca exponha `ASAAS_API_KEY` no frontend
- Use `VITE_` apenas para variáveis públicas
- Edge Functions usam secrets do Supabase

---

## 🚀 Configuração e Deploy

### Pré-requisitos

- Node.js 18+ e npm/yarn/bun
- Conta no Supabase
- Conta no Asaas (para pagamentos)
- Conta no Netlify/Vercel (opcional para deploy)

### Instalação Local

```bash
# 1. Clonar repositório
git clone <repo-url>
cd SistemaOrbi-main

# 2. Instalar dependências
npm install
# ou
bun install

# 3. Configurar variáveis de ambiente
cp .env.example .env

# Editar .env com suas credenciais:
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-key-aqui

# 4. Rodar em desenvolvimento
npm run dev
# Acessar: http://localhost:8080
```

### Configuração do Supabase

#### 1. Criar Projeto

```bash
# Instalar CLI
npm install -g supabase

# Login
npx supabase login

# Inicializar (se necessário)
npx supabase init
```

#### 2. Aplicar Migrations

```bash
# Push migrations para o Supabase
npx supabase db push

# Ou aplicar manualmente no Dashboard SQL Editor
```

#### 3. Deploy de Edge Functions

```bash
# Deploy todas as functions
npx supabase functions deploy asaas-create-customer
npx supabase functions deploy asaas-create-payment
npx supabase functions deploy asaas-webhook-handler
npx supabase functions deploy classify-transactions
```

#### 4. Configurar Secrets

```bash
npx supabase secrets set ASAAS_API_KEY=sua-key
npx supabase secrets set ASAAS_SANDBOX=true
npx supabase secrets set ASAAS_WEBHOOK_TOKEN=seu-token
```

### Configuração do Asaas

#### 1. Criar Conta

- Sandbox: https://sandbox.asaas.com
- Produção: https://www.asaas.com

#### 2. Obter API Key

- Dashboard → Configurações → API
- Copiar token

#### 3. Configurar Webhooks

- Dashboard → Webhooks
- URL: `https://seu-projeto.supabase.co/functions/v1/asaas-webhook-handler`
- Eventos:
  - ✅ PAYMENT_CREATED
  - ✅ PAYMENT_CONFIRMED
  - ✅ PAYMENT_RECEIVED
  - ✅ PAYMENT_OVERDUE
  - ✅ PAYMENT_REFUNDED

### Criar Primeiro Admin

```sql
-- 1. Encontrar seu user_id
SELECT id, email FROM auth.users;

-- 2. Criar admin
INSERT INTO public.admin_users (user_id, role, is_active)
VALUES ('seu-user-id-aqui', 'super_admin', true);
```

### Criar Planos Iniciais

Execute os inserts ou use o painel `/admin/plans`:

```sql
-- Plano Free
INSERT INTO subscription_plans (name, slug, monthly_price, annual_price, features, limits)
VALUES (
  'Free',
  'free',
  0.00,
  0.00,
  ARRAY['basic_dashboard', 'manual_categorization'],
  '{"max_accounts": 2, "max_transactions_per_month": 100}'::jsonb
);

-- Ver documentação SAAS_SETUP.md para planos completos
```

### Build para Produção

```bash
# Build otimizado
npm run build

# Testar build localmente
npm run preview
```

### Deploy no Netlify

#### Via CLI:

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

#### Via Dashboard:

1. Conectar repositório GitHub
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Deploy no Vercel

```bash
# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Configuração de Produção

**Checklist**:

- [ ] Alterar `ASAAS_SANDBOX=false`
- [ ] Usar API Key de produção do Asaas
- [ ] Configurar webhook URL de produção
- [ ] Testar fluxo de pagamento com valores reais
- [ ] Habilitar HTTPS
- [ ] Configurar domínio customizado
- [ ] Configurar backups do banco
- [ ] Habilitar logs de auditoria
- [ ] Configurar monitoramento de erros

### Scripts Disponíveis

```json
{
  "dev": "vite",                        // Dev server
  "dev:local": "./scripts/start-dev.sh", // Dev com Supabase local
  "build": "vite build",                 // Build produção
  "build:dev": "vite build --mode development", // Build dev
  "lint": "eslint .",                   // Linter
  "preview": "vite preview"             // Preview do build
}
```

---

## 📁 Estrutura de Pastas

```
SistemaOrbi-main/
├── docs/                           # Documentação
│   ├── ASAAS_SETUP_COMMANDS.md
│   ├── DEPLOY_PRODUCAO.md
│   ├── INTEGRACAO_ASAAS.md
│   ├── MOBILE_REFACTOR.md
│   ├── SAAS_SETUP.md
│   └── DOCUMENTACAO_SISTEMA_ORBI.md
│
├── public/                         # Arquivos estáticos
│   ├── favicon.ico
│   ├── robots.txt
│   └── _redirects                  # Netlify redirects
│
├── scripts/                        # Scripts de automação
│   ├── dev-setup.sh
│   ├── start-dev.sh
│   └── ...
│
├── src/                            # Código-fonte
│   ├── admin/                      # Painel Administrativo
│   │   ├── components/             # Componentes admin
│   │   │   ├── AddAdminDialog.tsx
│   │   │   ├── AdminAuthForm.tsx
│   │   │   ├── AdminHeader.tsx
│   │   │   ├── AdminSidebar.tsx
│   │   │   ├── PlanDialog.tsx
│   │   │   └── UserDetailDialog.tsx
│   │   ├── layouts/
│   │   │   └── AdminLayout.tsx
│   │   └── pages/                  # Páginas admin
│   │       ├── AdminDashboard.tsx
│   │       ├── AdminManagement.tsx
│   │       ├── BugReportsManagement.tsx
│   │       ├── PlanManagement.tsx
│   │       ├── SubscriptionManagement.tsx
│   │       └── UserManagement.tsx
│   │
│   ├── assets/                     # Assets estáticos
│   │   ├── orbi-logo_dark.png
│   │   ├── orbi-logo_white.png
│   │   ├── pix-dark.svg
│   │   └── pix-white.svg
│   │
│   ├── components/                 # Componentes React
│   │   ├── auth/                   # Autenticação
│   │   │   └── AuthForm.tsx
│   │   ├── bugs/                   # Relatórios de bugs
│   │   │   └── ReportBugDialog.tsx
│   │   ├── dashboard/              # Dashboard
│   │   │   ├── Dashboard.tsx
│   │   │   └── SubscriptionChart.tsx
│   │   ├── extrato-uploader/       # Upload de CSV
│   │   │   ├── BankDictionary.ts
│   │   │   ├── BatchClassifier.ts
│   │   │   ├── ConfirmationDialog.tsx
│   │   │   ├── CSVParser.ts
│   │   │   ├── DescriptionNormalizer.ts
│   │   │   ├── EnhancedCSVParser.ts
│   │   │   ├── ExtratoUploader.tsx
│   │   │   ├── IntelligentCache.ts
│   │   │   ├── IntelligentTransactionClassifier.ts
│   │   │   ├── MerchantCache.ts
│   │   │   └── TransactionMLClassifier.ts
│   │   ├── guards/                 # Route guards
│   │   │   ├── FeatureGuard.tsx
│   │   │   └── SubscriptionGuard.tsx
│   │   ├── navigation/             # Navegação
│   │   │   ├── AppHeader.tsx
│   │   │   ├── AppSidebar.tsx
│   │   │   └── SearchPopover.tsx
│   │   ├── payment/                # Pagamentos
│   │   │   └── PaymentDialog.tsx
│   │   ├── people/                 # Gestão de pessoas
│   │   │   └── PersonDetail.tsx
│   │   └── ui/                     # Componentes UI (shadcn)
│   │       └── [64 componentes]
│   │
│   ├── hooks/                      # Hooks customizados
│   │   ├── use-accounts.ts
│   │   ├── use-admin-auth.ts
│   │   ├── use-auth.ts
│   │   ├── use-bug-reports.ts
│   │   ├── use-card-transactions.ts
│   │   ├── use-card-usage.ts
│   │   ├── use-categories.ts
│   │   ├── use-credit-cards.ts
│   │   ├── use-debts.ts
│   │   ├── use-feature.ts
│   │   ├── use-installments.ts
│   │   ├── use-learned-patterns.ts
│   │   ├── use-mobile.tsx
│   │   ├── use-monthly-transactions.ts
│   │   ├── use-notes.ts
│   │   ├── use-payment.ts
│   │   ├── use-people.ts
│   │   ├── use-person-transactions.ts
│   │   ├── use-series.ts
│   │   ├── use-status-sync.ts
│   │   ├── use-subscription.ts
│   │   ├── use-subscriptions.ts
│   │   ├── use-theme.tsx
│   │   └── use-toast.ts
│   │
│   ├── integrations/               # Integrações externas
│   │   └── supabase/
│   │       ├── client.ts           # Cliente Supabase
│   │       └── types.ts            # Types do banco
│   │
│   ├── layouts/                    # Layouts
│   │   └── AppLayout.tsx
│   │
│   ├── lib/                        # Bibliotecas e utils
│   │   ├── features/
│   │   └── utils.ts
│   │
│   ├── pages/                      # Páginas principais
│   │   ├── Accounts.tsx
│   │   ├── Cards.tsx
│   │   ├── CardStatements.tsx
│   │   ├── Categories.tsx
│   │   ├── Index.tsx
│   │   ├── MonthlyStatement.tsx
│   │   ├── MyAI.tsx
│   │   ├── Notes.tsx
│   │   ├── NotFound.tsx
│   │   ├── People.tsx
│   │   ├── Pricing.tsx
│   │   └── Settings.tsx
│   │
│   ├── App.tsx                     # Componente principal
│   ├── main.tsx                    # Entry point
│   ├── index.css                   # Estilos globais
│   └── vite-env.d.ts               # Types Vite
│
├── supabase/                       # Configuração Supabase
│   ├── config.toml                 # Configuração local
│   ├── functions/                  # Edge Functions
│   │   ├── _shared/
│   │   │   └── cors.ts
│   │   ├── asaas-create-customer/
│   │   │   └── index.ts
│   │   ├── asaas-create-payment/
│   │   │   └── index.ts
│   │   ├── asaas-webhook-handler/
│   │   │   └── index.ts
│   │   ├── classify-transactions/
│   │   │   └── index.ts
│   │   │   └── index.ts
│   │       └── index.ts
│   ├── migrations/                 # Migrations SQL (87 arquivos)
│   │   └── [migrations SQL]
│   └── seed/                       # Seeds iniciais
│       ├── 01_initial_data.sql
│       └── 02_initial_categories.sql
│
├── .env                            # Variáveis de ambiente (local)
├── .gitignore                      # Arquivos ignorados
├── components.json                 # Config shadcn/ui
├── eslint.config.js                # Config ESLint
├── index.html                      # HTML principal
├── netlify.toml                    # Config Netlify
├── nginx.conf                      # Config Nginx
├── package.json                    # Dependências NPM
├── postcss.config.js               # Config PostCSS
├── README.md                       # README
├── tailwind.config.ts              # Config Tailwind
├── tsconfig.json                   # Config TypeScript
├── vercel.json                     # Config Vercel
└── vite.config.ts                  # Config Vite
```

---

## 📊 Estatísticas do Projeto

### Tamanho do Código

- **Total de arquivos**: ~300+ arquivos
- **Linhas de código**: ~50.000+ linhas
- **Migrations SQL**: 87 arquivos
- **Componentes React**: 100+ componentes
- **Hooks customizados**: 24 hooks
- **Edge Functions**: 6 functions
- **Páginas**: 12 páginas principais + 6 páginas admin

### Dependências

- **Frontend**: 35 dependências
- **Dev**: 13 dev dependencies
- **Total**: 48 packages

---

## 🔄 Fluxos de Uso Principais

### 1. Novo Usuário

```
1. Acessa /pricing
2. Clica em "Começar Grátis"
3. Cadastra-se (email/senha)
4. Recebe plano Free automaticamente
5. Redirecionado para /sistema
6. Vê dashboard inicial
7. Adiciona primeira conta
8. Adiciona primeira transação
```

### 2. Upgrade de Plano

```
1. Usuário Free acessa /pricing
2. Seleciona plano Pro
3. Escolhe ciclo (mensal/anual)
4. Sistema gera cobrança via Asaas
5. Exibe dados de pagamento (PIX/Boleto)
6. Usuário paga
7. Asaas envia webhook
8. Sistema ativa plano Pro
9. Usuário recebe acesso às features Pro
```

### 3. Upload de Extrato

```
1. Usuário acessa /sistema/statement
2. Clica em "Upload CSV"
3. Seleciona arquivo CSV do banco
4. Parser detecta formato automaticamente
5. Normaliza descrições
6. ML classifica transações
7. Mostra preview com sugestões
8. Usuário confirma ou ajusta
9. Transações são salvas
10. ML aprende com confirmações
```

### 4. Administrador Gerenciando Usuários

```
1. Admin acessa /admin
2. Faz login com credenciais admin
3. Acessa /admin/users
4. Visualiza lista de usuários
5. Clica em usuário específico
6. Vê detalhes e histórico
7. Pode alterar plano
8. Pode desativar usuário
9. Ações são registradas em audit_logs
```

---

## 🐛 Troubleshooting Comum

### Erro: "Missing Supabase environment variables"

**Solução**: Verifique se `.env` existe e contém:
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Erro: "User not authorized" ao acessar admin

**Solução**: Crie registro em `admin_users`:
```sql
INSERT INTO admin_users (user_id, role, is_active)
VALUES ('seu-user-id', 'super_admin', true);
```

### Transações não aparecem

**Solução**: 
1. Verificar se RLS está habilitado
2. Verificar se `user_id` está correto
3. Verificar se sessão está ativa

### ML não está classificando bem

**Solução**:
1. Treinar mais o modelo confirmando classificações
2. Adicionar mais padrões em `keyword_patterns`
3. Verificar dicionário de comerciantes

### Edge Function retorna 500

**Solução**:
1. Ver logs: `npx supabase functions logs nome-da-function`
2. Verificar secrets configurados
3. Testar payload de entrada

---

## 📈 Roadmap Futuro

### Features Planejadas

- [ ] App Mobile (React Native)
- [ ] API REST pública
- [ ] Integração com Open Banking
- [ ] Importação automática de bancos
- [ ] Metas financeiras
- [ ] Relatórios personalizados
- [ ] Exportação para Excel
- [ ] Dashboards customizáveis
- [ ] Compartilhamento de contas (família)
- [ ] Múltiplas moedas
- [ ] Integrações: Nubank, PicPay, etc
- [ ] Assistente AI conversacional
- [ ] Previsões financeiras com ML
- [ ] Alertas inteligentes
- [ ] Gamificação

---

## 📞 Suporte e Contato

Para dúvidas, bugs ou sugestões:

- **Email**: suporte@orbi.com.br (exemplo)
- **GitHub Issues**: [Link do repositório]
- **Documentação**: Este arquivo e docs/

---

## 📝 Licença

© 2025 Sistema Orbi. Todos os direitos reservados.

---

**Última atualização**: 19 de Outubro de 2025

**Versão da Documentação**: 1.0.0

---

## 🎓 Glossário

| Termo | Definição |
|-------|-----------|
| **RLS** | Row Level Security - Segurança a nível de linha no PostgreSQL |
| **Edge Function** | Função serverless que roda na borda (Deno runtime) |
| **SaaS** | Software as a Service - Software como serviço |
| **ML** | Machine Learning - Aprendizado de máquina |
| **Webhook** | Callback HTTP automático quando evento ocorre |
| **Multi-tenant** | Arquitetura onde múltiplos clientes compartilham infraestrutura |
| **shadcn/ui** | Coleção de componentes React reutilizáveis |
| **Supabase** | Backend-as-a-Service baseado em PostgreSQL |
| **TanStack Query** | Biblioteca de gerenciamento de estado assíncrono |
| **Vite** | Build tool moderna e rápida para frontend |

---

## 🙏 Agradecimentos

Este sistema foi construído com tecnologias open-source incríveis:

- React Team
- Supabase Team
- shadcn (shadcn/ui)
- Vercel (Next Themes)
- TanStack (React Query)
- Radix UI Team
- E toda a comunidade open-source

---

**Fim da Documentação**

Para qualquer atualização nesta documentação, edite o arquivo:  
`/docs/DOCUMENTACAO_SISTEMA_ORBI.md`

