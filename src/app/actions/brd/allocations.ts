'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireBrdRole } from './_auth';
import { createBrdNotification } from '@/lib/brd/notify';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';
import { REQUEST_STATUS } from '@/lib/constants/request-status';
import { createAssetAllocationRow } from '@/lib/brd/allocation-create';
import type { AssetAllocation } from '@/lib/brd/types';

function revalidateAllocations() {
  revalidatePath('/dashboard/allocations');
  revalidatePath('/dashboard');
}

function formatAllocationDbError(message: string) {
  if (message.includes('allocated_at') && message.includes('does not exist')) {
    return 'Database schema is missing allocation columns. Run supabase/migrations/008_asset_allocations_columns.sql in the Supabase SQL Editor, then try again.';
  }
  return formatAuditTriggerDbError(message);
}

const ALLOCATION_LIST_SELECT =
  '*, assets(id, name, asset_tag), users:user_id(id, first_name, last_name)';

export async function listAllocationsAction(params: {
  status?: string;
  page?: number;
  pageSize?: number;
  userId?: string;
} = {}) {
  const auth = await requireBrdRole(['Admin', 'Manager', 'Employee']);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? 'Unauthorized', data: [] as AssetAllocation[], total: 0 };
  }

  const { status, page = 1, pageSize = 10 } = params;
  const userId = auth.profile.role === 'Employee' ? auth.profile.id : params.userId;
  let query = supabaseAdmin
    .from('asset_allocations')
    .select(ALLOCATION_LIST_SELECT, { count: 'exact' });

  if (userId) query = query.eq('user_id', userId);
  if (status && status !== 'ALL') query = query.eq('status', status);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('allocated_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) {
    return { error: formatAllocationDbError(error.message), data: [] as AssetAllocation[], total: 0 };
  }

  return { data: (data as AssetAllocation[]) ?? [], total: count ?? 0 };
}

export async function getAllocationAction(id: string) {
  const auth = await requireBrdRole(['Admin', 'Manager', 'Employee']);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? 'Unauthorized', data: null as AssetAllocation | null };
  }

  const { data, error } = await supabaseAdmin
    .from('asset_allocations')
    .select(ALLOCATION_LIST_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return { error: formatAllocationDbError(error.message), data: null };
  }
  if (!data) {
    return { error: 'Allocation not found.', data: null };
  }

  if (
    auth.profile.role === 'Employee' &&
    data.user_id !== auth.profile.id
  ) {
    return { error: 'You do not have permission to view this allocation.', data: null };
  }

  return { data: data as AssetAllocation, error: undefined };
}

export async function listAllocationMetricsAction(params: { userId?: string } = {}) {
  const auth = await requireBrdRole(['Admin', 'Manager', 'Employee']);
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? 'Unauthorized', data: [] as AssetAllocation[] };
  }

  const userId = auth.profile.role === 'Employee' ? auth.profile.id : params.userId;
  let query = supabaseAdmin
    .from('asset_allocations')
    .select('id, status, acknowledged_at, created_at, allocated_at')
    .order('allocated_at', { ascending: false })
    .limit(500);

  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) {
    return { error: formatAllocationDbError(error.message), data: [] as AssetAllocation[] };
  }

  return { data: (data as AssetAllocation[]) ?? [] };
}

export async function getAllocationFormLookupsAction(requestId?: string | null) {
  try {
    const auth = await requireBrdRole(['Admin', 'Manager']);
    if (auth.error) return { assets: [], users: [], request: null, error: auth.error };

    let request: {
      id: string;
      justification: string;
      status: string;
      requester_id: string | null;
    } | null = null;

    if (requestId) {
      const { data, error } = await supabaseAdmin
        .from('asset_requests')
        .select('id, justification, status, requester_id')
        .eq('id', requestId)
        .maybeSingle();
      if (error) return { assets: [], users: [], request: null, error: error.message };
      request = data;
    }

    let assetsQuery = supabaseAdmin
      .from('assets')
      .select('id, name, asset_tag, status, request_id')
      .not('id', 'is', null)
      .order('asset_tag');

    if (requestId) {
      assetsQuery = assetsQuery.eq('request_id', requestId);
    } else {
      assetsQuery = assetsQuery.eq('status', 'Available');
    }

    const [assets, users] = await Promise.all([
      assetsQuery,
      supabaseAdmin
        .from('users')
        .select('id, first_name, last_name, department, email')
        .not('id', 'is', null)
        .order('first_name'),
    ]);

    const assetError = assets.error?.message;
    const userError = users.error?.message;

    return {
      assets: assets.data ?? [],
      users: users.data ?? [],
      request,
      error: [assetError, userError].filter(Boolean).join('; ') || undefined,
    };
  } catch (err) {
    return {
      assets: [],
      users: [],
      request: null,
      error: err instanceof Error ? err.message : 'Failed to load allocation lookups',
    };
  }
}

export async function createAllocationAction(input: {
  asset_id: string;
  user_id: string;
  notes?: string | null;
}) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) return { error: auth.error };

  if (!input.asset_id || !input.user_id) {
    return { error: 'Asset and employee are required.' };
  }

  const allocation = await createAssetAllocationRow(input);
  if (allocation.error) return { error: allocation.error };
  if (!allocation.data) return { error: 'Allocation was not created.' };

  await createBrdNotification({
    userId: input.user_id,
    title: 'Asset allocated',
    message: 'An asset has been assigned to you. Please acknowledge receipt.',
  });

  revalidateAllocations();
  return { success: true, id: allocation.data.id };
}

export async function returnAllocationAction(id: string) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) return { error: auth.error };

  const { data: alloc } = await supabaseAdmin
    .from('asset_allocations')
    .select('asset_id')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin
    .from('asset_allocations')
    .update({ returned_at: new Date().toISOString(), status: 'Returned' })
    .eq('id', id);

  if (error) return { error: formatAllocationDbError(error.message) };

  if (alloc?.asset_id) {
    await supabaseAdmin
      .from('assets')
      .update({ assigned_employee_id: null, status: 'Available' })
      .eq('id', alloc.asset_id);
  }

  await createBrdNotification({
    title: 'Asset returned',
    message: 'An asset allocation has been marked as returned.',
  });

  revalidateAllocations();
  return { success: true };
}

export async function acknowledgeAllocationAction(id: string) {
  const auth = await requireBrdRole(['Admin', 'Manager', 'Employee']);
  if (auth.error || !auth.profile) return { error: auth.error ?? 'Unauthorized' };

  const { data: allocation, error: loadError } = await supabaseAdmin
    .from('asset_allocations')
    .select('id, user_id, acknowledged_at')
    .eq('id', id)
    .single();

  if (loadError || !allocation) return { error: 'Allocation not found.' };
  if (allocation.acknowledged_at) return { error: 'Allocation already acknowledged.' };

  const isAllocatee = allocation.user_id === auth.profile.id;
  const canManageOnBehalf =
    auth.profile.role === 'Super_Admin' ||
    auth.profile.role === 'Admin' ||
    auth.profile.role === 'Manager';
  if (auth.profile.role === 'Employee' && !isAllocatee) {
    return { error: 'You can only acknowledge allocations assigned to you.' };
  }
  if (!isAllocatee && !canManageOnBehalf) {
    return { error: 'Unauthorized' };
  }

  const { error } = await supabaseAdmin
    .from('asset_allocations')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: auth.profile.id,
    })
    .eq('id', id);

  if (error) return { error: formatAllocationDbError(error.message) };

  const { data: alloc } = await supabaseAdmin
    .from('asset_allocations')
    .select('asset_id')
    .eq('id', id)
    .single();

  if (alloc?.asset_id) {
    const { data: asset } = await supabaseAdmin
      .from('assets')
      .select('request_id')
      .eq('id', alloc.asset_id)
      .single();

    if (asset?.request_id) {
      await supabaseAdmin
        .from('asset_requests')
        .update({
          status: REQUEST_STATUS.FULFILLED,
          fulfilled_at: new Date().toISOString(),
        })
        .eq('id', asset.request_id);
      revalidatePath('/dashboard/requests');
    }
  }

  await createBrdNotification({
    title: 'Allocation acknowledged',
    message: `${auth.profile.first_name} ${auth.profile.last_name} acknowledged an asset allocation.`,
  });

  revalidateAllocations();
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteAllocationAction(id: string) {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) return { error: auth.error };

  const { error } = await supabaseAdmin.from('asset_allocations').delete().eq('id', id);
  if (error) return { error: formatAllocationDbError(error.message) };

  revalidateAllocations();
  return { success: true };
}
