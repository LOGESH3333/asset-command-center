/**
 * Redeploy write_audit_log() on live Supabase (fixes audit_logs.details error).
 * Requires SUPABASE_DB_PASSWORD in .env.local
 * Run: node scripts/apply-audit-trigger-fix.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sql = readFileSync(resolve(root, 'supabase/migrations/010_audit_logs_record_id_uuid.sql'), 'utf8')
  .replace(/^--.*$/gm, '')
  .trim();

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
await client.query(sql);
await client.end();
console.log('write_audit_log() redeployed. Run: node scripts/test-inventory-insert.mjs');
