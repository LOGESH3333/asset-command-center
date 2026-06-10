/**
 * Smoke-test audited INSERT paths after write_audit_log() repair.
 * Run: node scripts/verify-audit-triggers.mjs
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(resolve(root, '.env.local'), 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ts = Date.now();
const results = [];

async function test(name, insertFn, cleanupFn) {
  try {
    const row = await insertFn();
    await cleanupFn(row);
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, error: err.message ?? String(err) });
  }
}

await test(
  'inventory',
  async () => {
    const { data, error } = await sb
      .from('inventory')
      .insert([{ name: `__audit_${ts}`, quantity_on_hand: 1, sku: `AUD-${ts}` }])
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
  async (row) => {
    await sb.from('inventory').delete().eq('id', row.id);
  }
);

await test(
  'asset_categories',
  async () => {
    const { data, error } = await sb
      .from('asset_categories')
      .insert([{ name: `__audit_cat_${ts}` }])
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
  async (row) => {
    await sb.from('asset_categories').delete().eq('id', row.id);
  }
);

await test(
  'vendors',
  async () => {
    const { data, error } = await sb
      .from('vendors')
      .insert([{ name: `__audit_vendor_${ts}` }])
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
  async (row) => {
    await sb.from('vendors').delete().eq('id', row.id);
  }
);

await test(
  'assets',
  async () => {
    const { data, error } = await sb
      .from('assets')
      .insert([
        {
          asset_tag: `AUD-${ts}`,
          name: `Audit Test Asset ${ts}`,
          status: 'Available',
        },
      ])
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

await test(
  'asset_requests',
  async () => {
    const { data, error } = await sb
      .from('asset_requests')
      .insert([
        {
          justification: `__audit_${ts} — smoke test request`,
          status: 'Pending Manager',
          priority: 'Low',
          requester_id: user?.id ?? null,
        },
      ])
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
  async (row) => {
    await sb.from('asset_requests').delete().eq('id', row.id);
  }
);

const { data: req } = await sb.from('asset_requests').select('id').limit(1).maybeSingle();

if (req?.id) {
  await test(
    'request_approvals',
    async () => {
      const { data, error } = await sb
        .from('request_approvals')
        .insert([
          {
            request_id: req.id,
            approval_stage: 'Manager',
            status: 'Pending',
            comments: `__audit_${ts}`,
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
  results.push({ name: 'request_approvals', ok: false, error: 'Skipped — no asset_requests row' });
}

const { data: availAsset } = await sb
  .from('assets')
  .select('id')
  .not('id', 'is', null)
  .limit(1)
  .maybeSingle();

if (availAsset?.id && user?.id) {
  await test(
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
  results.push({
    name: 'asset_allocations',
    ok: false,
    error: 'Skipped — need at least one available asset and one user',
  });
}

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
process.exit(failed.length ? 1 : 0);
