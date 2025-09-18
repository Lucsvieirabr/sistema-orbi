#!/bin/bash

# Script para configurar ambiente de produção
# Uso: ./scripts/dev-production.sh

echo "🌐 Configurando ambiente de produção..."

# Verificar se as variáveis de ambiente de produção estão definidas
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ Erro: Variáveis de ambiente de produção não encontradas!"
    echo "   Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas"
    echo "   no seu arquivo .env ou nas variáveis de ambiente do sistema."
    exit 1
fi

echo "✅ Ambiente de produção configurado!"
echo ""
echo "🔗 Conectando ao Supabase em produção..."
echo "   • URL: $VITE_SUPABASE_URL"
echo ""
echo "⚠️  ATENÇÃO: Você está trabalhando com o banco de produção!"
echo "   Certifique-se de ter cuidado com as operações que realizar."
