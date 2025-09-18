#!/bin/bash

# Script para parar ambiente de desenvolvimento
# Uso: ./scripts/stop-dev.sh

echo "🛑 Parando ambiente de desenvolvimento..."

# Parar Supabase local
echo "📦 Parando Supabase local..."
supabase stop

echo "✅ Ambiente parado com sucesso!"
echo ""
echo "💡 Para iniciar novamente: ./scripts/start-dev.sh"
