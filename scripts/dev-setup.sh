#!/bin/bash

# Script para configurar ambiente de desenvolvimento completo
# Uso: ./scripts/dev-setup.sh

echo "🚀 Configurando ambiente de desenvolvimento do Sistema Orbi..."

# Verificar se o Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado!"
    echo "   Instale com: npm install -g supabase"
    echo "   Ou visite: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "   Instale o Node.js: https://nodejs.org/"
    exit 1
fi

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Iniciar Supabase local
echo "📦 Iniciando Supabase local..."
if ! supabase status > /dev/null 2>&1; then
    supabase start
else
    echo "✅ Supabase já está rodando"
fi

# Aplicar migrações e seeds
echo "🔄 Aplicando migrações e dados de teste..."
supabase db reset

# Obter as chaves do Supabase local
echo "⚙️ Configurando variáveis de ambiente..."
SUPABASE_URL=$(supabase status | grep "API URL" | awk '{print $3}')
SUPABASE_ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')

# Atualizar arquivo .env
echo "VITE_SUPABASE_URL=$SUPABASE_URL" > .env
echo "VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> .env

echo "✅ Ambiente configurado com sucesso!"
echo ""
echo "📊 URLs disponíveis:"
echo "   • Studio: http://127.0.0.1:54333"
echo "   • API: $SUPABASE_URL"
echo "   • Database: postgresql://postgres:postgres@127.0.0.1:54332/postgres"
echo ""
echo "🚀 Para iniciar a aplicação:"
echo "   npm run dev"
echo ""
echo "🔧 Comandos úteis:"
echo "   • Parar Supabase: supabase stop"
echo "   • Resetar banco: supabase db reset"
echo "   • Ver status: supabase status"
