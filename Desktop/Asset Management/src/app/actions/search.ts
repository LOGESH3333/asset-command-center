'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { canAccessRoute } from '@/lib/auth/permissions';

export type SearchResultGroup = {
  label: string;
  items: { id: string; title: string; subtitle?: string; href: string }[];
};

export async function globalSearchAction(query: string): Promise<{
  groups: SearchResultGroup[];
  error?: string;
}> {
  const q = query.trim();
  if (q.length < 2) return { groups: [] };

  const { profile } = await getSessionUser();
  if (!profile) return { groups: [], error: 'Not authenticated' };

  const pattern = `%${q}%`;
  const groups: SearchResultGroup[] = [];

  const maybeAdd = async (
    label: string,
    route: string,
    fetcher: () => Promise<SearchResultGroup['items']>
  ) => {
    if (!canAccessRoute(profile.role, route)) return;
    const items = await fetcher();
    if (items.length) groups.push({ label, items });
  };

  await maybeAdd('Assets', '/dashboard/assets', async () => {
    const { data } = await supabaseAdmin
      .from('assets')
      .select('id, asset_tag, name, status')
      .or(`asset_tag.ilike.${pattern},name.ilike.${pattern}`)
      .limit(5);
    return (data ?? []).map((a) => ({
      id: a.id,
      title: a.name,
      subtitle: a.asset_tag,
      href: `/dashboard/assets/${a.asset_tag}`,
    }));
  });

  await maybeAdd('Inventory', '/dashboard/inventory', async () => {
    const { data } = await supabaseAdmin
      .from('inventory')
      .select('id, name, sku')
      .or(`name.ilike.${pattern},sku.ilike.${pattern}`)
      .limit(5);
    return (data ?? []).map((i) => ({
      id: i.id,
      title: i.name,
      subtitle: i.sku ?? undefined,
      href: `/dashboard/inventory/${i.id}`,
    }));
  });

  await maybeAdd('Requests', '/dashboard/requests', async () => {
    const { data } = await supabaseAdmin
      .from('asset_requests')
      .select('id, justification, status')
      .ilike('justification', pattern)
      .limit(5);
    return (data ?? []).map((r) => ({
      id: r.id,
      title: r.justification?.slice(0, 60) ?? 'Request',
      subtitle: r.status,
      href: `/dashboard/requests/${r.id}`,
    }));
  });

  await maybeAdd('Vendors', '/dashboard/vendors', async () => {
    const { data } = await supabaseAdmin
      .from('vendors')
      .select('id, name, email')
      .ilike('name', pattern)
      .limit(5);
    return (data ?? []).map((v) => ({
      id: v.id,
      title: v.name,
      subtitle: v.email ?? undefined,
      href: `/dashboard/vendors/${v.id}`,
    }));
  });

  await maybeAdd('Team', '/dashboard/users', async () => {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email, department')
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},department.ilike.${pattern}`)
      .limit(5);
    return (data ?? []).map((u) => ({
      id: u.id,
      title: `${u.first_name} ${u.last_name}`.trim(),
      subtitle: u.department ?? u.email,
      href: `/dashboard/users/${u.id}`,
    }));
  });

  await maybeAdd('Procurement', '/dashboard/procurement', async () => {
    const { data } = await supabaseAdmin
      .from('procurements')
      .select('id, title, status')
      .ilike('title', pattern)
      .limit(5);
    return (data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.status,
      href: `/dashboard/procurement/${p.id}`,
    }));
  });

  await maybeAdd('Purchase Orders', '/dashboard/purchase-orders', async () => {
    const { data } = await supabaseAdmin
      .from('purchase_orders')
      .select('id, po_number, status')
      .ilike('po_number', pattern)
      .limit(5);
    return (data ?? []).map((p) => ({
      id: p.id,
      title: p.po_number,
      subtitle: p.status,
      href: `/dashboard/purchase-orders/${p.id}`,
    }));
  });

  return { groups };
}
