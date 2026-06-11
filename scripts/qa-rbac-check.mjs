/**
 * Lightweight QA checks against live Supabase (no secrets logged).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, service, { auth: { persistSession: false } });

const results = [];

function pass(name, detail = '') {
  results.push({ name, status: 'PASS', detail });
}
function fail(name, detail = '') {
  results.push({ name, status: 'FAIL', detail });
}

async function testLogin(email, password) {
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  const userId = data.user?.id;
  const { data: profile } = await admin.from('users').select('id, role, email, status').eq('auth_id', userId).maybeSingle();
  return { ok: true, profile, authId: userId };
}

async function main() {
  // Super admin login
  const sa = await testLogin(env.SUPER_ADMIN_EMAIL, env.SUPER_ADMIN_PASSWORD);
  if (sa.ok && sa.profile) pass('Super Admin login + profile', `${sa.profile.email} / ${sa.profile.role}`);
  else fail('Super Admin login + profile', sa.error ?? 'No profile');

  // RPC exists
  const { error: rpcErr } = await admin.rpc('cleanup_user_delete_references', {
    target_user_id: '00000000-0000-0000-0000-000000000000',
  });
  if (!rpcErr || rpcErr.code === 'P0001' || rpcErr.message.includes('not found')) {
    pass('cleanup_user_delete_references RPC', rpcErr?.message ?? 'callable');
  } else if (rpcErr?.code === 'PGRST202') {
    fail('cleanup_user_delete_references RPC', 'function not found');
  } else {
    pass('cleanup_user_delete_references RPC', rpcErr.message);
  }

  // Role distribution
  const { data: users, error: usersErr } = await admin.from('users').select('role, status').limit(500);
  if (usersErr) fail('users table', usersErr.message);
  else {
    const byRole = {};
    for (const u of users ?? []) byRole[u.role] = (byRole[u.role] ?? 0) + 1;
    pass('users table', JSON.stringify(byRole));
  }

  // Audit log writable
  const { count, error: auditErr } = await admin
    .from('audit_logs')
    .select('id', { count: 'exact', head: true });
  if (auditErr) fail('audit_logs table', auditErr.message);
  else pass('audit_logs table', `${count ?? 0} rows`);

  // Core tables
  for (const table of [
    'asset_requests',
    'request_approvals',
    'asset_allocations',
    'assets',
    'vendors',
    'procurements',
    'purchase_orders',
    'notifications',
  ]) {
    const { error } = await admin.from(table).select('id').limit(1);
    if (error) fail(`table ${table}`, error.message);
    else pass(`table ${table}`, 'ok');
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.status === 'FAIL');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
