/**
 * Live Supabase schema probe — compares expected app columns vs PostgREST.
 * Run: node scripts/validate-schema.mjs
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env.local'), 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return env;
  } catch {
    return {};
  }
}

const EXPECTED = {
  assets: [
    'id', 'asset_tag', 'name', 'category_id', 'vendor_id', 'assigned_employee_id',
    'cost', 'purchase_date', 'warranty_expiry', 'status', 'notes', 'created_at', 'updated_at',
  ],
  asset_categories: ['id', 'name', 'created_at', 'updated_at'],
  vendors: [
    'id', 'name', 'contact_person', 'email', 'phone', 'address',
    'contact_email', 'contact_phone', 'created_at', 'updated_at',
  ],
  asset_requests: [
    'id', 'justification', 'requester_id', 'category_id', 'status', 'priority',
    'manager_id', 'procurement_id', 'finance_id',
    'manager_approval_date', 'procurement_approval_date', 'finance_approval_date',
    'rejection_reason', 'created_at', 'updated_at',
  ],
  asset_allocations: [
    'id', 'asset_id', 'user_id', 'allocated_at', 'returned_at', 'status',
    'acknowledged_at', 'acknowledged_by', 'notes', 'created_at', 'updated_at',
  ],
  maintenance_records: [
    'id', 'asset_id', 'type', 'description', 'cost', 'vendor_id',
    'scheduled_date', 'completed_date', 'performed_by', 'notes', 'created_at', 'updated_at',
  ],
  inventory: [
    'id', 'name', 'sku', 'category_id', 'vendor_id', 'quantity_on_hand',
    'reorder_level', 'unit_cost', 'location', 'notes', 'created_at', 'updated_at',
  ],
  procurements: [
    'id', 'request_id', 'title', 'description', 'status', 'priority', 'requester_id',
    'vendor_id', 'estimated_cost', 'notes', 'created_at', 'updated_at',
  ],
  purchase_orders: [
    'id', 'procurement_id', 'po_number', 'vendor_id', 'total_amount', 'status',
    'order_date', 'expected_delivery', 'notes', 'created_at', 'updated_at',
  ],
  audit_logs: [
    'id', 'user_id', 'action', 'table_name', 'record_id', 'old_data', 'new_data', 'created_at',
  ],
  notifications: ['id', 'user_id', 'title', 'message', 'read', 'created_at'],
  users: [
    'id', 'auth_id', 'email', 'first_name', 'last_name', 'department', 'role',
    'created_at', 'updated_at',
  ],
};

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log(JSON.stringify({ error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local' }));
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function probeTable(table, columns) {
  const select = columns.join(',');
  const { error } = await supabase.from(table).select(select).limit(0);
  if (!error) return { table, status: 'PASS', missing: [] };

  const msg = error.message || '';
  if (msg.includes('does not exist') && msg.includes('relation')) {
    return { table, status: 'FAIL', missing: ['TABLE'], error: msg };
  }
  const colMatch = msg.match(/column[s]? ([\w.,\s]+) does not exist/i)
    || msg.match(/Could not find the '([^']+)' column/i);
  if (colMatch) {
    const missing = colMatch[1].split(',').map((c) => c.trim().replace(/'/g, ''));
    return { table, status: 'FAIL', missing, error: msg };
  }
  return { table, status: 'WARNING', missing: [], error: msg };
}

async function probeFkJoin(table, select) {
  const { error } = await supabase.from(table).select(select).limit(0);
  return { table, select, ok: !error, error: error?.message };
}

const results = [];
for (const [table, cols] of Object.entries(EXPECTED)) {
  results.push(await probeTable(table, cols));
}

const fkProbes = [
  { table: 'assets', select: 'vendor_id, vendors(name)' },
  { table: 'assets', select: 'category_id, asset_categories(name)' },
  { table: 'asset_allocations', select: 'asset_id, assets(id, name, asset_tag), users:user_id(id, first_name, last_name)' },
  { table: 'maintenance_records', select: 'asset_id, assets(id, name)' },
  { table: 'inventory', select: 'category_id, asset_categories(id, name), vendor_id, vendors(id, name)' },
  { table: 'procurements', select: 'vendor_id, vendors(id, name), request_id, asset_requests(id, justification)' },
  { table: 'purchase_orders', select: 'vendor_id, vendors(id, name), procurement_id, procurements(id, title)' },
  { table: 'request_approvals', select: 'request_id, asset_requests(id, justification, status), approver_id, users(id, first_name, last_name)' },
];

const fkResults = [];
for (const p of fkProbes) {
  fkResults.push(await probeFkJoin(p.table, p.select));
}

// Probe audit trigger via test insert into inventory (rollback not possible — skip destructive)
console.log(JSON.stringify({ columns: results, fkJoins: fkResults }, null, 2));
