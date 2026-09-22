import test from 'node:test';
import assert from 'node:assert/strict';
import { CategoryResolver, LearnedPatterns, classifyBatch, classifyTransaction } from '../supabase/functions/classify-transactions/classifier.ts';
import { normalizeDescription } from '../supabase/functions/classify-transactions/description-cleaner.ts';
import { MerchantIndex } from '../supabase/functions/classify-transactions/merchant-index.ts';
import { REFERENCE_DICTIONARY, supplementDictionary } from '../supabase/functions/classify-transactions/reference-data.ts';

const health = 'Proteção Pessoal / Saúde / Farmácia';
const fees = 'Tarifas Bancárias / Juros / Impostos / Taxas';
const otherIncome = 'Outras Receitas (Aluguéis, extras, reembolso etc.)';
const salary = 'Salário / 13° Salário / Férias';
const categories = new CategoryResolver(undefined);
const index = new MerchantIndex(REFERENCE_DICTIONARY);
const context = (rows = [], catalog = categories, dictionary = index) => ({
  index: dictionary, categories: catalog, learned: new LearnedPatterns(rows, catalog),
});
const input = (description, type = 'expense') => ({ description, type });
const classify = (description, type = 'expense', ctx = context()) => classifyTransaction(input(description, type), ctx);

// Hand-written statement descriptors, kept separate from vocabulary construction.
const examples = [
  ['MP*DROGASIL 0123 SAO PAULO', health], ['PAG*DROGA RAIA', health],
  ['COMPRA CARTAO DROGARIA SAO PAULO', health], ['FARMÁCIA SANTA HELENA', health],
  ['PIX FARMACIA SANTA HELENA', health], ['POSTO DE SAUDE MUNICIPAL', health],
  ['IFD*LANCHES X', 'Alimentação'], ['iFood*XYZ', 'Alimentação'],
  ['IFOOD*XYZ', 'Alimentação'], ['RSHOP ASSAI ATACADISTA', 'Alimentação'],
  ['PAGTO ELO CARREFOUR', 'Alimentação'], ['PIX SUPERMERCADO BOM PRECO', 'Alimentação'],
  ['PIX RESTAURANTE SABOR CASEIRO', 'Alimentação'], ['RestauranteSaborCaseiro', 'Alimentação'],
  ['99 FOOD', 'Alimentação'], ['99*FOOD', 'Alimentação'], ['99food', 'Alimentação'],
  ['UBR*EATS', 'Alimentação'], ['UBER*EATS', 'Alimentação'], ['UBER EATS', 'Alimentação'],
  ['UBER*TRIP HELP.UBER.COM', 'Transporte'], ['UBERX', 'Transporte'],
  ['99 APP', 'Transporte'], ['99TECNOLOGIA', 'Transporte'], ['99*POP', 'Transporte'],
  ['ALUGUEL DE CARRO LOCALIZA', 'Transporte'], ['ESTACIONAMENTO CENTRO', 'Transporte'],
  ['POSTO SHELL', 'Transporte'], ['SEM PARAR', 'Transporte'],
  ['NETFLIX.COM', 'Assinaturas'], ['PAYPAL*SPOTIFY', 'Assinaturas'],
  ['AMAZON PRIME', 'Assinaturas'], ['AMZN PRIME', 'Assinaturas'], ['UBER*ONE', 'Assinaturas'],
  ['DISNEY+', 'Assinaturas'], ['DEB AUT VIVO', 'Assinaturas'],
  ['HTM*CURSO INGLES', 'Estudos'], ['HOTMART*CURSO', 'Estudos'], ['ALURA', 'Estudos'],
  ['PET SHOP AMIGOS', 'Pet'], ['COBASI', 'Pet'], ['PIX PETSHOP AMIGOS', 'Pet'],
  ['AMAZON MARKETPLACE', 'Presentes / Compras'], ['MERCADOLIVRE', 'Presentes / Compras'],
  ['C&A MODAS PARCELA 2/10', 'Roupas e acessórios'], ['RENNER 03/10', 'Roupas e acessórios'],
  ['SMARTFIT', 'Bem Estar / Beleza'], ['O BOTICARIO', 'Bem Estar / Beleza'],
  ['PAGTO CONTA LUZ', 'Casa'], ['DEB AUT SABESP', 'Casa'], ['ALUGUEL IMOVEL', 'Casa'],
  ['TARIFA PIX', fees], ['IOF CARTAO', fees], ['JUROS LIS', fees],
  ['APLIC CDB', 'Investimentos (pelo menos 20% da receita)'],
  ['CRED SAL EMPRESA', salary, 'income'], ['PRO LABORE', 'Pró Labore', 'income'],
  ['PLR EMPRESA', 'Participação de Lucros / Comissões', 'income'],
  ['REND PAGO CDB', 'Renda de Investimentos', 'income'],
  ['ESTORNO SALARIO', otherIncome, 'income'], ['ESTORNO RENDIMENTOS CDB', otherIncome, 'income'],
  ['ESTORNO TARIFA PIX', otherIncome, 'income'], ['RESG CDB', otherIncome, 'income'],
];

for (const [description, expected, type = 'expense'] of examples) {
  test(`statement: ${description} (${type})`, () => {
    const result = classify(description, type);
    assert.equal(result.category, expected, JSON.stringify(result));
    assert.ok(result.confidence >= 60, JSON.stringify(result));
  });
}

function merchant(key, category, aliases = [], extra = {}) {
  return { ...REFERENCE_DICTIONARY[0], id: key, merchant_key: key, entity_name: key, category, aliases, ...extra };
}
function learned(description, category, extra = {}) {
  return { description, category, normalized_description: description.toLowerCase(), subcategory: null,
    confidence: 90, usage_count: 1, last_used_at: '2026-09-21T10:00:00Z', ...extra };
}

test('learned category IDs survive renames, retain exact destinations and reject deleted IDs', () => {
  const catalog = new CategoryResolver([
    { id: 'custom', name: 'Almoço', category_type: 'expense' },
    { id: 'same-name', name: 'Almoço', category_type: 'expense', is_system: true },
  ]);
  const row = learned('CANTINA DA ESCOLA', 'Nome antigo', { metadata: { category_id: 'custom', transaction_type: 'expense' } });
  const result = classify('CANTINA DA ESCOLA', 'expense', context([row], catalog));
  assert.equal(result.category, 'Almoço');
  assert.equal(result.category_id, 'custom');
  row.category = 'Almoço';
  row.metadata.category_id = 'deleted';
  assert.notEqual(classify('CANTINA DA ESCOLA', 'expense', context([row], catalog)).method, 'user_learned');
});

test('person names in PIX never inherit surname merchants', () => {
  const dictionary = new MerchantIndex([...REFERENCE_DICTIONARY,
    merchant('supermercado pereira', 'Alimentação', ['pereira']),
    merchant('mateus', 'Alimentação'), merchant('luz', 'Casa')]);
  for (const name of ['MARIA PEREIRA', 'JOAO MATEUS', 'MARIA LUZ']) {
    const result = classify(`PIX ENVIADO ${name}`, 'expense', context([], categories, dictionary));
    assert.equal(result.category, 'Outros');
    assert.equal(result.needs_review, true);
  }
});

test('unknown counterparties and intermediaries require review', () => {
  for (const description of ['PIX*JOAO CARLOS', 'MERCADOPAGO', 'MERCADO PAGO JOAO SILVA', 'XYZ', '', '12345678901234567890']) {
    const result = classify(description);
    assert.equal(result.category, 'Outros', JSON.stringify(result));
    assert.equal(result.needs_review, true);
  }
  assert.equal(classify('PIX RECEBIDO CARREFOUR', 'income').category, otherIncome);
  assert.equal(classify('PIX RECEBIDO CARREFOUR', 'income').needs_review, true);
});

test('no arbitrary compact prefixes or ambiguous alias labels', () => {
  const dictionary = new MerchantIndex([merchant('pereira', 'Alimentação'),
    merchant('alpha', 'Casa', ['samebrand']), merchant('beta', 'Pet', ['samebrand'])]);
  for (const description of ['PEREIRAS', 'SAMEBRAND']) {
    assert.equal(classify(description, 'expense', context([], categories, dictionary)).method, 'default_fallback');
  }
  const reversed = new MerchantIndex([merchant('beta', 'Pet', ['samebrand']), merchant('alpha', 'Casa', ['samebrand'])]);
  assert.equal(classify('samebrand', 'expense', context([], categories, reversed)).method, 'default_fallback');
});

test('learning is directional, recent, and survives changing payment channels', () => {
  const rows = [learned('PIX ENVIADO ANA SILVA', 'Casa', { usage_count: 200 }),
    learned('PIX RECEBIDO ANA SILVA', salary), learned('DROGASIL', 'Despesas Pessoais')];
  const ctx = context(rows);
  assert.equal(classify('PIX RECEBIDO ANA SILVA', 'income', ctx).category, salary);
  assert.equal(classify('PIX ENVIADO ANA SILVA', 'expense', ctx).category, 'Casa');
  assert.equal(classify('COMPRA CARTAO DROGASIL 0123', 'expense', ctx).category, 'Despesas Pessoais');
  assert.equal(classify('PIX DROGASIL', 'expense', ctx).learned_from_user, true);
  const changed = context([learned('UBER 01/10', 'Transporte', { usage_count: 500, last_used_at: '2026-09-01' }),
    learned('UBER 02/10', 'Despesas Pessoais')]);
  assert.equal(classify('UBER 03/10', 'expense', changed).category, 'Despesas Pessoais');
});

test('learning must not revive disabled/low-confidence/deleted-category examples', () => {
  for (const row of [learned('DROGASIL', 'Casa', { is_active: false }), learned('DROGASIL', 'Casa', { confidence: 0 }),
    learned('DROGASIL', 'Categoria Excluída')]) {
    assert.equal(classify('DROGASIL', 'expense', context([row])).category, health);
  }
});

test('conflicting learned examples without recency evidence do not teach arbitrary labels', () => {
  const result = classify('LOJA XYZ', 'expense', context([learned('LOJA XYZ', 'Casa'), learned('LOJA XYZ', 'Pet')]));
  assert.equal(result.learned_from_user, false);
});

test('catalog uses real IDs, direction and exact custom names before aliases', () => {
  const rows = [
    { id: 'system', name: 'Refeição', category_type: 'expense', is_system: true },
    { id: 'personal', name: 'Refeição', category_type: 'expense', is_system: false },
    { id: 'income', name: 'Refeição', category_type: 'income', is_system: false },
    { id: 'other', name: 'Outros', category_type: 'expense', is_system: true },
  ];
  for (const catalog of [new CategoryResolver(rows), new CategoryResolver([...rows].reverse())]) {
    const result = classify('RESTAURANTE XYZ', 'expense', context([learned('RESTAURANTE XYZ', 'Refeição')], catalog));
    assert.equal(result.category, 'Refeição');
    assert.equal(result.category_id, 'personal');
    assert.equal(catalog.resolve('Refeição', 'income').id, 'income');
    assert.equal(catalog.resolve('Casa', 'expense'), null);
  }
  assert.equal(classify('DROGASIL', 'expense', context([], new CategoryResolver([]))).needs_review, true);
});

test('batch and individual classifications are identical, in either order', () => {
  const inputs = ['IFD*XYZ', 'IFD XYZ', '99 FOOD', '99*FOOD', 'UBER*TRIP', 'UBER*EATS'].map(d => input(d));
  const ctx = context();
  assert.deepEqual(classifyBatch(inputs, ctx), inputs.map(t => classifyTransaction(t, ctx)));
  assert.deepEqual(classifyBatch([...inputs].reverse(), ctx), [...inputs].reverse().map(t => classifyTransaction(t, ctx)));
});

test('normalization removes installment counters, keeps gateway identity and 99', () => {
  assert.equal(normalizeDescription('NETFLIX Parcela 2/10').signature, normalizeDescription('NETFLIX Parcela 3/10').signature);
  assert.ok(normalizeDescription('99TECNOLOGIA').signature);
  assert.deepEqual(normalizeDescription('iFood*XYZ'), normalizeDescription('IFOOD*XYZ'));
  assert.equal(normalizeDescription('HTM*CURSO INGLES').hints[0], 'hotmart');
});

test('supplement adds missing aliases without overwriting catalog decisions', () => {
  const result = supplementDictionary([merchant('uber', 'Transporte', ['ubercustom']), merchant('ifood', 'Refeição')]);
  assert.ok(result.find(r => r.merchant_key === 'uber').aliases.includes('uberx'));
  assert.ok(result.find(r => r.merchant_key === 'uber').aliases.includes('ubercustom'));
  assert.equal(result.find(r => r.merchant_key === 'ifood').category, 'Refeição');
});

test('a 500-line batch stays complete with bounded scores', () => {
  const inputs = Array.from({ length: 500 }, (_, i) => input(examples[i % examples.length][0]));
  const result = classifyBatch(inputs, context());
  assert.equal(result.length, inputs.length);
  result.forEach((r, i) => { assert.equal(r.description, inputs[i].description); assert.ok(r.confidence >= 0 && r.confidence <= 100); });
});
