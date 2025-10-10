#!/bin/bash

# Script para iniciar Edge Function de logos
cd "$(dirname "$0")/.."

echo "🚀 Iniciando Edge Function get-company-logo..."
echo ""

# Aplicar migração do bucket primeiro
echo "📦 Aplicando migração do bucket..."
supabase db push --include-all 2>&1 | grep -E "migration|error|Error|✓|✗" || true
echo ""

# Iniciar função
echo "🔧 Iniciando Edge Function..."
cd supabase/functions
supabase functions serve get-company-logo --env-file .env --no-verify-jwt


# cd "/home/lucas/Área de trabalho/SistemaOrbi-main/supabase/functions"
# supabase functions serve get-company-logo --env-file .env --no-verify-jwt
