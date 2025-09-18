#!/bin/bash

# Script para configurar ambiente local de desenvolvimento
# Uso: ./scripts/dev-local.sh

echo "🚀 Configurando ambiente local de desenvolvimento..."

# Verificar se o Supabase está rodando
if ! supabase status > /dev/null 2>&1; then
    echo "📦 Iniciando Supabase local..."
    supabase start
fi

# Aplicar migrações e seeds
echo "🔄 Aplicando migrações e dados de teste..."
supabase db reset

# Configurar variáveis de ambiente para desenvolvimento local
echo "⚙️ Configurando variáveis de ambiente..."
echo "   • URL: http://127.0.0.1:54331"
echo "   • Chave anônima: (use a chave local do Supabase)"
echo ""
echo "📝 Para configurar as variáveis de ambiente, execute:"
echo "   export VITE_SUPABASE_URL=http://127.0.0.1:54331"
echo "   export VITE_SUPABASE_ANON_KEY=\$(supabase status | grep 'anon key' | cut -d' ' -f3)"

echo "✅ Ambiente local configurado!"
echo ""
echo "📊 URLs disponíveis:"
echo "   • Studio: http://127.0.0.1:54333"
echo "   • API: http://127.0.0.1:54331"
echo "   • Database: postgresql://postgres:postgres@127.0.0.1:54332/postgres"
echo ""
echo "🔧 Para parar o ambiente local: supabase stop"
echo "🔄 Para resetar o banco: supabase db reset"
