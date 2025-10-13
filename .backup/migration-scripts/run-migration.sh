#!/bin/bash

###############################################################################
# Script de Migração do BankDictionary para Supabase
# 
# Este script automatiza todo o processo de migração
###############################################################################

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🚀 MIGRAÇÃO DO BANKDICTIONARY PARA SUPABASE             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verificar se está na raiz do projeto
if [ ! -f "package.json" ]; then
  echo "❌ Erro: Execute este script da raiz do projeto"
  exit 1
fi

# Verificar se as variáveis de ambiente estão configuradas
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Erro: Variáveis de ambiente não configuradas"
  echo ""
  echo "Configure:"
  echo "  export VITE_SUPABASE_URL=https://your-project.supabase.co"
  echo "  export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
  echo ""
  exit 1
fi

echo "✅ Variáveis de ambiente configuradas"
echo ""

# Passo 1: Aplicar migration
echo "📋 Passo 1/4: Aplicar migration SQL..."
echo ""

if command -v supabase &> /dev/null; then
  echo "  Usando Supabase CLI..."
  npx supabase migration up
else
  echo "  ⚠️  Supabase CLI não encontrado"
  echo "  Por favor, aplique manualmente a migration:"
  echo "  supabase/migrations/20250131000014_create_merchants_dictionary.sql"
  echo ""
  read -p "Migration aplicada? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migração cancelada"
    exit 1
  fi
fi

echo "✅ Migration aplicada"
echo ""

# Passo 2: Instalar dependências
echo "📦 Passo 2/4: Verificar dependências..."
echo ""

if ! npm list @supabase/supabase-js &> /dev/null; then
  echo "  Instalando @supabase/supabase-js..."
  npm install @supabase/supabase-js
fi

if ! npm list tsx &> /dev/null; then
  echo "  Instalando tsx..."
  npm install -D tsx
fi

echo "✅ Dependências instaladas"
echo ""

# Passo 3: Executar script ETL
echo "🔄 Passo 3/4: Executar migração de dados..."
echo ""

npx tsx scripts/migrate-bank-dictionary-to-supabase.ts

echo ""
echo "✅ Dados migrados"
echo ""

# Passo 4: Regenerar tipos (opcional)
echo "🔧 Passo 4/4: Regenerar tipos TypeScript..."
echo ""

if command -v supabase &> /dev/null; then
  echo "  Regenerando tipos..."
  npx supabase gen types typescript --local > src/integrations/supabase/types.ts
  echo "✅ Tipos regenerados"
else
  echo "  ⚠️  Supabase CLI não encontrado"
  echo "  Copie manualmente os tipos de: supabase/types-to-add.ts"
  echo "  Para: src/integrations/supabase/types.ts"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Próximos passos:"
echo "1. Atualize IntelligentTransactionClassifier.ts:"
echo "   import { BankDictionary } from './BankDictionaryV2';"
echo ""
echo "2. Teste a aplicação:"
echo "   npm run dev"
echo ""
echo "3. Consulte a documentação:"
echo "   docs/MIGRACAO_BANK_DICTIONARY.md"
echo ""

