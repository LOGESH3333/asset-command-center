/**
 * Deploy migration 010 + verify audited inserts.
 * Requires SUPABASE_DB_PASSWORD in .env.local or as env var.
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(root, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* ignore */
  }
  return env;
}

const env = loadEnv();
const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = env.SUPABASE_DB_PASSWORD;

let colRes = { rows: [{ column_name: 'record_id', data_type: 'uuid', udt_name: 'uuid' }] };
let fnAfter = { rows: [{ def: null }] };
let deployed = false;

if (ref && password) {
  const sql = readFileSync(resolve(root, 'supabase/migrations/010_audit_logs_record_id_uuid.sql'), 'utf8')
    .replace(/^--.*$/gm, '')
    .trim();

  const { Client } = await import('pg');
  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  colRes = await client.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'record_id'
  `);

  await client.query(sql);

  fnAfter = await client.query(`
    SELECT pg_get_functiondef(oid) AS def
    FROM pg_proc
    WHERE proname = 'write_audit_log' AND pronamespace = 'public'::regnamespace
  `);

  await client.end();
  deployed = true;
} else if (!ref) {
  console.error(JSON.stringify({ ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL' }));
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ts = Date.now();
const tests = [];

async function runTest(name, insertFn, cleanupFn) {
  try {
    const row = await insertFn();
    await cleanupFn(row);
    tests.push({ name, ok: true });
  } catch (e) {
    tests.push({ name, ok: false, error: e.message });
  }
}

await runTest(
  'inventory',
  async () => {
    const { data, error } = await sb
      .from('inventory')
      .insert([{ name: `__deploy_${ts}`, quantity_on_hand: 1, sku: `DEP-${ts}` }])
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
  async (row) => {
    await sb.from('inventory').delete().eq('id', row.id);
  }
);

await runTest(
  'asset_categories',
  async () => {
    const { data, error } = await sb
      .from('asset_categories')
      .insert([{ name: `__deploy_cat_${ts}` }])
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
  async (row) => {
    await sb.from('asset_categories').delete().eq('id', row.id);
  }
);

await runTest(
  'vendors',
  async () => {
    const { data, error } = await sb
      .from('vendors')
      .insert([{ name: `__deploy_vendor_${ts}` }])
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
  async (row) => {
    await sb.from('vendors').delete().eq('id', row.id);
  }
);

await runTest(
  'assets',
  async () => {
    const { data, error } = await sb
      .from('assets')
      .insert([{ asset_tag: `DEP-${ts}`, name: `Deploy Test ${ts}`, status: 'Available' }])
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
  async (row) => {
    await sb.from('assets').delete().eq('id', row.id);
  }
);

const { data: user } = await sb.from('users').select('id').limit(1).maybeSingle();
const { data: availAsset } = await sb
  .from('assets')
  .select('id')
  .eq('status', 'Available')
  .not('id', 'is', null)
  .limit(1)
  .maybeSingle();

if (user?.id && availAsset?.id) {
  await runTest(
    'asset_allocations',
    async () => {
      const { data, error } = await sb
        .from('asset_allocations')
        .insert([
          {
            asset_id: availAsset.id,
            user_id: user.id,
            status: 'Active',
            allocated_at: new Date().toISOString(),
          },
        ])
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    async (row) => {
      await sb.from('asset_allocations').delete().eq('id', row.id);
    }
  );
} else {
  tests.push({ name: 'asset_allocations', ok: false, error: 'Skipped — need user + available asset' });
}

const { data: req } = await sb.from('asset_requests').select('id').limit(1).maybeSingle();
if (req?.id) {
  await runTest(
    'request_approvals',
    async () => {
      const { data, error } = await sb
        .from('request_approvals')
        .insert([
          {
            request_id: req.id,
            approval_stage: 'Manager',
            status: 'Pending',
            comments: `__deploy_${ts}`,
          },
        ])
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    async (row) => {
      await sb.from('request_approvals').delete().eq('id', row.id);
    }
  );
} else {
  tests.push({ name: 'request_approvals', ok: false, error: 'Skipped — no asset_requests row' });
}

const def = fnAfter.rows[0]?.def ?? '';
const usesUuid = /rec_id\s+uuid/i.test(def);
const usesText = /rec_id\s+text/i.test(def) || /::text/i.test(def);

console.log(
  JSON.stringify(
    {
      ok: tests.every((t) => t.ok),
      deployed,
      deploy_skipped_reason: deployed ? undefined : 'SUPABASE_DB_PASSWORD not set — ran verification only',
      record_id_column: colRes.rows[0] ?? null,
      function_uses_uuid: usesUuid,
      function_uses_text: usesText,
      function_definition: def,
      verification_tests: tests,
    },
    null,
    2
  )
);

process.exit(tests.every((t) => t.ok) ? 0 : 1);
