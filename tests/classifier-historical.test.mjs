import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { CategoryResolver, LearnedPatterns, classifyTransaction } from '../supabase/functions/classify-transactions/classifier.ts';
import { MerchantIndex } from '../supabase/functions/classify-transactions/merchant-index.ts';
import { supplementDictionary } from '../supabase/functions/classify-transactions/reference-data.ts';

test('historical SQL dictionary preserves conflicts and classifies safely in either order', async () => {
  const db = new PGlite();
  const directory = new URL('../supabase/migrations/', import.meta.url);
  try {
    await db.exec('CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY)');
    const schema = await readFile(new URL('20250131000015_create_merchants_dictionary.sql', directory), 'utf8');
    await db.exec(schema.match(/CREATE TABLE public\.merchants_dictionary \([\s\S]*?\n\);/)[0]);
    for (const file of (await readdir(directory)).sort()) {
      const sql = await readFile(new URL(file, directory), 'utf8');
      if (/^20260916113/.test(file)) { await db.exec(sql); continue; }
      // Only top-level seed INSERT VALUES statements, never function bodies or
      // unrelated schema. PostgreSQL itself applies ON CONFLICT semantics.
      if (!/seed|keywords|keyword|ticketmais/.test(file)) continue;
      for (const match of sql.matchAll(/INSERT\s+INTO\s+(?:public\.)?merchants_dictionary\s*\([^)]+\)\s*VALUES[\s\S]*?;/gi)) {
        await db.exec(match[0]);
      }
    }
    const legacy = (await db.query('SELECT * FROM merchants_dictionary WHERE is_active ORDER BY merchant_key')).rows;
    assert.ok(legacy.length > 1300);
    assert.equal(legacy.find(r => r.merchant_key === 'subway').category, 'Alimentação');
    assert.equal(legacy.find(r => r.merchant_key === 'picpay').category, 'Outros');
    const rows = supplementDictionary(legacy);
    const categories = new CategoryResolver();
    const context = values => ({ index: new MerchantIndex(values), categories, learned: new LearnedPatterns([], categories) });
    const contexts = [context(rows), context([...rows].reverse())];
    for (const ctx of contexts) {
      for (const description of ['MP', 'MP JOAO', 'PIC PAY', 'PAG SEGURO', 'PAGBANK', '99 PAY', 'PIX 99 PAY', 'PIX BIA MATEUS', 'PARIS HOTEL', 'ESTACAO', 'ESTADIO']) {
        const result = classifyTransaction({ description, type: 'expense' }, ctx);
        assert.equal(result.needs_review, true, `${description}: ${JSON.stringify(result)}`);
      }
      for (const [description, category, type = 'expense'] of [
        ['O BOTICARIO', 'Presentes / Compras'], ['SUBWAY', 'Alimentação'],
        ['RESGATE AUTOMATICO', 'Outras Receitas (Aluguéis, extras, reembolso etc.)', 'income'],
        ['COMPRA PARCELADA SEM JUROS CARREFOUR', 'Alimentação'],
        ['MP*DROGASIL', 'Proteção Pessoal / Saúde / Farmácia'],
      ]) {
        const result = classifyTransaction({ description, type }, ctx);
        assert.equal(result.category, category, `${description}: ${JSON.stringify(result)}`);
      }
      assert.equal(classifyTransaction({ description: 'CREDITO', type: 'income' }, ctx).needs_review, true);
    }
    for (const description of ['ESTACAO', 'ESTADIO']) {
      assert.deepEqual(...contexts.map(ctx => classifyTransaction({ description, type: 'expense' }, ctx)));
    }
  } finally { await db.close(); }
});
