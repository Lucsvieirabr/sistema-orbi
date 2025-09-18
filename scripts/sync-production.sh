#!/bin/bash

# Script para sincronizar dados de produção com ambiente local
# Uso: ./scripts/sync-production.sh

echo "🔄 Sincronizando dados de produção com ambiente local..."

# Verificar se o Supabase está rodando
if ! supabase status > /dev/null 2>&1; then
    echo "📦 Iniciando Supabase local..."
    supabase start
fi

# Fazer backup do banco atual (opcional)
echo "💾 Fazendo backup do banco local atual..."
if [ -f "local_backup.sql" ]; then
    rm local_backup.sql
fi
pg_dump postgresql://postgres:postgres@127.0.0.1:54332/postgres > local_backup.sql 2>/dev/null

# Fazer dump do schema de produção
echo "📤 Baixando schema de produção..."
supabase db dump --file production_schema.sql

# Fazer dump dos dados de produção
echo "📤 Baixando dados de produção..."
supabase db dump --data-only --file production_data.sql

# Aplicar schema no banco local
echo "🔄 Aplicando schema no banco local..."
psql postgresql://postgres:postgres@127.0.0.1:54332/postgres -f production_schema.sql > /dev/null 2>&1

# Aplicar dados no banco local
echo "🔄 Aplicando dados no banco local..."
psql postgresql://postgres:postgres@127.0.0.1:54332/postgres -f production_data.sql > /dev/null 2>&1

# Verificar se a sincronização foi bem-sucedida
echo "✅ Verificando sincronização..."
TOTAL_ACCOUNTS=$(psql postgresql://postgres:postgres@127.0.0.1:54332/postgres -t -c "SELECT COUNT(*) FROM accounts;" 2>/dev/null | tr -d ' ')
TOTAL_TRANSACTIONS=$(psql postgresql://postgres:postgres@127.0.0.1:54332/postgres -t -c "SELECT COUNT(*) FROM transactions;" 2>/dev/null | tr -d ' ')

echo "📊 Dados sincronizados:"
echo "   • Contas: $TOTAL_ACCOUNTS"
echo "   • Transações: $TOTAL_TRANSACTIONS"

echo ""
echo "✅ Sincronização concluída!"
echo "🌐 Acesse o Studio: http://127.0.0.1:54333"
echo "🔧 Para rodar sua aplicação: npm run dev"
