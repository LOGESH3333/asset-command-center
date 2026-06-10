/**
 * Inspect live write_audit_log() definition and test inventory insert audit path.
 * Run: node scripts/inspect-audit-function.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = readFileSync(resolve(root, file), 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    } catch {
      /* ignore */
    }
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = env.SUPABASE_DB_PASSWORD;

if (!ref || !password) {
  console.log(
    JSON.stringify({
      error: 'Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local',
    })
  );
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

const fnRes = await client.query(`
  SELECT pg_get_functiondef(oid) AS def
  FROM pg_proc
  WHERE proname = 'write_audit_log'
    AND pronamespace = 'public'::regnamespace
`);

const def = fnRes.rows[0]?.def ?? null;
const usesDetails = def ? /\bdetails\b/i.test(def) : null;
const usesOldNew = def ? /\bold_data\b/.test(def) && /\bnew_data\b/.test(def) : null;

const triggers = await client.query(`
  SELECT tgname, relname AS table_name
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND t.tgname LIKE 'audit_%'
  ORDER BY relname
`);

let smokeTest = null;
if (!usesDetails) {
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO public.inventory (name, quantity_on_hand) VALUES ('__audit_smoke_test__', 1)`
    );
    await client.query(`DELETE FROM public.inventory WHERE name = '__audit_smoke_test__'`);
    await client.query('ROLLBACK');
    smokeTest = { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    smokeTest = { ok: false, error: err.message };
  }
}

await client.end();

console.log(
  JSON.stringify(
    {
      usesDetails,
      usesOldNew,
      functionDefinition: def,
      auditTriggers: triggers.rows,
      inventoryInsertSmokeTest: smokeTest,
    },
    null,
    2
  )
);
