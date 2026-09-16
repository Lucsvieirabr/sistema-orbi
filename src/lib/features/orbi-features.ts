/**
 * ============================================================================
 * DEFINIÇÃO DE FEATURES DO ORBI
 * ============================================================================
 * 
 * ⚠️ IMPORTANTE: Estas features correspondem EXATAMENTE às páginas do menu lateral!
 * Apenas funcionalidades REAIS que existem no sistema devem estar aqui.
 */

import { featureRegistry, defineFeature, defineLimit } from './feature-registry';

// ============================================================================
// 🎯 FEATURES CORE (Sempre Incluídas)
// ============================================================================

featureRegistry.registerFeatures([
  defineFeature(
    'dashboard',
    'Dashboard',
    'Acesso ao dashboard principal do sistema',
    'core',
    { isCore: true, route: '/sistema', metadata: { module: 'dashboard', icon: '📊', moduleLabel: 'Dashboard' } }
  ),
]);

// ============================================================================
// 💰 PÁGINAS DO MENU LATERAL (Features Principais)
// ============================================================================

featureRegistry.registerFeatures([
  // EXTRATO
  defineFeature(
    'extrato',
    'Acessar Extrato',
    'Visualizar a página de extrato mensal com todas as transações',
    'financial',
    { route: '/sistema/statement', metadata: { module: 'extrato', icon: '📝', moduleLabel: 'Extrato' } }
  ),

  // CONTAS
  defineFeature(
    'contas',
    'Acessar Contas',
    'Visualizar a página de gerenciamento de contas bancárias',
    'financial',
    { route: '/sistema/accounts', metadata: { module: 'contas', icon: '🏦', moduleLabel: 'Contas' } }
  ),

  // CATEGORIAS
  defineFeature(
    'categorias',
    'Acessar Categorias',
    'Visualizar a página de gerenciamento de categorias',
    'financial',
    { route: '/sistema/categories', metadata: { module: 'categorias', icon: '📂', moduleLabel: 'Categorias' } }
  ),

  // CARTÕES
  defineFeature(
    'cartoes',
    'Acessar Cartões',
    'Visualizar a página de gerenciamento de cartões de crédito',
    'financial',
    { route: '/sistema/cards', metadata: { module: 'cartoes', icon: '💳', moduleLabel: 'Cartões' } }
  ),

  // PESSOAS
  defineFeature(
    'pessoas',
    'Acessar Pessoas',
    'Visualizar a página de gerenciamento de pessoas e contatos',
    'financial',
    { route: '/sistema/people', metadata: { module: 'pessoas', icon: '👥', moduleLabel: 'Pessoas' } }
  ),

  // IA CLASSIFICADOR
  defineFeature(
    'ia_classificador',
    'Acessar IA Classificador',
    'Visualizar a página do IA Classificador para treinar o modelo de ML',
    'automation',
    { route: '/sistema/my-ai', metadata: { module: 'ia', icon: '🤖', moduleLabel: 'IA Classificador' } }
  ),
]);

// ============================================================================
// 🔧 OPERAÇÕES E FUNCIONALIDADES
// ============================================================================

featureRegistry.registerFeatures([
  // Operações em Transações (Extrato)
  defineFeature(
    'transacoes_criar',
    'Criar Transações',
    'Adicionar novas transações manualmente (botão Nova Transação)',
    'financial',
    { dependencies: ['extrato'], metadata: { module: 'extrato' } }
  ),
  defineFeature(
    'transacoes_editar',
    'Editar Transações',
    'Editar transações existentes',
    'financial',
    { dependencies: ['extrato'], metadata: { module: 'extrato' } }
  ),
  defineFeature(
    'transacoes_excluir',
    'Excluir Transações',
    'Remover transações',
    'financial',
    { dependencies: ['extrato'], metadata: { module: 'extrato' } }
  ),
  defineFeature(
    'transacoes_importar_csv',
    'Importar CSV',
    'Importar transações via arquivo CSV',
    'financial',
    { dependencies: ['extrato'], metadata: { module: 'extrato' } }
  ),

  // Operações em Contas
  defineFeature(
    'contas_criar',
    'Criar Contas',
    'Adicionar novas contas bancárias',
    'financial',
    { dependencies: ['contas'], metadata: { module: 'contas' } }
  ),
  defineFeature(
    'contas_editar',
    'Editar Contas',
    'Editar informações de contas',
    'financial',
    { dependencies: ['contas'], metadata: { module: 'contas' } }
  ),
  defineFeature(
    'contas_excluir',
    'Excluir Contas',
    'Remover contas bancárias',
    'financial',
    { dependencies: ['contas'], metadata: { module: 'contas' } }
  ),

  // Operações em Categorias
  defineFeature(
    'categorias_criar',
    'Criar Categorias',
    'Criar novas categorias',
    'financial',
    { dependencies: ['categorias'], metadata: { module: 'categorias' } }
  ),
  defineFeature(
    'categorias_editar',
    'Editar Categorias',
    'Editar categorias existentes',
    'financial',
    { dependencies: ['categorias'], metadata: { module: 'categorias' } }
  ),
  defineFeature(
    'categorias_excluir',
    'Excluir Categorias',
    'Remover categorias',
    'financial',
    { dependencies: ['categorias'], metadata: { module: 'categorias' } }
  ),

  // Operações em Cartões
  defineFeature(
    'cartoes_criar',
    'Criar Cartões',
    'Adicionar novos cartões de crédito',
    'financial',
    { dependencies: ['cartoes'], metadata: { module: 'cartoes' } }
  ),
  defineFeature(
    'cartoes_editar',
    'Editar Cartões',
    'Editar informações dos cartões',
    'financial',
    { dependencies: ['cartoes'], metadata: { module: 'cartoes' } }
  ),
  defineFeature(
    'cartoes_excluir',
    'Excluir Cartões',
    'Remover cartões de crédito',
    'financial',
    { dependencies: ['cartoes'], metadata: { module: 'cartoes' } }
  ),
  defineFeature(
    'cartoes_faturas',
    'Gerenciar Faturas',
    'Visualizar e gerenciar faturas dos cartões',
    'financial',
    { dependencies: ['cartoes'], metadata: { module: 'cartoes' } }
  ),

  // Operações em Pessoas
  defineFeature(
    'pessoas_criar',
    'Criar Pessoas',
    'Adicionar novas pessoas/contatos',
    'financial',
    { dependencies: ['pessoas'], metadata: { module: 'pessoas' } }
  ),
  defineFeature(
    'pessoas_editar',
    'Editar Pessoas',
    'Editar informações de pessoas',
    'financial',
    { dependencies: ['pessoas'], metadata: { module: 'pessoas' } }
  ),
  defineFeature(
    'pessoas_excluir',
    'Excluir Pessoas',
    'Remover pessoas do sistema',
    'financial',
    { dependencies: ['pessoas'], metadata: { module: 'pessoas' } }
  ),

  // PLANO CASAL (compartilhamento de dados entre 2 usuários)
  defineFeature(
    'familia_compartilhada',
    'Plano Casal',
    'Compartilhar visualização das finanças com um parceiro (2 acessos, 1 assinatura)',
    'core',
    { route: '/sistema/settings', metadata: { module: 'casal', icon: '👥', moduleLabel: 'Plano Casal' } }
  ),

  // Funcionalidades de IA
  defineFeature(
    'ia_classificacao_automatica',
    'Classificação Automática',
    'Usar IA para classificar transações automaticamente',
    'automation',
    { dependencies: ['ia_classificador'], metadata: { module: 'ia' } }
  ),
  // PAINEL DE ASSINATURAS (dashboard)
  // Substitui 'ia_deteccao_logos', removida junto com a integração logo.dev.
  // O card de assinaturas do dashboard nunca dependeu de logo — dependia do
  // gate, e o gate estava pendurado na feature errada.
  defineFeature(
    'dashboard_assinaturas',
    'Painel de Assinaturas',
    'Acompanhar assinaturas recorrentes e o custo mensal total no dashboard',
    'financial',
    { dependencies: ['dashboard'], metadata: { module: 'dashboard', icon: '🔁', moduleLabel: 'Dashboard' } }
  ),
]);

// ============================================================================
// 🧭 PLANEJAMENTO — MÓDULOS PREMIUM (exclusivos Pro e Casal)
// ============================================================================
// Autoridade: migrations 20260915161252 e 20260916021503/021607 (RLS + triggers + RPCs exigem a mesma
// feature). Aqui só declaramos que o módulo EXISTE; quem pode usar vem do plano.
// Catálogo de UX (rota, pitch, prévia) em `premium-modules.ts`.

featureRegistry.registerFeatures([
  defineFeature(
    'orcamentos',
    'Orçamentos Inteligentes',
    'Um teto de gasto por categoria, com consumo do mês em tempo real e sugestões pela média dos últimos 3 meses',
    'financial',
    { route: '/sistema/budgets', metadata: { module: 'planejamento', icon: '🎯', moduleLabel: 'Planejamento' } }
  ),
  defineFeature(
    'metas',
    'Metas Financeiras',
    'Objetivos com valor e prazo, aportes e resgates, e quanto guardar por mês para chegar lá',
    'financial',
    { route: '/sistema/goals', metadata: { module: 'planejamento', icon: '🏁', moduleLabel: 'Planejamento' } }
  ),
  defineFeature(
    'dre_pessoal',
    'DRE Pessoal Avançado',
    'Fechamento do mês: resultado, taxa de poupança, variação contra o mês anterior e maior despesa',
    'financial',
    { route: '/sistema/analytics', metadata: { module: 'planejamento', icon: '📑', moduleLabel: 'Planejamento' } }
  ),
  defineFeature(
    'motor_preditivo',
    'Motor Preditivo',
    'Projeção de caixa de 30/90/365 dias com ralo diário, alerta de ruptura e cenários hipotéticos',
    'financial',
    { route: '/sistema/forecast', metadata: { module: 'planejamento', icon: '🔭', moduleLabel: 'Planejamento' } }
  ),
  defineFeature(
    'contratos_rateio',
    'Contratos de Rateio e Acertos de Viagem',
    'Regras de divisão por pessoa e categoria, eventos com fechamento consolidado, PIX Copia e Cola e liquidação em lote',
    'financial',
    { route: '/sistema/ledgers', metadata: { module: 'planejamento', icon: '🧾', moduleLabel: 'Planejamento' } }
  ),
]);






// ============================================================================
// 📊 LIMITES DO SISTEMA
// ============================================================================

featureRegistry.registerLimits([
  defineLimit(
    'max_contas',
    'Máximo de Contas',
    'Número máximo de contas bancárias que pode cadastrar',
    'financial',
    3,
    { minValue: 1, maxValue: -1, unit: 'contas' }
  ),
  defineLimit(
    'max_cartoes',
    'Máximo de Cartões',
    'Número máximo de cartões de crédito',
    'financial',
    2,
    { minValue: 0, maxValue: -1, unit: 'cartões' }
  ),
  defineLimit(
    'max_transacoes_mes',
    'Transações por Mês',
    'Número máximo de transações que pode criar por mês',
    'financial',
    500,
    { minValue: 50, maxValue: -1, unit: 'transações/mês' }
  ),
  defineLimit(
    'max_pessoas',
    'Máximo de Pessoas',
    'Número máximo de pessoas/contatos',
    'financial',
    10,
    { minValue: 5, maxValue: -1, unit: 'pessoas' }
  ),
  defineLimit(
    'max_categorias',
    'Máximo de Categorias',
    'Número máximo de categorias personalizadas',
    'financial',
    20,
    { minValue: 10, maxValue: -1, unit: 'categorias' }
  ),
  defineLimit(
    'max_membros_familia',
    'Acessos Compartilhados',
    'Quantas pessoas além do titular podem visualizar as finanças (Plano Casal)',
    'core',
    0,
    { minValue: 0, maxValue: 1, unit: 'acessos' }
  ),
  defineLimit(
    'retencao_dados_meses',
    'Retenção de Dados',
    'Por quantos meses os dados históricos são mantidos',
    'core',
    12,
    { minValue: 6, maxValue: -1, unit: 'meses' }
  ),
]);

// Exportar para fácil acesso
export { featureRegistry };

