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
const { data: inv, error: invErr } = await sb
  .from('inventory')
  .insert([{ name: `__uuid_check_${ts}`, quantity_on_hand: 1, sku: `UUID-${ts}` }])
  .select('id')
  .single();

if (invErr) {
  console.log(JSON.stringify({ ok: false, insert_error: invErr.message }));
  process.exit(1);
}

const { data: logs } = await sb
  .from('audit_logs')
  .select('id, action, table_name, record_id, old_data, new_data, created_at')
  .eq('table_name', 'inventory')
  .order('created_at', { ascending: false })
  .limit(3);

await sb.from('inventory').delete().eq('id', inv.id);

const latest = logs?.[0];
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const recordIdOk = latest?.record_id === inv.id && uuidRe.test(latest.record_id ?? '');

console.log(
  JSON.stringify(
    {
      ok: recordIdOk,
      inserted_inventory_id: inv.id,
      latest_audit_log: latest,
      record_id_matches_row_uuid: recordIdOk,
      has_old_new_data: latest ? 'old_data' in latest && 'new_data' in latest : false,
    },
    null,
    2
  )
);

process.exit(recordIdOk ? 0 : 1);
