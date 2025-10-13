/**
 * Script para extrair TODOS os dados do BankDictionary.ts
 * usando importação direta do módulo (sem regex)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Função para processar merchants do dicionário
function extractFromDictionary(): MerchantEntry[] {
  const allData: MerchantEntry[] = [];
  
  // Criar uma instância temporária do BankDictionary
  // Para isso, vamos parsear o arquivo diretamente
  const BANK_DICTIONARY_PATH = path.join(__dirname, '../src/components/extrato-uploader/BankDictionary.ts');
  const content = fs.readFileSync(BANK_DICTIONARY_PATH, 'utf-8');
  
  // Encontrar a seção merchants: { ... }
  const merchantsMatch = content.match(/merchants:\s*\{([\s\S]*?)\n\s*\},\n\s*\/\/ Padrões genéricos/);
  
  if (merchantsMatch) {
    const merchantsSection = merchantsMatch[1];
    
    // Regex melhorada para capturar cada merchant
    const merchantPattern = /'([^']+)':\s*\{\s*entity_name:\s*'([^']+)',\s*category:\s*'([^']+)',(?:\s*subcategory:\s*'([^']+)',)?\s*aliases:\s*\[([^\]]*)\],\s*confidence_modifier:\s*([\d.]+),\s*priority:\s*(\d+)(?:,\s*state_specific:\s*(true|false))?(?:,\s*states:\s*\[([^\]]*)\])?\s*\}/g;
    
    let match;
    let count = 0;
    
    while ((match = merchantPattern.exec(merchantsSection)) !== null) {
      const [, merchantKey, entityName, category, subcategory, aliasesStr, confidence, priority, stateSpecific, statesStr] = match;
      
      // Extrair aliases
      const aliases = aliasesStr
        ? aliasesStr.match(/'([^']+)'/g)?.map(a => a.replace(/'/g, '')) || []
        : [];
      
      // Extrair states
      const states = statesStr
        ? statesStr.match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) || []
        : undefined;
      
      allData.push({
        merchant_key: merchantKey,
        entity_name: entityName,
        category,
        subcategory: subcategory || undefined,
        aliases,
        confidence_modifier: parseFloat(confidence),
        priority: parseInt(priority),
        entry_type: 'merchant',
        state_specific: stateSpecific === 'true',
        states: states && states.length > 0 ? states : undefined
      });
      
      count++;
      if (count % 100 === 0) {
        console.log(`  Processados ${count} merchants...`);
      }
    }
    
    console.log(`✅ Total de ${count} merchants extraídos`);
  }
  
  // Extrair padrões bancários
  const bankingMatch = content.match(/banking:\s*\{([\s\S]*?)\n\s*\},\n\s*\/\/ Concessionárias/);
  
  if (bankingMatch) {
    const bankingSection = bankingMatch[1];
    
    // Extrair contextos bancários
    const contextPattern = /'([^']+)':\s*\[([\s\S]*?)\]/g;
    let contextMatch;
    let bankingCount = 0;
    
    while ((contextMatch = contextPattern.exec(bankingSection)) !== null) {
      const [, context, patternsStr] = contextMatch;
      
      // Extrair cada padrão dentro do contexto
      const patternRegex = /\{\s*patterns:\s*\[([^\]]+)\],\s*category:\s*'([^']+)',(?:\s*subcategory:\s*'([^']+)',)?\s*confidence_modifier:\s*([\d.]+),\s*priority:\s*(\d+)\s*\}/g;
      
      let patternMatch;
      while ((patternMatch = patternRegex.exec(patternsStr)) !== null) {
        const [, patternsText, category, subcategory, confidence, priority] = patternMatch;
        
        // Extrair keywords do padrão
        const keywords = patternsText
          .match(/'([^']+)'/g)
          ?.map(k => k.replace(/'/g, '')) || [];
        
        allData.push({
          merchant_key: context,
          entity_name: context.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          category,
          subcategory: subcategory || undefined,
          aliases: [context],
          keywords,
          confidence_modifier: parseFloat(confidence),
          priority: parseInt(priority),
          entry_type: 'banking_pattern',
          context
        });
        
        bankingCount++;
      }
    }
    
    console.log(`✅ Total de ${bankingCount} padrões bancários extraídos`);
  }
  
  // Extrair categories (keywords genéricos)
  const categoriesMatch = content.match(/categories:\s*\{([\s\S]*?)\n\s*\},\n\s*\/\/ Padrões bancários/);
  
  if (categoriesMatch) {
    const categoriesSection = categoriesMatch[1];
    
    // Extrair cada categoria
    const categoryPattern = /'([^']+)':\s*\[([\s\S]*?)\]/g;
    let catMatch;
    let keywordCount = 0;
    
    while ((catMatch = categoryPattern.exec(categoriesSection)) !== null) {
      const [, categoryKey, entriesStr] = catMatch;
      
      // Extrair entries dessa categoria
      const entryRegex = /\{\s*keywords:\s*\[([^\]]+)\],\s*category:\s*'([^']+)',(?:\s*subcategory:\s*'([^']+)',)?\s*(?:entity_name:\s*'([^']+)',)?\s*confidence_modifier:\s*([\d.]+)(?:,\s*frequency:\s*\d+)?(?:,\s*priority:\s*(\d+))?[^}]*\}/g;
      
      let entryMatch;
      while ((entryMatch = entryRegex.exec(entriesStr)) !== null) {
        const [, keywordsStr, category, subcategory, entityName, confidence, priority] = entryMatch;
        
        const keywords = keywordsStr
          .match(/'([^']+)'/g)
          ?.map(k => k.replace(/'/g, '')) || [];
        
        if (keywords.length > 0) {
          allData.push({
            merchant_key: categoryKey,
            entity_name: entityName || categoryKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            category,
            subcategory: subcategory || undefined,
            aliases: [categoryKey],
            keywords,
            confidence_modifier: parseFloat(confidence),
            priority: priority ? parseInt(priority) : 60,
            entry_type: 'keyword'
          });
          
          keywordCount++;
        }
      }
    }
    
    console.log(`✅ Total de ${keywordCount} keywords extraídas`);
  }
  
  return allData;
}

function main() {
  console.log('\n🔍 Extraindo TODOS os dados do BankDictionary.ts...\n');
  
  const allData = extractFromDictionary();
  
  // Salvar em JSON
  const OUTPUT_PATH = path.join(__dirname, './extracted-merchants-data.json');
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allData, null, 2));
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 RESUMO DA EXTRAÇÃO COMPLETA');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total de registros: ${allData.length}`);
  
  // Contar por tipo
  const byType: Record<string, number> = {};
  allData.forEach(item => {
    byType[item.entry_type] = (byType[item.entry_type] || 0) + 1;
  });
  
  console.log('\n📊 Por tipo:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  • ${type}: ${count}`);
  });
  
  // Contar por categoria
  const byCategory: Record<string, number> = {};
  allData.forEach(item => {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
  });
  
  console.log('\n📊 Top 15 categorias:');
  Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .forEach(([cat, count]) => {
      console.log(`  • ${cat}: ${count}`);
    });
  
  console.log(`\n✅ Arquivo salvo em: ${OUTPUT_PATH}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main();

