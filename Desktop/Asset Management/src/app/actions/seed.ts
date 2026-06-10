'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertAssetRequestRows } from '@/lib/supabase/asset-request-insert';
import { insertVendorRow } from '@/lib/supabase/vendor-db';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { canManageUsers } from '@/lib/auth/roles';
import { REQUEST_STATUS_OPTIONS } from '@/lib/constants/request-status';

const CATEGORIES = [
  'Laptops', 'Monitors', 'Mobile Devices', 'Networking', 'Peripherals',
  'Furniture', 'Software Licenses', 'Servers', 'AV Equipment', 'Security Hardware',
];

const VENDORS = [
  { name: 'Apple Inc.', contact_person: 'Enterprise Sales', email: 'enterprise@apple.com', phone: '+1-800-275-2273', address: 'Cupertino, CA' },
  { name: 'Dell Technologies', contact_person: 'B2B Support', email: 'b2b@dell.com', phone: '+1-800-999-3355', address: 'Round Rock, TX' },
  { name: 'Lenovo', contact_person: 'Account Team', email: 'support@lenovo.com', phone: '+1-855-253-6686', address: 'Morrisville, NC' },
  { name: 'HP Enterprise', contact_person: 'Sales Desk', email: 'sales@hpe.com', phone: '+1-888-999-4747', address: 'Houston, TX' },
  { name: 'Cisco Systems', contact_person: 'Orders Team', email: 'orders@cisco.com', phone: '+1-800-553-6387', address: 'San Jose, CA' },
  { name: 'Microsoft', contact_person: 'Volume Licensing', email: 'volume@microsoft.com', phone: '+1-800-642-7676', address: 'Redmond, WA' },
  { name: 'Amazon Business', contact_person: 'Business Accounts', email: 'ab@amazon.com', phone: '+1-888-281-3847', address: 'Seattle, WA' },
  { name: 'CDW Corporation', contact_person: 'Sales', email: 'sales@cdw.com', phone: '+1-800-800-4239', address: 'Vernon Hills, IL' },
  { name: 'Insight Enterprises', contact_person: 'Info Desk', email: 'info@insight.com', phone: '+1-800-467-4448', address: 'Chandler, AZ' },
  { name: 'Samsung Business', contact_person: 'B2B Team', email: 'b2b@samsung.com', phone: '+1-800-726-7864', address: 'Ridgefield Park, NJ' },
];

const DEMO_USERS = [
  { email: 'admin@demo.com', first_name: 'Demo', last_name: 'Admin', department: 'IT', role: 'Admin' },
  { email: 'manager@demo.com', first_name: 'Sarah', last_name: 'Chen', department: 'Operations', role: 'Manager' },
  { email: 'manager2@demo.com', first_name: 'James', last_name: 'Rivera', department: 'Finance', role: 'Manager' },
  { email: 'emp1@demo.com', first_name: 'Alex', last_name: 'Kim', department: 'Engineering', role: 'Employee' },
  { email: 'emp2@demo.com', first_name: 'Jordan', last_name: 'Lee', department: 'Engineering', role: 'Employee' },
  { email: 'emp3@demo.com', first_name: 'Taylor', last_name: 'Nguyen', department: 'Marketing', role: 'Employee' },
  { email: 'emp4@demo.com', first_name: 'Morgan', last_name: 'Patel', department: 'Sales', role: 'Employee' },
  { email: 'emp5@demo.com', first_name: 'Casey', last_name: 'Brown', department: 'Support', role: 'Employee' },
  { email: 'emp6@demo.com', first_name: 'Riley', last_name: 'Davis', department: 'HR', role: 'Employee' },
  { email: 'emp7@demo.com', first_name: 'Sam', last_name: 'Wilson', department: 'Legal', role: 'Employee' },
];

const ASSET_NAMES = [
  'MacBook Pro 16"', 'MacBook Air M3', 'Dell Latitude 7440', 'ThinkPad X1 Carbon',
  'HP EliteBook 840', 'UltraWide Monitor 34"', '4K Display 27"', 'iPhone 15 Pro',
  'Samsung Galaxy S24', 'Cisco Catalyst Switch', 'Meraki MR46 AP', 'Logitech MX Master 3S',
  'Ergonomic Desk Chair', 'Standing Desk Pro', 'Windows Server License', 'Adobe Creative Cloud',
  'Zoom Room Kit', 'Biometric Access Reader', 'NAS Storage Array', 'UPS Battery Backup',
];

const STATUSES = ['Available', 'Allocated', 'Under Maintenance', 'Retired'] as const;
const REQUEST_STATUSES = REQUEST_STATUS_OPTIONS.map((o) => o.value);
const PRIORITIES = ['Low', 'Medium', 'High'] as const;

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

export async function seedDemoDataAction(): Promise<{ success?: boolean; error?: string; summary?: string }> {
  try {
    const { profile } = await getSessionUser();
    if (!profile || !canManageUsers(profile.role)) {
      return { error: 'Unauthorized: Admin access required to seed demo data.' };
    }

    await supabaseAdmin.from('asset_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('maintenance_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('asset_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('assets').delete().neq('asset_tag', '__none__');
    await supabaseAdmin.from('vendors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('asset_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Upsert demo users (no auth_id required for assessment)
    for (const u of DEMO_USERS) {
      await supabaseAdmin.from('users').upsert(
        { ...u, auth_id: null },
        { onConflict: 'email', ignoreDuplicates: false }
      );
    }

    const { data: categories, error: catErr } = await supabaseAdmin
      .from('asset_categories')
      .insert(CATEGORIES.map((name) => ({ name })))
      .select('id, name');
    if (catErr) throw new Error(`Categories: ${catErr.message}`);

    const vendorRows: { id: string; name: string }[] = [];
    for (const v of VENDORS) {
      const { data, error: vErr } = await insertVendorRow(v);
      if (vErr) throw new Error(`Vendors: ${vErr.message}`);
      if (data) vendorRows.push({ id: data.id, name: data.name });
    }
    const vendors = vendorRows;

    const { data: users, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name')
      .limit(20);
    if (userErr) throw new Error(`Users: ${userErr.message}`);

    const userIds = users?.map((u) => u.id) ?? [];

    const assetsPayload = Array.from({ length: 20 }, (_, i) => {
      const status = pick(STATUSES, i);
      const hasEmployee = status === 'Allocated' && userIds.length > 0;
      return {
        asset_tag: `AST-${String(1001 + i).padStart(4, '0')}`,
        name: `${pick(ASSET_NAMES, i)} #${i + 1}`,
        category_id: pick(categories!, i).id,
        vendor_id: pick(vendors!, i).id,
        assigned_employee_id: hasEmployee ? pick(userIds, i) : null,
        cost: Math.round((800 + (i * 137) % 4200) * 100) / 100,
        purchase_date: daysAgo(30 + (i * 7) % 700),
        warranty_expiry: daysAgo(-(90 + (i * 13) % 730)),
        status,
        notes: i % 3 === 0 ? 'Enterprise procurement — standard warranty included.' : null,
        created_at: monthsAgo(6 - (i % 6)),
      };
    });

    const { data: assets, error: assetErr } = await supabaseAdmin
      .from('assets')
      .insert(assetsPayload)
      .select('id, asset_tag, name, assigned_employee_id');
    if (assetErr) throw new Error(`Assets: ${assetErr.message}`);

    const allocationRows = (assets ?? [])
      .filter((a) => a.assigned_employee_id)
      .map((a) => ({
        asset_id: a.id,
        user_id: a.assigned_employee_id,
        notes: `Initial allocation for ${a.asset_tag}`,
      }));
    if (allocationRows.length) {
      await supabaseAdmin.from('asset_allocations').insert(allocationRows);
    }

    const requestJustifications = [
      'MacBook Pro for Engineering — New hire onboarding for backend team',
      'Dual Monitor Setup — Design team productivity improvement',
      'Ergonomic Chair Request — Health & safety compliance for remote worker',
      'Mobile Device Upgrade — Field sales team refresh cycle',
      'VPN Hardware Token — Secure remote access for finance analysts',
      'Conference Room AV Kit — Client presentation upgrades',
      'Standing Desk — Finance department ergonomic assessment',
      'Laptop Replacement — End-of-life device for operations lead',
      'Software License Renewal — Annual IDE subscription for dev team',
      'Network Switch — Floor 3 connectivity expansion project',
    ];

    const requestsPayload = requestJustifications.map((justification, i) => ({
      justification,
      status: pick(REQUEST_STATUSES, i),
      priority: pick(PRIORITIES, i + 2),
      requester_id: userIds.length ? pick(userIds, i) : null,
      created_at: monthsAgo(5 - (i % 5)),
    }));

    const { error: reqErr } = await insertAssetRequestRows(requestsPayload);
    if (reqErr) throw new Error(`Requests: ${reqErr.message}`);

    const maintPayload = Array.from({ length: 10 }, (_, i) => ({
      asset_id: pick(assets!, i).id,
      type: i % 3 === 0 ? 'Corrective' : 'Preventive',
      description: [
        'Annual hardware inspection and firmware update',
        'Screen replacement — hairline crack',
        'Battery health check and calibration',
        'Keyboard key replacement',
        'Fan cleaning and thermal paste refresh',
        'OS patch and security hardening',
        'Network adapter diagnostics',
        'Storage SMART test and defrag',
        'Docking station port repair',
        'Display calibration for color accuracy',
      ][i],
      cost: Math.round((50 + i * 87) * 100) / 100,
      vendor_id: pick(vendors!, i).id,
      scheduled_date: daysAgo(20 - i),
      completed_date: i < 7 ? daysAgo(10 - i) : null,
      performed_by: pick(['IT Ops', 'Dell ProSupport', 'Lenovo Premier', 'Internal Team'], i),
      notes: i % 2 === 0 ? 'Completed within SLA.' : null,
    }));

    const { error: maintErr } = await supabaseAdmin.from('maintenance_records').insert(maintPayload);
    if (maintErr) throw new Error(`Maintenance: ${maintErr.message}`);

    const notifPayload = [
      { title: 'Warranty expiring soon', message: '5 assets have warranties expiring within 90 days.', read: false },
      { title: 'Pending approvals', message: '4 asset requests awaiting manager approval.', read: false },
      { title: 'Maintenance scheduled', message: 'Preventive maintenance window opens Monday 09:00.', read: true },
      { title: 'New vendor onboarded', message: 'Samsung Business added to vendor directory.', read: true },
      { title: 'Allocation complete', message: 'MacBook Pro AST-1003 assigned to Engineering.', read: false },
      { title: 'Audit compliance', message: 'Quarterly audit log export ready.', read: true },
      { title: 'Budget threshold', message: 'Hardware spend at 78% of quarterly allocation.', read: false },
      { title: 'Retired assets', message: '2 assets marked Retired — schedule disposal.', read: true },
    ].map((n) => ({ ...n, created_at: monthsAgo(0) }));

    const { error: notifErr } = await supabaseAdmin.from('notifications').insert(notifPayload);
    if (notifErr) throw new Error(`Notifications: ${notifErr.message}`);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard/reports');
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/vendors');
    revalidatePath('/dashboard/users');

    return {
      success: true,
      summary: `Seeded ${categories?.length} categories, ${vendors?.length} vendors, ${users?.length ?? 0} users, ${assets?.length} assets, 10 requests, 10 maintenance records, ${notifPayload.length} notifications.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Seed failed';
    console.error('seedDemoDataAction:', message);
    return { error: message };
  }
}
