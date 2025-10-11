/**
 * Dicionário Inteligente de Transações para o Mercado Brasileiro
 *
 * Sistema avançado de categorização financeira com aprendizado automático,
 * lógica hierárquica e estrutura orientada por dados reais.
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Tokeniza descrição da transação
 */
function tokenizeDescription(description: string): string[] {
  return description.toLowerCase().split(/\s+/).filter(token => token.length > 2);
}

export interface DictionaryEntry {
  keywords: (string | RegExp)[];
  category: string;
  subcategory?: string;
  entity_name?: string;
  confidence_modifier: number; // 0.0-1.0
  frequency?: number;
  priority?: number; // Para resolução de conflitos
  context_sensitive?: boolean;
}

export interface MerchantEntry {
  entity_name: string;
  category: string;
  subcategory?: string;
  aliases: string[];
  confidence_modifier: number;
  priority: number;
  state_specific?: boolean;
  states?: string[]; // Para concessionárias
}

export interface BankingPattern {
  patterns: (string | RegExp)[];
  category: string;
  subcategory?: string;
  confidence_modifier: number;
  priority: number;
}

export interface IntelligentDictionary {
  // Estabelecimentos específicos com alta prioridade
  merchants: { [key: string]: MerchantEntry };

  // Padrões genéricos organizados por categoria
  categories: { [category: string]: DictionaryEntry[] };

  // Padrões bancários contextuais
  banking: { [context: string]: BankingPattern[] };

  // Concessionárias por estado (para serviços públicos)
  utilities: { [state: string]: { [service: string]: MerchantEntry[] } };

  // Sinônimos para melhorar matching
  synonyms: { [key: string]: string[] };

  // Histórico de aprendizado
  learned_patterns: { [description: string]: { category: string; subcategory?: string; confidence: number; count: number; last_seen: string } };

  // Estatísticas de uso
  usage_stats: { [category: string]: { count: number; accuracy: number } };
}

export class BankDictionary {
  private dictionary: IntelligentDictionary;
  private userLocation?: string;
  private userId?: string;

  constructor(userLocation?: string, userId?: string) {
    this.userLocation = userLocation;
    this.userId = userId;
    this.dictionary = this.buildIntelligentDictionary();
    if (this.userId) {
      this.loadLearnedPatterns();
    }
  }

  /**
   * Carrega padrões aprendidos globalmente do banco de dados
   */
  private async loadLearnedPatterns(): Promise<void> {
    try {
      const { data: patterns } = await (supabase as any)
        .rpc('get_global_learned_patterns', {
          p_limit: 1000, // Carrega até 1000 padrões mais confiáveis
          p_min_confidence: 75.00, // Apenas padrões com alta confiança
          p_min_user_votes: 2 // Pelo menos 2 votos de usuários
        }) as { data: any[] | null };

      if (patterns && Array.isArray(patterns) && patterns.length > 0) {
        patterns.forEach((pattern: any) => {
          this.dictionary.learned_patterns[pattern.description] = {
            category: pattern.category,
            subcategory: pattern.subcategory,
            confidence: pattern.confidence,
            count: pattern.usage_count,
            last_seen: pattern.last_used_at
          };
        });

      }
    } catch (error) {
      console.error('Erro ao carregar padrões aprendidos:', error);
    }
  }

  /**
   * Constrói dicionário inteligente baseado em dados reais do mercado brasileiro
   */
  private buildIntelligentDictionary(): IntelligentDictionary {
    return {
      merchants: {
        // ========================================
        // SUPERMERCADOS, ATACADOS E HIPERMERCADOS
        // ========================================
        
        // Redes Nacionais de Atacado
        'assai atacadista': {
          entity_name: 'Assaí Atacadista',
          category: 'Alimentação',
          subcategory: 'Atacado',
          aliases: ['assai', 'assaí', 'atacadista assai'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'atacadao': {
          entity_name: 'Atacadão',
          category: 'Alimentação',
          subcategory: 'Atacado',
          aliases: ['carrefour atacadao', 'atacadão'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'tenda atacado': {
          entity_name: 'Tenda Atacado',
          category: 'Alimentação',
          subcategory: 'Atacado',
          aliases: ['tenda'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'fort atacadista': {
          entity_name: 'Fort Atacadista',
          category: 'Alimentação',
          subcategory: 'Atacado',
          aliases: ['fort', 'atacadista fort', 'fort ataca'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'komprao koch atacadista': {
          entity_name: 'Komprao Koch Atacadista',
          category: 'Alimentação',
          subcategory: 'Atacado',
          aliases: ['komprao', 'koch', 'koch atacadista', 'komprao koch', 'atacadista koch'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'atacadao dia a dia': {
          entity_name: 'Atacadão Dia a Dia',
          category: 'Alimentação',
          subcategory: 'Atacado',
          aliases: ['diaadia', 'dia a dia'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'novo atacarejo': {
          entity_name: 'Novo Atacarejo',
          category: 'Alimentação',
          subcategory: 'Atacado',
          aliases: ['novo atac'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'atakarejo': {
          entity_name: 'Atakarejo',
          category: 'Alimentação',
          subcategory: 'Atacado',
          aliases: ['atac', 'ataca'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'mart minas': {
          entity_name: 'Mart Minas',
          category: 'Alimentação',
          subcategory: 'Atacado',
          aliases: ['dom atacadista'],
          confidence_modifier: 0.90,
          priority: 95
        },
        
        // Redes Nacionais de Supermercados
        'carrefour': {
          entity_name: 'Carrefour',
          category: 'Alimentação',
          subcategory: 'Hipermercado',
          aliases: ['carfour'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'pao de acucar': {
          entity_name: 'Pão de Açúcar',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['pao de acucar', 'paodeacu', 'pão de açucar', 'gpa'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'extra': {
          entity_name: 'Extra',
          category: 'Alimentação',
          subcategory: 'Hipermercado',
          aliases: ['extra supermercado', 'hipermercado extra'],
          confidence_modifier: 0.90,
          priority: 95
        },
        
        // Redes Regionais
        'comper': {
          entity_name: 'Comper Supermercados',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['supermercado comper', 'comper supermercado', 'grupo pereira'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'mateus supermercados': {
          entity_name: 'Mateus Supermercados',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['mateus', 'grupomateus', 'grupo mateus'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'supermercados bh': {
          entity_name: 'Supermercados BH',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['bh supermercado', 'super bh'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'muffato': {
          entity_name: 'Super Muffato',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['super muffato', 'supermercado muffato'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'cencosud': {
          entity_name: 'Cencosud',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['gbarbosa', 'g barbosa', 'prezunic'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'zaffari': {
          entity_name: 'Zaffari',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['cia zaffari', 'companhia zaffari'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'savegnago': {
          entity_name: 'Savegnago',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['supermercado savegnago'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'sonda supermercados': {
          entity_name: 'Sonda Supermercados',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['sonda'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'grupo abc': {
          entity_name: 'Grupo ABC',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['supermercado abc'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'bahamas supermercado': {
          entity_name: 'Bahamas Supermercado',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['bahamas', 'super bahamas'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'giassi': {
          entity_name: 'Giassi',
          category: 'Alimentação',
          subcategory: 'Supermercado',
          aliases: ['supermercado giassi'],
          confidence_modifier: 0.85,
          priority: 90
        },

        // ========================================
        // RESTAURANTES, FAST-FOOD E LANCHONETES
        // ========================================
        
        // Fast-Food Internacional
        'mcdonalds': {
          entity_name: "McDonald's",
          category: 'Alimentação',
          subcategory: 'Fast-Food',
          aliases: ['mc donalds', 'mcdonald', 'mc', 'arcos dourados'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'burger king': {
          entity_name: 'Burger King',
          category: 'Alimentação',
          subcategory: 'Fast-Food',
          aliases: ['bk', 'burguer king', 'burguer'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'habibs': {
          entity_name: "Habib's",
          category: 'Alimentação',
          subcategory: 'Fast-Food',
          aliases: ['habib', 'habibs'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'subway': {
          entity_name: 'Subway',
          category: 'Alimentação',
          subcategory: 'Fast-Food',
          aliases: ['sub'],
          confidence_modifier: 0.90,
          priority: 90
        },
        'kfc': {
          entity_name: 'KFC',
          category: 'Alimentação',
          subcategory: 'Fast-Food',
          aliases: ['kentucky', 'kentucky fried chicken'],
          confidence_modifier: 0.90,
          priority: 90
        },
        'popeyes': {
          entity_name: 'Popeyes',
          category: 'Alimentação',
          subcategory: 'Fast-Food',
          aliases: ['popeye'],
          confidence_modifier: 0.85,
          priority: 90
        },
        
        // Fast-Food Nacional
        'bobs': {
          entity_name: "Bob's",
          category: 'Alimentação',
          subcategory: 'Fast-Food',
          aliases: ['bobs'],
          confidence_modifier: 0.90,
          priority: 90
        },
        'giraffas': {
          entity_name: 'Giraffas',
          category: 'Alimentação',
          subcategory: 'Fast-Food',
          aliases: ['girafa'],
          confidence_modifier: 0.85,
          priority: 85
        },
        'china in box': {
          entity_name: 'China in Box',
          category: 'Alimentação',
          subcategory: 'Fast-Food',
          aliases: ['china box', 'chinainbox'],
          confidence_modifier: 0.85,
          priority: 85
        },
        'ragazzo': {
          entity_name: 'Ragazzo',
          category: 'Alimentação',
          subcategory: 'Fast-Food',
          aliases: ['ragazzo pizzaria'],
          confidence_modifier: 0.80,
          priority: 80
        },
        
        // Pizzarias
        'pizza hut': {
          entity_name: 'Pizza Hut',
          category: 'Alimentação',
          subcategory: 'Pizzaria',
          aliases: ['pizzahut'],
          confidence_modifier: 0.85,
          priority: 90
        },
        
        // Restaurantes
        'outback': {
          entity_name: 'Outback Steakhouse',
          category: 'Alimentação',
          subcategory: 'Restaurante',
          aliases: ['outback steakhouse'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'coco bambu': {
          entity_name: 'Coco Bambu',
          category: 'Alimentação',
          subcategory: 'Restaurante',
          aliases: ['cocobambu'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'spoleto': {
          entity_name: 'Spoleto',
          category: 'Alimentação',
          subcategory: 'Restaurante',
          aliases: ['spoleto culinaria'],
          confidence_modifier: 0.85,
          priority: 85
        },
        'madero': {
          entity_name: 'Madero',
          category: 'Alimentação',
          subcategory: 'Restaurante',
          aliases: ['madero container', 'madero steak'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'pampeana': {
          entity_name: 'Pampeana',
          category: 'Alimentação',
          subcategory: 'Restaurante',
          aliases: ['pampeana restaurante', 'rest pampeana'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'cantina cavallaris': {
          entity_name: 'Cantina Cavallaris',
          category: 'Alimentação',
          subcategory: 'Restaurante',
          aliases: ['cavallaris', 'cantina'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'dalcoquio': {
          entity_name: 'Dalcoquio',
          category: 'Alimentação',
          subcategory: 'Restaurante',
          aliases: ['rest dalcoquio'],
          confidence_modifier: 0.85,
          priority: 90
        },
        
        // Cafeterias
        'starbucks': {
          entity_name: 'Starbucks',
          category: 'Alimentação',
          subcategory: 'Cafeteria',
          aliases: ['starbucks coffee'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'rei do mate': {
          entity_name: 'Rei do Mate',
          category: 'Alimentação',
          subcategory: 'Cafeteria',
          aliases: ['reidomate'],
          confidence_modifier: 0.85,
          priority: 85
        },
        'cappi alley': {
          entity_name: 'Cappi Alley',
          category: 'Alimentação',
          subcategory: 'Cafeteria',
          aliases: ['cappialley', 'cappi', 'cafeteria cappi'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'cafe cultura': {
          entity_name: 'Cafe Cultura',
          category: 'Alimentação',
          subcategory: 'Cafeteria',
          aliases: ['cafe cultura', 'cafeteria cultura', 'café cultura'],
          confidence_modifier: 0.90,
          priority: 95
        },
        
        // Padarias e Docerias
        'cake garden': {
          entity_name: 'Cake Garden',
          category: 'Alimentação',
          subcategory: 'Doceria',
          aliases: ['confeitaria cake', 'cake'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'doceria armazem': {
          entity_name: 'Doceria Armazem',
          category: 'Alimentação',
          subcategory: 'Doceria',
          aliases: ['doceria armazem', 'armazem doceria', 'doceria armazém'],
          confidence_modifier: 0.90,
          priority: 95
        },
        
        // Delivery de Comida
        'ifood': {
          entity_name: 'iFood',
          category: 'Alimentação',
          subcategory: 'Delivery',
          aliases: ['pedido ifood', 'ifood entrega', 'ifd'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'rappi': {
          entity_name: 'Rappi',
          category: 'Alimentação',
          subcategory: 'Delivery',
          aliases: ['rappi entrega', 'rappi delivery'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'uber eats': {
          entity_name: 'Uber Eats',
          category: 'Alimentação',
          subcategory: 'Delivery',
          aliases: ['ubereats', 'uber comida'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'ze delivery': {
          entity_name: 'Zé Delivery',
          category: 'Alimentação',
          subcategory: 'Delivery',
          aliases: ['ze delivery', 'zé delivery', 'ze bebidas'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'aiqfome': {
          entity_name: 'aiqfome',
          category: 'Alimentação',
          subcategory: 'Delivery',
          aliases: ['aiq fome'],
          confidence_modifier: 0.80,
          priority: 85
        },
        
        // ========================================
        // TRANSPORTE E MOBILIDADE
        // ========================================
        
        // Aplicativos de Mobilidade Urbana
        'uber': {
          entity_name: 'Uber',
          category: 'Transporte',
          subcategory: 'Ride-Hailing',
          aliases: ['uber ride', 'corrida uber', 'uber taxi', 'uberbr', 'uber trip'],
          confidence_modifier: 0.95,
          priority: 100
        },
        '99': {
          entity_name: '99',
          category: 'Transporte',
          subcategory: 'Ride-Hailing',
          aliases: ['99 taxi', '99 pop', 'corrida 99', '99app'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'wappa': {
          entity_name: 'Wappa',
          category: 'Transporte',
          subcategory: 'Ride-Hailing',
          aliases: ['wappa taxi'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'tembici': {
          entity_name: 'Tembici',
          category: 'Transporte',
          subcategory: 'Aluguel de Bicicleta/Patinete',
          aliases: ['bike itau', 'bike itaú', 'tembici bike'],
          confidence_modifier: 0.85,
          priority: 90
        },
        
        // Combustível e Postos
        'posto tucha': {
          entity_name: 'Posto Tucha',
          category: 'Transporte',
          subcategory: 'Combustível',
          aliases: ['tucha', 'auto posto tucha'],
          confidence_modifier: 0.92,
          priority: 96
        },
        'shell': {
          entity_name: 'Shell',
          category: 'Transporte',
          subcategory: 'Combustível',
          aliases: ['posto shell'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'ipiranga': {
          entity_name: 'Ipiranga',
          category: 'Transporte',
          subcategory: 'Combustível',
          aliases: ['posto ipiranga'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'petrobras': {
          entity_name: 'Petrobras',
          category: 'Transporte',
          subcategory: 'Combustível',
          aliases: ['posto petrobras', 'br', 'br petrobras'],
          confidence_modifier: 0.90,
          priority: 95
        },
        
        // Pedágio e Serviços de Transporte
        'sem parar': {
          entity_name: 'Sem Parar',
          category: 'Transporte',
          subcategory: 'Pedágio',
          aliases: ['semparar'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'conectcar': {
          entity_name: 'ConectCar',
          category: 'Transporte',
          subcategory: 'Pedágio',
          aliases: ['conecta car'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'veloe': {
          entity_name: 'Veloe',
          category: 'Transporte',
          subcategory: 'Pedágio',
          aliases: ['veloe pedagio'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'itajaictnrp': {
          entity_name: 'Itajaí CT NRP',
          category: 'Transporte',
          subcategory: 'Pedágio',
          aliases: ['itajai ctnrp'],
          confidence_modifier: 0.75,
          priority: 80
        },
        
        // Transporte Rodoviário
        'buser': {
          entity_name: 'Buser',
          category: 'Transporte',
          subcategory: 'Transporte Rodoviário',
          aliases: ['buser onibus', 'buser viagens'],
          confidence_modifier: 0.90,
          priority: 95
        },
        '4bus': {
          entity_name: '4Bus',
          category: 'Transporte',
          subcategory: 'Transporte Rodoviário',
          aliases: ['4 bus', 'quatro bus'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'clickbus': {
          entity_name: 'ClickBus',
          category: 'Transporte',
          subcategory: 'Transporte Rodoviário',
          aliases: ['click bus'],
          confidence_modifier: 0.85,
          priority: 90
        },
        
        // Companhias Aéreas
        'latam': {
          entity_name: 'LATAM Airlines',
          category: 'Transporte',
          subcategory: 'Companhia Aérea',
          aliases: ['latam airlines', 'tam', 'tam linhas aereas'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'gol': {
          entity_name: 'Gol Linhas Aéreas',
          category: 'Transporte',
          subcategory: 'Companhia Aérea',
          aliases: ['gol linhas aereas', 'voegol'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'azul': {
          entity_name: 'Azul Linhas Aéreas',
          category: 'Transporte',
          subcategory: 'Companhia Aérea',
          aliases: ['azul linhas aereas', 'voeazul'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'voepass': {
          entity_name: 'Voepass',
          category: 'Transporte',
          subcategory: 'Companhia Aérea',
          aliases: ['voepass linhas aereas'],
          confidence_modifier: 0.85,
          priority: 90
        },
        
        // ========================================
        // CASA E MORADIA
        // ========================================
        
        // Concessionárias de Energia (Principais)
        'enel': {
          entity_name: 'Enel',
          category: 'Moradia',
          subcategory: 'Energia Elétrica',
          aliases: ['enel sp', 'enel rj', 'eletropaulo'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'cpfl': {
          entity_name: 'CPFL',
          category: 'Moradia',
          subcategory: 'Energia Elétrica',
          aliases: ['cpfl paulista', 'cpfl energia', 'clfsc'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'neoenergia': {
          entity_name: 'Neoenergia',
          category: 'Moradia',
          subcategory: 'Energia Elétrica',
          aliases: ['elektro', 'coelba', 'celpe', 'cosern'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'energisa': {
          entity_name: 'Energisa',
          category: 'Moradia',
          subcategory: 'Energia Elétrica',
          aliases: ['energisa energia'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'light': {
          entity_name: 'Light',
          category: 'Moradia',
          subcategory: 'Energia Elétrica',
          aliases: ['light energia', 'light rj'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'cemig': {
          entity_name: 'CEMIG',
          category: 'Moradia',
          subcategory: 'Energia Elétrica',
          aliases: ['cemig mg', 'cemig energia'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'copel': {
          entity_name: 'Copel',
          category: 'Moradia',
          subcategory: 'Energia Elétrica',
          aliases: ['copel energia', 'copel pr'],
          confidence_modifier: 0.90,
          priority: 95
        },
        
        // Concessionárias de Água e Saneamento
        'sabesp': {
          entity_name: 'Sabesp',
          category: 'Moradia',
          subcategory: 'Água e Esgoto',
          aliases: ['sabesp sp'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'cedae': {
          entity_name: 'CEDAE',
          category: 'Moradia',
          subcategory: 'Água e Esgoto',
          aliases: ['cedae rj'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'copasa': {
          entity_name: 'COPASA',
          category: 'Moradia',
          subcategory: 'Água e Esgoto',
          aliases: ['copasa mg'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'sanepar': {
          entity_name: 'Sanepar',
          category: 'Moradia',
          subcategory: 'Água e Esgoto',
          aliases: ['sanepar pr'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'casan': {
          entity_name: 'Casan',
          category: 'Moradia',
          subcategory: 'Água e Esgoto',
          aliases: ['casan sc'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'corsan': {
          entity_name: 'Corsan',
          category: 'Moradia',
          subcategory: 'Água e Esgoto',
          aliases: ['corsan rs'],
          confidence_modifier: 0.85,
          priority: 90
        },
        
        // Concessionárias de Gás
        'comgas': {
          entity_name: 'Comgás',
          category: 'Moradia',
          subcategory: 'Gás',
          aliases: ['comgas sp'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'naturgy': {
          entity_name: 'Naturgy',
          category: 'Moradia',
          subcategory: 'Gás',
          aliases: ['naturgy gas', 'ceg'],
          confidence_modifier: 0.85,
          priority: 90
        },
        
        // Provedores de Internet e TV
        'vivo': {
          entity_name: 'Vivo',
          category: 'Moradia',
          subcategory: 'Internet e TV',
          aliases: ['vivo fibra', 'telefonica', 'vivo internet', 'vivo tv'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'claro': {
          entity_name: 'Claro',
          category: 'Moradia',
          subcategory: 'Internet e TV',
          aliases: ['claro net', 'net', 'embratel', 'claro internet', 'claro tv'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'tim': {
          entity_name: 'TIM',
          category: 'Moradia',
          subcategory: 'Internet e TV',
          aliases: ['tim live', 'tim internet', 'tim fibra'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'oi': {
          entity_name: 'Oi',
          category: 'Moradia',
          subcategory: 'Internet e TV',
          aliases: ['oi fibra', 'oi internet', 'oi tv'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'sky': {
          entity_name: 'Sky',
          category: 'Moradia',
          subcategory: 'Internet e TV',
          aliases: ['sky tv', 'sky brasil'],
          confidence_modifier: 0.85,
          priority: 90
        },
        
        // Lojas de Construção e Decoração
        'leroy merlin': {
          entity_name: 'Leroy Merlin',
          category: 'Moradia',
          subcategory: 'Material de Construção',
          aliases: ['leroy'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'telhanorte': {
          entity_name: 'Telhanorte',
          category: 'Moradia',
          subcategory: 'Material de Construção',
          aliases: ['saint-gobain', 'saintgobain'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'cassol': {
          entity_name: 'Cassol',
          category: 'Moradia',
          subcategory: 'Material de Construção',
          aliases: ['cassol materiais'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'cec': {
          entity_name: 'CEC',
          category: 'Moradia',
          subcategory: 'Material de Construção',
          aliases: ['cec materiais'],
          confidence_modifier: 0.75,
          priority: 80
        },
        'tok&stok': {
          entity_name: 'Tok&Stok',
          category: 'Moradia',
          subcategory: 'Móveis e Decoração',
          aliases: ['tokstok', 'tok stok'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'etna': {
          entity_name: 'Etna',
          category: 'Moradia',
          subcategory: 'Móveis e Decoração',
          aliases: ['etna moveis'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'camicado': {
          entity_name: 'Camicado',
          category: 'Moradia',
          subcategory: 'Móveis e Decoração',
          aliases: ['camicado casa'],
          confidence_modifier: 0.80,
          priority: 85
        },
        
        // ========================================
        // ASSINATURAS E SERVIÇOS
        // ========================================
        
        // Streaming de Vídeo
        'netflix': {
          entity_name: 'Netflix',
          category: 'Assinaturas',
          subcategory: 'Streaming de Vídeo',
          aliases: ['netflix assinatura', 'netflix mensal', 'netflix anual', 'netflix premium', 'netflix básico'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'amazon prime': {
          entity_name: 'Amazon Prime',
          category: 'Assinaturas',
          subcategory: 'Streaming de Vídeo',
          aliases: ['prime video', 'amazon prime video', 'prime assinatura'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'disney plus': {
          entity_name: 'Disney+',
          category: 'Assinaturas',
          subcategory: 'Streaming de Vídeo',
          aliases: ['disney+', 'disneyplus', 'disney assinatura'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'hbo max': {
          entity_name: 'HBO Max',
          category: 'Assinaturas',
          subcategory: 'Streaming de Vídeo',
          aliases: ['max', 'hbo assinatura', 'max assinatura'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'globoplay': {
          entity_name: 'Globoplay',
          category: 'Assinaturas',
          subcategory: 'Streaming de Vídeo',
          aliases: ['globo play', 'globoplay assinatura'],
          confidence_modifier: 0.85,
          priority: 90
        },
        
        // Streaming de Música
        'spotify': {
          entity_name: 'Spotify',
          category: 'Assinaturas',
          subcategory: 'Streaming de Música',
          aliases: ['spotify premium', 'spotify assinatura', 'spotify mensal'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'deezer': {
          entity_name: 'Deezer',
          category: 'Assinaturas',
          subcategory: 'Streaming de Música',
          aliases: ['deezer premium', 'deezer assinatura'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'apple music': {
          entity_name: 'Apple Music',
          category: 'Assinaturas',
          subcategory: 'Streaming de Música',
          aliases: ['apple assinatura', 'itunes'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'amazon music': {
          entity_name: 'Amazon Music',
          category: 'Assinaturas',
          subcategory: 'Streaming de Música',
          aliases: ['amazon music unlimited'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'youtube premium': {
          entity_name: 'YouTube Premium',
          category: 'Assinaturas',
          subcategory: 'Streaming de Música',
          aliases: ['youtube music', 'youtube assinatura'],
          confidence_modifier: 0.90,
          priority: 95
        },
        
        // Software e Serviços Digitais (SaaS)
        'cursor ai': {
          entity_name: 'Cursor AI',
          category: 'Assinaturas',
          subcategory: 'Software',
          aliases: ['cursor', 'cursor ai powered'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'microsoft 365': {
          entity_name: 'Microsoft 365',
          category: 'Assinaturas',
          subcategory: 'Software',
          aliases: ['office 365', 'office365', 'microsoft office'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'adobe': {
          entity_name: 'Adobe',
          category: 'Assinaturas',
          subcategory: 'Software',
          aliases: ['creative cloud', 'adobe cc', 'adobe creative'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'google workspace': {
          entity_name: 'Google Workspace',
          category: 'Assinaturas',
          subcategory: 'Software',
          aliases: ['gsuite', 'g suite', 'google apps'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'aws': {
          entity_name: 'Amazon Web Services',
          category: 'Assinaturas',
          subcategory: 'Serviços de TI',
          aliases: ['amazon web services', 'aws cloud'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'google cloud': {
          entity_name: 'Google Cloud',
          category: 'Assinaturas',
          subcategory: 'Serviços de TI',
          aliases: ['gcp', 'google cloud platform'],
          confidence_modifier: 0.85,
          priority: 90
        },
        
        // Armazenamento em Nuvem
        'google one': {
          entity_name: 'Google One',
          category: 'Assinaturas',
          subcategory: 'Armazenamento',
          aliases: ['google armazenamento'],
          confidence_modifier: 0.90,
          priority: 90
        },
        'icloud': {
          entity_name: 'iCloud',
          category: 'Assinaturas',
          subcategory: 'Armazenamento',
          aliases: ['icloud armazenamento', 'icloud+'],
          confidence_modifier: 0.90,
          priority: 90
        },
        'dropbox': {
          entity_name: 'Dropbox',
          category: 'Assinaturas',
          subcategory: 'Armazenamento',
          aliases: ['dropbox assinatura'],
          confidence_modifier: 0.85,
          priority: 85
        },
        
        // Serviços Web (Domínios e Hospedagem)
        'nic br': {
          entity_name: 'NIC.br',
          category: 'Assinaturas',
          subcategory: 'Registro de Domínio',
          aliases: ['registro.br', 'nic.br', 'registro br'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'godaddy': {
          entity_name: 'GoDaddy',
          category: 'Assinaturas',
          subcategory: 'Hospedagem e Domínio',
          aliases: ['go daddy'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'hostgator': {
          entity_name: 'HostGator',
          category: 'Assinaturas',
          subcategory: 'Hospedagem e Domínio',
          aliases: ['host gator'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'hostinger': {
          entity_name: 'Hostinger',
          category: 'Assinaturas',
          subcategory: 'Hospedagem e Domínio',
          aliases: ['hostinger brasil'],
          confidence_modifier: 0.80,
          priority: 85
        },
        
        // ========================================
        // COMPRAS E VAREJO
        // ========================================
        
        // Lojas de Moda e Vestuário
        'renner': {
          entity_name: 'Lojas Renner',
          category: 'Compras',
          subcategory: 'Vestuário e Acessórios',
          aliases: ['lojas renner', 'renner lojas'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'riachuelo': {
          entity_name: 'Riachuelo',
          category: 'Compras',
          subcategory: 'Vestuário e Acessórios',
          aliases: ['rchlo', 'lojas riachuelo'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'c&a': {
          entity_name: 'C&A',
          category: 'Compras',
          subcategory: 'Vestuário e Acessórios',
          aliases: ['cea', 'c e a'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'pernambucanas': {
          entity_name: 'Pernambucanas',
          category: 'Compras',
          subcategory: 'Loja de Departamento',
          aliases: ['lojas pernambucanas'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'hering': {
          entity_name: 'Hering',
          category: 'Compras',
          subcategory: 'Vestuário e Acessórios',
          aliases: ['hering store'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'zara': {
          entity_name: 'Zara',
          category: 'Compras',
          subcategory: 'Vestuário e Acessórios',
          aliases: ['zara brasil'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'marisa': {
          entity_name: 'Marisa',
          category: 'Compras',
          subcategory: 'Vestuário e Acessórios',
          aliases: ['lojas marisa'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'studio z': {
          entity_name: 'Studio Z',
          category: 'Compras',
          subcategory: 'Calçados',
          aliases: ['studioz'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'pdv cia da moda': {
          entity_name: 'Cia da Moda',
          category: 'Compras',
          subcategory: 'Vestuário e Acessórios',
          aliases: ['cia da moda', 'companhia da moda'],
          confidence_modifier: 0.75,
          priority: 80
        },
        
        // Marketplaces e E-commerce
        'mercado livre': {
          entity_name: 'Mercado Livre',
          category: 'Compras',
          subcategory: 'Marketplace',
          aliases: ['mercadolivre', 'mercadopago', 'mercado pago'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'amazon': {
          entity_name: 'Amazon',
          category: 'Compras',
          subcategory: 'Marketplace',
          aliases: ['amz', 'amazon brasil', 'amazon.com.br'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'magazine luiza': {
          entity_name: 'Magazine Luiza',
          category: 'Compras',
          subcategory: 'Varejo',
          aliases: ['magalu', 'magazine luiza', 'magaz luiza'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'casas bahia': {
          entity_name: 'Casas Bahia',
          category: 'Compras',
          subcategory: 'Varejo',
          aliases: ['casasbahia'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'ponto': {
          entity_name: 'Ponto',
          category: 'Compras',
          subcategory: 'Varejo',
          aliases: ['pontofrio', 'ponto frio'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'americanas': {
          entity_name: 'Americanas',
          category: 'Compras',
          subcategory: 'Varejo',
          aliases: ['lojas americanas', 'americanas.com', 'b2w'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'shopee': {
          entity_name: 'Shopee',
          category: 'Compras',
          subcategory: 'Marketplace',
          aliases: ['shopee brasil'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'shein': {
          entity_name: 'Shein',
          category: 'Compras',
          subcategory: 'Vestuário e Acessórios',
          aliases: ['shein brasil'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'aliexpress': {
          entity_name: 'AliExpress',
          category: 'Compras',
          subcategory: 'Marketplace',
          aliases: ['ali express'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'pix marketplace': {
          entity_name: 'Pix Marketplace',
          category: 'Compras',
          subcategory: 'Marketplace',
          aliases: ['marketplace pix'],
          confidence_modifier: 0.70,
          priority: 75
        },
        
        // ========================================
        // SAÚDE E FARMÁCIAS
        // ========================================
        
        'drogasil': {
          entity_name: 'Drogasil',
          category: 'Saúde',
          subcategory: 'Farmácia',
          aliases: ['raia drogasil', 'raia', 'rd saude', 'rd saúde'],
          confidence_modifier: 0.95,
          priority: 100
        },
        'drogaria sao paulo': {
          entity_name: 'Drogaria São Paulo',
          category: 'Saúde',
          subcategory: 'Farmácia',
          aliases: ['dpsp', 'drogaria sp'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'pacheco': {
          entity_name: 'Drogarias Pacheco',
          category: 'Saúde',
          subcategory: 'Farmácia',
          aliases: ['drogarias pacheco'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'pague menos': {
          entity_name: 'Pague Menos',
          category: 'Saúde',
          subcategory: 'Farmácia',
          aliases: ['paguemenos', 'extrafarma'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'panvel': {
          entity_name: 'Panvel',
          category: 'Saúde',
          subcategory: 'Farmácia',
          aliases: ['farmacias panvel'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'drogaria araujo': {
          entity_name: 'Drogaria Araujo',
          category: 'Saúde',
          subcategory: 'Farmácia',
          aliases: ['araujo'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'drogarias nissei': {
          entity_name: 'Drogarias Nissei',
          category: 'Saúde',
          subcategory: 'Farmácia',
          aliases: ['nissei'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'farmacias sao joao': {
          entity_name: 'Farmácias São João',
          category: 'Saúde',
          subcategory: 'Farmácia',
          aliases: ['sao joao', 'são joão'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'drogal': {
          entity_name: 'Drogal',
          category: 'Saúde',
          subcategory: 'Farmácia',
          aliases: ['drogal farmacias'],
          confidence_modifier: 0.75,
          priority: 80
        },
        'dentista': {
          entity_name: 'Dentista',
          category: 'Saúde',
          subcategory: 'Serviços Médicos',
          aliases: ['consulta dentista', 'dentista dr', 'odontologia', 'clínica dental', 'dr silva'],
          confidence_modifier: 0.90,
          priority: 95
        },
        
        // ========================================
        // LAZER E ENTRETENIMENTO
        // ========================================
        
        'sympla': {
          entity_name: 'Sympla',
          category: 'Lazer e Entretenimento',
          subcategory: 'Ingressos e Eventos',
          aliases: ['sympla ingressos'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'ticketmaster': {
          entity_name: 'Ticketmaster',
          category: 'Lazer e Entretenimento',
          subcategory: 'Ingressos e Eventos',
          aliases: ['ticket master'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'total acesso': {
          entity_name: 'Total Acesso',
          category: 'Lazer e Entretenimento',
          subcategory: 'Ingressos e Eventos',
          aliases: ['totalacesso'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'eventim': {
          entity_name: 'Eventim',
          category: 'Lazer e Entretenimento',
          subcategory: 'Ingressos e Eventos',
          aliases: ['eventim brasil'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'ingresso.com': {
          entity_name: 'Ingresso.com',
          category: 'Lazer e Entretenimento',
          subcategory: 'Cinema',
          aliases: ['ingresso', 'ingressocom'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'academia': {
          entity_name: 'Academia',
          category: 'Bem Estar / Beleza',
          subcategory: 'Academia',
          aliases: ['academia fit', 'gym', 'fitness', 'crossfit', 'musculação', 'treino', 'fit life', 'smart fit'],
          confidence_modifier: 0.90,
          priority: 95
        },
        
        // ========================================
        // PETS
        // ========================================
        
        'cobasi': {
          entity_name: 'Cobasi',
          category: 'Pets',
          subcategory: 'Pet Shop',
          aliases: ['cobasi pet'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'petz': {
          entity_name: 'Petz',
          category: 'Pets',
          subcategory: 'Pet Shop',
          aliases: ['petz pet shop'],
          confidence_modifier: 0.85,
          priority: 90
        },
        'petlove': {
          entity_name: 'Petlove',
          category: 'Pets',
          subcategory: 'Pet Shop',
          aliases: ['pet love'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'petland': {
          entity_name: 'Petland',
          category: 'Pets',
          subcategory: 'Pet Shop',
          aliases: ['pet land'],
          confidence_modifier: 0.75,
          priority: 80
        },
        
        // ========================================
        // OUTROS
        // ========================================
        
        'pay2all': {
          entity_name: 'Pay2all',
          category: 'Outros',
          subcategory: 'Gateway de Pagamento',
          aliases: ['pay2all instituicao', 'pay2all pagamento', 'pay 2 all'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'ebanx': {
          entity_name: 'EBANX',
          category: 'Outros',
          subcategory: 'Gateway de Pagamento',
          aliases: ['ebanx pagamentos'],
          confidence_modifier: 0.80,
          priority: 85
        },
        'paypal': {
          entity_name: 'PayPal',
          category: 'Outros',
          subcategory: 'Gateway de Pagamento',
          aliases: ['pay pal'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'pagseguro': {
          entity_name: 'PagSeguro',
          category: 'Outros',
          subcategory: 'Gateway de Pagamento',
          aliases: ['pagbank', 'pag seguro'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'picpay': {
          entity_name: 'PicPay',
          category: 'Outros',
          subcategory: 'Gateway de Pagamento',
          aliases: ['pic pay'],
          confidence_modifier: 0.90,
          priority: 95
        },
        'receita federal': {
          entity_name: 'Receita Federal',
          category: 'Impostos / Taxas',
          subcategory: 'Imposto Federal',
          aliases: ['receita federal', 'rf', 'imposto de renda', 'darf'],
          confidence_modifier: 0.98,
          priority: 100
        },
        'codetime': {
          entity_name: 'Codetime Ltda',
          category: 'Receitas de Trabalho (Salário / Honorário)',
          subcategory: 'Salário',
          aliases: ['codetime ltda', 'codetime', 'code time'],
          confidence_modifier: 0.95,
          priority: 100
        }
      },

      categories: {
        'Alimentação': [
          // SUPERMERCADOS E ATACADOS
          {
            keywords: ['supermercado', 'supermercados', 'super mercado'],
            category: 'Alimentação',
            subcategory: 'Supermercado',
            confidence_modifier: 0.90,
            priority: 90
          },
          {
            keywords: ['atacado', 'atacadista', 'atacadão'],
            category: 'Alimentação',
            subcategory: 'Atacado',
            confidence_modifier: 0.90,
            priority: 90
          },
          {
            keywords: ['hipermercado', 'hiper mercado'],
            category: 'Alimentação',
            subcategory: 'Hipermercado',
            confidence_modifier: 0.85,
            priority: 85
          },
          {
            keywords: ['walmart', 'big', 'bretas'],
            category: 'Alimentação',
            subcategory: 'Supermercado',
            confidence_modifier: 0.85,
            priority: 85
          },
          // RESTAURANTES
          {
            keywords: ['restaurante', 'restaurantes', 'rest ', 'churrascaria'],
            category: 'Alimentação',
            subcategory: 'Restaurante',
            confidence_modifier: 0.80,
            priority: 80
          },
          {
            keywords: ['lanchonete', 'lanche', 'bar', 'boteco'],
            category: 'Alimentação',
            subcategory: 'Lanchonete',
            confidence_modifier: 0.75,
            priority: 75
          },
          // FAST FOOD
          {
            keywords: [/mcdonalds|mc donalds|mcdonald|arcos dourados/, /burger king|bk|burguer/],
            category: 'Alimentação',
            subcategory: 'Fast-Food',
            confidence_modifier: 0.90,
            priority: 90
          },
          {
            keywords: ['habibs', 'habib', 'bobs', 'bob'],
            category: 'Alimentação',
            subcategory: 'Fast-Food',
            confidence_modifier: 0.85,
            priority: 85
          },
          // PIZZARIA
          {
            keywords: ['pizzaria', 'pizz', 'pizza'],
            category: 'Alimentação',
            subcategory: 'Pizzaria',
            confidence_modifier: 0.80,
            priority: 80
          },
          // PADARIAS E DOCERIAS
          {
            keywords: ['padaria', 'panificadora', 'padoca'],
            category: 'Alimentação',
            subcategory: 'Padaria',
            confidence_modifier: 0.80,
            priority: 80
          },
          {
            keywords: ['confeitaria', 'doceria', 'doces'],
            category: 'Alimentação',
            subcategory: 'Doceria',
            confidence_modifier: 0.75,
            priority: 75
          },
          // CAFETERIAS
          {
            keywords: ['cafe', 'café', 'cafeteria', 'coffee'],
            category: 'Alimentação',
            subcategory: 'Cafeteria',
            confidence_modifier: 0.80,
            priority: 80
          },
          // DELIVERY
          {
            keywords: ['delivery', 'entrega', 'pedido online'],
            category: 'Alimentação',
            subcategory: 'Delivery',
            confidence_modifier: 0.75,
            priority: 75
          }
        ],

        'Transporte': [
          // APLICATIVOS DE MOBILIDADE
          {
            keywords: ['uber', 'uberbr', 'uber trip'],
            category: 'Transporte',
            subcategory: 'Ride-Hailing',
            confidence_modifier: 0.90,
            priority: 90
          },
          {
            keywords: ['99', '99app', '99 pop', 'wappa'],
            category: 'Transporte',
            subcategory: 'Ride-Hailing',
            confidence_modifier: 0.85,
            priority: 85
          },
          {
            keywords: ['tembici', 'bike itau', 'bike itaú', 'patinete'],
            category: 'Transporte',
            subcategory: 'Aluguel de Bicicleta/Patinete',
            confidence_modifier: 0.80,
            priority: 80
          },
          // COMBUSTÍVEL
          {
            keywords: ['posto', 'gasolina', 'combustivel', 'combustível', 'abastece'],
            category: 'Transporte',
            subcategory: 'Combustível',
            confidence_modifier: 0.90,
            priority: 90
          },
          {
            keywords: [/gasolina|etanol|diesel/, 'alcool', 'álcool'],
            category: 'Transporte',
            subcategory: 'Combustível',
            confidence_modifier: 0.85,
            priority: 85
          },
          // PEDÁGIOS
          {
            keywords: ['pedagio', 'pedágio', 'sem parar', 'conectcar', 'veloe'],
            category: 'Transporte',
            subcategory: 'Pedágio',
            confidence_modifier: 0.90,
            priority: 90
          },
          // TRANSPORTES PÚBLICOS
          {
            keywords: ['metro', 'metrô', 'onibus', 'ônibus', 'trem', 'balsa'],
            category: 'Transporte',
            subcategory: 'Transporte Público',
            confidence_modifier: 0.80,
            priority: 80
          },
          // TRANSPORTE RODOVIÁRIO
          {
            keywords: ['buser', '4bus', 'clickbus', 'onibus'],
            category: 'Transporte',
            subcategory: 'Transporte Rodoviário',
            confidence_modifier: 0.85,
            priority: 85
          },
          // COMPANHIAS AÉREAS
          {
            keywords: ['latam', 'gol', 'azul', 'voepass', 'tam', 'linhas aereas', 'aéreo'],
            category: 'Transporte',
            subcategory: 'Companhia Aérea',
            confidence_modifier: 0.90,
            priority: 90
          },
          // ESTACIONAMENTO
          {
            keywords: ['estacionamento', 'estapar', 'parebem', 'zona azul'],
            category: 'Transporte',
            subcategory: 'Estacionamento',
            confidence_modifier: 0.80,
            priority: 80
          }
        ],
        
        'Moradia': [
          // ENERGIA ELÉTRICA
          {
            keywords: ['enel', 'cpfl', 'neoenergia', 'elektro', 'energisa', 'light', 'cemig', 'copel', 'energia eletrica', 'energia elétrica', 'luz'],
            category: 'Moradia',
            subcategory: 'Energia Elétrica',
            confidence_modifier: 0.90,
            priority: 90
          },
          {
            keywords: ['eletropaulo', 'coelba', 'celpe', 'cosern'],
            category: 'Moradia',
            subcategory: 'Energia Elétrica',
            confidence_modifier: 0.85,
            priority: 85
          },
          // ÁGUA E SANEAMENTO
          {
            keywords: ['sabesp', 'cedae', 'copasa', 'sanepar', 'casan', 'corsan', 'agua', 'água', 'saneamento', 'esgoto'],
            category: 'Moradia',
            subcategory: 'Água e Esgoto',
            confidence_modifier: 0.90,
            priority: 90
          },
          // GÁS
          {
            keywords: ['comgas', 'naturgy', 'gas', 'gás', 'ceg'],
            category: 'Moradia',
            subcategory: 'Gás',
            confidence_modifier: 0.85,
            priority: 85
          },
          // INTERNET E TV
          {
            keywords: ['vivo', 'claro', 'tim', 'oi', 'sky', 'net', 'internet', 'fibra', 'banda larga'],
            category: 'Moradia',
            subcategory: 'Internet e TV',
            confidence_modifier: 0.85,
            priority: 85
          },
          {
            keywords: ['telefonica', 'embratel', 'tim live', 'vivo fibra', 'claro net'],
            category: 'Moradia',
            subcategory: 'Internet e TV',
            confidence_modifier: 0.80,
            priority: 80
          },
          // MATERIAL DE CONSTRUÇÃO
          {
            keywords: ['leroy merlin', 'leroy', 'telhanorte', 'cassol', 'material de construcao', 'material de construção'],
            category: 'Moradia',
            subcategory: 'Material de Construção',
            confidence_modifier: 0.85,
            priority: 85
          },
          // MÓVEIS E DECORAÇÃO
          {
            keywords: ['tok&stok', 'tokstok', 'etna', 'camicado', 'moveis', 'móveis', 'decoracao', 'decoração'],
            category: 'Moradia',
            subcategory: 'Móveis e Decoração',
            confidence_modifier: 0.80,
            priority: 80
          }
        ],
        
        'Compras': [
          // VESTUÁRIO E MODA
          {
            keywords: ['renner', 'riachuelo', 'c&a', 'cea', 'hering', 'zara', 'marisa', 'roupa', 'roupas', 'vestuario', 'vestuário'],
            category: 'Compras',
            subcategory: 'Vestuário e Acessórios',
            confidence_modifier: 0.85,
            priority: 85
          },
          {
            keywords: ['calcado', 'calçado', 'calcados', 'calçados', 'sapato', 'sapatos'],
            category: 'Compras',
            subcategory: 'Calçados',
            confidence_modifier: 0.80,
            priority: 80
          },
          // MARKETPLACES
          {
            keywords: ['mercado livre', 'mercadolivre', 'mercadopago'],
            category: 'Compras',
            subcategory: 'Marketplace',
            confidence_modifier: 0.90,
            priority: 90
          },
          {
            keywords: ['amazon', 'shopee', 'aliexpress', 'marketplace'],
            category: 'Compras',
            subcategory: 'Marketplace',
            confidence_modifier: 0.85,
            priority: 85
          },
          // VAREJO
          {
            keywords: ['magazine luiza', 'magalu', 'casas bahia', 'americanas', 'ponto', 'pontofrio'],
            category: 'Compras',
            subcategory: 'Varejo',
            confidence_modifier: 0.85,
            priority: 85
          },
          // LOJAS DE DEPARTAMENTO
          {
            keywords: ['pernambucanas', 'loja', 'lojas'],
            category: 'Compras',
            subcategory: 'Loja de Departamento',
            confidence_modifier: 0.70,
            priority: 70
          }
        ],
        
        'Saúde': [
          // FARMÁCIAS
          {
            keywords: ['farmacia', 'farmácia', 'drogaria', 'drogarias'],
            category: 'Saúde',
            subcategory: 'Farmácia',
            confidence_modifier: 0.90,
            priority: 90
          },
          {
            keywords: ['drogasil', 'raia', 'pague menos', 'drogaria sao paulo', 'dpsp', 'pacheco', 'panvel', 'araujo'],
            category: 'Saúde',
            subcategory: 'Farmácia',
            confidence_modifier: 0.85,
            priority: 85
          },
          // SERVIÇOS MÉDICOS
          {
            keywords: ['dentista', 'odontologia', 'clínica dental', 'consulta dentista'],
            category: 'Saúde',
            subcategory: 'Serviços Médicos',
            confidence_modifier: 0.90,
            priority: 90
          },
          {
            keywords: ['medico', 'médico', 'consulta médica', 'dr', 'doutor', 'doutora', 'clínica médica'],
            category: 'Saúde',
            subcategory: 'Serviços Médicos',
            confidence_modifier: 0.85,
            priority: 85
          }
        ],
        
        'Assinaturas': [
          // STREAMING
          {
            keywords: ['netflix', 'spotify', 'amazon prime', 'prime video', 'disney+', 'disney plus', 'hbo max', 'globoplay'],
            category: 'Assinaturas',
            subcategory: 'Streaming de Vídeo',
            confidence_modifier: 0.95,
            priority: 95
          },
          {
            keywords: ['apple music', 'deezer', 'youtube premium', 'youtube music'],
            category: 'Assinaturas',
            subcategory: 'Streaming de Música',
            confidence_modifier: 0.90,
            priority: 90
          },
          // SOFTWARE
          {
            keywords: ['microsoft 365', 'office 365', 'adobe', 'google workspace', 'cursor ai'],
            category: 'Assinaturas',
            subcategory: 'Software',
            confidence_modifier: 0.85,
            priority: 85
          },
          // ARMAZENAMENTO
          {
            keywords: ['google one', 'icloud', 'dropbox', 'onedrive', 'armazenamento'],
            category: 'Assinaturas',
            subcategory: 'Armazenamento',
            confidence_modifier: 0.80,
            priority: 80
          },
          // DOMÍNIOS E HOSPEDAGEM
          {
            keywords: ['nic br', 'registro.br', 'godaddy', 'hostgator', 'hostinger', 'dominio', 'domínio', 'hospedagem'],
            category: 'Assinaturas',
            subcategory: 'Registro de Domínio',
            confidence_modifier: 0.85,
            priority: 85
          },
          // GENÉRICO
          {
            keywords: ['assinatura', 'assinaturas', 'mensalidade', 'mensal', 'anual', 'anuidade', 'plano mensal', 'plano anual'],
            category: 'Assinaturas',
            subcategory: 'Streaming de Vídeo',
            confidence_modifier: 0.70,
            priority: 70
          }
        ],
        
        'Lazer e Entretenimento': [
          {
            keywords: ['sympla', 'ticketmaster', 'total acesso', 'eventim', 'ingresso', 'ingressos', 'evento', 'eventos'],
            category: 'Lazer e Entretenimento',
            subcategory: 'Ingressos e Eventos',
            confidence_modifier: 0.85,
            priority: 85
          },
          {
            keywords: ['cinema', 'filme', 'teatro', 'show'],
            category: 'Lazer e Entretenimento',
            subcategory: 'Cinema',
            confidence_modifier: 0.75,
            priority: 75
          }
        ],
        
        'Pets': [
          {
            keywords: ['cobasi', 'petz', 'petlove', 'petland', 'pet shop', 'petshop', 'pet'],
            category: 'Pets',
            subcategory: 'Pet Shop',
            confidence_modifier: 0.85,
            priority: 85
          }
        ],

        'Bem Estar / Beleza': [
          // ACADEMIAS E FITNESS
          {
            keywords: ['academia', 'gym', 'fitness', 'crossfit', 'musculação', 'treino', 'smart fit', 'blue fit', 'curves', 'fit life'],
            category: 'Bem Estar / Beleza',
            subcategory: 'Academia',
            confidence_modifier: 0.90,
            priority: 90
          },
          // BELEZA E ESTÉTICA
          {
            keywords: ['cabelereiro', 'cabeleireiro', 'barbearia', 'salao', 'salão', 'estetica', 'estética', 'spa'],
            category: 'Bem Estar / Beleza',
            subcategory: 'Bem Estar / Beleza',
            confidence_modifier: 0.75,
            priority: 75
          }
        ],
        
        'Educação': [
          // FACULDADES
          {
            keywords: ['estacio', 'unip', 'anhembi', 'mackenzie', 'fmu', 'faculdade', 'universidade'],
            category: 'Educação',
            subcategory: 'Faculdade',
            confidence_modifier: 0.80,
            priority: 80
          },
          // CURSOS TÉCNICOS
          {
            keywords: ['senac', 'senai', 'curso tecnico', 'curso técnico'],
            category: 'Educação',
            subcategory: 'Curso Técnico',
            confidence_modifier: 0.75,
            priority: 75
          },
          // LIVRARIAS
          {
            keywords: ['livraria', 'saraiva', 'cultura', 'livros'],
            category: 'Educação',
            subcategory: 'Livros',
            confidence_modifier: 0.80,
            priority: 80
          }
        ],
        
        'Impostos / Taxas': [
          // IMPOSTOS FEDERAIS
          {
            keywords: ['receita federal', 'darf', 'imposto de renda'],
            category: 'Impostos / Taxas',
            subcategory: 'Imposto Federal',
            confidence_modifier: 0.95,
            priority: 100
          },
          {
            keywords: ['das', 'simples nacional'],
            category: 'Impostos / Taxas',
            subcategory: 'Imposto Federal',
            confidence_modifier: 0.90,
            priority: 95
          },
          // IMPOSTOS MUNICIPAIS
          {
            keywords: ['iptu', 'imposto predial'],
            category: 'Impostos / Taxas',
            subcategory: 'Imposto Municipal',
            confidence_modifier: 0.90,
            priority: 95
          },
          // IMPOSTOS ESTADUAIS
          {
            keywords: ['ipva', 'imposto veiculo'],
            category: 'Impostos / Taxas',
            subcategory: 'Imposto Estadual',
            confidence_modifier: 0.90,
            priority: 95
          },
          // CONTRIBUIÇÕES SOCIAIS
          {
            keywords: ['fgts', 'inss'],
            category: 'Impostos / Taxas',
            subcategory: 'Contribuição Social',
            confidence_modifier: 0.85,
            priority: 90
          }
        ],
        
        'Tarifas Bancárias': [
          // TARIFAS BANCÁRIAS
          {
            keywords: ['tarifa', /taxa bancaria/, /manutencao conta/, /taxa mensal/, 'cesta de servicos', 'cesta de serviços'],
            category: 'Tarifas Bancárias',
            subcategory: 'Taxa Bancária',
            confidence_modifier: 0.90,
            priority: 90
          },
          // ANUIDADES
          {
            keywords: ['anuidade', 'anuid', 'anuidade mastercard', 'anuidade visa'],
            category: 'Tarifas Bancárias',
            subcategory: 'Anuidade de Cartão',
            confidence_modifier: 0.95,
            priority: 95
          },
          // IOF
          {
            keywords: ['iof', 'iof de atraso', 'iof saq/rotativo', 'imposto op. financeira'],
            category: 'Tarifas Bancárias',
            subcategory: 'Taxa Bancária',
            confidence_modifier: 0.95,
            priority: 100
          },
          // JUROS
          {
            keywords: ['juros de atraso', 'juro sobre rotativo', 'juros de mora', 'juros de divida', 'juros de dívida'],
            category: 'Tarifas Bancárias',
            subcategory: 'Juros',
            confidence_modifier: 0.95,
            priority: 100
          },
          {
            keywords: ['juros', /juros cobrados/, /juro de mora/],
            category: 'Tarifas Bancárias',
            subcategory: 'Juros',
            confidence_modifier: 0.85,
            priority: 85
          },
          // MULTAS
          {
            keywords: ['multa de atraso', 'multa por atraso'],
            category: 'Tarifas Bancárias',
            subcategory: 'Multa',
            confidence_modifier: 0.95,
            priority: 95
          },
          {
            keywords: ['multa'],
            category: 'Tarifas Bancárias',
            subcategory: 'Multa',
            confidence_modifier: 0.80,
            priority: 80
          },
          // FINANCIAMENTO
          {
            keywords: ['pagamento minimo', 'parcelamento rotativ', 'rotativo'],
            category: 'Tarifas Bancárias',
            subcategory: 'Financiamento',
            confidence_modifier: 0.85,
            priority: 85
          }
        ],
        
        'Transferências': [
          {
            keywords: ['pix enviado', 'envio pix', 'transferencia pix'],
            category: 'Transferências',
            subcategory: 'PIX Enviado',
            confidence_modifier: 0.95,
            priority: 100
          },
          {
            keywords: ['pagamento efetuado', 'pagamento realizado', 'debito'],
            category: 'Transferências',
            subcategory: 'Pagamento',
            confidence_modifier: 0.90,
            priority: 90
          },
          {
            keywords: ['ted', 'doc', 'transferencia', 'transferência', 'transf. eletr'],
            category: 'Transferências',
            subcategory: 'Transferência Bancária',
            confidence_modifier: 0.85,
            priority: 85
          }
        ],

        'Renda de Investimentos': [
          // RENDA FIXA
          {
            keywords: [/renda fixa/, 'cdb', 'lci', 'lca', 'tesouro'],
            category: 'Renda de Investimentos',
            subcategory: 'Renda Fixa',
            confidence_modifier: 0.85,
            priority: 85
          },
          // DIVIDENDOS
          {
            keywords: ['dividendo', 'dividendos'],
            category: 'Renda de Investimentos',
            subcategory: 'Dividendos',
            confidence_modifier: 0.75,
            priority: 75
          }
        ],

        'Outras Receitas (Aluguéis, extras, reembolso etc.)': [
          // ALUGUEL
          {
            keywords: ['aluguel', 'alugueis'],
            category: 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
            subcategory: 'Aluguel',
            confidence_modifier: 0.80,
            priority: 80
          },
          // REEMBOLSO
          {
            keywords: ['reembolso', 'devolucao', 'devolução'],
            category: 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
            subcategory: 'Reembolso',
            confidence_modifier: 0.75,
            priority: 75
          }
        ],

        'Salário / 13° Salário / Férias': [
          {
            keywords: ['salario', 'salário', 'remuneracao', 'remuneração', 'vencimento'],
            category: 'Salário / 13° Salário / Férias',
            subcategory: 'Salário',
            confidence_modifier: 0.85,
            priority: 85
          }
        ],

        'Pró Labore': [
          {
            keywords: [/pro labore|prolabore/],
            category: 'Pró Labore',
            subcategory: 'Pró Labore',
            confidence_modifier: 0.80,
            priority: 80
          }
        ]
      },

      banking: {
        // TARIFAS E ENCARGOS BANCÁRIOS
        'multa de atraso': [
          {
            patterns: [/multa de atraso|multa por atraso|multa atraso/],
            category: 'Tarifas Bancárias',
            subcategory: 'Multa',
            confidence_modifier: 0.98,
            priority: 100
          }
        ],
        'juros de atraso': [
          {
            patterns: [/juros de atraso|juro sobre rotativo|juros atraso|juros de mora|juros de divida|juros de dívida/],
            category: 'Tarifas Bancárias',
            subcategory: 'Juros',
            confidence_modifier: 0.98,
            priority: 100
          }
        ],
        'iof': [
          {
            patterns: [/iof de atraso|iof atraso|iof saq\/rotativo|imposto op\. financeira|^iof$/],
            category: 'Tarifas Bancárias',
            subcategory: 'Taxa Bancária',
            confidence_modifier: 0.98,
            priority: 100
          }
        ],
        'anuidade': [
          {
            patterns: [/anuidade mastercard|anuidade visa|anuidade|anuid/],
            category: 'Tarifas Bancárias',
            subcategory: 'Anuidade de Cartão',
            confidence_modifier: 0.95,
            priority: 100
          }
        ],
        'tarifa bancaria': [
          {
            patterns: [/tarifa|taxa bancaria|manutencao conta|taxa mensal|cesta de servicos/],
            category: 'Tarifas Bancárias',
            subcategory: 'Taxa Bancária',
            confidence_modifier: 0.90,
            priority: 95
          }
        ],
        'pagamento minimo': [
          {
            patterns: [/pagamento minimo|pagamento mínimo|parcelamento rotativ|rotativo/],
            category: 'Tarifas Bancárias',
            subcategory: 'Financiamento',
            confidence_modifier: 0.90,
            priority: 95
          }
        ],
        'saldo em atraso': [
          {
            patterns: [/saldo em atraso|atraso saldo/],
            category: 'Tarifas Bancárias',
            subcategory: 'Dívida',
            confidence_modifier: 0.90,
            priority: 92
          }
        ],
        'encerramento de divida': [
          {
            patterns: [/encerramento de divida|encerramento de dívida|quitacao|quitação/],
            category: 'Tarifas Bancárias',
            subcategory: 'Quitação de Dívida',
            confidence_modifier: 0.85,
            priority: 90
          }
        ],
        
        // TRANSFERÊNCIAS E PAGAMENTOS PIX
        'pix enviado': [
          {
            patterns: [/pix enviado|envio pix|transferencia pix enviada/],
            category: 'Transferências',
            subcategory: 'PIX Enviado',
            confidence_modifier: 0.98,
            priority: 100
          }
        ],
        'pix recebido': [
          {
            patterns: [/pix recebido|recebimento pix|entrada pix/],
            category: 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
            subcategory: 'PIX Recebido',
            confidence_modifier: 0.98,
            priority: 100
          }
        ],
        'pagamento efetuado': [
          {
            patterns: [/pagamento efetuado|pagamento realizado/],
            category: 'Transferências',
            subcategory: 'Pagamento',
            confidence_modifier: 0.95,
            priority: 95
          }
        ],
        
        // TRANSFERÊNCIAS BANCÁRIAS
        'ted': [
          {
            patterns: [/^ted |ted enviado|ted recebido|transf\. eletr/],
            category: 'Transferências',
            subcategory: 'TED/DOC Enviado',
            confidence_modifier: 0.95,
            priority: 95
          }
        ],
        'doc': [
          {
            patterns: [/^doc |doc enviado|doc recebido/],
            category: 'Transferências',
            subcategory: 'TED/DOC Enviado',
            confidence_modifier: 0.95,
            priority: 95
          }
        ],
        'transferencia': [
          {
            patterns: [/transferencia|transferência/],
            category: 'Transferências',
            subcategory: 'Transferência Bancária',
            confidence_modifier: 0.85,
            priority: 85
          }
        ],
        
        // RECEITAS E RECEBIMENTOS
        'pagamento recebido': [
          {
            patterns: [/pagamento recebido|recebimento|valor recebido/],
            category: 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
            subcategory: 'Recebimento',
            confidence_modifier: 0.85,
            priority: 90
          }
        ],
        'credito de atraso': [
          {
            patterns: [/credito de atraso|crédito de atraso|estorno/],
            category: 'Outras Receitas (Aluguéis, extras, reembolso etc.)',
            subcategory: 'Estorno',
            confidence_modifier: 0.90,
            priority: 95
          }
        ],
        
        // GATEWAY DE PAGAMENTO
        'gateway de pagamento': [
          {
            patterns: [/pay2all|ebanx|paypal|pagseguro|pagbank|picpay/],
            category: 'Outros',
            subcategory: 'Gateway de Pagamento',
            confidence_modifier: 0.85,
            priority: 85
          }
        ]
      },

      utilities: {
        'SP': {
          'Energia': [
            { entity_name: 'Enel SP', category: 'Moradia', subcategory: 'Energia', aliases: ['enel', 'eletropaulo'], confidence_modifier: 0.90, priority: 95, state_specific: true, states: ['SP'] },
            { entity_name: 'CPFL Paulista', category: 'Moradia', subcategory: 'Energia', aliases: ['cpfl', 'companhia paulista'], confidence_modifier: 0.90, priority: 95, state_specific: true, states: ['SP'] },
            { entity_name: 'Neoenergia Elektro', category: 'Moradia', subcategory: 'Energia', aliases: ['neoenergia', 'elektro'], confidence_modifier: 0.85, priority: 90, state_specific: true, states: ['SP'] }
          ],
          'Água/Saneamento': [
            { entity_name: 'Sabesp', category: 'Moradia', subcategory: 'Água/Saneamento', aliases: ['sabesp'], confidence_modifier: 0.90, priority: 95, state_specific: true, states: ['SP'] }
          ],
          'Gás': [
            { entity_name: 'Comgás', category: 'Moradia', subcategory: 'Gás', aliases: ['comgas'], confidence_modifier: 0.85, priority: 90, state_specific: true, states: ['SP'] }
          ]
        },
        'RJ': {
          'Energia': [
            { entity_name: 'Light', category: 'Moradia', subcategory: 'Energia', aliases: ['light'], confidence_modifier: 0.90, priority: 95, state_specific: true, states: ['RJ'] },
            { entity_name: 'Enel RJ', category: 'Moradia', subcategory: 'Energia', aliases: ['enel'], confidence_modifier: 0.90, priority: 95, state_specific: true, states: ['RJ'] }
          ],
          'Água/Saneamento': [
            { entity_name: 'CEDAE', category: 'Moradia', subcategory: 'Água/Saneamento', aliases: ['cedae'], confidence_modifier: 0.85, priority: 90, state_specific: true, states: ['RJ'] }
          ],
          'Gás': [
            { entity_name: 'Naturgy', category: 'Moradia', subcategory: 'Gás', aliases: ['naturgy', 'ceg'], confidence_modifier: 0.85, priority: 90, state_specific: true, states: ['RJ'] }
          ]
        },
        'MG': {
          'Energia': [
            { entity_name: 'CEMIG', category: 'Moradia', subcategory: 'Energia', aliases: ['cemig'], confidence_modifier: 0.90, priority: 95, state_specific: true, states: ['MG'] }
          ],
          'Água/Saneamento': [
            { entity_name: 'COPASA', category: 'Moradia', subcategory: 'Água/Saneamento', aliases: ['copasa'], confidence_modifier: 0.85, priority: 90, state_specific: true, states: ['MG'] }
          ]
        },
        'BA': {
          'Energia': [
            { entity_name: 'COELBA', category: 'Moradia', subcategory: 'Energia', aliases: ['coelba', 'neoenergia'], confidence_modifier: 0.90, priority: 95, state_specific: true, states: ['BA'] }
          ],
          'Água/Saneamento': [
            { entity_name: 'EMBASA', category: 'Moradia', subcategory: 'Água/Saneamento', aliases: ['embasa'], confidence_modifier: 0.85, priority: 90, state_specific: true, states: ['BA'] }
          ]
        }
      },

      synonyms: {
        'supermercado': ['supermercados', 'super mercado', 'super-mercado'],
        'atacado': ['atacados', 'atacadão', 'ataque'],
        'posto': ['postos', 'gasolina', 'combustível'],
        'farmacia': ['farmácia', 'drogaria', 'drogarias'],
        'restaurante': ['restaurantes', 'restaurant', 'restauracao'],
        'academia': ['academias', 'gym', 'fitness', 'crossfit'],
        'petshop': ['pet shop', 'pet center', 'loja animais'],
        'telefonia': ['celular', 'telefonia', 'telefone', 'telecom'],
        'streaming': ['assinatura', 'servico streaming'],
        'delivery': ['entrega', 'pedido online', 'app delivery'],
        'pix': ['transferencia', 'envio', 'recebimento'],
        'salario': ['salário', 'remuneração', 'vencimento'],
        'juros': ['juro', 'encargo', 'taxa juros']
      },

      learned_patterns: {},
      usage_stats: {}
    };
  }

  /**
   * Busca por estabelecimento específico usando sistema de pontuação baseado em tokens
   */
  findMerchant(description: string): { category: string; subcategory?: string; confidence: number; entity_name?: string; priority: number } | null {
    const descText = description.toLowerCase().trim();
    const tokens = tokenizeDescription(descText);

    let bestMatch: any = null;
    let highestScore = 0;

    // Busca por estabelecimentos específicos (prioridade máxima)
    for (const [merchantKey, merchant] of Object.entries(this.dictionary.merchants)) {
      // Busca direta por correspondência exata ou parcial (CASE INSENSITIVE)
      const directMatch = descText.includes(merchantKey.toLowerCase()) || 
                          merchant.aliases.some(alias => descText.includes(alias.toLowerCase()));

      if (directMatch) {
        const score = merchant.confidence_modifier * (merchant.priority / 100);

        if (score > highestScore) {
          highestScore = score;
          bestMatch = {
            category: merchant.category,
            subcategory: merchant.subcategory,
            confidence: score * 100,
            entity_name: merchant.entity_name,
            priority: merchant.priority
          };
        }
      }
    }

    // Busca por concessionárias específicas do estado (se localização conhecida)
    if (this.userLocation && this.dictionary.utilities[this.userLocation]) {
      for (const [service, utilities] of Object.entries(this.dictionary.utilities[this.userLocation])) {
        for (const utility of utilities) {
          const score = this.calculateTokenScore(tokens, utility.entity_name, utility.aliases, utility.confidence_modifier, utility.priority);

          if (score > highestScore && score >= 0.7) {
            highestScore = score;
            bestMatch = {
              category: utility.category,
              subcategory: utility.subcategory,
              confidence: score * 100,
              entity_name: utility.entity_name,
              priority: utility.priority
            };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calcula pontuação baseada em tokens
   */
  private calculateTokenScore(tokens: string[], mainKey: string, aliases: string[], confidenceModifier: number, priority: number): number {
    let score = 0;
    let maxPossibleScore = 0;

    // Pontuação para chave principal
    const mainTokens = tokenizeDescription(mainKey);
    maxPossibleScore += mainTokens.length;

    for (const mainToken of mainTokens) {
      if (tokens.includes(mainToken)) {
        score += 1;
      }
    }

    // Pontuação para aliases
    for (const alias of aliases) {
      const aliasTokens = tokenizeDescription(alias);
      maxPossibleScore += aliasTokens.length * 0.8; // Aliases têm peso menor

      for (const aliasToken of aliasTokens) {
        if (tokens.includes(aliasToken)) {
          score += 0.8;
        }
      }
    }

    // Calcula pontuação relativa
    const relativeScore = maxPossibleScore > 0 ? score / maxPossibleScore : 0;

    // Aplica modificadores
    const finalScore = relativeScore * confidenceModifier * (priority / 100);

    return Math.min(finalScore, 1.0);
  }

  /**
   * Busca por padrões genéricos usando sistema de pontuação
   */
  findByKeywords(description: string, type: 'income' | 'expense'): { category: string; subcategory?: string; confidence: number; priority: number } | null {
    const descText = description.toLowerCase();
    const tokens = tokenizeDescription(descText);

    let bestMatch: any = null;
    let highestScore = 0;
    let bestPriority = 0;

    // Busca por padrões genéricos organizados por categoria
    for (const [category, entries] of Object.entries(this.dictionary.categories)) {
      for (const entry of entries) {
        // Busca direta por palavras-chave na descrição
        const directMatch = entry.keywords.some((keyword: string | RegExp) => {
          if (typeof keyword === 'string') {
            return descText.includes(keyword.toLowerCase());
          } else {
            return keyword.test(descText);
          }
        });

        if (directMatch) {
          const priority = entry.priority || 50;
          const score = (entry.confidence_modifier || 0.8) * (priority / 100);

          if (score > highestScore) {
            highestScore = score;
            bestPriority = priority;
            bestMatch = {
              category: entry.category,
              subcategory: entry.subcategory,
              confidence: score * 100,
              priority: priority
            };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calcula pontuação para palavras-chave genéricas
   */
  private calculateKeywordScore(tokens: string[], keywords: (string | RegExp)[], confidenceModifier: number, priority: number): number {
    let score = 0;
    let maxPossibleScore = 0;

    for (const keyword of keywords) {
      if (typeof keyword === 'string') {
        const keywordTokens = tokenizeDescription(keyword);
        maxPossibleScore += keywordTokens.length * 0.6; // Palavras-chave têm peso menor

        for (const keywordToken of keywordTokens) {
          if (tokens.includes(keywordToken)) {
            score += 0.6;
          }
        }
      } else if (keyword instanceof RegExp) {
        // Para expressões regulares, verifica se alguma corresponde
        if (keyword.test(tokens.join(' '))) {
          score += 1.0;
          maxPossibleScore += 1.0;
        }
      }
    }

    const relativeScore = maxPossibleScore > 0 ? score / maxPossibleScore : 0;
    return Math.min(relativeScore * confidenceModifier * (priority / 100), 1.0);
  }

  /**
   * Busca por padrões bancários específicos usando sistema de pontuação
   */
  findBankingPattern(description: string): { category: string; subcategory?: string; confidence: number; priority: number } | null {
    const descText = description.toLowerCase();
    const tokens = tokenizeDescription(descText);

    let bestMatch: any = null;
    let highestScore = 0;

    // Busca por padrões bancários contextuais
    for (const [context, patterns] of Object.entries(this.dictionary.banking)) {
      for (const pattern of patterns) {
        const score = this.calculateBankingScore(tokens, pattern.patterns, pattern.confidence_modifier, pattern.priority);

        if (score > highestScore && score >= 0.6) {
          highestScore = score;
          bestMatch = {
            category: pattern.category,
            subcategory: pattern.subcategory,
            confidence: score * 100,
            priority: pattern.priority
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calcula pontuação para padrões bancários
   */
  private calculateBankingScore(tokens: string[], patterns: (string | RegExp)[], confidenceModifier: number, priority: number): number {
    let score = 0;

    for (const pattern of patterns) {
      if (typeof pattern === 'string') {
        const patternTokens = tokenizeDescription(pattern);
        for (const patternToken of patternTokens) {
          if (tokens.includes(patternToken)) {
            score += 0.8;
          }
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(tokens.join(' '))) {
          score += 1.0;
        }
      }
    }

    return Math.min(score * confidenceModifier * (priority / 100), 1.0);
  }

  /**
   * Categoriza transação usando lógica hierárquica inteligente
   * AVALIA TODAS AS OPÇÕES E ESCOLHE A DE MAIOR CONFIANÇA
   */
  categorize(description: string, type: 'income' | 'expense'): { category: string; subcategory?: string; confidence: number; entity_name?: string; learned?: boolean; method?: string } {
    const originalDescription = description;

    // Array para armazenar TODAS as possibilidades
    const candidates: Array<{
      category: string;
      subcategory?: string;
      confidence: number;
      entity_name?: string;
      learned?: boolean;
      method: string;
      priority: number;
    }> = [];

    // 1. PADRÕES APRENDIDOS PELO USUÁRIO (Maior Prioridade)
    const learnedMatch = this.findLearnedPattern(description);
    if (learnedMatch && learnedMatch.confidence >= 75) {
      candidates.push({
        category: learnedMatch.category,
        subcategory: learnedMatch.subcategory,
        confidence: learnedMatch.confidence,
        learned: true,
        method: 'learned_pattern',
        priority: 100 // Prioridade máxima
      });
    }

    // 2. ESTABELECIMENTOS ESPECÍFICOS (Alta Prioridade)
    const merchant = this.findMerchant(description);
    if (merchant && merchant.confidence >= 60) {
      candidates.push({
        ...merchant,
        method: 'merchant_specific',
        priority: merchant.priority || 95
      });
    }

    // 3. PADRÕES BANCÁRIOS CONTEXTUAIS (Média-Alta Prioridade)
    const bankingPattern = this.findBankingPattern(description);
    if (bankingPattern && bankingPattern.confidence >= 70) {
      candidates.push({
        ...bankingPattern,
        method: 'banking_pattern',
        priority: bankingPattern.priority || 85
      });
    }

    // 4. PALAVRAS-CHAVE GENÉRICAS (Média Prioridade)
    const keywordPattern = this.findByKeywords(description, type);
    if (keywordPattern && keywordPattern.confidence >= 50) {
      candidates.push({
        ...keywordPattern,
        method: 'keyword_match',
        priority: keywordPattern.priority || 70
      });
    }

    // 5. ESCOLHER A MELHOR OPÇÃO
    if (candidates.length > 0) {
      // Ordenar por: 1) Confiança, 2) Prioridade, 3) Se é aprendido
      candidates.sort((a, b) => {
        // Primeiro: maior confiança
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        // Segundo: maior prioridade
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Terceiro: preferir aprendidos
        if (b.learned !== a.learned) {
          return (b.learned ? 1 : 0) - (a.learned ? 1 : 0);
        }
        return 0;
      });

      const bestMatch = candidates[0];
      
      this.updateUsageStats(bestMatch.category);
      
      return {
        category: bestMatch.category,
        subcategory: bestMatch.subcategory,
        confidence: bestMatch.confidence,
        entity_name: bestMatch.entity_name,
        learned: bestMatch.learned,
        method: bestMatch.method
      };
    }

    // 6. CATEGORIZAÇÃO PADRÃO (Fallback)
    const defaultCategory = type === 'income'
      ? 'Outras Receitas (Aluguéis, extras, reembolso etc.)'
      : 'Outros';
    
    this.updateUsageStats(defaultCategory);

    return {
      category: defaultCategory,
      confidence: 50,
      learned: false,
      method: 'default_fallback'
    };
  }

  /**
   * Busca por padrões aprendidos pelo usuário
   */
  private findLearnedPattern(description: string): { category: string; subcategory?: string; confidence: number } | null {
    const learned = this.dictionary.learned_patterns[description];
    if (learned && learned.count >= 2) { // Pelo menos 2 ocorrências para considerar aprendido
      const confidence = Math.min(learned.confidence + (learned.count * 5), 95); // Aumenta confiança com uso
      return {
        category: learned.category,
        subcategory: learned.subcategory,
        confidence
      };
    }
    return null;
  }

  /**
   * Atualiza estatísticas de uso
   */
  private updateUsageStats(category: string): void {
    if (!this.dictionary.usage_stats[category]) {
      this.dictionary.usage_stats[category] = { count: 0, accuracy: 0 };
    }
    this.dictionary.usage_stats[category].count++;
  }

  /**
   * Sistema de aprendizado automático baseado em correções do usuário (global)
   */
  async learnFromCorrection(description: string, correctCategory: string, subcategory?: string, confidence: number = 85): Promise<void> {
    const normalizedDescription = description.toLowerCase().trim();
    const currentTime = new Date().toISOString();

    // Salva no banco de dados global
    await this.saveLearnedPatternToDatabase(description, correctCategory, subcategory, confidence, true);

    // 1. APRENDIZADO DE ESTABELECIMENTOS ESPECÍFICOS
    // Se a descrição não corresponde a nenhum padrão existente, trata como estabelecimento específico
    const existingMerchant = Object.keys(this.dictionary.merchants).find(key =>
      normalizedDescription.includes(key) ||
      this.dictionary.merchants[key].aliases.some(alias => normalizedDescription.includes(alias))
    );

    if (!existingMerchant && this.isLikelyEstablishment(normalizedDescription)) {
      this.addLearnedMerchant(normalizedDescription, correctCategory, subcategory, confidence, currentTime);
    }

    // 2. APRENDIZADO DE PADRÕES GENÉRICOS
    // Se é uma palavra-chave nova, adiciona à categoria apropriada
    if (this.isGenericPattern(normalizedDescription) && !this.hasExistingPattern(normalizedDescription)) {
      this.addLearnedPattern(normalizedDescription, correctCategory, subcategory, confidence, currentTime);
    }

    // 3. REFORÇO DE PADRÕES EXISTENTES
    // Se o usuário confirma uma categorização existente, aumenta a confiança
    const existingPattern = this.findExistingPattern(normalizedDescription);
    if (existingPattern) {
      this.reinforceExistingPattern(normalizedDescription, correctCategory, currentTime);
    }

    // 4. DETECÇÃO DE PADRÕES RECORRENTES
    // Se a mesma descrição aparece múltiplas vezes, considera como aprendido
    if (!this.dictionary.learned_patterns[normalizedDescription]) {
      this.dictionary.learned_patterns[normalizedDescription] = {
        category: correctCategory,
        subcategory,
        confidence,
        count: 1,
        last_seen: currentTime
      };
    } else {
      this.dictionary.learned_patterns[normalizedDescription].count++;
      this.dictionary.learned_patterns[normalizedDescription].last_seen = currentTime;

      // Aumenta confiança baseado na frequência
      const learned = this.dictionary.learned_patterns[normalizedDescription];
      learned.confidence = Math.min(learned.confidence + (learned.count * 2), 95);
    }
  }

  /**
   * Salva padrão aprendido no banco de dados global
   */
  private async saveLearnedPatternToDatabase(description: string, category: string, subcategory?: string, confidence: number = 85, userVote: boolean = false): Promise<void> {
    try {
      await (supabase as any).rpc('update_global_learned_pattern', {
        p_description: description,
        p_category: category,
        p_subcategory: subcategory,
        p_confidence: confidence,
        p_user_vote: userVote
      });
    } catch (error) {
      console.error('Erro ao salvar padrão aprendido no banco:', error);
    }
  }

  /**
   * Verifica se descrição parece ser um estabelecimento específico
   */
  private isLikelyEstablishment(description: string): boolean {
    // Estabelecimentos específicos geralmente têm:
    // - Múltiplas palavras (não apenas uma)
    // - Não são termos bancários genéricos
    // - Não são palavras-chave comuns

    const tokens = tokenizeDescription(description);
    const bankingTerms = ['pix', 'pagamento', 'transferencia', 'debito', 'credito', 'juros', 'multa', 'taxa'];

    return tokens.length >= 2 &&
           !bankingTerms.some(term => description.includes(term)) &&
           !this.hasGenericKeywords(description);
  }

  /**
   * Verifica se é um padrão genérico
   */
  private isGenericPattern(description: string): boolean {
    return tokenizeDescription(description).length <= 3 &&
           !this.isLikelyEstablishment(description);
  }

  /**
   * Verifica se descrição tem palavras-chave genéricas existentes
   */
  private hasGenericKeywords(description: string): boolean {
    for (const entries of Object.values(this.dictionary.categories)) {
      for (const entry of entries) {
        for (const keyword of entry.keywords) {
          if (typeof keyword === 'string' && description.includes(keyword.toLowerCase())) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Verifica se já existe algum padrão para esta descrição
   */
  private hasExistingPattern(description: string): boolean {
    return this.findLearnedPattern(description) !== null ||
           this.findMerchant(description) !== null ||
           this.findBankingPattern(description) !== null;
  }

  /**
   * Encontra padrão existente para descrição
   */
  private findExistingPattern(description: string): { category: string; subcategory?: string } | null {
    const learned = this.findLearnedPattern(description);
    if (learned) return learned;

    const merchant = this.findMerchant(description);
    if (merchant) return { category: merchant.category, subcategory: merchant.subcategory };

    const banking = this.findBankingPattern(description);
    if (banking) return { category: banking.category, subcategory: banking.subcategory };

    return null;
  }

  /**
   * Adiciona estabelecimento aprendido
   */
  private addLearnedMerchant(description: string, category: string, subcategory: string | undefined, confidence: number, timestamp: string): void {
    this.dictionary.merchants[description] = {
      entity_name: this.extractEntityName(description),
      category,
      subcategory,
      aliases: this.generateAliases(description),
      confidence_modifier: confidence / 100,
      priority: 90,
      state_specific: false
    };

    this.dictionary.learned_patterns[description] = {
      category,
      subcategory,
      confidence,
      count: 1,
      last_seen: timestamp
    };
  }

  /**
   * Adiciona padrão aprendido (público para uso pelo IntelligentTransactionClassifier)
   */
  addLearnedPattern(description: string, category: string, subcategory: string | undefined, confidence: number, timestamp: string): void {
    // Encontra a categoria no dicionário
    const categoryEntries = this.dictionary.categories[category];
    if (categoryEntries) {
      categoryEntries.push({
        keywords: [description],
        category,
        subcategory,
        confidence_modifier: confidence / 100,
        priority: 70
      });
    }

    this.dictionary.learned_patterns[description] = {
      category,
      subcategory,
      confidence,
      count: 1,
      last_seen: timestamp
    };
  }

  /**
   * Reforça padrão existente
   */
  private reinforceExistingPattern(description: string, correctCategory: string, timestamp: string): void {
    if (this.dictionary.learned_patterns[description]) {
      this.dictionary.learned_patterns[description].count++;
      this.dictionary.learned_patterns[description].last_seen = timestamp;
    }
  }

  /**
   * Extrai nome da entidade da descrição
   */
  private extractEntityName(description: string): string {
    // Remove termos bancários comuns
    const cleaned = description
      .replace(/pix enviado|pix recebido|pagamento efetuado|transferencia/g, '')
      .trim();

    // Pega primeiras palavras significativas
    const words = cleaned.split(/\s+/).filter(word => word.length > 2);
    return words.slice(0, 3).join(' ');
  }

  /**
   * Gera aliases para estabelecimento
   */
  private generateAliases(description: string): string[] {
    const tokens = tokenizeDescription(description);
    const aliases: string[] = [];

    // Gera variações removendo palavras comuns
    const commonWords = ['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas'];

    for (let i = 1; i < tokens.length; i++) {
      const partial = tokens.slice(0, i + 1).join(' ');
      if (partial.length > 3 && !commonWords.some(word => partial.includes(word))) {
        aliases.push(partial);
      }
    }

    return aliases.slice(0, 3); // Limita a 3 aliases
  }

  /**
   * Obtém estatísticas avançadas do dicionário
   */
  getStats(): {
    merchants: number;
    categories: number;
    banking: number;
    learned_patterns: number;
    total_entries: number;
    usage_stats: { [category: string]: { count: number; accuracy: number } }
  } {
    let totalEntries = 0;

    // Conta entradas por categoria
    for (const entries of Object.values(this.dictionary.categories)) {
      totalEntries += entries.length;
    }

    return {
      merchants: Object.keys(this.dictionary.merchants).length,
      categories: totalEntries,
      banking: Object.keys(this.dictionary.banking).length,
      learned_patterns: Object.keys(this.dictionary.learned_patterns).length,
      total_entries: totalEntries + Object.keys(this.dictionary.merchants).length,
      usage_stats: this.dictionary.usage_stats
    };
  }

  /**
   * Obtém padrões aprendidos para análise
   */
  getLearnedPatterns(): { [description: string]: { category: string; subcategory?: string; confidence: number; count: number; last_seen: string } } {
    return this.dictionary.learned_patterns;
  }

  /**
   * Exporta dicionário para backup/persistência
   */
  exportDictionary(): IntelligentDictionary {
    return JSON.parse(JSON.stringify(this.dictionary));
  }

  /**
   * Importa dicionário (para restauração)
   */
  importDictionary(dictionary: IntelligentDictionary): void {
    this.dictionary = { ...dictionary };
  }

  /**
   * Define localização do usuário para concessionárias específicas
   */
  setUserLocation(state: string): void {
    this.userLocation = state;
  }

  /**
   * Obtém localização atual do usuário
   */
  getUserLocation(): string | undefined {
    return this.userLocation;
  }

  /**
   * Obtém concessionárias disponíveis para estado específico
   */
  getUtilitiesForState(state: string): { [service: string]: MerchantEntry[] } | null {
    return this.dictionary.utilities[state] || null;
  }

  /**
   * Adiciona nova concessionária manualmente
   */
  addUtility(state: string, service: string, utility: Omit<MerchantEntry, 'state_specific' | 'states'>): void {
    if (!this.dictionary.utilities[state]) {
      this.dictionary.utilities[state] = {};
    }

    if (!this.dictionary.utilities[state][service]) {
      this.dictionary.utilities[state][service] = [];
    }

    this.dictionary.utilities[state][service].push({
      ...utility,
      state_specific: true,
      states: [state]
    });
  }

  /**
   * Remove padrão aprendido
   */
  removeLearnedPattern(description: string): boolean {
    if (this.dictionary.learned_patterns[description]) {
      delete this.dictionary.learned_patterns[description];
      return true;
    }
    return false;
  }

  /**
   * Limpa estatísticas de uso
   */
  clearUsageStats(): void {
    this.dictionary.usage_stats = {};
  }

  /**
   * Obtém categorias mais usadas
   */
  getMostUsedCategories(limit: number = 10): { category: string; count: number }[] {
    return Object.entries(this.dictionary.usage_stats)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, limit)
      .map(([category, stats]) => ({ category, count: stats.count }));
  }

  /**
   * Valida estrutura do dicionário
   */
  validateDictionary(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Verifica se todas as categorias têm subcategorias válidas
    for (const [category, entries] of Object.entries(this.dictionary.categories)) {
      for (const entry of entries) {
        if (!entry.keywords || entry.keywords.length === 0) {
          errors.push(`Categoria "${category}" tem entrada sem keywords`);
        }
        if (!entry.category) {
          errors.push(`Categoria "${category}" tem entrada sem category definida`);
        }
      }
    }

    // Verifica estabelecimentos
    for (const [merchantKey, merchant] of Object.entries(this.dictionary.merchants)) {
      if (!merchant.entity_name) {
        errors.push(`Estabelecimento "${merchantKey}" sem entity_name`);
      }
      if (!merchant.category) {
        errors.push(`Estabelecimento "${merchantKey}" sem categoria`);
      }
      if (!merchant.aliases || merchant.aliases.length === 0) {
        errors.push(`Estabelecimento "${merchantKey}" sem aliases`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
