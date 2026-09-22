import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Executes the actual migration in PostgreSQL. Minimal fixture schema mirrors
// the touched columns; Supabase authentication and MFA are deliberately stubbed.
test('verified learning migration: ownership, direction, correction and retry safety', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.user_id', true), '')::uuid $$;
      CREATE FUNCTION public.orbi_require_mfa_session() RETURNS void LANGUAGE plpgsql AS
        $$ BEGIN IF current_setting('request.mfa', true) = 'deny' THEN RAISE EXCEPTION 'MFA required' USING ERRCODE='42501'; END IF; END $$;
      CREATE TABLE categories(id uuid PRIMARY KEY, user_id uuid, name text, category_type text, is_system boolean);
      CREATE TABLE transactions(id uuid PRIMARY KEY, user_id uuid, description text, type text, category_id uuid REFERENCES categories);
      CREATE TABLE user_learned_patterns(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
        description text NOT NULL, normalized_description text NOT NULL, category text NOT NULL,
        subcategory text, confidence numeric(5,2) NOT NULL DEFAULT 85,
        usage_count integer NOT NULL DEFAULT 1, last_used_at timestamptz DEFAULT now(),
        first_learned_at timestamptz DEFAULT now(), is_active boolean NOT NULL DEFAULT true,
        source_type text NOT NULL DEFAULT 'user_correction', metadata jsonb DEFAULT '{}',
        UNIQUE(user_id, normalized_description));
      ALTER TABLE user_learned_patterns ENABLE ROW LEVEL SECURITY;
      CREATE POLICY own_patterns ON user_learned_patterns TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
      ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
      CREATE POLICY own_transactions ON transactions TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
      ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
      CREATE POLICY accessible_categories ON categories FOR SELECT TO authenticated USING(auth.uid()=user_id OR (is_system AND user_id IS NULL));
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT SELECT,INSERT,UPDATE ON user_learned_patterns TO authenticated;
      GRANT SELECT ON transactions,categories TO authenticated;
      INSERT INTO categories VALUES
        ('10000000-0000-0000-0000-000000000001',NULL,'Alimentação','expense',true),
        ('10000000-0000-0000-0000-000000000002',NULL,'Salário','income',true),
        ('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Privada','expense',false);
      INSERT INTO transactions VALUES
        ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','PIX LOJA','expense','10000000-0000-0000-0000-000000000001'),
        ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','PIX LOJA','income','10000000-0000-0000-0000-000000000002'),
        ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','SEGREDO','expense','10000000-0000-0000-0000-000000000003'),
        ('30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','ERRADO','income','10000000-0000-0000-0000-000000000001');
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20260921164008_classifier_verified_learning.sql', import.meta.url), 'utf8'));
    const learn = id => db.query('SELECT learn_transaction_classification($1::uuid)', [id]);
    const first = '30000000-0000-0000-0000-000000000001';
    await db.exec("SET ROLE authenticated; SET request.user_id = '20000000-0000-0000-0000-000000000001'");
    await learn(first);
    await learn(first);
    let rows = (await db.query('SELECT * FROM user_learned_patterns')).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].usage_count, 1);
    assert.equal(rows[0].metadata.transaction_type, 'expense');
    assert.equal(rows[0].metadata.category_id, '10000000-0000-0000-0000-000000000001');
    await learn('30000000-0000-0000-0000-000000000002');
    assert.equal((await db.query('SELECT * FROM user_learned_patterns')).rows.length, 2);
    for (const id of ['30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000099']) {
      await assert.rejects(learn(id), { code: '42501' });
    }
    await db.exec("SET request.mfa='deny'");
    await assert.rejects(learn(first), { code: '42501' });
    await db.exec("SET request.mfa='allow'; SET request.user_id=''");
    await assert.rejects(learn(first), { code: '42501' });
    await db.exec("SET request.user_id='20000000-0000-0000-0000-000000000002'");
    assert.equal((await db.query('SELECT * FROM user_learned_patterns')).rows.length, 0);
    await learn('30000000-0000-0000-0000-000000000003');
    assert.equal((await db.query('SELECT * FROM user_learned_patterns')).rows.length, 1);
    await db.exec("RESET ROLE; UPDATE categories SET name='Mercado' WHERE name='Alimentação'; SET ROLE authenticated; SET request.user_id='20000000-0000-0000-0000-000000000001'");
    await learn(first);
    rows = (await db.query("SELECT * FROM user_learned_patterns WHERE metadata->>'transaction_type'='expense'")).rows;
    assert.equal(rows[0].category, 'Mercado');
    assert.equal(rows[0].usage_count, 1);
    assert.equal(Number(rows[0].confidence), 90);
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(learn(first), { code: '42501' });
  } finally {
    await db.close();
  }
});
