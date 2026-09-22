import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyChunks, mapClassification, fallbackClassification, validateChunk,
  prepareCorrections, partitionDuplicates, requiresReview,
} from '../src/components/extrato-uploader/classification.ts';
import { insertImportChunks, readAllPages } from '../src/components/extrato-uploader/importPersistence.ts';

const owner = 'owner';
const cat = (id, name, category_type = 'expense', user_id = null, is_system = true) => ({ id, name, category_type, user_id, is_system });
const categories = [
  cat('meal', 'Refeição'), cat('food', 'Alimentação'), cat('other', 'Outros'),
  cat('custom', 'Café do trabalho', 'expense', owner, false),
  cat('income', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'income'),
  cat('foreign', 'Refeição', 'expense', 'someone-else', false),
];
const tx = (id, overrides = {}) => ({ id, description: `Loja ${id}`, date: '2026-09-21', value: 25, type: 'expense', account_id: 'account-a', category_id: 'food', ...overrides });
const result = (description, overrides = {}) => ({ description, category: 'Refeição', confidence: 92, method: 'merchant_entity', features_used: ['merchant'], needs_review: false, ...overrides });

test('exact names preserve Refeição and custom categories; Edge ID takes precedence', () => {
  assert.equal(mapClassification(tx('1'), result('Loja 1'), categories, owner).category_id, 'meal');
  assert.equal(mapClassification(tx('1'), result('Loja 1', { category: 'Café do trabalho' }), categories, owner).category_id, 'custom');
  const mapped = mapClassification(tx('1'), result('Loja 1', { category_id: 'custom', category: 'Alimentação' }), categories, owner);
  assert.equal(mapped.category_id, 'custom');
  assert.equal(mapped.category_name, 'Café do trabalho');
});

test('ID and fallback validate both owner and type, including misleading system flags', () => {
  const invalid = mapClassification(tx('1'), result('Loja 1', { category_id: 'foreign' }), categories, owner);
  assert.equal(invalid.category_id, 'other');
  assert.equal(invalid.confidence, 0);
  assert.equal(invalid.needs_review, true);
  const income = tx('2', { type: 'income' });
  assert.equal(mapClassification(income, result('Loja 2', { category_id: 'meal' }), categories, owner).category_id, 'income');
  const contaminated = [cat('foreign-fallback', 'Outros', 'expense', 'someone-else', true), cat('wrong-type', 'Outros', 'income')];
  assert.equal(mapClassification(tx('3'), fallbackClassification(tx('3')), contaminated, owner).category_id, undefined);
});

test('same-name personal category has deterministic precedence over global category', () => {
  const choices = [cat('a-global', 'Refeição'), cat('z-personal', 'Refeição', 'expense', owner, false)];
  assert.equal(mapClassification(tx('1'), result('Loja 1'), choices, owner).category_id, 'z-personal');
});

test('Edge review flag survives high confidence and low confidence requires explicit review', () => {
  const high = mapClassification(tx('1'), result('Loja 1', { needs_review: true }), categories, owner);
  assert.equal(requiresReview(high), true);
  assert.equal(requiresReview({ ...high, reviewed: true }), false);
  assert.equal(requiresReview(mapClassification(tx('1'), result('Loja 1', { confidence: 45 }), categories, owner)), true);
});

test('one failed chunk preserves good chunks and never displaces subsequent results', async () => {
  const inputs = Array.from({ length: 8 }, (_, i) => tx(String(i)));
  const response = await classifyChunks(inputs, 2, async chunk => {
    if (chunk[0].id === '2') throw new Error('429');
    return { results: chunk.map(t => result(t.description)) };
  });
  assert.deepEqual(response.results.map(r => r.description), inputs.map(t => t.description));
  assert.deepEqual(response.results.map(r => r.confidence), [92, 92, 0, 0, 92, 92, 92, 92]);
  assert.deepEqual(response.failures, [{ start: 2, count: 2, message: '429' }]);
});

test('truncated and reordered responses cannot silently assign a category to another row', async () => {
  const inputs = [tx('a'), tx('b'), tx('c'), tx('d')];
  const response = await classifyChunks(inputs, 2, async chunk => ({ results: chunk[0].id === 'a'
    ? [result(chunk[1].description)] : chunk.map(t => result(t.description)) }));
  assert.deepEqual(response.results.map(r => r.confidence), [0, 0, 92, 92]);
  assert.throws(() => validateChunk({ results: [result('Loja b'), result('Loja a')] }, inputs.slice(0, 2)), /Ordem/);
});

test('invalid row payload falls back locally; old Edge payload without new optional fields remains valid', () => {
  const inputs = [tx('1'), tx('2')];
  const good = { description: 'Loja 2', category: 'Refeição', confidence: 90, method: 'dictionary' };
  const rows = validateChunk({ results: [result('Loja 1', { confidence: NaN }), good] }, inputs);
  assert.equal(rows[0].confidence, 0);
  assert.equal(rows[1].confidence, 90);
  assert.deepEqual(rows[1].features_used, []);
  assert.equal(rows[1].needs_review, false);
});

test('empty batches never invoke Edge and invalid batch sizes terminate', async () => {
  let calls = 0;
  const invoke = async chunk => { calls++; return { results: chunk.map(t => result(t.description)) }; };
  assert.deepEqual(await classifyChunks([], 0, invoke), { results: [], failures: [] });
  assert.equal(calls, 0);
  assert.equal((await classifyChunks([tx('1')], NaN, invoke)).results.length, 1);
});

test('only actual corrections of saved IDs train, even after deletion and reordering', () => {
  const source = [tx('deleted'), tx('saved'), tx('failed'), tx('duplicate'), tx('reverted')];
  const originals = new Map(source.map(t => [t.id, t]));
  const items = [source[2], source[1], source[3]].map(t => ({ ...t, category_id: 'meal' }));
  items.push(source[4]);
  const learned = prepareCorrections(items, originals, new Set(['saved', 'reverted']), categories, owner);
  assert.deepEqual(learned.errors, []);
  assert.equal(learned.corrections.length, 1);
  assert.equal(learned.corrections[0].id, 'saved');
  assert.equal(learned.corrections[0].p_category, 'Refeição');
});

test('learning never sends old category_name or stale subcategory as the new subcategory', () => {
  const original = tx('1', { subcategory: 'Supermercado', category_name: 'Alimentação' });
  const originals = new Map([[original.id, original]]);
  const changed = { ...original, category_id: 'meal' };
  assert.equal(prepareCorrections([changed], originals, new Set(['1']), categories, owner).corrections[0].p_subcategory, undefined);
  assert.equal(prepareCorrections([{ ...changed, subcategory: 'Restaurante' }], originals, new Set(['1']), categories, owner).corrections[0].p_subcategory, 'Restaurante');
});

test('learning rejects categories from other users, wrong types and invalid descriptions', () => {
  for (const overrides of [{ category_id: 'foreign' }, { category_id: 'income' }, { category_id: 'meal', description: 'x' }]) {
    const original = tx('1');
    const prepared = prepareCorrections([{ ...original, ...overrides }], new Map([['1', original]]), new Set(['1']), categories, owner);
    assert.equal(prepared.corrections.length, 0);
    assert.equal(prepared.errors.length, 1);
  }
});

test('same-direction corrections reject contradictory or duplicate training examples', () => {
  const originals = [tx('1', { description: 'Mesmo fornecedor' }), tx('2', { description: 'Mesmo fornecedor' })];
  const source = new Map(originals.map(t => [t.id, t]));
  const saved = new Set(['1', '2']);
  const items = originals.map(t => ({ ...t, category_id: 'meal' }));
  assert.equal(prepareCorrections(items, source, saved, categories, owner).corrections.length, 1);
  items[1].category_id = 'custom';
  const conflicting = prepareCorrections(items, source, saved, categories, owner);
  assert.equal(conflicting.corrections.length, 0);
  assert.equal(conflicting.errors.length, 1);
});

test('duplicate identity includes type and destination and preserves repeated purchases', () => {
  const first = tx('1', { description: 'Compra' });
  const second = { ...first, id: '2' };
  const anotherAccount = { ...first, id: '3', account_id: 'account-b' };
  const income = { ...first, id: '4', type: 'income' };
  const card = { ...first, id: '5', account_id: undefined, credit_card_id: 'card-a' };
  const split = partitionDuplicates([first, second, anotherAccount, income, card], [first]);
  assert.deepEqual(split.duplicadas.map(t => t.id), ['1']);
  assert.deepEqual(split.novas.map(t => t.id), ['2', '3', '4', '5']);
});

test('retrying a failed identical purchase does not mistake the saved twin for its duplicate', () => {
  const saved = tx('saved', { description: 'Compra' });
  const failed = { ...saved, id: 'failed' };
  const split = partitionDuplicates([failed], [saved], [saved]);
  assert.deepEqual(split.novas.map(t => t.id), ['failed']);
});

test('duplicate scan reads all pages and surfaces database failure', async () => {
  const pages = [];
  const rows = await readAllPages(async (from, to) => {
    pages.push([from, to]);
    return { data: Array.from({ length: from < 1000 ? 500 : 1 }, (_, i) => from + i), error: null };
  });
  assert.equal(rows.length, 1001);
  assert.deepEqual(pages, [[0, 499], [500, 999], [1000, 1499]]);
  await assert.rejects(readAllPages(async () => ({ data: null, error: new Error('offline') })), /offline/);
});

test('partial save reports stable IDs for identical descriptions and saves good rows', async () => {
  const items = [tx('a', { description: 'Compra' }), tx('b', { description: 'Compra' }), tx('c')];
  const calls = [];
  const saved = await insertImportChunks(items, items, async rows => {
    calls.push(rows.map(r => r.id));
    return { error: rows.some(r => r.id === 'b') ? { code: '23514' } : null };
  }, () => 'Descrição inválida', () => false, 2);
  assert.deepEqual([...saved.savedIds], ['a', 'c']);
  assert.deepEqual(saved.failures.map(f => f.id), ['b']);
  assert.deepEqual(calls, [['a', 'b'], ['a'], ['b'], ['c']]);
});

test('transport errors do not replay possibly committed chunks; quota stops further calls', async () => {
  for (const failure of [new Error('Failed to fetch'), { code: 'P0001', message: 'quota' }]) {
    let calls = 0;
    const items = [tx('1'), tx('2'), tx('3')];
    const result = await insertImportChunks(items, items, async () => { calls++; throw failure; }, () => 'Falha', () => true, 2);
    assert.equal(calls, 1);
    assert.equal(result.savedIds.size, 0);
    assert.deepEqual(result.failures.map(f => f.id), ['1', '2', '3']);
  }
});
