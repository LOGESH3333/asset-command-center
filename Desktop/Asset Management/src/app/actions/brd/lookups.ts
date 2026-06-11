'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { PROCUREMENT_ELIGIBLE_STATUSES } from '@/lib/constants/request-status';

export async function getBrdFormLookupsAction() {
  const [assets, users, vendors, categories, requests, procurements] = await Promise.all([
    supabaseAdmin.from('assets').select('id, name, asset_tag').order('asset_tag'),
    supabaseAdmin.from('users').select('id, first_name, last_name, department').order('first_name'),
    supabaseAdmin.from('vendors').select('id, name').order('name'),
    supabaseAdmin.from('asset_categories').select('id, name').order('name'),
    supabaseAdmin.from('asset_requests').select('id, justification, status').order('created_at', { ascending: false }),
    supabaseAdmin.from('procurements').select('id, title, status').order('created_at', { ascending: false }),
  ]);

  const allRequests = requests.data ?? [];
  const procurementEligible = allRequests.filter((r) =>
    (PROCUREMENT_ELIGIBLE_STATUSES as string[]).includes(r.status)
  );

  return {
    assets: (assets.data ?? []).filter((a) => a.id),
    users: users.data ?? [],
    vendors: vendors.data ?? [],
    categories: categories.data ?? [],
    requests: allRequests,
    procurementRequests: procurementEligible,
    procurements: procurements.data ?? [],
    error: [assets.error, users.error, vendors.error, categories.error, requests.error, procurements.error]
      .filter(Boolean)
      .map((e) => e!.message)
      .join('; ') || undefined,
  };
}
