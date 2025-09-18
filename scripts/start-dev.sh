#!/bin/bash

# Script para iniciar desenvolvimento completo
# Uso: ./scripts/start-dev.sh

echo "🚀 Iniciando ambiente de desenvolvimento completo..."

# Verificar se o Supabase está rodando
if ! supabase status > /dev/null 2>&1; then
    echo "📦 Iniciando Supabase local..."
    supabase start
else
    echo "✅ Supabase já está rodando"
fi

# Configurar variáveis de ambiente
echo "⚙️ Configurando variáveis de ambiente..."
source scripts/setup-env.sh

# Iniciar aplicação React
echo "🌐 Iniciando aplicação React..."
npm run dev
