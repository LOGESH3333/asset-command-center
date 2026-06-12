'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireBrdRole } from './_auth';
import { createBrdNotification } from '@/lib/brd/notify';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';
import type { AssetDisposal } from '@/lib/brd/types';

const DISPOSAL_LIST_SELECT = '*, assets(id, name, asset_tag)';

function revalidateDisposals() {
  revalidatePath('/dashboard/disposals');
  revalidatePath('/dashboard/assets');
}

export async function listDisposalsAction(params: {
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) {
    return { error: auth.error, data: [] as AssetDisposal[], total: 0 };
  }

  const { status, page = 1, pageSize = 10 } = params;
  let query = supabaseAdmin
    .from('asset_disposals')
    .select(DISPOSAL_LIST_SELECT, { count: 'exact' });

  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  console.log('[disposal-list] raw Supabase response', {
    table: 'asset_disposals',
    statusFilter: status ?? 'ALL',
    error: error
      ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        }
      : null,
    count,
    rowCount: data?.length ?? 0,
    data,
  });

  if (error) {
    return {
      error: formatAuditTriggerDbError(error.message),
      data: [] as AssetDisposal[],
      total: 0,
    };
  }

  return { data: (data as AssetDisposal[]) ?? [], total: count ?? 0 };
}

export async function getDisposalAction(id: string) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) {
    return { error: auth.error, data: null as AssetDisposal | null };
  }

  const { data, error } = await supabaseAdmin
    .from('asset_disposals')
    .select(DISPOSAL_LIST_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return { error: formatAuditTriggerDbError(error.message), data: null };
  }
  if (!data) {
    return { error: 'Disposal request not found.', data: null };
  }

  return { data: data as AssetDisposal, error: undefined };
}

export async function listDisposalMetricsAction() {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) {
    return { error: auth.error, data: [] as AssetDisposal[] };
  }

  const { data, error, count } = await supabaseAdmin
    .from('asset_disposals')
    .select('id, status, disposal_method, salvage_value, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  console.log('[disposal-metrics] raw Supabase response', {
    table: 'asset_disposals',
    error: error
      ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        }
      : null,
    count,
    rowCount: data?.length ?? 0,
    data,
  });

  if (error) {
    return {
      error: formatAuditTriggerDbError(error.message),
      data: [] as AssetDisposal[],
    };
  }

  return { data: (data as AssetDisposal[]) ?? [] };
}

export async function createDisposalAction(input: {
  asset_id: string;
  reason: string;
  disposal_method?: string | null;
  disposal_date?: string | null;
  salvage_value?: number | null;
  notes?: string | null;
}) {
  const auth = await requireBrdRole(['Admin', 'Manager', 'Employee']);
  if (auth.error) return { error: auth.error };

  if (!input.asset_id || !input.reason?.trim()) {
    return { error: 'Asset and reason are required.' };
  }

  const { data, error } = await supabaseAdmin
    .from('asset_disposals')
    .insert([
      {
        asset_id: input.asset_id,
        reason: input.reason.trim(),
        disposal_method: input.disposal_method || null,
        disposal_date: input.disposal_date || null,
        salvage_value: input.salvage_value ?? null,
        notes: input.notes?.trim() || null,
        requested_by: auth.profile?.id ?? null,
        status: 'Pending',
      },
    ])
    .select('id')
    .single();

  if (error) return { error: formatAuditTriggerDbError(error.message) };

  await createBrdNotification({
    title: 'Disposal requested',
    message: 'A new asset disposal request requires review.',
  });

  revalidateDisposals();
  return { success: true, id: data?.id };
}

export async function decideDisposalAction(
  id: string,
  decision: 'Approved' | 'Rejected' | 'Completed'
) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) return { error: auth.error };

  const { data: disposal, error } = await supabaseAdmin
    .from('asset_disposals')
    .update({
      status: decision,
      approved_by: auth.profile?.id ?? null,
      disposal_date: decision === 'Completed' ? new Date().toISOString().slice(0, 10) : undefined,
    })
    .eq('id', id)
    .select('asset_id')
    .single();

  if (error) return { error: formatAuditTriggerDbError(error.message) };

  if (decision === 'Completed' && disposal?.asset_id) {
    await supabaseAdmin
      .from('assets')
      .update({ status: 'Retired', assigned_employee_id: null })
      .eq('id', disposal.asset_id);
  }

  await createBrdNotification({
    title: `Disposal ${decision.toLowerCase()}`,
    message: `Asset disposal request has been ${decision.toLowerCase()}.`,
  });

  revalidateDisposals();
  return { success: true };
}

export async function deleteDisposalAction(id: string) {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) return { error: auth.error };

  const { error } = await supabaseAdmin.from('asset_disposals').delete().eq('id', id);
  if (error) return { error: formatAuditTriggerDbError(error.message) };

  revalidateDisposals();
  return { success: true };
}

export async function getDisposalLookupsAction() {
  try {
    const auth = await requireBrdRole(['Admin', 'Manager', 'Employee']);
    if (auth.error) return { assets: [], error: auth.error };

    const [assets, users] = await Promise.all([
      supabaseAdmin.from('assets').select('id, name, asset_tag').order('asset_tag'),
      supabaseAdmin.from('users').select('id, first_name, last_name').order('first_name'),
    ]);
    return {
      assets: (assets.data ?? []).filter((a) => a.id),
      error: assets.error?.message || users.error?.message,
    };
  } catch (err) {
    return {
      assets: [],
      error: err instanceof Error ? err.message : 'Failed to load disposal lookups',
    };
  }
}
