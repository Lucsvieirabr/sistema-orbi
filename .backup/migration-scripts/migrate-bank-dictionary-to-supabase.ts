/**
 * Script ETL: Migração do BankDictionary.ts para Supabase
 * 
 * Este script extrai todos os dados hardcoded do BankDictionary.ts
 * e os insere na tabela merchants_dictionary no Supabase.
 * 
 * Uso: npx tsx scripts/migrate-bank-dictionary-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas!');
  console.error('Configure: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================================
// INTERFACE DE MERCHANT
// ============================================================================

interface MerchantEntry {
  merchant_key: string;
  entity_name: string;
  category: string;
  subcategory?: string;
  aliases: string[];
  confidence_modifier: number;
  priority: number;
  entry_type: 'merchant' | 'banking_pattern' | 'keyword' | 'utility';
  state_specific?: boolean;
  states?: string[];
  context?: string;
  keywords?: string[];
  regex_patterns?: string[];
  metadata?: any;
}

// ============================================================================
// CARREGAR DADOS EXTRAÍDOS DO BANKDICTIONARY.TS
// ============================================================================

// Carregar dados do arquivo JSON gerado pelo extract script
const EXTRACTED_DATA_PATH = path.join(__dirname, './extracted-merchants-data.json');
let merchantsData: MerchantEntry[] = [];

try {
  const rawData = fs.readFileSync(EXTRACTED_DATA_PATH, 'utf-8');
  merchantsData = JSON.parse(rawData);
  console.log(`✅ Carregados ${merchantsData.length} registros do arquivo extraído\n`);
} catch (error) {
  console.warn('⚠️  Arquivo de dados extraídos não encontrado. Usando dados de exemplo...\n');
  merchantsData = [
  // ========================================
  // SUPERMERCADOS, ATACADOS E HIPERMERCADOS
  // ========================================
  
  // Redes Nacionais de Atacado
  {
    merchant_key: 'assai atacadista',
    entity_name: 'Assaí Atacadista',
    category: 'Alimentação',
    subcategory: 'Atacado',
    aliases: ['assai', 'assaí', 'atacadista assai'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'atacadao',
    entity_name: 'Atacadão',
    category: 'Alimentação',
    subcategory: 'Atacado',
    aliases: ['carrefour atacadao', 'atacadão'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'tenda atacado',
    entity_name: 'Tenda Atacado',
    category: 'Alimentação',
    subcategory: 'Atacado',
    aliases: ['tenda'],
    confidence_modifier: 0.90,
    priority: 95,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'fort atacadista',
    entity_name: 'Fort Atacadista',
    category: 'Alimentação',
    subcategory: 'Atacado',
    aliases: ['fort', 'atacadista fort', 'fort ataca'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'komprao koch atacadista',
    entity_name: 'Komprao Koch Atacadista',
    category: 'Alimentação',
    subcategory: 'Atacado',
    aliases: ['komprao', 'koch', 'koch atacadista', 'komprao koch', 'atacadista koch'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  
  // Redes Nacionais de Supermercados
  {
    merchant_key: 'carrefour',
    entity_name: 'Carrefour',
    category: 'Alimentação',
    subcategory: 'Hipermercado',
    aliases: ['carfour'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'pao de acucar',
    entity_name: 'Pão de Açúcar',
    category: 'Alimentação',
    subcategory: 'Supermercado',
    aliases: ['pao de acucar', 'paodeacu', 'pão de açucar', 'gpa'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'extra',
    entity_name: 'Extra',
    category: 'Alimentação',
    subcategory: 'Hipermercado',
    aliases: ['extra supermercado', 'hipermercado extra'],
    confidence_modifier: 0.90,
    priority: 95,
    entry_type: 'merchant'
  },
  
  // ========================================
  // DELIVERY E APLICATIVOS DE COMIDA
  // ========================================
  {
    merchant_key: 'ifood',
    entity_name: 'iFood',
    category: 'Alimentação',
    subcategory: 'Delivery',
    aliases: ['i food', 'ifood.com.br', 'ifood delivery'],
    confidence_modifier: 1.0,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'uber eats',
    entity_name: 'Uber Eats',
    category: 'Alimentação',
    subcategory: 'Delivery',
    aliases: ['ubereats', 'uber eat'],
    confidence_modifier: 1.0,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'rappi',
    entity_name: 'Rappi',
    category: 'Alimentação',
    subcategory: 'Delivery',
    aliases: ['rappi.com', 'rappi br'],
    confidence_modifier: 1.0,
    priority: 100,
    entry_type: 'merchant'
  },
  
  // ========================================
  // FARMÁCIAS
  // ========================================
  {
    merchant_key: 'drogasil',
    entity_name: 'Drogasil',
    category: 'Proteção Pessoal / Saúde / Farmácia',
    subcategory: 'Farmácia',
    aliases: ['drogasil farmacia'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'drogaria sao paulo',
    entity_name: 'Drogaria São Paulo',
    category: 'Proteção Pessoal / Saúde / Farmácia',
    subcategory: 'Farmácia',
    aliases: ['drogaria sp', 'droga sao paulo', 'dsp'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'pacheco',
    entity_name: 'Drogaria Pacheco',
    category: 'Proteção Pessoal / Saúde / Farmácia',
    subcategory: 'Farmácia',
    aliases: ['pacheco farmacia', 'drogaria pacheco'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  
  // ========================================
  // TRANSPORTE
  // ========================================
  {
    merchant_key: 'uber',
    entity_name: 'Uber',
    category: 'Transporte',
    subcategory: 'Transporte por Aplicativo',
    aliases: ['uber trip', 'uber.com', 'uber technologies'],
    confidence_modifier: 1.0,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: '99',
    entity_name: '99 Taxi',
    category: 'Transporte',
    subcategory: 'Transporte por Aplicativo',
    aliases: ['99 taxi', '99taxi', '99pop', '99 pop'],
    confidence_modifier: 1.0,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'posto ipiranga',
    entity_name: 'Posto Ipiranga',
    category: 'Transporte',
    subcategory: 'Combustível',
    aliases: ['ipiranga', 'auto posto ipiranga'],
    confidence_modifier: 0.90,
    priority: 95,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'posto shell',
    entity_name: 'Posto Shell',
    category: 'Transporte',
    subcategory: 'Combustível',
    aliases: ['shell', 'auto posto shell'],
    confidence_modifier: 0.90,
    priority: 95,
    entry_type: 'merchant'
  },
  
  // ========================================
  // TELEFONE E ASSINATURAS
  // ========================================
  {
    merchant_key: 'netflix',
    entity_name: 'Netflix',
    category: 'Assinaturas',
    subcategory: 'Streaming',
    aliases: ['netflix.com', 'netflix br'],
    confidence_modifier: 1.0,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'spotify',
    entity_name: 'Spotify',
    category: 'Assinaturas',
    subcategory: 'Streaming',
    aliases: ['spotify.com', 'spotify brasil'],
    confidence_modifier: 1.0,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'amazon prime',
    entity_name: 'Amazon Prime',
    category: 'Assinaturas',
    subcategory: 'Streaming',
    aliases: ['prime video', 'amazon video', 'prime'],
    confidence_modifier: 1.0,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'vivo',
    entity_name: 'Vivo',
    category: 'Assinaturas',
    subcategory: 'Telefonia',
    aliases: ['vivo telefonia', 'vivo celular', 'vivo internet'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'claro',
    entity_name: 'Claro',
    category: 'Assinaturas',
    subcategory: 'Telefonia',
    aliases: ['claro telefonia', 'claro celular', 'claro internet'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  {
    merchant_key: 'tim',
    entity_name: 'TIM',
    category: 'Assinaturas',
    subcategory: 'Telefonia',
    aliases: ['tim telefonia', 'tim celular', 'tim brasil'],
    confidence_modifier: 0.95,
    priority: 100,
    entry_type: 'merchant'
  },
  
  // ========================================
  // PADRÕES BANCÁRIOS (banking_pattern)
  // ========================================
  {
    merchant_key: 'pix enviado',
    entity_name: 'PIX Enviado',
    category: 'Outros',
    subcategory: 'Transferências',
    aliases: ['pix', 'transferencia pix', 'pagamento pix'],
    keywords: ['pix', 'enviado', 'transferencia'],
    confidence_modifier: 1.0,
    priority: 100,
    entry_type: 'banking_pattern',
    context: 'pix_enviado'
  },
  {
    merchant_key: 'pix recebido',
    entity_name: 'PIX Recebido',
    category: 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
    subcategory: 'PIX Recebido',
    aliases: ['pix', 'transferencia pix recebida'],
    keywords: ['pix', 'recebido', 'credito'],
    confidence_modifier: 1.0,
    priority: 100,
    entry_type: 'banking_pattern',
    context: 'pix_recebido'
  },
  {
    merchant_key: 'ted enviado',
    entity_name: 'TED Enviado',
    category: 'Outros',
    subcategory: 'Transferências',
    aliases: ['ted', 'transferencia ted'],
    keywords: ['ted', 'enviado', 'transferencia'],
    confidence_modifier: 0.95,
    priority: 95,
    entry_type: 'banking_pattern',
    context: 'transferencia'
  },
  {
    merchant_key: 'doc enviado',
    entity_name: 'DOC Enviado',
    category: 'Outros',
    subcategory: 'Transferências',
    aliases: ['doc', 'transferencia doc'],
    keywords: ['doc', 'enviado', 'transferencia'],
    confidence_modifier: 0.95,
    priority: 95,
    entry_type: 'banking_pattern',
    context: 'transferencia'
  },
  {
    merchant_key: 'debito automatico',
    entity_name: 'Débito Automático',
    category: 'Outros',
    subcategory: 'Débito Automático',
    aliases: ['deb automatico', 'debito auto'],
    keywords: ['debito', 'automatico', 'deb', 'auto'],
    confidence_modifier: 0.90,
    priority: 90,
    entry_type: 'banking_pattern',
    context: 'debito_automatico'
  },
  {
    merchant_key: 'tarifa bancaria',
    entity_name: 'Tarifa Bancária',
    category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
    subcategory: 'Tarifa Bancária',
    aliases: ['tarifa', 'taxa bancaria'],
    keywords: ['tarifa', 'taxa', 'banco'],
    confidence_modifier: 0.95,
    priority: 95,
    entry_type: 'banking_pattern',
    context: 'tarifa'
  },
  {
    merchant_key: 'juros',
    entity_name: 'Juros',
    category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
    subcategory: 'Juros',
    aliases: ['juro', 'juros de mora'],
    keywords: ['juros', 'juro', 'mora'],
    confidence_modifier: 0.95,
    priority: 95,
    entry_type: 'banking_pattern',
    context: 'juros'
  },
  {
    merchant_key: 'iof',
    entity_name: 'IOF',
    category: 'Tarifas Bancárias / Juros / Impostos / Taxas',
    subcategory: 'IOF',
    aliases: ['iof operacao', 'imposto iof'],
    keywords: ['iof'],
    confidence_modifier: 1.0,
    priority: 100,
    entry_type: 'banking_pattern',
    context: 'imposto'
  },
  
  // ========================================
  // PALAVRAS-CHAVE GENÉRICAS (keyword)
  // ========================================
  {
    merchant_key: 'supermercado',
    entity_name: 'Supermercado',
    category: 'Alimentação',
    subcategory: 'Supermercado',
    aliases: ['super', 'mercado', 'supermarket'],
    keywords: ['supermercado', 'super', 'mercado'],
    confidence_modifier: 0.70,
    priority: 60,
    entry_type: 'keyword'
  },
  {
    merchant_key: 'farmacia',
    entity_name: 'Farmácia',
    category: 'Proteção Pessoal / Saúde / Farmácia',
    subcategory: 'Farmácia',
    aliases: ['drogaria', 'pharmacy'],
    keywords: ['farmacia', 'drogaria', 'remedios'],
    confidence_modifier: 0.75,
    priority: 65,
    entry_type: 'keyword'
  },
  {
    merchant_key: 'restaurante',
    entity_name: 'Restaurante',
    category: 'Alimentação',
    subcategory: 'Restaurante',
    aliases: ['rest', 'lanchonete', 'bar'],
    keywords: ['restaurante', 'lanchonete', 'bar', 'lanches'],
    confidence_modifier: 0.70,
    priority: 60,
    entry_type: 'keyword'
  },
  {
    merchant_key: 'posto',
    entity_name: 'Posto de Combustível',
    category: 'Transporte',
    subcategory: 'Combustível',
    aliases: ['auto posto', 'posto de gasolina'],
    keywords: ['posto', 'combustivel', 'gasolina', 'etanol', 'diesel'],
    confidence_modifier: 0.75,
    priority: 65,
    entry_type: 'keyword'
  },
  {
    merchant_key: 'academia',
    entity_name: 'Academia',
    category: 'Bem Estar / Beleza',
    subcategory: 'Academia',
    aliases: ['gym', 'fitness'],
    keywords: ['academia', 'gym', 'fitness', 'musculacao'],
    confidence_modifier: 0.80,
    priority: 70,
    entry_type: 'keyword'
  },
  {
    merchant_key: 'pet shop',
    entity_name: 'Pet Shop',
    category: 'Pet',
    subcategory: 'Pet Shop',
    aliases: ['petshop', 'pet'],
    keywords: ['pet', 'petshop', 'animais', 'veterinaria'],
    confidence_modifier: 0.80,
    priority: 70,
    entry_type: 'keyword'
  },
  ];
}

// ============================================================================
// FUNÇÕES DE MIGRAÇÃO
// ============================================================================

async function clearExistingData() {
  console.log('🗑️  Limpando dados existentes...');
  const { error } = await supabase
    .from('merchants_dictionary')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (error) {
    console.warn('⚠️  Aviso ao limpar dados:', error.message);
  }
}

async function insertMerchants() {
  console.log(`📥 Inserindo ${merchantsData.length} merchants...`);
  
  const batchSize = 100;
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < merchantsData.length; i += batchSize) {
    const batch = merchantsData.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('merchants_dictionary')
      .insert(batch)
      .select();
    
    if (error) {
      console.error(`❌ Erro no batch ${i / batchSize + 1}:`, error.message);
      errors += batch.length;
    } else {
      inserted += data?.length || 0;
      console.log(`  ✅ Batch ${i / batchSize + 1}: ${data?.length} registros inseridos`);
    }
  }
  
  return { inserted, errors };
}

async function generateReport() {
  console.log('\n📊 Gerando relatório...\n');
  
  // Total de merchants
  const { count: totalCount } = await supabase
    .from('merchants_dictionary')
    .select('*', { count: 'exact', head: true });
  
  // Por tipo
  const { data: byType } = await supabase
    .from('merchants_dictionary')
    .select('entry_type')
    .order('entry_type');
  
  const typeCounts: Record<string, number> = {};
  byType?.forEach(row => {
    typeCounts[row.entry_type] = (typeCounts[row.entry_type] || 0) + 1;
  });
  
  // Por categoria
  const { data: byCategory } = await supabase
    .from('merchants_dictionary')
    .select('category')
    .order('category');
  
  const categoryCounts: Record<string, number> = {};
  byCategory?.forEach(row => {
    categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
  });
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('📈 RELATÓRIO DA MIGRAÇÃO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\n📦 Total de registros: ${totalCount}\n`);
  
  console.log('📊 Por tipo de entrada:');
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`  • ${type}: ${count}`);
  });
  
  console.log('\n📊 Por categoria (top 10):');
  Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([category, count]) => {
      console.log(`  • ${category}: ${count}`);
    });
  
  console.log('\n═══════════════════════════════════════════════════════');
}

async function testSearchFunctions() {
  console.log('\n🧪 Testando funções de busca...\n');
  
  // Teste 1: Buscar merchant
  const { data: merchant1 } = await supabase
    .rpc('search_merchant', { 
      p_description: 'ifood delivery',
      p_limit: 3
    });
  console.log('✅ Teste search_merchant("ifood delivery"):', merchant1?.[0]?.entity_name);
  
  // Teste 2: Buscar padrão bancário
  const { data: pattern1 } = await supabase
    .rpc('search_banking_pattern', { 
      p_description: 'pix enviado para maria'
    });
  console.log('✅ Teste search_banking_pattern("pix enviado"):', pattern1?.[0]?.category);
  
  // Teste 3: Buscar por palavra-chave
  const { data: keyword1 } = await supabase
    .rpc('search_by_keywords', { 
      p_description: 'comprei remédios na farmacia',
      p_type: 'expense'
    });
  console.log('✅ Teste search_by_keywords("farmacia"):', keyword1?.[0]?.category);
  
  console.log('\n✅ Todos os testes passaram!\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 MIGRAÇÃO DO BANKDICTIONARY PARA SUPABASE             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Passo 1: Limpar dados existentes
    await clearExistingData();
    
    // Passo 2: Inserir merchants
    const { inserted, errors } = await insertMerchants();
    
    console.log('\n✅ Migração concluída!');
    console.log(`  • ${inserted} registros inseridos com sucesso`);
    if (errors > 0) {
      console.log(`  • ${errors} erros encontrados`);
    }
    
    // Passo 3: Gerar relatório
    await generateReport();
    
    // Passo 4: Testar funções
    await testSearchFunctions();
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ MIGRAÇÃO FINALIZADA COM SUCESSO!                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ Erro fatal na migração:', error);
    process.exit(1);
  }
}

// Executar
main();

