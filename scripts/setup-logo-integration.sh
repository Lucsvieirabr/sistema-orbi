#!/bin/bash

# Script de setup automático para integração logo.dev
# Autor: Sistema Orbi
# Data: Outubro 2025

set -e

echo "🎨 Setup da Integração Logo.dev"
echo "================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se está na raiz do projeto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Execute este script da raiz do projeto${NC}"
    exit 1
fi

# 1. Verificar se Supabase CLI está instalado
echo "📦 Verificando Supabase CLI..."
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo "Instale com: npm install -g supabase"
    exit 1
fi
echo -e "${GREEN}✅ Supabase CLI encontrado${NC}"
echo ""

# 2. Verificar/Criar arquivo .env para Edge Functions
echo "🔑 Configurando variáveis de ambiente..."
ENV_FILE="supabase/functions/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "LOGO_DEV_TOKEN=" > "$ENV_FILE"
    echo -e "${YELLOW}⚠️  Arquivo .env criado em supabase/functions/.env${NC}"
    echo -e "${YELLOW}   Por favor, adicione seu token da logo.dev${NC}"
    echo ""
else
    echo -e "${GREEN}✅ Arquivo .env já existe${NC}"
fi

# Verificar se token está configurado
if grep -q "LOGO_DEV_TOKEN=\$" "$ENV_FILE" || grep -q "LOGO_DEV_TOKEN=$" "$ENV_FILE"; then
    echo -e "${YELLOW}⚠️  Token não configurado ainda${NC}"
    echo "   Edite: $ENV_FILE"
    echo "   Obtenha seu token em: https://logo.dev"
    echo ""
else
    echo -e "${GREEN}✅ Token configurado${NC}"
    echo ""
fi

# 3. Aplicar migrações
echo "🗄️  Aplicando migrações do banco..."
if supabase db push --dry-run 2>&1 | grep -q "20251009000002_add_logo_url_to_series"; then
    echo -e "${YELLOW}⚠️  Migração ainda não aplicada${NC}"
    read -p "Deseja aplicar agora? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        supabase db push
        echo -e "${GREEN}✅ Migração aplicada${NC}"
    else
        echo -e "${YELLOW}⚠️  Migração pulada - execute manualmente: supabase db push${NC}"
    fi
else
    echo -e "${GREEN}✅ Migrações atualizadas${NC}"
fi
echo ""

# 4. Verificar se Supabase está rodando
echo "🚀 Verificando Supabase local..."
if ! supabase status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase não está rodando${NC}"
    read -p "Deseja iniciar agora? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        supabase start
        echo -e "${GREEN}✅ Supabase iniciado${NC}"
    else
        echo -e "${YELLOW}⚠️  Execute manualmente: supabase start${NC}"
    fi
else
    echo -e "${GREEN}✅ Supabase rodando${NC}"
fi
echo ""

# 5. Instruções para testar
echo "🎯 Próximos Passos:"
echo "==================="
echo ""
echo "1. Configurar token (se ainda não fez):"
echo -e "   ${YELLOW}nano $ENV_FILE${NC}"
echo ""
echo "2. Servir a Edge Function localmente:"
echo -e "   ${YELLOW}cd supabase/functions${NC}"
echo -e "   ${YELLOW}supabase functions serve search-logo --env-file .env${NC}"
echo ""
echo "3. Testar a função:"
echo -e '   ${YELLOW}curl -X POST http://localhost:54321/functions/v1/search-logo \\${NC}'
echo -e '     ${YELLOW}-H "Content-Type: application/json" \\${NC}'
echo -e '     ${YELLOW}-d '"'"'{"query":"Netflix"}'"'"'${NC}'
echo ""
echo "4. Iniciar o app:"
echo -e "   ${YELLOW}npm run dev${NC}"
echo ""
echo "5. Criar uma assinatura no app e ver o logo no dashboard!"
echo ""

# 6. Deploy em produção (opcional)
echo "📦 Para deploy em produção:"
echo "============================"
echo ""
echo "1. Deploy da Edge Function:"
echo -e "   ${YELLOW}supabase functions deploy search-logo${NC}"
echo ""
echo "2. Configurar secret em produção:"
echo -e "   ${YELLOW}supabase secrets set LOGO_DEV_TOKEN=seu_token${NC}"
echo ""
echo "3. Aplicar migrações:"
echo -e "   ${YELLOW}supabase db push${NC}"
echo ""

echo -e "${GREEN}✨ Setup concluído!${NC}"
echo ""
echo "📚 Documentação completa: LOGO_INTEGRATION_README.md"
echo "⚡ Setup rápido: QUICK_SETUP.md"

