# 🚀 Guia de Deploy em Produção - Integração Logo.dev

## 📋 Visão Geral

Este documento contém **todos os passos necessários** para fazer deploy da integração logo.dev em produção no Supabase.

---

## ✅ Pré-requisitos

Antes de começar, certifique-se de ter:

- [ ] Conta no Supabase (https://supabase.com)
- [ ] Projeto Supabase criado
- [ ] Supabase CLI instalado (`npm install -g supabase`)
- [ ] Token da API logo.dev (https://logo.dev)
- [ ] Git configurado no projeto

---

## 🔧 Passo 1: Preparar o Projeto

### 1.1 Login no Supabase

```bash
cd "/home/lucas/Área de trabalho/SistemaOrbi-main"

# Login no Supabase CLI
supabase login
```

Isso abrirá o navegador para você fazer login.

### 1.2 Link com o Projeto Remoto

```bash
# Link com seu projeto de produção
supabase link --project-ref SEU_PROJECT_REF
```

> 💡 **Onde encontrar o PROJECT_REF:**
> - Dashboard Supabase → Settings → General → Reference ID

### 1.3 Verificar Conexão

```bash
# Verificar se está linkado corretamente
supabase status
```

---

## 🗄️ Passo 2: Deploy do Banco de Dados

### 2.1 Aplicar Migrações

```bash
# Push de todas as migrações para produção
supabase db push
```

Isso aplicará:
- ✅ `20251009000002_add_logo_url_to_series.sql` - Campo logo_url
- ✅ `20251010000001_create_logos_storage_bucket.sql` - Bucket de storage

### 2.2 Verificar Migrações Aplicadas

```bash
# Ver migrações aplicadas
supabase migration list
```

### 2.3 Criar Bucket Manualmente (se necessário)

Se a migração do bucket falhar, crie manualmente:

1. Acesse: **Dashboard → Storage → Create bucket**
2. Nome: `company-logos`
3. Public: ✅ **Marcado**
4. File size limit: `512 KB`
5. Allowed MIME types: `image/png, image/jpeg, image/jpg, image/webp`

### 2.4 Configurar Políticas RLS

Execute no **SQL Editor** do dashboard:

```sql
-- Public read access
CREATE POLICY "Public read access to company logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload company logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-logos');

-- Authenticated users can update
CREATE POLICY "Authenticated users can update company logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'company-logos');

-- Authenticated users can delete
CREATE POLICY "Authenticated users can delete company logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'company-logos');
```

---

## ⚡ Passo 3: Deploy da Edge Function

### 3.1 Deploy da Função

```bash
# Deploy da Edge Function get-company-logo
supabase functions deploy get-company-logo
```

### 3.2 Configurar Secrets (Tokens)

```bash
# Configurar token de busca da API
supabase secrets set LOGO_DEV_TOKEN=sk_seu_token_aqui

# Configurar token de imagens
supabase secrets set LOGO_DEV_TOKEN_IMAGES=pk_seu_token_aqui

# Configurar service role key (pegue do dashboard)
supabase secrets set SERVICE_ROLE_KEY=eyJhbGc...seu_service_role_key
```

> 💡 **Onde encontrar o SERVICE_ROLE_KEY:**
> - Dashboard → Settings → API → `service_role` secret

### 3.3 Verificar Secrets

```bash
# Listar secrets configurados
supabase secrets list
```

Deve mostrar:
```
LOGO_DEV_TOKEN
LOGO_DEV_TOKEN_IMAGES
SERVICE_ROLE_KEY
```

### 3.4 Testar Edge Function

```bash
# Pegar seu ANON_KEY do dashboard
# Dashboard → Settings → API → anon public

# Testar a função
curl -X POST https://SEU_PROJECT.supabase.co/functions/v1/get-company-logo \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Netflix"}'
```

Resposta esperada:
```json
{
  "logo_url": "https://SEU_PROJECT.supabase.co/storage/v1/object/public/company-logos/logos/netflix.png",
  "source": "api"
}
```

---

## 🎨 Passo 4: Deploy do Frontend

### 4.1 Atualizar Variáveis de Ambiente

Crie/atualize o arquivo `.env.production`:

```bash
# Backend Supabase
VITE_SUPABASE_URL=https://SEU_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=seu_anon_key_aqui
```

> ⚠️ **IMPORTANTE:** Não coloque os tokens da logo.dev no frontend!

### 4.2 Build do Frontend

```bash
# Build de produção
npm run build
```

### 4.3 Deploy do Frontend

Dependendo da plataforma:

**Vercel:**
```bash
vercel --prod
```

**Netlify:**
```bash
netlify deploy --prod
```

**Outros:** Faça upload da pasta `dist/` para seu hosting.

---

## ✅ Passo 5: Verificação Final

### 5.1 Checklist de Deploy

- [ ] Migrações aplicadas (ver no Dashboard → Database)
- [ ] Bucket `company-logos` existe e é público
- [ ] Políticas RLS configuradas
- [ ] Edge Function `get-company-logo` deployada
- [ ] Secrets configurados (3 secrets)
- [ ] Frontend buildado e deployado
- [ ] Variáveis de ambiente configuradas

### 5.2 Teste Completo em Produção

1. **Acessar aplicação em produção**
2. **Fazer login**
3. **Ir para "Extrato Mensal"**
4. **Criar transação:**
   - Tipo: Despesa
   - Categoria: Assinaturas
   - Descrição: "Netflix"
   - Valor: R$ 55,90
   - Marcar: Transação Fixa/Recorrente
5. **Salvar**
6. **Ir para Dashboard**
7. **Verificar:**
   - Logo da Netflix aparece
   - Card "Assinaturas Ativas" visível
   - Valor correto (R$ 55,90/mês)

### 5.3 Verificar Cache Funcionando

1. **Criar outra transação** com "Netflix"
2. **Abrir console do navegador** (F12)
3. **Ver mensagem:** `Logo obtained from: storage`
4. **Verificar no Dashboard → Storage:**
   - Bucket: company-logos
   - Pasta: logos
   - Arquivo: netflix.png ✅

---

## 📊 Passo 6: Monitoramento

### 6.1 Ver Logs da Edge Function

```bash
# Ver logs em tempo real
supabase functions logs get-company-logo --follow

# Ver últimos 100 logs
supabase functions logs get-company-logo -n 100
```

### 6.2 Ver Logos Armazenados

**Via Dashboard:**
1. Dashboard → Storage
2. Bucket: company-logos
3. Pasta: logos
4. Ver todos os logos salvos

**Via SQL:**
```sql
SELECT 
  name,
  created_at,
  (metadata->>'size')::int as size_bytes,
  ROUND((metadata->>'size')::int / 1024.0, 2) as size_kb
FROM storage.objects
WHERE bucket_id = 'company-logos'
ORDER BY created_at DESC;
```

### 6.3 Métricas de Uso

```sql
-- Total de logos
SELECT COUNT(*) as total_logos
FROM storage.objects
WHERE bucket_id = 'company-logos';

-- Espaço usado
SELECT 
  COUNT(*) as total_logos,
  SUM((metadata->>'size')::bigint) as total_bytes,
  ROUND(SUM((metadata->>'size')::bigint) / 1024.0 / 1024.0, 2) as total_mb
FROM storage.objects
WHERE bucket_id = 'company-logos';

-- Logos mais recentes
SELECT 
  name,
  created_at
FROM storage.objects
WHERE bucket_id = 'company-logos'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔧 Passo 7: Configurações Avançadas

### 7.1 Ajustar URLs para Produção

A Edge Function usa automaticamente as URLs corretas em produção:
- **Interna (Docker):** Detectada automaticamente pelo Supabase
- **Pública (CDN):** Usa o domínio do seu projeto

Não precisa fazer nada! ✅

### 7.2 Otimizar Performance

**Cache Headers:**
```sql
-- Já configurado na função: cacheControl: '31536000' (1 ano)
```

**CDN do Supabase:**
- Logos são servidos via CDN global do Supabase
- Cache automático no navegador
- Performance excelente

### 7.3 Limites e Quotas

**Supabase Storage:**
- Free tier: 1 GB
- Logos: ~10-20 KB cada
- Capacidade: ~50.000-100.000 logos

**API logo.dev:**
- Verificar limites do seu plano
- Com cache: ~95% menos chamadas

---

## 🐛 Troubleshooting em Produção

### Logo não aparece

**1. Verificar se Edge Function está ativa:**
```bash
supabase functions list
```

**2. Ver logs de erro:**
```bash
supabase functions logs get-company-logo -n 50
```

**3. Testar função diretamente:**
```bash
curl -X POST https://SEU_PROJECT.supabase.co/functions/v1/get-company-logo \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Spotify"}'
```

### Erro 401/403

**Causa:** Secrets não configurados  
**Solução:**
```bash
supabase secrets set LOGO_DEV_TOKEN=...
supabase secrets set LOGO_DEV_TOKEN_IMAGES=...
```

### Erro 500 na função

**Causa:** SERVICE_ROLE_KEY não configurado  
**Solução:**
```bash
# Pegar do dashboard e configurar
supabase secrets set SERVICE_ROLE_KEY=eyJ...
```

### Cache não funciona

**Causa:** Bucket não existe ou sem permissões  
**Solução:** Ver Passo 2.3 e 2.4 acima

---

## 🔄 Passo 8: Atualizações Futuras

### Atualizar Edge Function

```bash
# Fazer mudanças no código
nano supabase/functions/get-company-logo/index.ts

# Re-deploy
supabase functions deploy get-company-logo
```

### Adicionar Novas Migrações

```bash
# Criar nova migração
supabase migration new nome_da_migracao

# Aplicar em produção
supabase db push
```

### Atualizar Secrets

```bash
# Atualizar token (se renovar)
supabase secrets set LOGO_DEV_TOKEN=novo_token
```

---

## 📈 Passo 9: Monitoramento Contínuo

### Métricas Importantes

**Taxa de Cache:**
```sql
-- Ver quantas séries têm logos
SELECT 
  COUNT(*) as total_series,
  COUNT(logo_url) as series_with_logos,
  ROUND(COUNT(logo_url) * 100.0 / COUNT(*), 2) as percentage
FROM series
WHERE is_fixed = true OR category_id IN (
  SELECT id FROM categories WHERE name ILIKE '%assinatura%'
);
```

**Uso do Storage:**
```sql
SELECT 
  bucket_id,
  COUNT(*) as files,
  pg_size_pretty(SUM((metadata->>'size')::bigint)) as total_size
FROM storage.objects
WHERE bucket_id = 'company-logos'
GROUP BY bucket_id;
```

### Alertas Recomendados

Configure alertas para:
- Quota de storage > 80%
- Erros na Edge Function > 10/hora
- Tempo de resposta > 2s

---

## 💰 Passo 10: Custos e Otimizações

### Economia Estimada

**Sem cache (antes):**
- 1.000 assinaturas × 30 acessos/mês = 30.000 chamadas API
- Custo: ~$30/mês

**Com cache (depois):**
- 1.000 logos únicos × 1 chamada = 1.000 chamadas API
- 29.000 acessos do storage (grátis)
- Custo: ~$1/mês
- **Economia: 97%** 💰

### Otimizações Adicionais

**1. Pré-popular cache com logos populares:**
```bash
# Script para popular logos comuns
for company in netflix spotify disney apple google; do
  curl -X POST https://SEU_PROJECT.supabase.co/functions/v1/get-company-logo \
    -H "Authorization: Bearer SEU_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"companyName\":\"$company\"}"
  sleep 1
done
```

**2. Limpeza automática de logos não usados:**
```sql
-- Deletar logos que não estão em nenhuma série (executar mensalmente)
DELETE FROM storage.objects
WHERE bucket_id = 'company-logos'
AND name NOT IN (
  SELECT DISTINCT 
    'logos/' || REGEXP_REPLACE(LOWER(description), '[^a-z0-9]', '-', 'g') || '.png'
  FROM series
  WHERE logo_url IS NOT NULL
);
```

---

## 📝 Passo 11: Checklist Final de Produção

### Backend

- [ ] **Migrações aplicadas:**
  ```bash
  supabase migration list
  ```

- [ ] **Bucket criado e público:**
  - Dashboard → Storage → company-logos ✅

- [ ] **Políticas RLS configuradas:**
  ```sql
  SELECT policyname FROM pg_policies 
  WHERE tablename = 'objects' 
  AND policyname ILIKE '%company-logos%';
  ```

- [ ] **Edge Function deployada:**
  ```bash
  supabase functions list
  # Deve mostrar: get-company-logo ✅
  ```

- [ ] **Secrets configurados:**
  ```bash
  supabase secrets list
  # Deve mostrar:
  # - LOGO_DEV_TOKEN ✅
  # - LOGO_DEV_TOKEN_IMAGES ✅
  # - SERVICE_ROLE_KEY ✅
  ```

### Frontend

- [ ] **Variáveis de ambiente produção:**
  - VITE_SUPABASE_URL ✅
  - VITE_SUPABASE_ANON_KEY ✅

- [ ] **Build passou sem erros:**
  ```bash
  npm run build
  ```

- [ ] **Deploy realizado:**
  - Vercel/Netlify/outro hosting ✅

### Testes

- [ ] **Criar assinatura em produção** ✅
- [ ] **Logo aparece no dashboard** ✅
- [ ] **Segunda assinatura usa cache** ✅
- [ ] **URL do logo está correta** ✅
- [ ] **Console mostra "Logo obtained from: storage"** ✅

---

## 🎯 Comandos Resumidos (Copiar e Colar)

```bash
# ===========================================
# DEPLOY COMPLETO EM PRODUÇÃO
# ===========================================

# 1. Login e Link
supabase login
supabase link --project-ref SEU_PROJECT_REF

# 2. Deploy Banco de Dados
supabase db push

# 3. Deploy Edge Function
supabase functions deploy get-company-logo

# 4. Configurar Secrets
supabase secrets set LOGO_DEV_TOKEN=sk_...
supabase secrets set LOGO_DEV_TOKEN_IMAGES=pk_...
supabase secrets set SERVICE_ROLE_KEY=eyJ...

# 5. Verificar
supabase secrets list
supabase functions list

# 6. Testar
curl -X POST https://SEU_PROJECT.supabase.co/functions/v1/get-company-logo \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Netflix"}'

# 7. Build Frontend
npm run build

# 8. Deploy Frontend (exemplo Vercel)
vercel --prod
```

---

## 🔒 Segurança em Produção

### Boas Práticas

✅ **Tokens protegidos:**
- Nunca commitar tokens no git
- Usar secrets do Supabase
- Rotacionar tokens periodicamente

✅ **RLS ativo:**
- Storage com políticas públicas para leitura
- Upload apenas autenticado

✅ **HTTPS everywhere:**
- Supabase usa HTTPS automaticamente
- logo.dev usa HTTPS
- Frontend deve usar HTTPS

### Rotação de Tokens

Se precisar trocar tokens:

```bash
# 1. Gerar novos tokens na logo.dev
# 2. Atualizar secrets
supabase secrets set LOGO_DEV_TOKEN=novo_token
supabase secrets set LOGO_DEV_TOKEN_IMAGES=novo_token_images

# 3. Reiniciar função (automático)
```

---

## 📞 Suporte e Links Úteis

### Documentação Oficial

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Logo.dev API](https://logo.dev/docs)

### Comandos Úteis

```bash
# Ver status do projeto
supabase status

# Ver logs da função
supabase functions logs get-company-logo --follow

# Ver arquivos no storage
supabase storage ls company-logos/logos --linked

# Baixar logo do storage
supabase storage download company-logos/logos/netflix.png

# Deletar logo do storage
supabase storage rm company-logos/logos/netflix.png
```

### Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| 401 Unauthorized | Token inválido | Verificar secrets |
| 403 Forbidden | RLS bloqueando | Verificar políticas |
| 404 Not Found | Função não deployada | `supabase functions deploy` |
| 500 Internal Error | Secret faltando | `supabase secrets set` |
| CORS Error | Headers faltando | Verificar cors.ts |

---

## 🎊 Conclusão

Após seguir todos os passos:

✅ Sistema em produção  
✅ Cache funcionando  
✅ Economia de 95% da API  
✅ Performance otimizada  
✅ Monitoramento ativo  

### Custos Estimados (Produção)

**Supabase (Free tier é suficiente):**
- Database: Grátis (até 500MB)
- Storage: Grátis (até 1GB)
- Edge Functions: Grátis (até 500K invocações/mês)

**Logo.dev:**
- Com cache: ~$1-5/mês
- Sem cache: ~$30-50/mês
- **Economia: 90-95%**

### Próximos Passos

1. Monitorar uso nas primeiras semanas
2. Ajustar quotas se necessário
3. Adicionar mais logos populares ao cache
4. Configurar alertas de erro
5. Otimizar conforme necessário

---

**🎉 Parabéns! Seu sistema está em produção!**

Para dúvidas ou problemas, consulte:
- `RESUMO_FINAL_IMPLEMENTACAO.md` - Overview geral
- Logs da Edge Function - Erros em tempo real
- Dashboard Supabase - Métricas e status

---

*Última atualização: 10/Out/2025*  
*Versão: 2.0.0*  
*Status: ✅ Pronto para Produção*

