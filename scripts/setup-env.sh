#!/bin/bash

# Script para configurar variáveis de ambiente local
# Uso: source scripts/setup-env.sh

echo "🔧 Configurando variáveis de ambiente para desenvolvimento local..."

# Verificar se o Supabase está rodando
if ! supabase status > /dev/null 2>&1; then
    echo "❌ Supabase não está rodando. Execute: supabase start"
    return 1
fi

# Obter as chaves do Supabase local
SUPABASE_URL=$(supabase status | grep "API URL" | awk '{print $3}')
SUPABASE_ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')

# Exportar as variáveis
export VITE_SUPABASE_URL="$SUPABASE_URL"
export VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

echo "✅ Variáveis configuradas:"
echo "   • VITE_SUPABASE_URL: $VITE_SUPABASE_URL"
echo "   • VITE_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:0:20}..."
echo ""
echo "🚀 Agora você pode executar: npm run dev"
