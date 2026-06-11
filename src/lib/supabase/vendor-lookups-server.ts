import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';

export type VendorOption = {
  id: string;
  name: string;
};

/** Load vendor dropdown options via service role (bypasses client RLS). */
export async function fetchVendorOptions(): Promise<{
  data: VendorOption[];
  error?: string;
}> {
  const { data, error } = await supabaseAdmin
    .from('vendors')
    .select('id, name')
    .not('name', 'is', null)
    .neq('name', '')
    .order('name');

  if (error) {
    return { data: [], error: formatAuditTriggerDbError(error.message) };
  }

  const vendors = (data ?? [])
    .filter((row): row is { id: string; name: string } => Boolean(row.id && row.name?.trim()))
    .map((row) => ({ id: row.id, name: row.name.trim() }));

  return { data: vendors };
}
