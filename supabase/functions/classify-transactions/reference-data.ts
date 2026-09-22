/**
 * Versioned bootstrap vocabulary. These are explicit category examples, not a
 * trained statistical model. User corrections always take precedence. The
 * remote catalog remains authoritative; aliases are only supplemented when
 * the category agrees. Keep regression examples independent of this file.
 */
import type { DictionaryRow } from './merchant-index.ts';
import { foldAccents, tokenizePhrase } from './description-cleaner.ts';

type Example = [key: string, aliases?: string[]];
type Group = [category: string, subcategory: string, type: 'merchant' | 'keyword' | 'utility', examples: Example[]];

const GROUPS: Group[] = [
  ['Alimentação', 'Supermercado', 'merchant', [
    ['assai atacadista', ['assai', 'assaí']], ['carrefour'], ['pao de acucar'],
    ['atacadao'], ['supermercados bh'], ['supermercados guanabara'],
    ['supermercados mundial'], ['supermercados condor'], ['supermercados savegnago'],
    ['supermercados zona sul'], ['sams club', ['sam s club']],
  ]],
  ['Alimentação', 'Delivery', 'merchant', [
    ['ifood', ['ifd', 'i food']], ['rappi'], ['uber eats', ['ubereats', 'ubr eats']],
    ['99 food', ['99food']], ['ze delivery', ['zedelivery']],
  ]],
  ['Alimentação', 'Restaurantes', 'merchant', [
    ['mcdonalds', ['mc donalds', 'mc donald s', 'mcdonald s']],
    ['burger king'], ['subway'], ['habibs', ['habib s']], ['outback'], ['starbucks'],
  ]],
  ['Transporte', 'Transporte por Aplicativo', 'merchant', [
    ['uber', ['uberx', 'uber trip', 'uber rides', 'ubr trip']],
    ['99 taxi', ['99', '99app', '99 app', '99 pop', '99taxi', '99tecnologia', '99 tecnologia']],
    ['cabify'], ['indrive'],
  ]],
  ['Transporte', 'Combustível', 'merchant', [
    ['posto ipiranga'], ['posto shell'], ['posto petrobras'], ['auto posto'],
  ]],
  ['Transporte', 'Pedágio e Estacionamento', 'merchant', [
    ['sem parar', ['semparar']], ['conectcar'], ['veloe'], ['estapar'],
  ]],
  ['Transporte', 'Aluguel de Veículo', 'merchant', [['localiza'], ['movida'], ['unidas rent a car']]],
  ['Assinaturas', 'Serviços Digitais', 'merchant', [
    ['netflix'], ['spotify'], ['amazon prime', ['prime video', 'amzn prime']],
    ['disney plus', ['disneyplus', 'disney+']], ['hbo max', ['hbomax']],
    ['globoplay'], ['youtube premium'], ['apple icloud', ['icloud']],
    ['google one'], ['microsoft 365'], ['adobe'], ['openai', ['chatgpt']],
    ['uber one'],
  ]],
  ['Assinaturas', 'Telefonia e Internet', 'merchant', [
    ['vivo', ['telefonica vivo']], ['claro'], ['tim'], ['oi fibra'], ['vivo fibra'],
  ]],
  ['Proteção Pessoal / Saúde / Farmácia', 'Farmácia', 'merchant', [
    ['drogasil'], ['droga raia', ['drogaraia']], ['drogaria sao paulo'],
    ['drogarias pacheco'], ['pague menos'], ['panvel'], ['ultrafarma'],
  ]],
  ['Bem Estar / Beleza', 'Beleza e Academia', 'merchant', [
    ['smart fit', ['smartfit']], ['bluefit', ['blue fit']], ['bodytech'],
    ['boticario', ['o boticario']], ['natura'], ['sephora'],
  ]],
  ['Pet', 'Animais', 'merchant', [['petz'], ['cobasi'], ['petlove']]],
  ['Estudos', 'Cursos e Educação', 'merchant', [
    ['hotmart', ['htm']], ['udemy'], ['alura'], ['coursera'], ['duolingo'],
  ]],
  ['Presentes / Compras', 'Compras', 'merchant', [
    ['amazon', ['amzn mktp']], ['mercado livre', ['mercadolivre']], ['shopee'],
    ['magazine luiza', ['magalu']], ['casas bahia'], ['americanas'], ['aliexpress'],
  ]],
  ['Roupas e acessórios', 'Vestuário', 'merchant', [
    ['renner', ['lojas renner']], ['riachuelo'], ['cea', ['c&a', 'c a modas']],
    ['zara'], ['shein'], ['netshoes'], ['centauro'],
  ]],
  ['Casa', 'Contas de Consumo', 'utility', [
    ['enel'], ['cemig'], ['cpfl'], ['copel'], ['neoenergia'], ['equatorial energia'],
    ['sabesp'], ['sanepar'], ['copasa'], ['cedae'], ['comgas'], ['naturgy'],
  ]],
  ['Lazer', 'Entretenimento', 'merchant', [
    ['cinemark'], ['cinepolis'], ['kinoplex'], ['steam'], ['playstation'], ['xbox'],
  ]],
  ['Alimentação', 'Alimentação', 'keyword', [
    ['supermercado', ['supermercados', 'hipermercado', 'atacadista', 'mercearia', 'hortifruti', 'acougue']],
    ['restaurante', ['restaurantes', 'pizzaria', 'lanchonete', 'padaria', 'confeitaria', 'cafeteria', 'hamburgueria']],
  ]],
  ['Proteção Pessoal / Saúde / Farmácia', 'Saúde', 'keyword', [
    ['farmacia', ['farmacias', 'drogaria', 'drogarias']],
    ['clinica', ['hospital', 'laboratorio', 'odontologia', 'dentista', 'psicologo', 'fisioterapia']],
  ]],
  ['Pet', 'Animais', 'keyword', [['pet shop', ['petshop', 'veterinario', 'veterinaria']]]],
  ['Estudos', 'Educação', 'keyword', [['mensalidade escolar', ['faculdade', 'universidade', 'colegio', 'curso ingles']]]],
  ['Transporte', 'Combustível', 'keyword', [['combustivel', ['gasolina', 'etanol', 'posto combustivel']]]],
  ['Bem Estar / Beleza', 'Cuidados Pessoais', 'keyword', [['cabeleireiro', ['barbearia', 'manicure', 'salao beleza', 'academia']]]],
];

export const REFERENCE_DATA_VERSION = '2026-09-21.1';
export const REFERENCE_DICTIONARY: DictionaryRow[] = GROUPS.flatMap(([category, subcategory, entry_type, examples]) =>
  examples.map(([key, aliases = []]) => ({
    id: `reference:${key}`, merchant_key: key, entity_name: key, category, subcategory,
    entry_type, aliases, keywords: [], priority: 85, confidence_modifier: 0.95,
    state_specific: false, states: [],
  })),
);

const keyOf = (text: string) => foldAccents(text).toLowerCase().trim();
export function supplementDictionary(rows: DictionaryRow[]): DictionaryRow[] {
  const byKey = new Map(rows.map(row => [keyOf(row.merchant_key), row]));
  const knownNames = new Set(rows.flatMap(row => [row.merchant_key, row.entity_name, ...(row.aliases ?? [])])
    .map(name => tokenizePhrase(name).join(' ')));
  for (const example of REFERENCE_DICTIONARY) {
    const key = keyOf(example.merchant_key);
    const current = byKey.get(key);
    if (!current && !knownNames.has(tokenizePhrase(example.merchant_key).join(' '))) byKey.set(key, example);
    else if (current && keyOf(current.category) === keyOf(example.category)) {
      byKey.set(key, { ...current, aliases: [...new Set([...(current.aliases ?? []), ...(example.aliases ?? [])])] });
    }
  }
  return [...byKey.values()];
}
