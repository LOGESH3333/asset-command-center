/**
 * Apply demo-critical pending migrations to live Supabase.
 * Requires SUPABASE_DB_PASSWORD in .env.local
 * Run: node scripts/apply-demo-rls.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = [
  '020_approval_queue_rls.sql',
  '021_comprehensive_module_rls.sql',
  '022_assets_request_id.sql',
  '023_assets_schema_sync.sql',
  '024_allocation_consistency_transaction.sql',
  '025_allocation_allocated_by_fix.sql',
];

const raw = readFileSync(resolve(root, '.env.local'), 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = env.SUPABASE_DB_PASSWORD;

if (!ref || !password) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local');
  process.exit(1);
}

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
for (const file of migrations) {
  const sql = readFileSync(resolve(root, 'supabase/migrations', file), 'utf8');
  console.log(`Applying ${file}...`);
  await client.query(sql);
  console.log(`OK: ${file}`);
}
await client.end();
console.log('Pending demo migrations applied. Restart npm run dev and refresh the dashboard.');
