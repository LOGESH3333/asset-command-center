'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireBrdRole } from './_auth';
import { createBrdNotification } from '@/lib/brd/notify';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';
import { REQUEST_STATUS } from '@/lib/constants/request-status';

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

export async function getAllocationFormLookupsAction() {
  const [assets, users] = await Promise.all([
    supabaseAdmin
      .from('assets')
      .select('id, name, asset_tag, status')
      .eq('status', 'Available')
      .not('id', 'is', null)
      .order('asset_tag'),
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
    error: [assetError, userError].filter(Boolean).join('; ') || undefined,
  };
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

  const { data, error } = await supabaseAdmin
    .from('asset_allocations')
    .insert([
      {
        asset_id: input.asset_id,
        user_id: input.user_id,
        notes: input.notes?.trim() || null,
        status: 'Active',
        allocated_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single();

  if (error) return { error: formatAllocationDbError(error.message) };

  await supabaseAdmin
    .from('assets')
    .update({ assigned_employee_id: input.user_id, status: 'Allocated' })
    .eq('id', input.asset_id);

  await createBrdNotification({
    userId: input.user_id,
    title: 'Asset allocated',
    message: 'An asset has been assigned to you. Please acknowledge receipt.',
  });

  revalidateAllocations();
  return { success: true, id: data?.id };
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
