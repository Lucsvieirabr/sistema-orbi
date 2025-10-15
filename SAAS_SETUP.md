# 🚀 Orbi SaaS - Guia de Implementação

Este documento descreve a estrutura SaaS implementada no sistema Orbi e os próximos passos para ativação completa.

## ✅ O que foi implementado

### 1. **Estrutura de Banco de Dados**
- ✅ Tabela `subscription_plans` - Planos de assinatura
- ✅ Tabela `user_subscriptions` - Assinaturas dos usuários
- ✅ Tabela `payment_history` - Histórico de pagamentos
- ✅ Tabela `user_profiles` - Perfis estendidos
- ✅ Tabela `plan_features` - Features por plano
- ✅ Tabela `user_usage` - Métricas de uso
- ✅ Tabela `admin_users` - Administradores do sistema
- ✅ Tabela `audit_logs` - Logs de auditoria
- ✅ Row Level Security (RLS) configurado em todas as tabelas
- ✅ Funções SQL auxiliares (`is_admin()`, `get_user_plan()`, `user_has_feature()`, etc.)

### 2. **Hooks React**
- ✅ `use-subscription.ts` - Gerenciamento de assinatura do usuário
- ✅ `use-admin-auth.ts` - Verificação de permissões admin

### 3. **Painel Administrativo**
- ✅ Layout admin (`/admin`)
- ✅ Dashboard com métricas (`/admin`)
- ✅ CRUD de Planos (`/admin/plans`)
- ✅ Gerenciamento de Usuários (`/admin/users`)
- ✅ Sidebar administrativa
- ✅ Proteção de rotas (apenas admins)

### 4. **Interface Pública**
- ✅ Página de Pricing (`/pricing`)
- ✅ Visualização de planos com ciclos mensais/anuais
- ✅ Cálculo de economia anual

### 5. **Rotas Configuradas**
```
/pricing              → Página pública de planos
/login                → Login de usuário
/admin                → Login administrativo (visual diferenciado)
/sistema/*            → Área do usuário (protegida)
/admin/dashboard      → Dashboard admin (protegido)
/admin/plans          → CRUD de planos (protegido)
/admin/users          → Gestão de usuários (protegido)
/admin/*              → Outras rotas admin (protegidas)
```

---

## 📋 Próximos Passos

### **FASE 1: Criar Primeiro Admin** ⚠️ IMPORTANTE

Antes de usar o painel admin, você precisa criar manualmente o primeiro admin no banco de dados:

```sql
-- 1. Encontre o ID do seu usuário
SELECT id, email FROM auth.users;

-- 2. Copie o ID e execute (substitua 'SEU_USER_ID_AQUI'):
INSERT INTO public.admin_users (user_id, role, is_active)
VALUES ('SEU_USER_ID_AQUI', 'super_admin', true);
```

Após isso, você poderá acessar `/admin` e criar outros administradores pela interface.

### **FASE 2: Criar Planos via Interface**

1. Acesse `/admin/plans`
2. Clique em "Novo Plano"
3. Configure os planos sugeridos:

#### Plano FREE
```
Nome: Free
Slug: free
Descrição: Perfeito para começar a organizar suas finanças pessoais
Preço Mensal: 0,00
Preço Anual: 0,00

Features (marcar):
- ✅ basic_dashboard
- ✅ manual_categorization

Limites:
- max_accounts: 2
- max_transactions_per_month: 100
- max_credit_cards: 1
- max_people: 3
- retention_months: 6
```

#### Plano PRO
```
Nome: Pro
Slug: pro
Descrição: Para quem quer controle total com inteligência artificial
Preço Mensal: 29,90
Preço Anual: 299,00

Features (marcar):
- ✅ basic_dashboard
- ✅ manual_categorization
- ✅ csv_export
- ✅ ml_classification
- ✅ advanced_reports
- ✅ priority_support
- ✅ logo_customization
- ✅ custom_categories
- ✅ bulk_import
- ✅ scheduled_reports

Limites:
- max_accounts: 10
- max_transactions_per_month: 1000
- max_credit_cards: 5
- max_people: 10
- retention_months: 24
```

#### Plano PREMIUM
```
Nome: Premium
Slug: premium
Descrição: Recursos ilimitados para profissionais e empresas
Preço Mensal: 59,90
Preço Anual: 599,00

Features (marcar todas):
- ✅ Todas as features

Limites (use -1 para ilimitado):
- max_accounts: -1
- max_transactions_per_month: -1
- max_credit_cards: -1
- max_people: -1
- retention_months: -1
```

### **FASE 3: Atribuir Planos aos Usuários Existentes**

Execute no banco para dar plano Free aos usuários existentes:

```sql
-- Obter ID do plano Free
SELECT id FROM public.subscription_plans WHERE slug = 'free';

-- Criar assinatura free para usuários sem plano (substitua FREE_PLAN_ID_AQUI)
INSERT INTO public.user_subscriptions (user_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
SELECT 
  u.id,
  'FREE_PLAN_ID_AQUI',
  'active',
  'monthly',
  NOW(),
  NOW() + INTERVAL '365 days'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions WHERE user_id = u.id
);
```

---

## 🔌 Integração com Asaas (PREPARADO - NÃO IMPLEMENTADO)

A estrutura está preparada para integração com Asaas. Campos prontos:
- `asaas_customer_id`
- `asaas_subscription_id`
- `asaas_payment_id`
- `asaas_plan_id`

### Próximos passos para Asaas:

1. **Criar Edge Functions** (em `supabase/functions/`):
   ```
   /asaas-create-customer/
   /asaas-create-subscription/
   /asaas-webhook-handler/
   /asaas-cancel-subscription/
   ```

2. **Adicionar variáveis de ambiente**:
   ```env
   ASAAS_API_KEY=seu_api_key
   ASAAS_ENVIRONMENT=sandbox
   ASAAS_WEBHOOK_SECRET=seu_secret
   ```

3. **Implementar fluxos**:
   - Criar customer no Asaas ao registrar usuário
   - Gerar cobrança ao escolher plano
   - Processar webhooks de pagamento
   - Atualizar status da assinatura

---

## 🎨 Padrão Visual Implementado

Todo o painel admin segue o mesmo padrão visual do sistema principal:

- ✅ Cards com `shadow-lg` e `hover:shadow-lg`
- ✅ Header com ícone + título + descrição
- ✅ Toggle cards/list view
- ✅ Busca integrada
- ✅ Skeletons para loading
- ✅ Empty states amigáveis
- ✅ Cores consistentes (`bg-primary/10`, `text-muted-foreground`)
- ✅ Confirmação de exclusões com `ConfirmationDialog`

---

## 📊 Usando o Hook de Subscription

No frontend, use o hook `useSubscription` para controlar features:

```tsx
import { useSubscription } from "@/hooks/use-subscription";

function MyComponent() {
  const { 
    subscription, 
    plan,
    hasFeature, 
    checkLimit,
    isPro,
    isPremium 
  } = useSubscription();

  // Verificar feature
  if (!hasFeature('ml_classification')) {
    return <UpgradePrompt />;
  }

  // Verificar limite
  const canAddAccount = checkLimit('max_accounts', currentAccountCount);
  
  return (
    <div>
      <h1>Seu plano: {plan?.name}</h1>
      {isPro && <ProFeature />}
    </div>
  );
}
```

---

## 🔒 Segurança

- ✅ RLS habilitado em todas as tabelas
- ✅ Usuários só veem seus próprios dados
- ✅ Admins têm acesso total via políticas RLS
- ✅ Funções SECURITY DEFINER para operações seguras
- ✅ Audit logs para rastreamento

---

## 📁 Estrutura de Arquivos Criados

```
supabase/migrations/
  └── 20251016000001_create_saas_structure.sql

src/
  ├── hooks/
  │   ├── use-subscription.ts
  │   └── use-admin-auth.ts
  │
  ├── admin/
  │   ├── layouts/
  │   │   └── AdminLayout.tsx
  │   ├── components/
  │   │   ├── AdminSidebar.tsx
  │   │   ├── AdminHeader.tsx
  │   │   └── PlanDialog.tsx
  │   └── pages/
  │       ├── AdminDashboard.tsx
  │       ├── PlanManagement.tsx
  │       └── UserManagement.tsx
  │
  └── pages/
      └── Pricing.tsx
```

---

## 🚦 Status das Funcionalidades

| Feature | Status |
|---------|--------|
| Estrutura de BD | ✅ Completo |
| RLS e Segurança | ✅ Completo |
| Painel Admin | ✅ Completo |
| CRUD Planos | ✅ Completo |
| Gestão Usuários | ✅ Completo |
| Página Pricing | ✅ Completo |
| Hook Subscription | ✅ Completo |
| Integração Asaas | ⏳ Estrutura pronta |
| Webhooks Asaas | ⏳ Pendente |
| Onboarding | ⏳ Pendente |
| Billing Portal | ⏳ Pendente |

---

## 💡 Dicas

1. **Teste o sistema** criando planos e testando limites
2. **Configure features** específicas para cada plano conforme necessário
3. **Monitore métricas** no dashboard admin
4. **Use o audit_logs** para rastrear mudanças importantes

---

## 🆘 Troubleshooting

**Erro: "Não é admin"**
- Verifique se executou o INSERT em `admin_users`
- Confirme que `is_active = true`

**Planos não aparecem**
- Verifique se `is_active = true`
- Confirme RLS policies

**Subscription não carrega**
- Execute o script de atribuição de planos
- Verifique se o usuário tem registro em `user_subscriptions`

---

Para dúvidas ou problemas, consulte a documentação do Supabase ou as policies RLS no banco.

