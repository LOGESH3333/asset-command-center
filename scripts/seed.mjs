import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* .env.local optional if vars already set */
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CATEGORIES = [
  'Laptops', 'Monitors', 'Mobile Devices', 'Networking', 'Peripherals',
  'Furniture', 'Software Licenses', 'Servers', 'AV Equipment', 'Security Hardware',
];

const VENDORS = [
  { name: 'Apple Inc.', contact_email: 'enterprise@apple.com', contact_phone: '+1-800-275-2273' },
  { name: 'Dell Technologies', contact_email: 'b2b@dell.com', contact_phone: '+1-800-999-3355' },
  { name: 'Lenovo', contact_email: 'support@lenovo.com', contact_phone: '+1-855-253-6686' },
  { name: 'HP Enterprise', contact_email: 'sales@hpe.com', contact_phone: '+1-888-999-4747' },
  { name: 'Cisco Systems', contact_email: 'orders@cisco.com', contact_phone: '+1-800-553-6387' },
  { name: 'Microsoft', contact_email: 'volume@microsoft.com', contact_phone: '+1-800-642-7676' },
  { name: 'Amazon Business', contact_email: 'ab@amazon.com', contact_phone: '+1-888-281-3847' },
  { name: 'CDW Corporation', contact_email: 'sales@cdw.com', contact_phone: '+1-800-800-4239' },
  { name: 'Insight Enterprises', contact_email: 'info@insight.com', contact_phone: '+1-800-467-4448' },
  { name: 'Samsung Business', contact_email: 'b2b@samsung.com', contact_phone: '+1-800-726-7864' },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

function pick(arr, i) {
  return arr[i % arr.length];
}

async function main() {
  console.log('Clearing existing data...');
  await supabase.from('maintenance_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('asset_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('assets').delete().neq('asset_tag', '__none__');
  await supabase.from('vendors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('asset_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { data: categories, error: catErr } = await supabase
    .from('asset_categories')
    .insert(CATEGORIES.map((name) => ({ name })))
    .select('id');
  if (catErr) throw catErr;

  const { data: vendors, error: vendErr } = await supabase.from('vendors').insert(VENDORS).select('id');
  if (vendErr) throw vendErr;

  const { data: users } = await supabase.from('users').select('id').limit(20);
  const userIds = users?.map((u) => u.id) ?? [];

  const statuses = ['Available', 'Allocated', 'Under Maintenance', 'Retired'];
  const names = ['MacBook Pro', 'Dell Latitude', 'ThinkPad X1', 'UltraWide Monitor', 'iPhone 15', 'Cisco Switch'];

  const assets = Array.from({ length: 50 }, (_, i) => ({
    asset_tag: `AST-${String(1001 + i).padStart(4, '0')}`,
    name: `${pick(names, i)} #${i + 1}`,
    category_id: pick(categories, i).id,
    vendor_id: pick(vendors, i).id,
    assigned_employee_id: pick(statuses, i) === 'Allocated' && userIds.length ? pick(userIds, i) : null,
    cost: 800 + (i * 137) % 4200,
    purchase_date: daysAgo(30 + (i * 7) % 700),
    warranty_expiry: daysAgo(-(90 + (i * 13) % 730)),
    status: pick(statuses, i),
    created_at: monthsAgo(6 - (i % 6)),
  }));

  const assetsForInsert = assets.map((asset) =>
    asset.status === 'Allocated'
      ? { ...asset, status: 'Available', assigned_employee_id: null }
      : asset
  );

  const { data: insertedAssets, error: assetErr } = await supabase
    .from('assets')
    .insert(assetsForInsert)
    .select('id, asset_tag');
  if (assetErr) throw assetErr;

  for (const asset of insertedAssets ?? []) {
    const source = assets.find((row) => row.asset_tag === asset.asset_tag);
    if (source?.status !== 'Allocated' || !source.assigned_employee_id) continue;

    const { error } = await supabase.rpc('create_asset_allocation_transaction', {
      p_asset_id: asset.id,
      p_user_id: source.assigned_employee_id,
      p_notes: `Initial allocation for ${asset.asset_tag}`,
    });
    if (error) throw error;
  }

  const requests = Array.from({ length: 20 }, (_, i) => ({
    title: `Asset Request #${i + 1} — ${pick(names, i)}`,
    description: 'Required for departmental operations.',
    status: pick(['Pending', 'Approved', 'Rejected', 'Fulfilled'], i),
    priority: pick(['Low', 'Medium', 'High'], i),
    employee_id: userIds.length ? pick(userIds, i) : null,
    created_at: monthsAgo(5 - (i % 5)),
  }));
  const { error: reqErr } = await supabase.from('asset_requests').insert(requests);
  if (reqErr) throw reqErr;

  const maintenance = Array.from({ length: 15 }, (_, i) => ({
    asset_id: pick(insertedAssets, i).id,
    type: i % 3 === 0 ? 'Corrective' : 'Preventive',
    description: `Maintenance task ${i + 1}: inspection and service`,
    cost: 50 + i * 87,
    vendor_id: pick(vendors, i).id,
    scheduled_date: daysAgo(20 - i),
    completed_date: i < 10 ? daysAgo(10 - i) : null,
    performed_by: pick(['IT Ops', 'Dell ProSupport', 'Internal Team'], i),
  }));
  const { error: maintErr } = await supabase.from('maintenance_records').insert(maintenance);
  if (maintErr) throw maintErr;

  const notifications = [
    { title: 'Warranty expiring soon', message: '12 assets expiring within 90 days.', read: false },
    { title: 'Pending approvals', message: '8 requests awaiting approval.', read: false },
    { title: 'Maintenance scheduled', message: 'Preventive window Monday 09:00.', read: true },
    { title: 'Allocation complete', message: 'MacBook Pro AST-1003 assigned to Engineering.', read: false },
    { title: 'Budget threshold', message: 'Hardware spend at 78% of quarterly allocation.', read: false },
  ];
  const { error: notifErr } = await supabase.from('notifications').insert(notifications);
  if (notifErr) throw notifErr;

  console.log('Seed complete:', {
    categories: categories.length,
    vendors: vendors.length,
    assets: insertedAssets.length,
    requests: 20,
    maintenance: 15,
    notifications: notifications.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
