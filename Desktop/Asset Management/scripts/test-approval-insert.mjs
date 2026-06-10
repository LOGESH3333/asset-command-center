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

const { data: req } = await sb.from('asset_requests').select('id').limit(1).maybeSingle();
if (!req?.id) {
  console.log('SKIP: no asset_requests row');
  process.exit(0);
}

const { data, error } = await sb
  .from('request_approvals')
  .insert([
    {
      request_id: req.id,
      approval_stage: 'Manager',
      status: 'Pending',
      comments: '__audit_smoke_test__',
    },
  ])
  .select('id')
  .single();

if (error) {
  console.log('INSERT FAILED:', error.message);
  process.exit(1);
}

console.log('INSERT OK:', data?.id);
await sb.from('request_approvals').delete().eq('id', data.id);
