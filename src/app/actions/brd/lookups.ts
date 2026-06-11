'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { PROCUREMENT_ELIGIBLE_STATUSES } from '@/lib/constants/request-status';
import { fetchVendorOptions, type VendorOption } from '@/lib/supabase/vendor-lookups-server';
import { requireBrdRole } from './_auth';

export async function listVendorOptionsAction() {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) return { error: auth.error, data: [] as VendorOption[] };

  const result = await fetchVendorOptions();
  if (result.error) return { error: result.error, data: [] as VendorOption[] };

  return { data: result.data };
}

export async function getBrdFormLookupsAction() {
  try {
    const auth = await requireBrdRole(['Admin', 'Manager', 'Employee']);
    if (auth.error) return { error: auth.error, vendors: [] as VendorOption[] };

    const [assets, users, vendorResult, categories, requests, procurements] = await Promise.all([
      supabaseAdmin.from('assets').select('id, name, asset_tag').order('asset_tag'),
      supabaseAdmin.from('users').select('id, first_name, last_name, department').order('first_name'),
      fetchVendorOptions(),
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
      vendors: vendorResult.data,
      categories: categories.data ?? [],
      requests: allRequests,
      procurementRequests: procurementEligible,
      procurements: procurements.data ?? [],
      error: [assets.error, users.error, vendorResult.error, categories.error, requests.error, procurements.error]
        .filter(Boolean)
        .map((e) => (typeof e === 'string' ? e : e!.message))
        .join('; ') || undefined,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to load form lookups',
      vendors: [] as VendorOption[],
    };
  }
}
