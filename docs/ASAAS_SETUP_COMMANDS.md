# 🚀 Comandos Rápidos - Setup Asaas

Este documento contém todos os comandos necessários para configurar a integração com Asaas.

## 📋 Pré-requisitos

1. Conta no Asaas (sandbox ou produção)
2. Token da API Asaas
3. Supabase CLI instalado (`npm install -g supabase`)
4. Projeto Supabase configurado

## 1️⃣ Aplicar Migrations

```bash
# Aplicar todas as migrations (incluindo correção da estrutura Asaas)
npx supabase db push

# Ou aplicar migration específica
npx supabase db push --include-all
```

## 2️⃣ Deploy das Edge Functions

```bash
# Fazer login no Supabase (se ainda não fez)
npx supabase login

# Linkar ao projeto (se ainda não fez)
npx supabase link --project-ref seu-project-id

# Deploy de todas as funções Asaas
npx supabase functions deploy asaas-create-customer
npx supabase functions deploy asaas-create-payment
npx supabase functions deploy asaas-webhook-handler
```

## 3️⃣ Configurar Secrets/Variáveis de Ambiente

### **Opção A: Via CLI**

```bash
# Token da API Asaas (obtenha em https://www.asaas.com/config/api)
npx supabase secrets set ASAAS_API_KEY=seu_token_aqui

# Modo sandbox (use true para testes, false para produção)
npx supabase secrets set ASAAS_SANDBOX=true

# Token de validação do webhook (gere um token aleatório seguro)
npx supabase secrets set ASAAS_WEBHOOK_TOKEN=$(openssl rand -hex 32)
```

### **Opção B: Via Dashboard**

1. Acesse: https://supabase.com/dashboard/project/SEU_PROJECT/settings/functions
2. Vá em "Edge Functions" → "Manage secrets"
3. Adicione as variáveis:
   - `ASAAS_API_KEY`: seu token Asaas
   - `ASAAS_SANDBOX`: `true` ou `false`
   - `ASAAS_WEBHOOK_TOKEN`: token secreto para validar webhooks

## 4️⃣ Configurar Webhook no Asaas

### **Obter URL do Webhook**

```bash
# Sua URL será:
https://SEU_PROJECT_ID.supabase.co/functions/v1/asaas-webhook-handler
```

### **Configurar no Painel Asaas**

1. Acesse: https://www.asaas.com/webhooks (ou sandbox.asaas.com)
2. Clique em "Novo Webhook"
3. Cole a URL: `https://SEU_PROJECT_ID.supabase.co/functions/v1/asaas-webhook-handler`
4. Selecione os eventos:
   - ✅ Cobrança criada (PAYMENT_CREATED)
   - ✅ Cobrança confirmada (PAYMENT_CONFIRMED)
   - ✅ Cobrança recebida (PAYMENT_RECEIVED)
   - ✅ Cobrança vencida (PAYMENT_OVERDUE)
   - ✅ Cobrança estornada (PAYMENT_REFUNDED)
   - ✅ Assinatura criada (SUBSCRIPTION_CREATED)
   - ✅ Assinatura atualizada (SUBSCRIPTION_UPDATED)
   - ✅ Assinatura cancelada (SUBSCRIPTION_CANCELED)
5. Adicione o token de autenticação (o mesmo que você configurou em `ASAAS_WEBHOOK_TOKEN`)
6. Salve

## 5️⃣ Testar a Integração

### **Teste Rápido - Criar Customer**

```bash
# Obter token de autenticação do Supabase
# (faça login no seu app e pegue o token do localStorage ou DevTools)

curl -X POST \
  'https://SEU_PROJECT_ID.supabase.co/functions/v1/asaas-create-customer' \
  -H 'Authorization: Bearer SEU_SUPABASE_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "uuid-do-usuario",
    "userEmail": "teste@exemplo.com",
    "userName": "Teste Usuario"
  }'
```

### **Teste Rápido - Criar Pagamento**

```bash
curl -X POST \
  'https://SEU_PROJECT_ID.supabase.co/functions/v1/asaas-create-payment' \
  -H 'Authorization: Bearer SEU_SUPABASE_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "planId": "uuid-do-plano",
    "billingCycle": "monthly",
    "paymentMethod": "PIX"
  }'
```

## 6️⃣ Ver Logs

```bash
# Ver logs em tempo real
npx supabase functions logs asaas-create-customer --follow
npx supabase functions logs asaas-create-payment --follow
npx supabase functions logs asaas-webhook-handler --follow

# Ver logs das últimas 24 horas
npx supabase functions logs asaas-webhook-handler --since=24h
```

## 7️⃣ Troubleshooting

### **Webhook não está funcionando**

```bash
# 1. Verificar se a função está deployada
npx supabase functions list

# 2. Testar webhook manualmente
curl -X POST \
  'https://SEU_PROJECT_ID.supabase.co/functions/v1/asaas-webhook-handler' \
  -H 'Content-Type: application/json' \
  -H 'asaas-access-token: seu-token' \
  -d '{
    "event": "PAYMENT_CONFIRMED",
    "payment": {
      "id": "pay_test123",
      "customer": "cus_test123",
      "value": 10.99,
      "status": "CONFIRMED"
    }
  }'

# 3. Ver logs de erro
npx supabase functions logs asaas-webhook-handler --tail=50
```

### **Erro "ASAAS_API_KEY not found"**

```bash
# Verificar se o secret está configurado
npx supabase secrets list

# Se não estiver, configurar
npx supabase secrets set ASAAS_API_KEY=seu_token
```

### **Erro 401 Unauthorized no Asaas**

1. Verifique se o token está correto
2. Verifique se está usando o token correto (sandbox vs produção)
3. Verifique se o token tem as permissões necessárias

## 8️⃣ Migração Sandbox → Produção

```bash
# 1. Alterar para modo produção
npx supabase secrets set ASAAS_SANDBOX=false

# 2. Atualizar token para produção
npx supabase secrets set ASAAS_API_KEY=seu_token_producao

# 3. Atualizar webhook no Asaas produção
# Acesse: https://www.asaas.com/webhooks
# Configure a mesma URL

# 4. Testar com valor pequeno real
# Use a interface do app para criar um pagamento de teste
```

## 9️⃣ Monitoramento

### **Dashboard Asaas**

- Cobranças: https://www.asaas.com/cobranca
- Clientes: https://www.asaas.com/cliente
- Webhooks: https://www.asaas.com/webhooks

### **Dashboard Supabase**

- Edge Functions: https://supabase.com/dashboard/project/SEU_PROJECT/functions
- Database: https://supabase.com/dashboard/project/SEU_PROJECT/editor

### **Queries Úteis**

```sql
-- Ver últimos pagamentos
SELECT * FROM payment_history 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver assinaturas ativas
SELECT u.email, s.status, p.name as plan_name
FROM user_subscriptions s
JOIN auth.users u ON u.id = s.user_id
JOIN subscription_plans p ON p.id = s.plan_id
WHERE s.status IN ('active', 'trial')
ORDER BY s.created_at DESC;

-- Ver pagamentos pendentes
SELECT 
  u.email,
  ph.amount,
  ph.status,
  ph.due_date,
  ph.invoice_url
FROM payment_history ph
JOIN auth.users u ON u.id = ph.user_id
WHERE ph.status = 'pending'
ORDER BY ph.due_date ASC;
```

## 🔐 Segurança

### **Rotacionar Token do Webhook**

```bash
# Gerar novo token
NEW_TOKEN=$(openssl rand -hex 32)

# Atualizar no Supabase
npx supabase secrets set ASAAS_WEBHOOK_TOKEN=$NEW_TOKEN

# Atualizar no painel Asaas
# Acesse: https://www.asaas.com/webhooks
# Edite o webhook e atualize o token
```

### **Backup do Token**

```bash
# Salvar token em arquivo seguro (NÃO commitar no git!)
echo "ASAAS_API_KEY=seu_token" > .env.asaas.backup
echo "ASAAS_WEBHOOK_TOKEN=seu_webhook_token" >> .env.asaas.backup

# Adicionar ao .gitignore
echo ".env.asaas.backup" >> .gitignore
```

## 📞 Suporte

- **Asaas:** https://ajuda.asaas.com
- **Supabase:** https://supabase.com/docs
- **Documentação Interna:** Ver `INTEGRACAO_ASAAS.md`

---

**Última atualização:** 17/10/2025

