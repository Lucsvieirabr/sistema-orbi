/**
 * Script para extrair TODOS os merchants do BankDictionary.ts
 * e gerar o arquivo de dados completo para migração
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BANK_DICTIONARY_PATH = path.join(__dirname, '../src/components/extrato-uploader/BankDictionary.ts');
const OUTPUT_PATH = path.join(__dirname, './extracted-merchants-data.json');

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

function extractMerchants(): MerchantEntry[] {
  const content = fs.readFileSync(BANK_DICTIONARY_PATH, 'utf-8');
  const merchants: MerchantEntry[] = [];
  
  // Regex para encontrar definições de merchants
  // Padrão: 'merchant_key': { entity_name: '...', category: '...', ... }
  const merchantRegex = /'([^']+)':\s*\{([^}]+entity_name[^}]+)\}/gs;
  
  let match;
  let count = 0;
  
  while ((match = merchantRegex.exec(content)) !== null) {
    const merchantKey = match[1];
    const merchantBody = match[2];
    
    try {
      // Extrair entity_name
      const entityNameMatch = merchantBody.match(/entity_name:\s*'([^']+)'/);
      const entityName = entityNameMatch ? entityNameMatch[1] : merchantKey;
      
      // Extrair category
      const categoryMatch = merchantBody.match(/category:\s*'([^']+)'/);
      const category = categoryMatch ? categoryMatch[1] : 'Outros';
      
      // Extrair subcategory
      const subcategoryMatch = merchantBody.match(/subcategory:\s*'([^']+)'/);
      const subcategory = subcategoryMatch ? subcategoryMatch[1] : undefined;
      
      // Extrair aliases
      const aliasesMatch = merchantBody.match(/aliases:\s*\[([^\]]+)\]/);
      let aliases: string[] = [];
      if (aliasesMatch) {
        const aliasesStr = aliasesMatch[1];
        aliases = aliasesStr.match(/'([^']+)'/g)?.map(a => a.replace(/'/g, '')) || [];
      }
      
      // Extrair confidence_modifier
      const confidenceMatch = merchantBody.match(/confidence_modifier:\s*([\d.]+)/);
      const confidence_modifier = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.80;
      
      // Extrair priority
      const priorityMatch = merchantBody.match(/priority:\s*(\d+)/);
      const priority = priorityMatch ? parseInt(priorityMatch[1]) : 50;
      
      // Extrair state_specific
      const stateSpecificMatch = merchantBody.match(/state_specific:\s*(true|false)/);
      const state_specific = stateSpecificMatch ? stateSpecificMatch[1] === 'true' : false;
      
      // Extrair states
      const statesMatch = merchantBody.match(/states:\s*\[([^\]]+)\]/);
      let states: string[] = [];
      if (statesMatch) {
        const statesStr = statesMatch[1];
        states = statesStr.match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) || [];
      }
      
      const merchant: MerchantEntry = {
        merchant_key: merchantKey,
        entity_name: entityName,
        category,
        subcategory,
        aliases,
        confidence_modifier,
        priority,
        entry_type: 'merchant',
        state_specific,
        states: states.length > 0 ? states : undefined
      };
      
      merchants.push(merchant);
      count++;
      
      if (count % 100 === 0) {
        console.log(`Extraídos ${count} merchants...`);
      }
    } catch (error) {
      console.warn(`Erro ao processar merchant '${merchantKey}':`, error);
    }
  }
  
  return merchants;
}

function extractBankingPatterns(): MerchantEntry[] {
  const content = fs.readFileSync(BANK_DICTIONARY_PATH, 'utf-8');
  const patterns: MerchantEntry[] = [];
  
  // Extrair padrões bancários da seção 'banking'
  const bankingSection = content.match(/banking:\s*\{([\s\S]*?)\n\s*\},\n\s*\/\//);
  
  if (bankingSection) {
    const bankingContent = bankingSection[1];
    
    // Padrões comuns
    const commonPatterns = [
      { key: 'pix enviado', name: 'PIX Enviado', cat: 'Outros', sub: 'Transferências', context: 'pix_enviado' },
      { key: 'pix recebido', name: 'PIX Recebido', cat: 'Outras Receitas (Aluguéis, extras, reembolso etc.)', sub: 'PIX Recebido', context: 'pix_recebido' },
      { key: 'ted enviado', name: 'TED Enviado', cat: 'Outros', sub: 'Transferências', context: 'transferencia' },
      { key: 'doc enviado', name: 'DOC Enviado', cat: 'Outros', sub: 'Transferências', context: 'transferencia' },
      { key: 'transferencia', name: 'Transferência', cat: 'Outros', sub: 'Transferências', context: 'transferencia' },
      { key: 'debito automatico', name: 'Débito Automático', cat: 'Outros', sub: 'Débito Automático', context: 'debito_automatico' },
      { key: 'tarifa bancaria', name: 'Tarifa Bancária', cat: 'Tarifas Bancárias / Juros / Impostos / Taxas', sub: 'Tarifa Bancária', context: 'tarifa' },
      { key: 'tarifa', name: 'Tarifa', cat: 'Tarifas Bancárias / Juros / Impostos / Taxas', sub: 'Tarifa', context: 'tarifa' },
      { key: 'taxa', name: 'Taxa', cat: 'Tarifas Bancárias / Juros / Impostos / Taxas', sub: 'Taxa', context: 'taxa' },
      { key: 'juros', name: 'Juros', cat: 'Tarifas Bancárias / Juros / Impostos / Taxas', sub: 'Juros', context: 'juros' },
      { key: 'multa', name: 'Multa', cat: 'Tarifas Bancárias / Juros / Impostos / Taxas', sub: 'Multa', context: 'multa' },
      { key: 'iof', name: 'IOF', cat: 'Tarifas Bancárias / Juros / Impostos / Taxas', sub: 'IOF', context: 'imposto' },
      { key: 'anuidade', name: 'Anuidade', cat: 'Tarifas Bancárias / Juros / Impostos / Taxas', sub: 'Anuidade de Cartão', context: 'anuidade' },
      { key: 'saque', name: 'Saque', cat: 'Tarifas Bancárias / Juros / Impostos / Taxas', sub: 'Tarifa de Saque', context: 'saque' },
    ];
    
    commonPatterns.forEach(p => {
      patterns.push({
        merchant_key: p.key,
        entity_name: p.name,
        category: p.cat,
        subcategory: p.sub,
        aliases: [p.key],
        keywords: p.key.split(' '),
        confidence_modifier: 0.95,
        priority: 95,
        entry_type: 'banking_pattern',
        context: p.context
      });
    });
  }
  
  return patterns;
}

function extractKeywords(): MerchantEntry[] {
  // Keywords genéricas comuns
  const keywords: MerchantEntry[] = [
    { merchant_key: 'supermercado', entity_name: 'Supermercado', category: 'Alimentação', subcategory: 'Supermercado', aliases: ['super', 'mercado'], keywords: ['supermercado', 'super', 'mercado'], confidence_modifier: 0.70, priority: 60, entry_type: 'keyword' },
    { merchant_key: 'farmacia', entity_name: 'Farmácia', category: 'Proteção Pessoal / Saúde / Farmácia', subcategory: 'Farmácia', aliases: ['drogaria'], keywords: ['farmacia', 'drogaria', 'remedios'], confidence_modifier: 0.75, priority: 65, entry_type: 'keyword' },
    { merchant_key: 'restaurante', entity_name: 'Restaurante', category: 'Alimentação', subcategory: 'Restaurante', aliases: ['rest', 'lanchonete'], keywords: ['restaurante', 'lanchonete', 'bar', 'lanches'], confidence_modifier: 0.70, priority: 60, entry_type: 'keyword' },
    { merchant_key: 'posto', entity_name: 'Posto de Combustível', category: 'Transporte', subcategory: 'Combustível', aliases: ['auto posto'], keywords: ['posto', 'combustivel', 'gasolina', 'etanol'], confidence_modifier: 0.75, priority: 65, entry_type: 'keyword' },
    { merchant_key: 'padaria', entity_name: 'Padaria', category: 'Alimentação', subcategory: 'Padaria', aliases: ['panificadora'], keywords: ['padaria', 'panificadora', 'paes'], confidence_modifier: 0.75, priority: 65, entry_type: 'keyword' },
    { merchant_key: 'academia', entity_name: 'Academia', category: 'Bem Estar / Beleza', subcategory: 'Academia', aliases: ['gym', 'fitness'], keywords: ['academia', 'gym', 'fitness'], confidence_modifier: 0.80, priority: 70, entry_type: 'keyword' },
    { merchant_key: 'pet shop', entity_name: 'Pet Shop', category: 'Pet', subcategory: 'Pet Shop', aliases: ['petshop', 'pet'], keywords: ['pet', 'petshop', 'animais'], confidence_modifier: 0.80, priority: 70, entry_type: 'keyword' },
    { merchant_key: 'medico', entity_name: 'Médico', category: 'Proteção Pessoal / Saúde / Farmácia', subcategory: 'Consultas Médicas', aliases: ['dr', 'dra', 'doutor'], keywords: ['medico', 'dr', 'consulta'], confidence_modifier: 0.75, priority: 70, entry_type: 'keyword' },
    { merchant_key: 'dentista', entity_name: 'Dentista', category: 'Proteção Pessoal / Saúde / Farmácia', subcategory: 'Dentista', aliases: ['odonto'], keywords: ['dentista', 'odonto'], confidence_modifier: 0.80, priority: 70, entry_type: 'keyword' },
    { merchant_key: 'salao', entity_name: 'Salão de Beleza', category: 'Bem Estar / Beleza', subcategory: 'Salão', aliases: ['cabelereiro'], keywords: ['salao', 'beleza', 'cabelo'], confidence_modifier: 0.75, priority: 65, entry_type: 'keyword' },
  ];
  
  return keywords;
}

function main() {
  console.log('🔍 Extraindo dados do BankDictionary.ts...\n');
  
  // Extrair merchants
  console.log('📦 Extraindo merchants...');
  const merchants = extractMerchants();
  console.log(`✅ ${merchants.length} merchants extraídos\n`);
  
  // Extrair banking patterns
  console.log('🏦 Extraindo padrões bancários...');
  const bankingPatterns = extractBankingPatterns();
  console.log(`✅ ${bankingPatterns.length} padrões bancários extraídos\n`);
  
  // Extrair keywords
  console.log('🔑 Extraindo keywords...');
  const keywords = extractKeywords();
  console.log(`✅ ${keywords.length} keywords extraídas\n`);
  
  // Combinar tudo
  const allData = [...merchants, ...bankingPatterns, ...keywords];
  
  // Salvar em JSON
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allData, null, 2));
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 RESUMO DA EXTRAÇÃO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total de registros: ${allData.length}`);
  console.log(`  • Merchants: ${merchants.length}`);
  console.log(`  • Banking patterns: ${bankingPatterns.length}`);
  console.log(`  • Keywords: ${keywords.length}`);
  console.log(`\nArquivo salvo em: ${OUTPUT_PATH}`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Estatísticas por categoria
  const categoryCount: Record<string, number> = {};
  allData.forEach(item => {
    categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
  });
  
  console.log('📈 Top 10 categorias:');
  Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([cat, count]) => {
      console.log(`  • ${cat}: ${count}`);
    });
}

main();

