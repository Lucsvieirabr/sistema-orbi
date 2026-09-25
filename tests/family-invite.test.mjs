import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Runs the real opt-in migration on PostgreSQL. The fixture mirrors only what
// the migration touches: auth.users, the Plano Casal tables and the plan helpers
// (plan lookup stubbed by a table).
const OWNER = '00000000-0000-0000-0000-00000000000a';
const PARTNER = '00000000-0000-0000-0000-00000000000b';
const STRANGER = '00000000-0000-0000-0000-00000000000c';
const OWNER2 = '00000000-0000-0000-0000-00000000000d';
const UNCONFIRMED = '00000000-0000-0000-0000-00000000000e';

test('family invite: pending until explicit accept, token bound to the invited account', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.user_id', true), '')::uuid $$;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb DEFAULT '{}');
      CREATE TABLE user_profiles(user_id uuid, display_name text, full_name text, avatar_path text);
      CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, action text NOT NULL,
        entity_type text NOT NULL, entity_id uuid, metadata jsonb, new_data jsonb);
      CREATE TABLE plans(user_id uuid PRIMARY KEY, features jsonb, limits jsonb);

      CREATE TABLE family_groups(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id));
      CREATE TABLE family_group_members(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        family_group_id uuid NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
        email text NOT NULL,
        user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT family_group_members_email_unique UNIQUE (family_group_id, email));
      ALTER TABLE family_group_members ENABLE ROW LEVEL SECURITY;
      ALTER TABLE family_group_members FORCE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT SELECT, INSERT, DELETE ON family_group_members, family_groups TO authenticated;

      CREATE FUNCTION orbi_own_active_plan(p uuid) RETURNS jsonb LANGUAGE sql STABLE AS
        $$ SELECT jsonb_build_object('features', features, 'limits', limits) FROM plans WHERE user_id = p $$;
      CREATE FUNCTION orbi_owner_shares_family(p uuid) RETURNS boolean LANGUAGE sql STABLE AS
        $$ SELECT COALESCE(orbi_own_active_plan(p) -> 'features' ->> 'familia_compartilhada', 'false') = 'true' $$;
      CREATE FUNCTION orbi_quota_lock(p uuid, r text) RETURNS void LANGUAGE sql AS
        $$ SELECT pg_advisory_xact_lock(hashtext('orbi:quota:' || r), hashtext(p::text)) $$;
      CREATE FUNCTION orbi_quota_max(l jsonb, k text, d integer) RETURNS integer LANGUAGE sql IMMUTABLE AS
        $$ SELECT COALESCE(NULLIF(l ->> k, '')::integer, d) $$;
      CREATE FUNCTION orbi_quota_reject(l text, m integer) RETURNS void LANGUAGE plpgsql AS
        $$ BEGIN RAISE EXCEPTION 'Limite de % atingido.', l USING ERRCODE = 'P0005', HINT = 'plan_quota_exceeded'; END $$;
      CREATE FUNCTION orbi_no_subscription(l text) RETURNS void LANGUAGE plpgsql AS
        $$ BEGIN RAISE EXCEPTION 'Sem assinatura para %.', l USING ERRCODE = 'P0004'; END $$;
      CREATE FUNCTION orbi_my_family_group_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
        SELECT gid FROM (SELECT id AS gid, created_at FROM family_groups WHERE owner_id = auth.uid()
          UNION ALL SELECT family_group_id, created_at FROM family_group_members WHERE user_id = auth.uid()) s
        ORDER BY created_at LIMIT 1 $$;
      CREATE FUNCTION check_family_members_limit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
      CREATE TRIGGER trg_check_family_members_limit BEFORE INSERT ON family_group_members
        FOR EACH ROW EXECUTE FUNCTION check_family_members_limit();
      CREATE FUNCTION orbi_claim_family_invites() RETURNS void LANGUAGE sql AS $$ SELECT $$;
      CREATE FUNCTION orbi_family_user_ids() RETURNS uuid[] LANGUAGE sql STABLE AS $$ SELECT ARRAY[auth.uid()] $$;
      GRANT EXECUTE ON FUNCTION orbi_family_user_ids() TO authenticated;

      INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data) VALUES
        ('${OWNER}', 'owner@orbi.test', now(), '{"full_name":"Lucas Vieira"}'),
        ('${PARTNER}', 'ana@orbi.test', now(), '{"full_name":"Ana Souza"}'),
        ('${STRANGER}', 'intruso@orbi.test', now(), '{}'),
        ('${OWNER2}', 'bia@orbi.test', now(), '{}'),
        ('${UNCONFIRMED}', 'novo@orbi.test', NULL, '{}');
      INSERT INTO user_profiles VALUES ('${OWNER}', 'Lucas', 'Lucas Vieira', '${OWNER}/0123456789abcdef0123456789abcdef.webp');
      INSERT INTO plans VALUES
        ('${OWNER}', '{"familia_compartilhada": true}', '{"max_membros_familia": 1}'),
        ('${OWNER2}', '{"familia_compartilhada": true}', '{"max_membros_familia": 1}'),
        ('${STRANGER}', '{"familia_compartilhada": false}', '{}');
      INSERT INTO family_groups(owner_id) VALUES ('${OWNER}'), ('${OWNER2}'), ('${STRANGER}');
    `);
    for (const file of [
      '20260925180000_family_invite_opt_in.sql',
      '20260925200000_invite_preview_avatar.sql',
      '20260925220000_family_member_leave.sql',
    ]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    const ownerAvatar = `${OWNER}/0123456789abcdef0123456789abcdef.webp`;
    const canRead = async (path) => (await db.query('SELECT public.orbi_can_read_avatar($1) AS ok', [path])).rows[0].ok;

    const as = (uid) => db.exec(`RESET ROLE; SET ROLE authenticated; SET request.user_id = '${uid}'`);
    const rpc = async (fn, arg) => (await db.query(`SELECT public.${fn}($1) AS r`, [arg])).rows[0].r;
    const member = async (email) => {
      await db.exec('RESET ROLE');
      return (await db.query('SELECT * FROM family_group_members WHERE email = $1', [email])).rows[0];
    };

    // Issue: pending, only the hash stored, normalized e-mail.
    await as(OWNER);
    const issued = await rpc('orbi_family_invite_issue', '  Ana@Orbi.test ');
    assert.match(issued.token, /^[0-9a-f]{64}$/);
    assert.equal(issued.status, 'pending');
    assert.equal(issued.inviter_name, 'Lucas');
    let row = await member('ana@orbi.test');
    assert.equal(row.status, 'pending');
    assert.equal(row.user_id, null);
    assert.equal(row.invite_token_hash, createHash('sha256').update(issued.token).digest('hex'));

    // Client never reads the hash nor writes the table directly.
    await as(OWNER);
    await assert.rejects(db.query('SELECT invite_token_hash FROM family_group_members'), { code: '42501' });
    assert.equal((await db.query('SELECT id, status FROM family_group_members')).rows.length, 1);
    await assert.rejects(
      db.query(`INSERT INTO family_group_members(family_group_id, email) SELECT id, 'x@y.z' FROM family_groups WHERE owner_id = '${OWNER}'`),
      { code: '42501' },
    );

    // Second person in the group, invalid e-mail, plan without Casal.
    await assert.rejects(rpc('orbi_family_invite_issue', 'outra@orbi.test'), { code: 'P0005' });
    await assert.rejects(rpc('orbi_family_invite_issue', 'sem-arroba'), { code: '22023' });
    await as(STRANGER);
    await assert.rejects(rpc('orbi_family_invite_issue', 'ana@orbi.test'), { code: 'P0005' });

    // Pending invite opens the inviter's photo only to the invited account.
    assert.equal(await canRead(ownerAvatar), false);
    await as(PARTNER);
    assert.equal(await canRead(ownerAvatar), true);
    await as(STRANGER);

    // Someone else holding the link: masked e-mail, no inviter name, no link.
    const preview = await rpc('orbi_family_invite_preview', issued.token);
    assert.deepEqual(preview, { status: 'email_mismatch', invited_email: 'a•••@orbi.test' });
    assert.equal((await rpc('orbi_family_invite_accept', issued.token)).status, 'email_mismatch');
    assert.equal((await member('ana@orbi.test')).status, 'pending');

    await as(OWNER);
    assert.equal((await rpc('orbi_family_invite_preview', issued.token)).status, 'self');
    await as(PARTNER);
    assert.equal((await rpc('orbi_family_invite_preview', 'nao-e-token')).status, 'invalid');

    // Invited account: ready → accept → active.
    const ready = await rpc('orbi_family_invite_preview', issued.token);
    assert.equal(ready.status, 'ready');
    assert.equal(ready.inviter_name, 'Lucas');
    assert.equal(ready.inviter_avatar_path, ownerAvatar);
    assert.equal(ready.member_id, undefined);
    assert.equal(ready.owner_id, undefined);
    assert.equal((await rpc('orbi_family_invite_accept', issued.token)).status, 'accepted');
    row = await member('ana@orbi.test');
    assert.equal(row.status, 'active');
    assert.equal(row.user_id, PARTNER);
    assert.ok(row.accepted_at);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_logs WHERE action = 'family_invite_accepted'")).rows[0].n, 1);

    await as(PARTNER);
    assert.equal((await rpc('orbi_family_invite_preview', issued.token)).status, 'accepted');
    await as(OWNER);
    await assert.rejects(rpc('orbi_family_invite_issue', 'ana@orbi.test'), { code: '23505' });

    // Already in a group: a second invite cannot take the partner away.
    await as(OWNER2);
    const other = await rpc('orbi_family_invite_issue', 'ana@orbi.test');
    await as(PARTNER);
    assert.equal((await rpc('orbi_family_invite_accept', other.token)).status, 'already_linked');

    // Client picks neither id nor created_at of a group (would reorder "oldest group").
    await assert.rejects(
      db.query(`INSERT INTO family_groups(owner_id, created_at) VALUES ('${PARTNER}', '2000-01-01')`),
      { code: '42501' },
    );

    // Partner can leave on their own; the link is gone and they are free to accept another invite.
    await db.query(`DELETE FROM family_group_members WHERE user_id = '${PARTNER}' AND status = 'active'`);
    await db.exec('RESET ROLE');
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM family_group_members WHERE user_id = '${PARTNER}'`)).rows[0].n, 0);
    await as(PARTNER);
    assert.equal((await rpc('orbi_family_invite_preview', other.token)).status, 'ready');

    // Unconfirmed e-mail, expiry, rotation and owner downgrade.
    await db.exec(`RESET ROLE; DELETE FROM family_group_members WHERE email = 'ana@orbi.test' AND user_id IS NULL`);
    await as(OWNER2);
    const first = await rpc('orbi_family_invite_issue', 'novo@orbi.test');
    await as(UNCONFIRMED);
    assert.equal((await rpc('orbi_family_invite_preview', first.token)).status, 'email_unconfirmed');
    await db.exec(`RESET ROLE; UPDATE auth.users SET email_confirmed_at = now() WHERE id = '${UNCONFIRMED}'`);
    await db.exec(`UPDATE family_group_members SET invite_expires_at = now() - interval '1 minute' WHERE email = 'novo@orbi.test'`);
    await as(UNCONFIRMED);
    assert.equal((await rpc('orbi_family_invite_preview', first.token)).status, 'expired');
    assert.equal(await canRead(`${OWNER2}/0123456789abcdef0123456789abcdef.webp`), false);
    await as(OWNER2);
    const second = await rpc('orbi_family_invite_issue', 'novo@orbi.test');
    assert.notEqual(second.token, first.token);
    await as(UNCONFIRMED);
    assert.equal((await rpc('orbi_family_invite_preview', first.token)).status, 'invalid');
    await db.exec(`RESET ROLE; UPDATE plans SET features = '{}' WHERE user_id = '${OWNER2}'`);
    await as(UNCONFIRMED);
    assert.equal((await rpc('orbi_family_invite_accept', second.token)).status, 'owner_inactive');
    assert.equal((await member('novo@orbi.test')).status, 'pending');

    // Deleted account takes its link with it (no active row without user_id).
    await db.exec(`RESET ROLE; DELETE FROM auth.users WHERE id = '${PARTNER}'`);
    assert.equal(await member('ana@orbi.test'), undefined);

    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(rpc('orbi_family_invite_preview', issued.token), { code: '42501' });
  } finally {
    await db.close();
  }
});
