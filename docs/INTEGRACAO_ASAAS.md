# 📘 Integração com Asaas - Guia Completo

Este documento descreve como a integração com o gateway de pagamentos Asaas foi implementada no sistema Orbi.

## 📊 Arquitetura Correta

### ❌ **O que NÃO fazer**
- **NÃO** armazenar URLs de pagamento fixas na tabela `subscription_plans`
- Cada pagamento é único por usuário e deve ser gerado dinamicamente

### ✅ **O que fazer**
A integração segue o fluxo correto:

1. **Customer** → Criar customer no Asaas quando usuário se registra
2. **Payment/Subscription** → Criar cobrança quando usuário escolhe um plano
3. **Webhooks** → Processar eventos de pagamento para atualizar status

## 🗄️ Estrutura do Banco de Dados

### **user_profiles**
```sql
asaas_customer_id TEXT UNIQUE -- ID do customer no Asaas
```

### **user_subscriptions**
```sql
asaas_customer_id TEXT       -- ID do customer no Asaas
asaas_subscription_id TEXT   -- ID da assinatura recorrente (se aplicável)
```

### **payment_history**
```sql
asaas_payment_id TEXT        -- ID do pagamento no Asaas
invoice_url TEXT             -- URL da fatura
bank_slip_url TEXT           -- URL do boleto
pix_qr_code TEXT            -- URL do QR Code PIX
pix_copy_paste TEXT         -- Código PIX copia e cola
```

## 🔧 Configuração

### **1. Variáveis de Ambiente**

Configure no Supabase Dashboard (Edge Functions Secrets):

```bash
# Token da API Asaas
ASAAS_API_KEY=seu_token_aqui

# Modo sandbox (true/false)
ASAAS_SANDBOX=true

# Token de validação do webhook (opcional, mas recomendado)
ASAAS_WEBHOOK_TOKEN=seu_token_secreto
```

### **2. Configurar Webhooks no Asaas**

No painel do Asaas, configure a URL do webhook:

```
https://seu-projeto.supabase.co/functions/v1/asaas-webhook-handler
```

**Eventos importantes:**
- ✅ PAYMENT_CREATED
- ✅ PAYMENT_CONFIRMED
- ✅ PAYMENT_RECEIVED
- ✅ PAYMENT_OVERDUE
- ✅ PAYMENT_REFUNDED
- ✅ SUBSCRIPTION_CREATED (se usar assinaturas recorrentes)
- ✅ SUBSCRIPTION_UPDATED
- ✅ SUBSCRIPTION_CANCELED

### **3. Deploy das Edge Functions**

```bash
# Fazer login no Supabase
npx supabase login

# Fazer deploy das functions
npx supabase functions deploy asaas-create-customer
npx supabase functions deploy asaas-create-payment
npx supabase functions deploy asaas-webhook-handler

# Configurar secrets
npx supabase secrets set ASAAS_API_KEY=seu_token
npx supabase secrets set ASAAS_SANDBOX=true
npx supabase secrets set ASAAS_WEBHOOK_TOKEN=seu_token_secreto
```

### **4. Aplicar Migrations**

```bash
# Aplicar a migration de correção da estrutura
npx supabase db push
```

## 🔄 Fluxo de Pagamento

### **Passo 1: Criar Customer (opcional, feito automaticamente)**

```typescript
// Edge Function: asaas-create-customer
const response = await supabase.functions.invoke('asaas-create-customer', {
  body: {
    userId: user.id,
    userEmail: user.email,
    userName: user.full_name,
    cpfCnpj: '12345678901', // Opcional
    phone: '11999999999'     // Opcional
  }
});
```

### **Passo 2: Criar Pagamento**

```typescript
// Usando o hook usePayment
import { usePayment } from '@/hooks/use-payment';

const { createPayment, paymentData } = usePayment();

const result = await createPayment({
  planId: 'uuid-do-plano',
  billingCycle: 'monthly', // ou 'annual'
  paymentMethod: 'PIX'     // ou 'BOLETO', 'CREDIT_CARD'
});

if (result.success && result.payment) {
  // Mostrar dados de pagamento ao usuário
  console.log('Invoice URL:', result.payment.invoiceUrl);
  console.log('PIX Code:', result.payment.pixCopyPaste);
}
```

### **Passo 3: Webhooks Processam Automaticamente**

Quando o usuário paga:

1. Asaas envia webhook `PAYMENT_CONFIRMED`
2. Edge Function `asaas-webhook-handler` processa
3. Status da assinatura muda para `active`
4. Registro em `payment_history` é atualizado
5. Usuário recebe acesso às funcionalidades do plano

## 🎨 Interface de Usuário

### **Componente PaymentDialog**

```tsx
import { PaymentDialog } from '@/components/payment';

<PaymentDialog 
  open={showDialog}
  onOpenChange={setShowDialog}
  paymentData={paymentData}
/>
```

Mostra automaticamente:
- ✅ Valor e vencimento
- ✅ QR Code PIX (se disponível)
- ✅ Código PIX copia e cola
- ✅ Link para boleto
- ✅ Link para fatura completa

### **Página de Pricing**

A página `/pricing` já está integrada:

1. Usuário seleciona plano
2. Sistema cria pagamento via Edge Function
3. Dialog mostra opções de pagamento
4. Após pagamento, webhook ativa automaticamente

## 📋 Status de Pagamentos

### **payment_history.status**
- `pending` - Aguardando pagamento
- `confirmed` - Pagamento confirmado
- `failed` - Pagamento vencido/falhou
- `refunded` - Pagamento reembolsado
- `canceled` - Pagamento cancelado

### **user_subscriptions.status**
- `trial` - Em período de teste
- `active` - Assinatura ativa
- `past_due` - Pagamento vencido
- `canceled` - Assinatura cancelada
- `expired` - Assinatura expirada

## 🔍 Logs e Debugging

### **Ver logs das Edge Functions**

```bash
# Logs em tempo real
npx supabase functions logs asaas-create-payment --follow
npx supabase functions logs asaas-webhook-handler --follow
```

### **Testar Webhooks Localmente**

Use ferramentas como ngrok ou Webhook.site para testar:

```bash
# Iniciar ngrok
ngrok http 54321

# Configurar URL no Asaas (sandbox)
https://seu-ngrok-url.ngrok.io/functions/v1/asaas-webhook-handler
```

## 🧪 Ambiente de Sandbox

### **Cartões de Teste Asaas**

Para testar cartões de crédito (sandbox):

```
Número: 5162 3060 8285 9703
CVV: 318
Validade: qualquer data futura
Nome: TESTE APROVADO
```

### **PIX de Teste**

No sandbox, pagamentos PIX são aprovados instantaneamente ao clicar no link de pagamento.

## 📚 Referências

- [Documentação API Asaas](https://docs.asaas.com/reference)
- [Webhooks Asaas](https://docs.asaas.com/reference/webhooks)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

## 🚨 Importante

### **Segurança**
1. ✅ **NUNCA** exponha `ASAAS_API_KEY` no frontend
2. ✅ **SEMPRE** valide webhooks com token
3. ✅ Use HTTPS em produção
4. ✅ Valide todos os inputs nas Edge Functions

### **Produção**
Antes de ir para produção:

1. Alterar `ASAAS_SANDBOX=false`
2. Usar token de produção
3. Configurar webhook URL de produção
4. Testar fluxo completo com valores reais pequenos
5. Habilitar logs de auditoria

## 💡 Dicas

### **Assinaturas Recorrentes vs Pagamentos Únicos**

Atualmente, o sistema usa **pagamentos únicos** por simplicidade. Para implementar assinaturas recorrentes:

1. Use endpoint `/subscriptions` do Asaas (em vez de `/payments`)
2. Armazene `asaas_subscription_id` em `user_subscriptions`
3. Asaas gerará cobranças automaticamente
4. Webhooks atualizarão status a cada ciclo

### **Múltiplos Métodos de Pagamento**

Para permitir que usuário escolha:

```typescript
const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'BOLETO'>('PIX');

const result = await createPayment({
  planId,
  billingCycle,
  paymentMethod // usuário escolhe
});
```

### **Cupons de Desconto**

Para implementar cupons:

1. Criar tabela `coupons` no banco
2. Validar cupom antes de criar pagamento
3. Aplicar desconto no valor da cobrança
4. Registrar cupom usado em `payment_history.metadata`

## ✅ Checklist de Implementação

- [x] Remover colunas `monthly_payment_url` e `annual_payment_url`
- [x] Adicionar `asaas_customer_id` em `user_profiles`
- [x] Implementar Edge Function `asaas-create-customer`
- [x] Implementar Edge Function `asaas-create-payment`
- [x] Implementar Edge Function `asaas-webhook-handler`
- [x] Criar hook `usePayment` para React
- [x] Criar componente `PaymentDialog`
- [x] Atualizar página `/pricing`
- [ ] Configurar variáveis de ambiente no Supabase
- [ ] Deploy das Edge Functions
- [ ] Configurar webhooks no painel Asaas
- [ ] Testar em sandbox
- [ ] Testar em produção com valores pequenos

---

**Última atualização:** 17/10/2025  
**Autor:** Sistema Orbi - Módulo de Pagamentos

